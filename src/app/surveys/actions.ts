"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { allocateDocumentNumber } from "@/lib/numbering";
import { isValidEmailAddress } from "@/lib/email-recipients";
import { loadClientSecondaryEmail } from "@/lib/client-secondary-email";
import { insertClientRow } from "@/lib/client-create";
import { insertInvoiceWithItems } from "@/lib/invoice-create";
import { createScheduleEventWithGoogle } from "@/lib/schedule-create";
import { emailInvoiceToClient } from "@/lib/invoice-email";
import { getLondonDateKey } from "@/lib/dates";
import {
  SURVEY_EVENT_TYPE,
  SURVEY_INVOICE_TITLE,
  SURVEY_INVOICE_TYPE,
  SURVEY_JOB_STATUS,
  SURVEY_JOB_STATUS_FALLBACK,
  SURVEY_JOB_TYPE,
  SURVEY_JOB_TYPE_FALLBACK,
  SURVEY_PAYMENT_TERMS,
  buildSurveyBookedNotice,
  buildSurveyItemDescription,
  buildSurveyJobTitle,
  formatAddress,
  formatSurveyWhen,
  isEndAfterStart,
  isValidDateKey,
  isValidTime,
  parseSurveyFee,
  type AddressParts,
  type BookSurveyState,
  type SurveyClientOption,
  type SurveyEmailOutcome,
} from "@/lib/survey";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type PostgrestLikeError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
} | null;

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function textOrNull(formData: FormData, name: string) {
  return text(formData, name) || null;
}

function errorText(error: PostgrestLikeError) {
  return [error?.message, error?.details]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/* A value rejected by a check constraint or an enum type. */
function isRejectedValue(error: PostgrestLikeError) {
  return error?.code === "23514" || error?.code === "22P02";
}

function isMissingColumn(error: PostgrestLikeError, column: string) {
  return (
    (error?.code === "42703" || error?.code === "PGRST204") &&
    errorText(error).includes(column)
  );
}

/* =========================================================
   JOB INSERT
   Tries job_type "Damp Survey" and status "Survey Booked" first and
   falls back to "Other" / "Enquiry" if the database rejects them.
   ========================================================= */

async function insertSurveyJob(
  supabase: SupabaseServerClient,
  base: Record<string, unknown>,
  surveyDate: string
) {
  let jobType = SURVEY_JOB_TYPE;
  let status = SURVEY_JOB_STATUS;
  let includeSurveyDate = true;
  let lastError: PostgrestLikeError = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from("jobs")
      .insert({
        ...base,
        job_type: jobType,
        status,
        ...(includeSurveyDate ? { survey_date: surveyDate } : {}),
      })
      .select("id, job_number")
      .single();

    if (!error && data) {
      return {
        job: data as { id: string; job_number: string | null },
        jobType,
        status,
      };
    }

    lastError = error;

    if (isRejectedValue(error)) {
      const message = errorText(error);

      if (
        message.includes("status") &&
        status !== SURVEY_JOB_STATUS_FALLBACK
      ) {
        status = SURVEY_JOB_STATUS_FALLBACK;
        continue;
      }

      if (jobType !== SURVEY_JOB_TYPE_FALLBACK) {
        jobType = SURVEY_JOB_TYPE_FALLBACK;
        continue;
      }

      if (status !== SURVEY_JOB_STATUS_FALLBACK) {
        status = SURVEY_JOB_STATUS_FALLBACK;
        continue;
      }
    }

    if (includeSurveyDate && isMissingColumn(error, "survey_date")) {
      includeSurveyDate = false;
      continue;
    }

    break;
  }

  console.error("Survey job save error:", lastError);

  return { job: null, jobType, status };
}

/* =========================================================
   CLIENT
   ========================================================= */

type ClientRecord = AddressParts & {
  id: string;
  name: string;
  email: string | null;
};

function clientName(client: {
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
}) {
  return (
    client.display_name ||
    [client.first_name, client.last_name].filter(Boolean).join(" ") ||
    client.company_name ||
    "Client"
  );
}

/* =========================================================
   BOOK SURVEY
   ========================================================= */

export async function bookSurvey(
  _previous: BookSurveyState,
  formData: FormData
): Promise<BookSurveyState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  /* -------------------------------------------------------
     READ + VALIDATE EVERYTHING BEFORE CREATING ANYTHING
     ------------------------------------------------------- */

  const clientMode = text(formData, "client_mode") === "new" ? "new" : "existing";
  const existingClientId = text(formData, "client_id");

  const newClient = {
    display_name: text(formData, "new_client_name"),
    email: text(formData, "new_client_email").toLowerCase() || null,
    secondary_email:
      text(formData, "new_client_secondary_email").toLowerCase() || null,
    phone: textOrNull(formData, "new_client_phone"),
    address_line_1: textOrNull(formData, "new_client_address_line_1"),
    address_line_2: textOrNull(formData, "new_client_address_line_2"),
    town: textOrNull(formData, "new_client_town"),
    county: textOrNull(formData, "new_client_county"),
    postcode: text(formData, "new_client_postcode").toUpperCase() || null,
  };

  if (clientMode === "existing" && !existingClientId) {
    return { error: "Please search for and choose a client, or add a new client." };
  }

  if (clientMode === "new") {
    if (!newClient.display_name) {
      return { error: "Please enter the new client's name." };
    }

    if (newClient.email && !isValidEmailAddress(newClient.email)) {
      return { error: "Please enter a valid email address for the new client." };
    }

    if (
      newClient.secondary_email &&
      !isValidEmailAddress(newClient.secondary_email)
    ) {
      return { error: "Please enter a valid secondary email address." };
    }
  }

  const differentAddress = formData.get("different_address") === "on";

  const enteredSite: AddressParts = {
    address_line_1: textOrNull(formData, "site_address_line_1"),
    address_line_2: textOrNull(formData, "site_address_line_2"),
    town: textOrNull(formData, "site_town"),
    county: textOrNull(formData, "site_county"),
    postcode: text(formData, "site_postcode").toUpperCase() || null,
  };

  if (
    differentAddress &&
    !enteredSite.address_line_1 &&
    !enteredSite.postcode
  ) {
    return { error: "Please enter the survey address (at least the first line or postcode)." };
  }

  const surveyDate = text(formData, "survey_date");
  const startTime = text(formData, "start_time").slice(0, 5);
  const endTime = text(formData, "end_time").slice(0, 5);

  if (!isValidDateKey(surveyDate)) {
    return { error: "Please choose the survey date." };
  }

  if (!isValidTime(startTime)) {
    return { error: "Please choose the survey start time." };
  }

  if (!isValidTime(endTime) || !isEndAfterStart(startTime, endTime)) {
    return { error: "The end time must be after the start time." };
  }

  const fee = parseSurveyFee(text(formData, "survey_fee"));

  if (fee === null) {
    return { error: "Please enter the survey fee in pounds, e.g. 250 or 250.00." };
  }

  const notes = textOrNull(formData, "notes");
  const sendEmail = formData.get("send_email") === "on";

  /* -------------------------------------------------------
     CLIENT
     ------------------------------------------------------- */

  let client: ClientRecord;
  let createdClient: SurveyClientOption | null = null;
  const created: string[] = [];

  if (clientMode === "existing") {
    const { data, error } = await supabase
      .from("clients")
      .select(`
        id,
        display_name,
        first_name,
        last_name,
        company_name,
        email,
        address_line_1,
        address_line_2,
        town,
        county,
        postcode
      `)
      .eq("id", existingClientId)
      .single();

    if (error || !data) {
      console.error("Survey client load error:", error);
      return { error: "That client could not be found. Nothing was created." };
    }

    client = {
      id: data.id,
      name: clientName(data),
      email: data.email,
      address_line_1: data.address_line_1,
      address_line_2: data.address_line_2,
      town: data.town,
      county: data.county,
      postcode: data.postcode,
    };
  } else {
    const { secondary_email: secondaryEmail, ...baseRow } = newClient;

    const inserted = await insertClientRow(supabase, baseRow, secondaryEmail);

    if (inserted.error || !inserted.clientId) {
      console.error("Survey client save error:", inserted.error);
      return { error: "The new client could not be saved. Nothing was created." };
    }

    client = {
      id: inserted.clientId,
      name: newClient.display_name,
      email: newClient.email,
      address_line_1: newClient.address_line_1,
      address_line_2: newClient.address_line_2,
      town: newClient.town,
      county: newClient.county,
      postcode: newClient.postcode,
    };

    createdClient = {
      id: inserted.clientId,
      name: newClient.display_name,
      company: null,
      email: newClient.email,
      secondaryEmail: inserted.secondaryEmailNotSaved ? null : secondaryEmail,
      phone: newClient.phone,
      addressLine1: newClient.address_line_1,
      addressLine2: newClient.address_line_2,
      town: newClient.town,
      county: newClient.county,
      postcode: newClient.postcode,
    };

    created.push(
      inserted.secondaryEmailNotSaved
        ? `client ${newClient.display_name} (the secondary email was not saved because the database is missing that column)`
        : `client ${newClient.display_name}`
    );

    revalidatePath("/clients");
  }

  const site: AddressParts = differentAddress
    ? enteredSite
    : {
        address_line_1: client.address_line_1 ?? null,
        address_line_2: client.address_line_2 ?? null,
        town: client.town ?? null,
        county: client.county ?? null,
        postcode: client.postcode ?? null,
      };

  const siteText = formatAddress(site) || null;
  const title = buildSurveyJobTitle(site);
  const when = formatSurveyWhen(surveyDate, startTime, endTime);

  /* -------------------------------------------------------
     JOB
     ------------------------------------------------------- */

  let jobNumber: string;

  try {
    jobNumber = await allocateDocumentNumber("job");
  } catch (error) {
    console.error("Survey job number error:", error);
    return {
      error: createdClient
        ? `Client ${createdClient.name} was added, but the job number could not be allocated, so the survey was not booked. The new client is now selected; please try again.`
        : "The job number could not be allocated. Nothing was created.",
      newClient: createdClient,
    };
  }

  const savedJob = await insertSurveyJob(
    supabase,
    {
      job_number: jobNumber,
      client_id: client.id,
      title,
      address_line_1: site.address_line_1 ?? null,
      address_line_2: site.address_line_2 ?? null,
      town: site.town ?? null,
      county: site.county ?? null,
      postcode: site.postcode ?? null,
      description: notes,
      notes: null,
    },
    surveyDate
  );

  if (!savedJob.job) {
    return {
      error: createdClient
        ? `Client ${createdClient.name} was added, but the survey job could not be saved, so nothing else was created. The new client is now selected; please try again.`
        : "The survey job could not be saved. Nothing was created.",
      newClient: createdClient,
    };
  }

  const job = savedJob.job;
  const jobLabel = job.job_number || jobNumber;
  created.push(`job ${jobLabel}`);

  const warnings: string[] = [];

  /* -------------------------------------------------------
     SCHEDULE (same path as the Schedule page, incl. Google copy)
     ------------------------------------------------------- */

  let scheduled = false;

  try {
    const event = await createScheduleEventWithGoogle(supabase, {
      job_id: job.id,
      contract_id: null,
      client_id: client.id,
      title: `${jobLabel} - ${title} (${client.name})`,
      event_type: SURVEY_EVENT_TYPE,
      status: "Scheduled",
      start_date: surveyDate,
      end_date: surveyDate,
      start_time: startTime,
      end_time: endTime,
      all_day: false,
      location: siteText,
      assigned_to: null,
      notes,
    });

    if (event.ok) {
      scheduled = true;

      if (event.googleNotice) {
        warnings.push(
          "The appointment is on the Schedule but could not be copied to Google Calendar."
        );
      }
    } else {
      warnings.push(
        "The Schedule appointment could not be created. Please add it from the Schedule page."
      );
    }
  } catch (error) {
    console.error("Survey schedule error:", error);
    warnings.push(
      "The Schedule appointment could not be created. Please add it from the Schedule page."
    );
  }

  /* -------------------------------------------------------
     INVOICE (shared invoice creation + numbering)
     ------------------------------------------------------- */

  const today = getLondonDateKey(new Date());
  let invoice: { id: string; invoiceNumber: string } | null = null;

  try {
    const createdInvoice = await insertInvoiceWithItems(
      supabase,
      {
        clientId: client.id,
        jobId: job.id,
        quoteId: null,
        contractId: null,
        invoiceType: SURVEY_INVOICE_TYPE,
        title: SURVEY_INVOICE_TITLE,
        description: siteText
          ? `Damp survey at ${siteText} on ${when}.`
          : `Damp survey on ${when}.`,
        invoiceDate: today,
        dueDate: today,
        customerMessage: null,
        paymentTerms: SURVEY_PAYMENT_TERMS,
        internalNotes: null,
        // Invoice form defaults: VAT off, 20% rate if turned on.
        vatEnabled: false,
        vatRate: 20,
      },
      [
        {
          description: buildSurveyItemDescription(surveyDate, startTime, site),
          quantity: 1,
          unit: "item",
          unit_price: fee,
          item_type: "Labour",
        },
      ]
    );

    invoice = {
      id: createdInvoice.id,
      invoiceNumber: createdInvoice.invoiceNumber,
    };
  } catch (error) {
    console.error("Survey invoice error:", error);
    warnings.push(
      `The invoice could not be created${
        error instanceof Error && error.message ? ` (${error.message})` : ""
      }, so nothing was emailed. Please create it from this job.`
    );
  }

  /* -------------------------------------------------------
     EMAIL (shared with the Email Invoice composer)
     ------------------------------------------------------- */

  let email: SurveyEmailOutcome = { status: "not-requested" };

  if (!invoice) {
    email = { status: "no-invoice" };
  } else if (sendEmail) {
    try {
      const secondaryEmail =
        clientMode === "existing"
          ? await loadClientSecondaryEmail(supabase, client.id)
          : createdClient?.secondaryEmail ?? null;

      if (!client.email && !secondaryEmail) {
        email = { status: "no-email" };
      } else {
        const result = await emailInvoiceToClient(supabase, invoice.id);

        if (result.status === "sent") {
          email = { status: "sent", recipients: result.recipients };

          if (result.warning) {
            warnings.push(result.warning);
          }
        } else if (result.status === "no-email") {
          email = { status: "no-email" };
        } else {
          email = { status: "failed", error: result.error };
        }
      }
    } catch (error) {
      console.error("Survey invoice email error:", error);
      email = { status: "failed", error: "unexpected error" };
    }
  }

  /* -------------------------------------------------------
     REFRESH + REDIRECT
     ------------------------------------------------------- */

  revalidatePath("/");
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${job.id}`);
  revalidatePath(`/clients/${client.id}`);
  revalidatePath("/invoices");

  if (scheduled) {
    revalidatePath("/schedule");
  }

  if (invoice) {
    revalidatePath(`/invoices/${invoice.id}`);
  }

  const notice = buildSurveyBookedNotice({
    when,
    invoiceNumber: invoice?.invoiceNumber ?? null,
    email,
  });

  if (warnings.length > 0) {
    warnings.push(`Created: ${created.join(", ")}${scheduled ? ", schedule appointment" : ""}${invoice ? `, invoice ${invoice.invoiceNumber}` : ""}.`);
  }

  const params = new URLSearchParams();
  params.set("survey_notice", notice);

  if (warnings.length > 0) {
    params.set("survey_warning", warnings.join(" "));
  }

  redirect(`/jobs/${job.id}?${params.toString()}`);
}
