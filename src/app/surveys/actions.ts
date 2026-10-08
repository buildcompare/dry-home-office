"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { allocateDocumentNumber } from "@/lib/numbering";
import { describeRecipients, isValidEmailAddress } from "@/lib/email-recipients";
import { loadClientSecondaryEmail } from "@/lib/client-secondary-email";
import { insertClientRow } from "@/lib/client-create";
import { calculateInvoiceTotals, insertInvoiceWithItems } from "@/lib/invoice-create";
import { applyInvoicePayment } from "@/lib/invoice-payment";
import { loadSurveyRecord } from "@/lib/survey-records";
import {
  createScheduleEventWithGoogle,
  removeScheduleEvent,
  updateScheduleEventWithGoogle,
} from "@/lib/schedule-create";
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
  safeSurveysPath,
  surveyFeeLock,
  withQueryParam,
  type AddressParts,
  type BookSurveyState,
  type SurveyClientOption,
  type SurveyEmailOutcome,
  type UpdateSurveyState,
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

/* Short, safe reason for a failed insert, e.g. " (check constraint …)". */
function describeDbError(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : error instanceof Error
        ? error.message
        : "";

  const cleaned = message.replace(/\s+/g, " ").trim().slice(0, 160);

  return cleaned ? ` (${cleaned})` : "";
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

    const reason =
      error instanceof Error && error.message
        ? ` (${error.message})`
        : "";

    /*
     * No invoice: remove the job again so there is no half-booked
     * survey. Nothing has been put on the Schedule yet.
     */
    const { error: rollbackError } = await supabase
      .from("jobs")
      .delete()
      .eq("id", job.id);

    if (rollbackError) {
      console.error("Survey job rollback error:", rollbackError);

      const params = new URLSearchParams();
      params.set(
        "warning",
        `The invoice could not be created${reason}, and job ${jobLabel} could not be removed again. It is not on the Schedule and nothing was emailed. Please delete or finish it from the job page.`
      );
      redirect(`/surveys/${job.id}?${params.toString()}`);
    }

    return {
      error: createdClient
        ? `The invoice could not be created${reason}, so the survey was not booked (the job was removed again; nothing was added to the Schedule or emailed). Client ${createdClient.name} was added and is now selected; please try again.`
        : `The invoice could not be created${reason}, so the survey was not booked. Nothing was saved, added to the Schedule or emailed.`,
      newClient: createdClient,
    };
  }

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
        `The survey could not be added to the Schedule${describeDbError(
          event.error
        )}. Use "Add to Schedule" below to try again.`
      );
    }
  } catch (error) {
    console.error("Survey schedule error:", error);
    warnings.push(
      `The survey could not be added to the Schedule${describeDbError(
        error
      )}. Use "Add to Schedule" below to try again.`
    );
  }

  /* -------------------------------------------------------
     EMAIL (shared with the Email Invoice composer)
     ------------------------------------------------------- */

  let email: SurveyEmailOutcome = { status: "not-requested" };

  if (sendEmail) {
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

  revalidatePath(`/invoices/${invoice.id}`);
  revalidatePath("/surveys");

  const notice = buildSurveyBookedNotice({
    when,
    invoiceNumber: invoice.invoiceNumber,
    email,
  });

  if (warnings.length > 0) {
    warnings.push(`Created: ${created.join(", ")}${scheduled ? ", schedule appointment" : ""}${`, invoice ${invoice.invoiceNumber}`}.`);
  }

  const params = new URLSearchParams();
  params.set("notice", notice);

  if (warnings.length > 0) {
    params.set("warning", warnings.join(" "));
  }

  redirect(`/surveys/${job.id}?${params.toString()}`);
}

/* =========================================================
   SURVEY PAGES: SHARED
   ========================================================= */

async function requireUser(supabase: SupabaseServerClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }
}

function refreshSurveyPages(
  jobId: string,
  extra: { clientId?: string | null; invoiceId?: string | null } = {}
) {
  revalidatePath("/");
  revalidatePath("/surveys");
  revalidatePath(`/surveys/${jobId}`);
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/schedule");
  revalidatePath("/invoices");

  if (extra.invoiceId) {
    revalidatePath(`/invoices/${extra.invoiceId}`);
  }

  if (extra.clientId) {
    revalidatePath(`/clients/${extra.clientId}`);
  }
}

function surveyEventTitle(
  jobNumber: string | null,
  title: string,
  clientName: string | null
) {
  return `${jobNumber ? `${jobNumber} - ` : ""}${title}${
    clientName ? ` (${clientName})` : ""
  }`;
}

/* =========================================================
   UPDATE SURVEY
   Order: Google Calendar + Schedule first (so a failed Google push
   changes nothing), then the job, then the invoice line if unpaid.
   ========================================================= */

export async function updateSurvey(
  _previous: UpdateSurveyState,
  formData: FormData
): Promise<UpdateSurveyState> {
  const supabase = await createClient();
  await requireUser(supabase);

  const jobId = text(formData, "job_id");
  const record = jobId ? await loadSurveyRecord(supabase, jobId) : null;

  if (!record) {
    return { error: "This survey could not be found." };
  }

  if (record.cancelled) {
    return { error: "This survey has been cancelled, so it can't be edited." };
  }

  const surveyDate = text(formData, "survey_date");

  if (!isValidDateKey(surveyDate)) {
    return { error: "Please choose the survey date." };
  }

  const event = record.event;
  let startTime: string | null = null;
  let endTime: string | null = null;
  let allDay = false;

  if (event) {
    const start = text(formData, "start_time").slice(0, 5);
    const end = text(formData, "end_time").slice(0, 5);

    if (!start && event.all_day) {
      allDay = true;
    } else {
      if (!isValidTime(start)) {
        return { error: "Please choose the survey start time." };
      }

      if (!isValidTime(end) || !isEndAfterStart(start, end)) {
        return { error: "The end time must be after the start time." };
      }

      startTime = start;
      endTime = end;
    }
  }

  const site: AddressParts = {
    address_line_1: textOrNull(formData, "site_address_line_1"),
    address_line_2: textOrNull(formData, "site_address_line_2"),
    town: textOrNull(formData, "site_town"),
    county: textOrNull(formData, "site_county"),
    postcode: text(formData, "site_postcode").toUpperCase() || null,
  };

  const notes = textOrNull(formData, "notes");
  const feeLock = surveyFeeLock(record.invoice);
  let fee: number | null = null;

  if (!feeLock && formData.has("survey_fee")) {
    fee = parseSurveyFee(text(formData, "survey_fee"));

    if (fee === null) {
      return { error: "Please enter the survey fee in pounds, e.g. 250 or 250.00." };
    }
  }

  const siteText = formatAddress(site) || null;

  const keepsSurveyTitle = (record.jobTitle ?? "")
    .toLowerCase()
    .startsWith("damp survey");

  const title = keepsSurveyTitle
    ? buildSurveyJobTitle(site)
    : record.jobTitle || buildSurveyJobTitle(site);

  /* 1. Schedule + Google Calendar */

  if (event) {
    const updated = await updateScheduleEventWithGoogle(supabase, event, {
      title: surveyEventTitle(record.jobNumber, title, record.client?.name ?? null),
      location: siteText,
      notes,
      start_date: surveyDate,
      end_date: surveyDate,
      start_time: allDay ? null : startTime,
      end_time: allDay ? null : endTime,
      all_day: allDay,
    });

    if (!updated.ok) {
      return {
        error:
          updated.reason === "google"
            ? "Google Calendar could not be updated, so nothing was changed. Please try again."
            : "The Schedule appointment could not be updated, so nothing was changed.",
      };
    }
  }

  /* 2. Job */

  const { error: jobError } = await supabase
    .from("jobs")
    .update({
      title,
      survey_date: surveyDate,
      address_line_1: site.address_line_1 ?? null,
      address_line_2: site.address_line_2 ?? null,
      town: site.town ?? null,
      county: site.county ?? null,
      postcode: site.postcode ?? null,
      description: notes,
    })
    .eq("id", record.jobId);

  if (jobError) {
    console.error("Survey job update error:", jobError);
    return {
      error: event
        ? "The Schedule appointment was updated, but the job could not be saved. Please try again."
        : "The job could not be saved. Nothing was changed.",
    };
  }

  /* 3. Invoice line, only while unpaid */

  const notices = ["Survey saved."];
  const warnings: string[] = [];
  const invoice = record.invoice;

  if (invoice && !feeLock && fee !== null) {
    const item = invoice.items[0];
    const when = formatSurveyWhen(surveyDate, startTime);
    const description = buildSurveyItemDescription(surveyDate, startTime, site);
    const priceChanged = Math.round(item.unit_price * 100) !== Math.round(fee * 100);

    if (priceChanged || item.description !== description) {
      const { error: itemError } = await supabase
        .from("invoice_items")
        .update({ unit_price: fee, description })
        .eq("id", item.id);

      if (itemError) {
        console.error("Survey invoice item update error:", itemError);
        warnings.push(
          `The job and Schedule were saved, but invoice ${invoice.invoiceNumber} could not be updated.`
        );
      } else {
        const totals = calculateInvoiceTotals(
          [{ quantity: item.quantity || 1, unit_price: fee }],
          invoice.vatEnabled,
          invoice.vatRate || 20
        );

        const { error: invoiceError } = await supabase
          .from("invoices")
          .update({
            subtotal: totals.subtotal,
            vat_amount: totals.vatAmount,
            amount: totals.total,
            description: siteText
              ? `Damp survey at ${siteText} on ${when}.`
              : `Damp survey on ${when}.`,
          })
          .eq("id", invoice.id);

        if (invoiceError) {
          console.error("Survey invoice update error:", invoiceError);

          // Put the line back so the invoice stays consistent.
          await supabase
            .from("invoice_items")
            .update({ unit_price: item.unit_price, description: item.description })
            .eq("id", item.id);

          warnings.push(
            `The job and Schedule were saved, but invoice ${invoice.invoiceNumber} could not be updated.`
          );
        } else if (priceChanged && invoice.sentAt) {
          notices.push(
            `Invoice ${invoice.invoiceNumber} now shows £${totals.total.toFixed(2)}. It was already emailed, so resend it to send the updated invoice.`
          );
        } else if (priceChanged) {
          notices.push(`Invoice ${invoice.invoiceNumber} updated to £${totals.total.toFixed(2)}.`);
        }
      }
    }
  }

  refreshSurveyPages(record.jobId, {
    clientId: record.client?.id,
    invoiceId: invoice?.id,
  });

  const params = new URLSearchParams();
  params.set("notice", notices.join(" "));
  if (warnings.length > 0) params.set("warning", warnings.join(" "));
  redirect(`/surveys/${record.jobId}?${params.toString()}`);
}

/* =========================================================
   ADD TO SCHEDULE (survey has no appointment)
   ========================================================= */

export async function addSurveyToSchedule(formData: FormData) {
  const supabase = await createClient();
  await requireUser(supabase);

  const jobId = text(formData, "job_id");
  const back = `/surveys/${jobId}`;
  const record = jobId ? await loadSurveyRecord(supabase, jobId) : null;

  if (!record) {
    redirect("/surveys?error=This%20survey%20could%20not%20be%20found");
  }

  if (record.cancelled) {
    redirect(withQueryParam(back, "error", "This survey has been cancelled."));
  }

  if (record.event) {
    redirect(withQueryParam(back, "notice", "This survey is already on the Schedule."));
  }

  const surveyDate = text(formData, "survey_date");
  const allDay = formData.get("all_day") === "on";
  const startTime = text(formData, "start_time").slice(0, 5);
  const endTime = text(formData, "end_time").slice(0, 5);

  if (!isValidDateKey(surveyDate)) {
    redirect(withQueryParam(back, "error", "Please choose the survey date."));
  }

  if (!allDay) {
    if (!isValidTime(startTime)) {
      redirect(withQueryParam(back, "error", 'Please enter a start time, or tick "All day".'));
    }

    if (!isValidTime(endTime) || !isEndAfterStart(startTime, endTime)) {
      redirect(withQueryParam(back, "error", "The end time must be after the start time."));
    }
  }

  const title = record.jobTitle || buildSurveyJobTitle(record.site);

  const created = await createScheduleEventWithGoogle(supabase, {
    job_id: record.jobId,
    contract_id: null,
    client_id: record.client?.id ?? null,
    title: surveyEventTitle(record.jobNumber, title, record.client?.name ?? null),
    event_type: SURVEY_EVENT_TYPE,
    status: "Scheduled",
    start_date: surveyDate,
    end_date: surveyDate,
    start_time: allDay ? null : startTime,
    end_time: allDay ? null : endTime,
    all_day: allDay,
    location: record.siteText || null,
    assigned_to: null,
    notes: record.notes,
  });

  if (!created.ok) {
    redirect(
      withQueryParam(
        back,
        "error",
        `The survey could not be added to the Schedule${describeDbError(created.error)}.`
      )
    );
  }

  if (record.surveyDate !== surveyDate) {
    await supabase.from("jobs").update({ survey_date: surveyDate }).eq("id", record.jobId);
  }

  refreshSurveyPages(record.jobId, { clientId: record.client?.id });

  redirect(
    withQueryParam(
      back,
      created.googleNotice ? "warning" : "notice",
      created.googleNotice
        ? "Added to the Schedule, but it could not be copied to Google Calendar."
        : "Added to the Schedule."
    )
  );
}

/* =========================================================
   RESEND INVOICE (shared invoice send function)
   ========================================================= */

export async function resendSurveyInvoice(formData: FormData) {
  const supabase = await createClient();
  await requireUser(supabase);

  const jobId = text(formData, "job_id");
  const back = safeSurveysPath(text(formData, "back"), `/surveys/${jobId}`);
  const record = jobId ? await loadSurveyRecord(supabase, jobId) : null;

  if (!record?.invoice) {
    redirect(withQueryParam(back, "error", "There is no survey invoice to send."));
  }

  const invoice = record.invoice;
  const result = await emailInvoiceToClient(supabase, invoice.id);

  refreshSurveyPages(record.jobId, { invoiceId: invoice.id });

  if (result.status === "no-email") {
    redirect(
      withQueryParam(
        back,
        "error",
        `Invoice ${invoice.invoiceNumber} was not sent because the client has no email address.`
      )
    );
  }

  if (result.status === "failed") {
    redirect(
      withQueryParam(
        back,
        "error",
        `Invoice ${invoice.invoiceNumber} could not be emailed (${result.error}).`
      )
    );
  }

  redirect(
    withQueryParam(
      back,
      result.warning ? "warning" : "notice",
      `Invoice ${invoice.invoiceNumber} emailed to ${describeRecipients(result.recipients)}.${
        result.warning ? ` ${result.warning}` : ""
      }`
    )
  );
}

/* =========================================================
   MARK PAID (same payment recording as the invoice page)
   ========================================================= */

export async function markSurveyPaid(formData: FormData) {
  const supabase = await createClient();
  await requireUser(supabase);

  const jobId = text(formData, "job_id");
  const back = safeSurveysPath(text(formData, "back"), `/surveys/${jobId}`);
  const record = jobId ? await loadSurveyRecord(supabase, jobId) : null;

  if (!record?.invoice) {
    redirect(withQueryParam(back, "error", "There is no survey invoice to mark as paid."));
  }

  const invoice = record.invoice;

  if (invoice.outstanding <= 0.009) {
    redirect(withQueryParam(back, "notice", `Invoice ${invoice.invoiceNumber} is already paid.`));
  }

  const allowedMethods = ["Bank Transfer", "Card", "Cash", "Cheque", "Other"];
  const method = text(formData, "payment_method");

  try {
    await applyInvoicePayment(supabase, {
      invoiceId: invoice.id,
      paymentAmount: invoice.outstanding,
      paymentDate: getLondonDateKey(new Date()),
      paymentMethod: allowedMethods.includes(method) ? method : "Bank Transfer",
      paymentReference: null,
      paymentNotes: "Marked paid from Surveys",
    });
  } catch (error) {
    console.error("Survey mark paid error:", error);
    redirect(
      withQueryParam(
        back,
        "error",
        `Invoice ${invoice.invoiceNumber} could not be marked as paid${
          error instanceof Error && error.message ? ` (${error.message})` : ""
        }.`
      )
    );
  }

  refreshSurveyPages(record.jobId, { clientId: record.client?.id, invoiceId: invoice.id });

  redirect(
    withQueryParam(
      back,
      "notice",
      `Invoice ${invoice.invoiceNumber} marked as paid (£${invoice.outstanding.toFixed(2)} received today).`
    )
  );
}

/* =========================================================
   CANCEL SURVEY
   Removes the Schedule appointment through the Schedule page's
   delete path (Google first), then marks the job Cancelled.
   The invoice is left alone.
   ========================================================= */

export async function cancelSurvey(formData: FormData) {
  const supabase = await createClient();
  await requireUser(supabase);

  const jobId = text(formData, "job_id");
  const back = `/surveys/${jobId}`;
  const record = jobId ? await loadSurveyRecord(supabase, jobId) : null;

  if (!record) {
    redirect("/surveys?error=This%20survey%20could%20not%20be%20found");
  }

  if (record.cancelled) {
    redirect(withQueryParam(back, "notice", "This survey is already cancelled."));
  }

  const { data: events, error: eventsError } = await supabase
    .from("schedule_events")
    .select("id, job_id, contract_id, google_calendar_id, google_event_id, status")
    .eq("job_id", record.jobId)
    .eq("event_type", SURVEY_EVENT_TYPE)
    .neq("status", "Cancelled");

  if (eventsError) {
    console.error("Survey cancel events load error:", eventsError);
    redirect(withQueryParam(back, "error", "The Schedule could not be read, so nothing was cancelled."));
  }

  let removedCount = 0;

  for (const event of events ?? []) {
    const removed = await removeScheduleEvent(supabase, {
      id: event.id,
      job_id: event.job_id,
      contract_id: event.contract_id,
      google_calendar_id: event.google_calendar_id ?? null,
      google_event_id: event.google_event_id ?? null,
    });

    if (!removed.ok) {
      redirect(
        withQueryParam(
          back,
          "error",
          `${
            removed.reason === "google"
              ? "The appointment could not be removed from Google Calendar"
              : "The Schedule appointment could not be removed"
          }, so the survey was not cancelled.${
            removedCount > 0 ? " Another appointment for it was already removed." : ""
          }`
        )
      );
    }

    removedCount += 1;
  }

  const { error: jobError } = await supabase
    .from("jobs")
    .update({ status: "Cancelled" })
    .eq("id", record.jobId);

  if (jobError) {
    console.error("Survey cancel job error:", jobError);
    redirect(
      withQueryParam(
        back,
        "error",
        removedCount > 0
          ? "The appointment was removed from the Schedule, but the job could not be marked Cancelled. Please try again."
          : "The job could not be marked Cancelled."
      )
    );
  }

  refreshSurveyPages(record.jobId, {
    clientId: record.client?.id,
    invoiceId: record.invoice?.id,
  });

  const invoiceNote = record.invoice
    ? ` Invoice ${record.invoice.invoiceNumber} was left as it is${
        record.invoice.state === "paid" ? " (paid), so you may want to refund it" : ", so you may want to void it"
      }.`
    : "";

  redirect(
    withQueryParam(
      back,
      "notice",
      `Survey cancelled${removedCount > 0 ? " and removed from the Schedule" : ""}.${invoiceNote}`
    )
  );
}
