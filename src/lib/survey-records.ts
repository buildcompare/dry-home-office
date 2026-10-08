/*
 * Loads everything the Surveys pages need for survey jobs: the job,
 * client, Survey schedule appointment and survey invoice (with items).
 */

import type { createClient } from "@/lib/supabase/server";
import { isMissingSecondaryEmailColumn } from "@/lib/client-secondary-email";
import {
  SURVEY_EVENT_TYPE,
  SURVEY_INVOICE_TITLE,
  SURVEY_JOB_TYPE,
  SURVEY_TITLE_PREFIX,
  formatAddress,
  invoiceOutstanding,
  invoiceTotal,
  isSurveyInvoice,
  isSurveyJob,
  surveyInvoiceState,
  type AddressParts,
  type SurveyPaymentState,
} from "@/lib/survey";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type SurveyEvent = {
  id: string;
  title: string | null;
  status: string | null;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  all_day: boolean | null;
  location: string | null;
  job_id: string | null;
  contract_id: string | null;
  google_calendar_id: string | null;
  google_event_id: string | null;
};

export type SurveyInvoiceItem = {
  id: string;
  description: string | null;
  quantity: number;
  unit_price: number;
};

export type SurveyInvoiceRecord = {
  id: string;
  invoiceNumber: string;
  status: string;
  total: number;
  outstanding: number;
  amountPaid: number;
  vatEnabled: boolean;
  vatRate: number;
  sentAt: string | null;
  sentTo: string | null;
  state: SurveyPaymentState | null;
  items: SurveyInvoiceItem[];
};

export type SurveyRecord = {
  jobId: string;
  jobNumber: string | null;
  jobTitle: string | null;
  jobStatus: string | null;
  cancelled: boolean;
  client: {
    id: string;
    name: string;
    email: string | null;
    secondaryEmail: string | null;
  } | null;
  site: AddressParts;
  siteText: string;
  notes: string | null;
  surveyDate: string | null;
  startTime: string | null;
  endTime: string | null;
  allDay: boolean;
  event: SurveyEvent | null;
  hadCancelledEvent: boolean;
  invoice: SurveyInvoiceRecord | null;
  otherSurveyInvoices: number;
};

const JOB_COLUMNS = `
  id,
  job_number,
  title,
  job_type,
  status,
  address_line_1,
  address_line_2,
  town,
  county,
  postcode,
  survey_date,
  description,
  created_at,
  client_id,

  clients (
    id,
    display_name,
    first_name,
    last_name,
    company_name,
    email
  )
`;

type JobRow = {
  id: string;
  job_number: string | null;
  title: string | null;
  job_type: string | null;
  status: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  town: string | null;
  county: string | null;
  postcode: string | null;
  survey_date: string | null;
  description: string | null;
  created_at: string | null;
  client_id: string | null;
  clients: unknown;
};

type ClientRow = {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
};

function single<T>(value: unknown): T | null {
  if (Array.isArray(value)) {
    return (value[0] as T) ?? null;
  }

  return (value as T) ?? null;
}

function chunks<T>(values: T[], size = 100) {
  const out: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    out.push(values.slice(index, index + size));
  }
  return out;
}

async function loadSecondaryEmails(
  supabase: SupabaseServerClient,
  clientIds: string[]
) {
  const map = new Map<string, string>();

  for (const ids of chunks(clientIds)) {
    const { data, error } = await supabase
      .from("clients")
      .select("id, secondary_email")
      .in("id", ids);

    if (error) {
      if (!isMissingSecondaryEmailColumn(error)) {
        console.error("Survey secondary emails load error:", error);
      }
      return map;
    }

    for (const row of (data ?? []) as { id: string; secondary_email?: string | null }[]) {
      const value = row.secondary_email?.trim();
      if (value) map.set(row.id, value);
    }
  }

  return map;
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Survey jobs (all, or one by id), newest first.
 */
async function loadSurveyJobs(
  supabase: SupabaseServerClient,
  jobId?: string
): Promise<{ jobs: JobRow[]; error: boolean }> {
  if (jobId) {
    const { data, error } = await supabase
      .from("jobs")
      .select(JOB_COLUMNS)
      .eq("id", jobId)
      .maybeSingle();

    if (error) {
      console.error("Survey job load error:", error);
      return { jobs: [], error: true };
    }

    const job = data as JobRow | null;
    return { jobs: job && isSurveyJob(job) ? [job] : [], error: false };
  }

  const [byType, byTitle] = await Promise.all([
    supabase
      .from("jobs")
      .select(JOB_COLUMNS)
      .eq("job_type", SURVEY_JOB_TYPE)
      .order("created_at", { ascending: false }),
    supabase
      .from("jobs")
      .select(JOB_COLUMNS)
      .ilike("title", `${SURVEY_TITLE_PREFIX}%`)
      .order("created_at", { ascending: false }),
  ]);

  if (byType.error || byTitle.error) {
    console.error("Survey jobs load error:", byType.error || byTitle.error);
  }

  const seen = new Set<string>();
  const jobs: JobRow[] = [];

  for (const job of [
    ...((byType.data ?? []) as JobRow[]),
    ...((byTitle.data ?? []) as JobRow[]),
  ]) {
    if (seen.has(job.id) || !isSurveyJob(job)) continue;
    seen.add(job.id);
    jobs.push(job);
  }

  return { jobs, error: Boolean(byType.error && byTitle.error) };
}

export async function loadSurveyRecords(
  supabase: SupabaseServerClient,
  options: { jobId?: string } = {}
): Promise<{ records: SurveyRecord[]; error: boolean }> {
  const { jobs, error } = await loadSurveyJobs(supabase, options.jobId);

  if (jobs.length === 0) {
    return { records: [], error };
  }

  const jobIds = jobs.map((job) => job.id);
  const events: SurveyEvent[] = [];
  const invoices: Record<string, unknown>[] = [];

  for (const ids of chunks(jobIds)) {
    const [eventResult, invoiceResult] = await Promise.all([
      supabase
        .from("schedule_events")
        .select(`
          id,
          title,
          status,
          start_date,
          end_date,
          start_time,
          end_time,
          all_day,
          location,
          job_id,
          contract_id,
          google_calendar_id,
          google_event_id
        `)
        .in("job_id", ids)
        .eq("event_type", SURVEY_EVENT_TYPE)
        .order("start_date", { ascending: true }),

      supabase
        .from("invoices")
        .select(`
          id,
          job_id,
          quote_id,
          contract_id,
          invoice_number,
          invoice_type,
          title,
          status,
          amount,
          subtotal,
          vat_amount,
          vat_enabled,
          vat_rate,
          amount_paid,
          sent_at,
          sent_to,
          created_at
        `)
        .in("job_id", ids)
        .ilike("title", `${SURVEY_INVOICE_TITLE}%`)
        .order("created_at", { ascending: true }),
    ]);

    if (eventResult.error) {
      console.error("Survey events load error:", eventResult.error);
    }

    if (invoiceResult.error) {
      console.error("Survey invoices load error:", invoiceResult.error);
    }

    events.push(...((eventResult.data ?? []) as SurveyEvent[]));
    invoices.push(...((invoiceResult.data ?? []) as Record<string, unknown>[]));
  }

  /* Line items, loaded separately like the invoice PDF does. */
  const itemsByInvoice = new Map<string, Record<string, unknown>[]>();
  const invoiceIds = invoices.map((invoice) => String(invoice.id));

  for (const ids of chunks(invoiceIds)) {
    const { data, error: itemsError } = await supabase
      .from("invoice_items")
      .select("id, invoice_id, description, quantity, unit_price, sort_order")
      .in("invoice_id", ids);

    if (itemsError) {
      console.error("Survey invoice items load error:", itemsError);
      continue;
    }

    for (const item of (data ?? []) as Record<string, unknown>[]) {
      const key = String(item.invoice_id);
      const list = itemsByInvoice.get(key) ?? [];
      list.push(item);
      itemsByInvoice.set(key, list);
    }
  }

  const clientIds = Array.from(
    new Set(jobs.map((job) => job.client_id).filter((id): id is string => Boolean(id)))
  );

  const secondaryEmails = await loadSecondaryEmails(supabase, clientIds);

  const records = jobs.map((job): SurveyRecord => {
    const client = single<ClientRow>(job.clients);

    const jobEvents = events.filter((event) => event.job_id === job.id);
    const activeEvent =
      jobEvents.find((event) => event.status !== "Cancelled") ?? null;

    const jobInvoices = invoices
      .filter((invoice) => invoice.job_id === job.id)
      .filter((invoice) => isSurveyInvoice(invoice))
      .filter((invoice) => surveyInvoiceState(invoice) !== null);

    // The current survey invoice: the newest one that isn't cancelled.
    const raw = jobInvoices[jobInvoices.length - 1] ?? null;

    const invoice: SurveyInvoiceRecord | null = raw
      ? {
          id: String(raw.id),
          invoiceNumber: String(raw.invoice_number ?? ""),
          status: String(raw.status ?? ""),
          total: invoiceTotal(raw),
          outstanding: invoiceOutstanding(raw),
          amountPaid: toNumber(raw.amount_paid),
          vatEnabled: Boolean(raw.vat_enabled),
          vatRate: toNumber(raw.vat_rate),
          sentAt: (raw.sent_at as string | null) ?? null,
          sentTo: (raw.sent_to as string | null) ?? null,
          state: surveyInvoiceState(raw),
          items: (
            (itemsByInvoice.get(String(raw.id)) ?? []) as {
              id: string;
              description: string | null;
              quantity: unknown;
              unit_price: unknown;
              sort_order: unknown;
            }[]
          )
            .slice()
            .sort((a, b) => toNumber(a.sort_order) - toNumber(b.sort_order))
            .map((item) => ({
              id: item.id,
              description: item.description,
              quantity: toNumber(item.quantity),
              unit_price: toNumber(item.unit_price),
            })),
        }
      : null;

    const site: AddressParts = {
      address_line_1: job.address_line_1,
      address_line_2: job.address_line_2,
      town: job.town,
      county: job.county,
      postcode: job.postcode,
    };

    return {
      jobId: job.id,
      jobNumber: job.job_number,
      jobTitle: job.title,
      jobStatus: job.status,
      cancelled: job.status === "Cancelled",
      client: client
        ? {
            id: client.id,
            name:
              client.display_name ||
              [client.first_name, client.last_name].filter(Boolean).join(" ") ||
              client.company_name ||
              "Unnamed client",
            email: client.email?.trim() || null,
            secondaryEmail: secondaryEmails.get(client.id) ?? null,
          }
        : null,
      site,
      siteText: formatAddress(site),
      notes: job.description,
      surveyDate: activeEvent?.start_date ?? job.survey_date?.slice(0, 10) ?? null,
      startTime: activeEvent?.start_time?.slice(0, 5) ?? null,
      endTime: activeEvent?.end_time?.slice(0, 5) ?? null,
      allDay: Boolean(activeEvent?.all_day),
      event: activeEvent,
      hadCancelledEvent: !activeEvent && jobEvents.length > 0,
      invoice,
      otherSurveyInvoices: Math.max(0, jobInvoices.length - 1),
    };
  });

  return { records, error };
}

export async function loadSurveyRecord(
  supabase: SupabaseServerClient,
  jobId: string
) {
  const { records } = await loadSurveyRecords(supabase, { jobId });
  return records[0] ?? null;
}
