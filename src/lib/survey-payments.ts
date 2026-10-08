/*
 * Server-side loaders for survey payment badges and the Dashboard
 * "Unpaid surveys" panel. Everything fails soft: if a query errors the
 * badges and panel simply do not show.
 */

import type { createClient } from "@/lib/supabase/server";
import {
  SURVEY_EVENT_TYPE,
  ISSUED_INVOICE_STATUSES,
  SURVEY_INVOICE_TITLE,
  invoiceOutstanding,
  invoiceTotal,
  isSurveyInvoice,
  isSurveyJob,
  surveyInvoiceState,
  type SurveyInvoiceLike,
} from "@/lib/survey";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type SurveyInvoiceRow = SurveyInvoiceLike & {
  id: string;
  job_id: string | null;
};

function single<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

/**
 * Survey invoices grouped by job id. Pass jobIds to limit the query.
 */
export async function loadSurveyInvoicesByJob(
  supabase: SupabaseServerClient,
  jobIds?: string[]
) {
  const byJob = new Map<string, SurveyInvoiceRow[]>();

  if (jobIds && jobIds.length === 0) {
    return byJob;
  }

  let query = supabase
    .from("invoices")
    .select(`
      id,
      job_id,
      title,
      invoice_type,
      quote_id,
      contract_id,
      status,
      amount,
      subtotal,
      vat_amount,
      amount_paid
    `)
    .ilike("title", `${SURVEY_INVOICE_TITLE}%`)
    .not("job_id", "is", null);

  // Keep the request URL short: for long lists load every survey
  // invoice instead and let the caller pick by job id.
  if (jobIds && jobIds.length <= 150) {
    query = query.in("job_id", jobIds);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Survey invoices load error:", error);
    return byJob;
  }

  for (const invoice of (data ?? []) as SurveyInvoiceRow[]) {
    if (!invoice.job_id) continue;

    const list = byJob.get(invoice.job_id) ?? [];
    list.push(invoice);
    byJob.set(invoice.job_id, list);
  }

  return byJob;
}

export type UnpaidSurvey = {
  invoiceId: string;
  invoiceNumber: string;
  jobId: string;
  jobNumber: string | null;
  clientName: string;
  surveyDate: string | null;
  startTime: string | null;
  endTime: string | null;
  total: number;
  outstanding: number;
};

/**
 * Survey jobs whose survey invoice is not yet paid, soonest survey first.
 */
export async function loadUnpaidSurveys(
  supabase: SupabaseServerClient
): Promise<UnpaidSurvey[]> {
  const { data, error } = await supabase
    .from("invoices")
    .select(`
      id,
      invoice_number,
      title,
      invoice_type,
      quote_id,
      contract_id,
      status,
      amount,
      subtotal,
      vat_amount,
      amount_paid,
      job_id,

      clients (
        display_name,
        first_name,
        last_name
      ),

      jobs (
        id,
        job_number,
        title,
        job_type,
        survey_date
      )
    `)
    .ilike("title", `${SURVEY_INVOICE_TITLE}%`)
    .not("job_id", "is", null)
    .is("quote_id", null)
    .is("contract_id", null)
    .in("status", ISSUED_INVOICE_STATUSES);

  if (error) {
    console.error("Unpaid surveys load error:", error);
    return [];
  }

  const rows = (data ?? [])
    .map((invoice) => ({
      invoice,
      job: single(invoice.jobs),
      client: single(invoice.clients),
    }))
    .filter(
      ({ invoice, job }) =>
        job &&
        isSurveyJob(job) &&
        isSurveyInvoice(invoice) &&
        surveyInvoiceState(invoice) === "unpaid"
    );

  if (rows.length === 0) {
    return [];
  }

  /* Survey appointment times from the Schedule. */
  const jobIds = Array.from(
    new Set(rows.map(({ job }) => String(job?.id)))
  );

  const times = new Map<
    string,
    { date: string; start: string | null; end: string | null }
  >();

  const { data: events, error: eventsError } = await supabase
    .from("schedule_events")
    .select("job_id, start_date, start_time, end_time, status")
    .in("job_id", jobIds)
    .eq("event_type", SURVEY_EVENT_TYPE)
    .neq("status", "Cancelled")
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (eventsError) {
    console.error("Unpaid survey times load error:", eventsError);
  }

  for (const event of events ?? []) {
    if (event.job_id && !times.has(event.job_id)) {
      times.set(event.job_id, {
        date: event.start_date,
        start: event.start_time,
        end: event.end_time,
      });
    }
  }

  return rows
    .map(({ invoice, job, client }) => {
      const jobId = String(job?.id);
      const time = times.get(jobId);

      return {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        jobId,
        jobNumber: job?.job_number ?? null,
        clientName:
          client?.display_name ||
          [client?.first_name, client?.last_name].filter(Boolean).join(" ") ||
          "Unknown client",
        surveyDate: time?.date ?? job?.survey_date ?? null,
        startTime: time?.start ?? null,
        endTime: time?.end ?? null,
        total: invoiceTotal(invoice),
        outstanding: invoiceOutstanding(invoice),
      };
    })
    .sort((a, b) =>
      `${a.surveyDate ?? "9999"} ${a.startTime ?? ""}`.localeCompare(
        `${b.surveyDate ?? "9999"} ${b.startTime ?? ""}`
      )
    );
}
