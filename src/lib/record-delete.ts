/*
 * Deleting office records (James's test data clean-up).
 *
 * The database schema (foreign keys / ON DELETE rules) is not in the
 * repo, so nothing here relies on cascades: child rows are deleted, and
 * links from kept rows are cleared, explicitly and in a safe order:
 *
 *   schedule events (Google first) → survey reports (+ files)
 *   → invoice payments → guarantees → invoice items → invoices
 *   → variation items → variations → contracts → quote items → quotes
 *   → jobs → client
 *
 * Every step checks that the rows really went: Supabase RLS silently
 * skips rows it doesn't allow, so "no error but still there" is reported
 * as blocked, with the table name and the SQL file that fixes it.
 * The first failure stops everything and the message says what was and
 * wasn't deleted.
 */

import type { createClient } from "@/lib/supabase/server";
import { formatCurrency, money } from "@/lib/money";
import { deleteScheduleEventPermanently } from "@/lib/schedule-create";
import { SURVEY_REPORTS_BUCKET } from "@/lib/survey-report-shared";
import { isReportsSetupError } from "@/lib/survey-reports";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export const DELETE_POLICY_SQL_FILE = "supabase/delete_policies.sql";

type Ref = { id: string; label: string };

type ScheduleRef = Ref & {
  google_calendar_id: string | null;
  google_event_id: string | null;
};

type InvoiceRef = Ref & { paid: number };

type PaymentRef = { id: string; invoice_id: string; amount: number };

type ReportRef = Ref & { file_path: string };

export type DeleteGraph = {
  client: Ref | null;
  jobs: Ref[];
  quotes: Ref[];
  contracts: Ref[];
  variations: Ref[];
  invoices: InvoiceRef[];
  payments: PaymentRef[];
  guarantees: Ref[];
  scheduleEvents: ScheduleRef[];
  surveyReports: ReportRef[];
  surveyReportsAvailable: boolean;
};

export class DeleteError extends Error {}

/* =========================================================
   SMALL HELPERS
   ========================================================= */

type Row = Record<string, unknown>;

const CHUNK = 100;

function chunks<T>(items: T[]) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK) out.push(items.slice(i, i + CHUNK));
  return out;
}

function str(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function uniqueById<T extends { id: string }>(rows: T[]) {
  const seen = new Map<string, T>();
  for (const row of rows) if (!seen.has(row.id)) seen.set(row.id, row);
  return Array.from(seen.values());
}

export function clientDisplayName(client: Row | null | undefined) {
  if (!client) return "Client";
  return (
    str(client.display_name).trim() ||
    [str(client.first_name), str(client.last_name)].filter(Boolean).join(" ").trim() ||
    str(client.company_name).trim() ||
    "Client"
  );
}

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

function formatShortDate(value: unknown) {
  const text = str(value);
  if (!/^\d{4}-\d{2}-\d{2}/.test(text)) return "";
  const [y, m, d] = text.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d))
  );
}

/**
 * Select rows from `table` matching ANY of the filters
 * (column IN ids, or column = value).
 */
async function selectAny(
  supabase: SupabaseServerClient,
  table: string,
  columns: string,
  filters: { column: string; ids: string[] }[]
): Promise<Row[]> {
  const rows: Row[] = [];

  for (const filter of filters) {
    const ids = Array.from(new Set(filter.ids.filter(Boolean)));

    for (const part of chunks(ids)) {
      const { data, error } = await supabase.from(table).select(columns).in(filter.column, part);

      if (error) {
        console.error(`Delete preview: ${table} lookup error`, error);
        throw new DeleteError(`Linked ${table.replace(/_/g, " ")} could not be checked, so nothing was deleted.`);
      }

      rows.push(...((data ?? []) as unknown as Row[]));
    }
  }

  return uniqueById(rows.map((row) => ({ ...row, id: str(row.id) })));
}

const ids = (rows: { id: string }[]) => rows.map((row) => row.id);

/* =========================================================
   COLLECT EVERYTHING LINKED
   ========================================================= */

export async function collectDeleteGraph(
  supabase: SupabaseServerClient,
  seed: { clientId?: string; jobIds?: string[] }
): Promise<DeleteGraph> {
  const clientIds = seed.clientId ? [seed.clientId] : [];

  let client: Ref | null = null;

  if (seed.clientId) {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("id", seed.clientId)
      .maybeSingle();

    if (error || !data) {
      throw new DeleteError("This client could not be found.");
    }

    client = { id: seed.clientId, label: clientDisplayName(data as Row) };
  }

  const jobs = await selectAny(supabase, "jobs", "id, job_number, title", [
    { column: "id", ids: seed.jobIds ?? [] },
    { column: "client_id", ids: clientIds },
  ]);
  const jobIds = ids(jobs as { id: string }[]);

  const quotes = await selectAny(supabase, "quotes", "id, quote_number, title", [
    { column: "job_id", ids: jobIds },
    { column: "client_id", ids: clientIds },
  ]);
  const quoteIds = ids(quotes as { id: string }[]);

  const contracts = await selectAny(supabase, "contracts", "id, contract_number, title", [
    { column: "job_id", ids: jobIds },
    { column: "quote_id", ids: quoteIds },
    { column: "client_id", ids: clientIds },
  ]);
  const contractIds = ids(contracts as { id: string }[]);

  const variations = await selectAny(supabase, "variations", "id, variation_number, title", [
    { column: "job_id", ids: jobIds },
    { column: "quote_id", ids: quoteIds },
    { column: "client_id", ids: clientIds },
  ]);

  const invoices = await selectAny(supabase, "invoices", "id, invoice_number, title, amount_paid", [
    { column: "job_id", ids: jobIds },
    { column: "quote_id", ids: quoteIds },
    { column: "contract_id", ids: contractIds },
    { column: "client_id", ids: clientIds },
  ]);
  const invoiceIds = ids(invoices as { id: string }[]);

  const payments = await selectAny(supabase, "invoice_payments", "id, invoice_id, amount", [
    { column: "invoice_id", ids: invoiceIds },
  ]);

  const guarantees = await selectAny(supabase, "guarantees", "id, guarantee_number, title", [
    { column: "job_id", ids: jobIds },
    { column: "contract_id", ids: contractIds },
    { column: "invoice_id", ids: invoiceIds },
    { column: "client_id", ids: clientIds },
  ]);

  const events = await selectAny(
    supabase,
    "schedule_events",
    "id, title, start_date, google_calendar_id, google_event_id",
    [
      { column: "job_id", ids: jobIds },
      { column: "contract_id", ids: contractIds },
      { column: "client_id", ids: clientIds },
    ]
  );

  let reports: Row[] = [];
  let surveyReportsAvailable = true;

  try {
    reports = await selectAny(supabase, "survey_reports", "id, title, file_name, file_path", [
      { column: "job_id", ids: jobIds },
    ]);
  } catch {
    // Table not created yet (supabase/survey_reports.sql not run).
    const { error } = await supabase.from("survey_reports").select("id").limit(1);
    if (error && isReportsSetupError(error)) {
      surveyReportsAvailable = false;
    } else {
      throw new DeleteError("Linked survey reports could not be checked, so nothing was deleted.");
    }
  }

  const paidByInvoice = new Map<string, number>();
  const paymentRefs: PaymentRef[] = payments.map((row) => ({
    id: str(row.id),
    invoice_id: str(row.invoice_id),
    amount: Number(row.amount ?? 0) || 0,
  }));
  for (const payment of paymentRefs) {
    paidByInvoice.set(payment.invoice_id, money((paidByInvoice.get(payment.invoice_id) ?? 0) + payment.amount));
  }

  const label = (row: Row, numberKey: string, fallback: string) =>
    [str(row[numberKey]), str(row.title)].filter(Boolean).join(" – ") || fallback;

  return {
    client,
    jobs: jobs.map((row) => ({ id: str(row.id), label: label(row, "job_number", "Job") })),
    quotes: quotes.map((row) => ({ id: str(row.id), label: label(row, "quote_number", "Quote") })),
    contracts: contracts.map((row) => ({ id: str(row.id), label: label(row, "contract_number", "Contract") })),
    variations: variations.map((row) => ({ id: str(row.id), label: label(row, "variation_number", "Variation") })),
    invoices: invoices.map((row) => ({
      id: str(row.id),
      label: label(row, "invoice_number", "Invoice"),
      paid: Math.max(Number(row.amount_paid ?? 0) || 0, paidByInvoice.get(str(row.id)) ?? 0),
    })),
    payments: paymentRefs,
    guarantees: guarantees.map((row) => ({ id: str(row.id), label: label(row, "guarantee_number", "Guarantee") })),
    scheduleEvents: events.map((row) => ({
      id: str(row.id),
      label: [str(row.title) || "Appointment", formatShortDate(row.start_date)].filter(Boolean).join(" · "),
      google_calendar_id: (row.google_calendar_id as string | null) ?? null,
      google_event_id: (row.google_event_id as string | null) ?? null,
    })),
    surveyReports: reports.map((row) => ({
      id: str(row.id),
      label: str(row.title) || str(row.file_name) || "Survey report",
      file_path: str(row.file_path),
    })),
    surveyReportsAvailable,
  };
}

export function graphTotal(graph: DeleteGraph) {
  return (
    (graph.client ? 1 : 0) +
    graph.jobs.length +
    graph.quotes.length +
    graph.contracts.length +
    graph.variations.length +
    graph.invoices.length +
    graph.payments.length +
    graph.guarantees.length +
    graph.scheduleEvents.length +
    graph.surveyReports.length
  );
}

export function graphPaidTotal(graph: DeleteGraph) {
  return money(graph.invoices.reduce((sum, invoice) => sum + invoice.paid, 0));
}

export type SummaryGroup = { label: string; items: string[] };

export function graphSummary(graph: DeleteGraph): SummaryGroup[] {
  const groups: SummaryGroup[] = [];
  const add = (one: string, many: string, items: string[]) => {
    if (items.length > 0) groups.push({ label: items.length === 1 ? `1 ${one}` : `${items.length} ${many}`, items });
  };

  if (graph.client) add("client", "clients", [graph.client.label]);
  add("job", "jobs", graph.jobs.map((r) => r.label));
  add("quote (with line items)", "quotes (with line items)", graph.quotes.map((r) => r.label));
  add("variation", "variations", graph.variations.map((r) => r.label));
  add("contract", "contracts", graph.contracts.map((r) => r.label));
  add(
    "invoice (with line items)",
    "invoices (with line items)",
    graph.invoices.map((r) => (r.paid > 0 ? `${r.label} (${formatCurrency(r.paid)} paid)` : r.label))
  );
  add(
    "payment record",
    "payment records",
    graph.payments.map((p) => {
      const invoice = graph.invoices.find((inv) => inv.id === p.invoice_id);
      return `${formatCurrency(p.amount)}${invoice ? ` on ${invoice.label.split(" – ")[0]}` : ""}`;
    })
  );
  add("guarantee", "guarantees", graph.guarantees.map((r) => r.label));
  add(
    "Schedule appointment (also removed from Google Calendar)",
    "Schedule appointments (also removed from Google Calendar)",
    graph.scheduleEvents.map((r) => r.label)
  );
  add("survey report (PDF file too)", "survey reports (PDF files too)", graph.surveyReports.map((r) => r.label));

  return groups;
}

/* =========================================================
   DELETE STEPS
   ========================================================= */

type Progress = { done: string[] };

function describeDbError(error: { code?: string | null; message?: string | null; details?: string | null }) {
  if (error.code === "23503") {
    return `another record still points at it (${str(error.details || error.message).slice(0, 160)})`;
  }
  if (error.code === "42501") {
    return "permission denied by Supabase";
  }
  return str(error.message).slice(0, 160) || "database error";
}

function stopMessage(progress: Progress, what: string, reason: string) {
  const done = progress.done.length > 0 ? ` Already deleted: ${progress.done.join(", ")}.` : " Nothing was deleted.";
  return `Stopped: could not delete ${what} – ${reason}.${done} Everything else was left as it was.`;
}

function blockedReason(table: string, verb = "deleting from") {
  return `Supabase row level security blocked ${verb} the "${table}" table. Run ${DELETE_POLICY_SQL_FILE} in the Supabase SQL Editor, then try again`;
}

/** Delete rows by id and check they are really gone. */
async function deleteByIds(
  supabase: SupabaseServerClient,
  table: string,
  rowIds: string[],
  progress: Progress,
  what: string,
  doneLabel: string
) {
  const unique = Array.from(new Set(rowIds));
  if (unique.length === 0) return;

  let deleted = 0;

  for (const part of chunks(unique)) {
    const { data, error } = await supabase.from(table).delete().in("id", part).select("id");

    if (error) {
      console.error(`Delete ${table} error:`, error);
      if (deleted > 0) progress.done.push(`${deleted} of ${doneLabel}`);
      throw new DeleteError(stopMessage(progress, what, describeDbError(error)));
    }

    deleted += data?.length ?? 0;
  }

  if (deleted < unique.length) {
    const { data: remaining } = await supabase.from(table).select("id").in("id", unique.slice(0, CHUNK));

    if ((remaining?.length ?? 0) > 0) {
      if (deleted > 0) progress.done.push(`${deleted} of ${doneLabel}`);
      throw new DeleteError(stopMessage(progress, what, blockedReason(table)));
    }
  }

  progress.done.push(doneLabel);
}

/** Delete child rows of parents (e.g. invoice_items by invoice_id). */
async function deleteChildren(
  supabase: SupabaseServerClient,
  table: string,
  parentColumn: string,
  parentIds: string[],
  progress: Progress,
  what: string
) {
  if (parentIds.length === 0) return;

  const children = await selectAny(supabase, table, "id", [{ column: parentColumn, ids: parentIds }]);
  if (children.length === 0) return;

  await deleteByIds(
    supabase,
    table,
    ids(children as { id: string }[]),
    progress,
    what,
    plural(children.length, table.replace(/_/g, " ").replace(/s$/, ""), table.replace(/_/g, " "))
  );
}

/** Clear a link column on rows that are being kept. */
async function clearLink(
  supabase: SupabaseServerClient,
  table: string,
  column: string,
  value: string,
  progress: Progress,
  what: string
) {
  const linked = await selectAny(supabase, table, "id", [{ column, ids: [value] }]);
  if (linked.length === 0) return 0;

  const { data, error } = await supabase
    .from(table)
    .update({ [column]: null })
    .eq(column, value)
    .select("id");

  if (error) {
    console.error(`Clear ${table}.${column} error:`, error);
    throw new DeleteError(
      stopMessage(
        progress,
        what,
        error.code === "23502"
          ? `the link from ${table.replace(/_/g, " ")} can't be cleared (${column} is required), so delete those records first`
          : describeDbError(error)
      )
    );
  }

  if ((data?.length ?? 0) < linked.length) {
    throw new DeleteError(stopMessage(progress, what, blockedReason(table, "updating")));
  }

  progress.done.push(`cleared the link on ${plural(linked.length, table.replace(/_/g, " ").replace(/s$/, ""), table.replace(/_/g, " "))}`);
  return linked.length;
}

async function deleteScheduleEvents(supabase: SupabaseServerClient, events: ScheduleRef[], progress: Progress) {
  let count = 0;

  for (const event of events) {
    const removed = await deleteScheduleEventPermanently(supabase, event);

    if (!removed.ok) {
      if (count > 0) progress.done.push(plural(count, "Schedule appointment"));
      throw new DeleteError(
        stopMessage(
          progress,
          `the Schedule appointment "${event.label}"`,
          removed.reason === "google"
            ? "Google Calendar could not be updated (check Settings → Calendar)"
            : removed.reason === "blocked"
              ? blockedReason("schedule_events")
              : removed.message || "database error"
        )
      );
    }

    count += 1;
  }

  if (count > 0) progress.done.push(plural(count, "Schedule appointment"));
}

async function deleteSurveyReports(
  supabase: SupabaseServerClient,
  reports: ReportRef[],
  progress: Progress,
  warnings: string[]
) {
  if (reports.length === 0) return;

  await deleteByIds(
    supabase,
    "survey_reports",
    ids(reports),
    progress,
    "survey reports",
    plural(reports.length, "survey report")
  );

  const paths = reports.map((report) => report.file_path).filter(Boolean);

  for (const part of chunks(paths)) {
    const { error } = await supabase.storage.from(SURVEY_REPORTS_BUCKET).remove(part);
    if (error) {
      console.error("Survey report file remove error:", error);
      warnings.push("Some survey report PDF files could not be removed from Storage (the records are gone).");
      break;
    }
  }
}

/**
 * Delete everything in the graph, children first. Throws DeleteError
 * with a what-was/wasn't-deleted message on the first failure.
 */
export async function deleteGraph(supabase: SupabaseServerClient, graph: DeleteGraph) {
  const progress: Progress = { done: [] };
  const warnings: string[] = [];

  await deleteScheduleEvents(supabase, graph.scheduleEvents, progress);
  await deleteSurveyReports(supabase, graph.surveyReports, progress, warnings);

  await deleteByIds(supabase, "invoice_payments", graph.payments.map((p) => p.id), progress, "the payment records", plural(graph.payments.length, "payment record"));
  await deleteByIds(supabase, "guarantees", ids(graph.guarantees), progress, "the guarantees", plural(graph.guarantees.length, "guarantee"));
  await deleteChildren(supabase, "invoice_items", "invoice_id", ids(graph.invoices), progress, "the invoice line items");
  await deleteByIds(supabase, "invoices", ids(graph.invoices), progress, "the invoices", plural(graph.invoices.length, "invoice"));
  await deleteChildren(supabase, "variation_items", "variation_id", ids(graph.variations), progress, "the variation line items");
  await deleteByIds(supabase, "variations", ids(graph.variations), progress, "the variations", plural(graph.variations.length, "variation"));
  await deleteByIds(supabase, "contracts", ids(graph.contracts), progress, "the contracts", plural(graph.contracts.length, "contract"));
  await deleteChildren(supabase, "quote_items", "quote_id", ids(graph.quotes), progress, "the quote line items");
  await deleteByIds(supabase, "quotes", ids(graph.quotes), progress, "the quotes", plural(graph.quotes.length, "quote"));
  await deleteByIds(supabase, "jobs", ids(graph.jobs), progress, "the jobs", plural(graph.jobs.length, "job"));

  if (graph.client) {
    await deleteByIds(supabase, "clients", [graph.client.id], progress, "the client", "the client");
  }

  return { done: progress.done, warnings };
}

/* =========================================================
   SINGLE RECORDS
   ========================================================= */

export async function loadSingle(
  supabase: SupabaseServerClient,
  table: "quotes" | "contracts" | "invoices" | "guarantees" | "variations",
  id: string
) {
  const { data, error } = await supabase.from(table).select("*").eq("id", id).maybeSingle();

  if (error) {
    console.error(`Delete: ${table} load error`, error);
    throw new DeleteError("This record could not be loaded, so nothing was deleted.");
  }

  return (data as Row | null) ?? null;
}

export async function linkedRefs(
  supabase: SupabaseServerClient,
  table: string,
  column: string,
  id: string,
  numberKey: string,
  fallback: string
): Promise<Ref[]> {
  const rows = await selectAny(supabase, table, `id, ${numberKey}`, [{ column, ids: [id] }]);
  return rows.map((row) => ({ id: str(row.id), label: str(row[numberKey]) || fallback }));
}

export async function invoicePayments(supabase: SupabaseServerClient, invoiceId: string) {
  const rows = await selectAny(supabase, "invoice_payments", "id, invoice_id, amount", [
    { column: "invoice_id", ids: [invoiceId] },
  ]);

  return rows.map((row) => ({ id: str(row.id), amount: Number(row.amount ?? 0) || 0 }));
}

export async function deleteInvoiceRecord(supabase: SupabaseServerClient, invoiceId: string, label: string) {
  const progress: Progress = { done: [] };
  const payments = await invoicePayments(supabase, invoiceId);

  await deleteByIds(supabase, "invoice_payments", ids(payments), progress, "the payment records", plural(payments.length, "payment record"));
  await clearLink(supabase, "guarantees", "invoice_id", invoiceId, progress, `the link from guarantees to ${label}`);
  await deleteChildren(supabase, "invoice_items", "invoice_id", [invoiceId], progress, "the invoice line items");
  await deleteByIds(supabase, "invoices", [invoiceId], progress, label, label);

  return progress.done;
}

export async function deleteQuoteRecord(supabase: SupabaseServerClient, quoteId: string, label: string) {
  const progress: Progress = { done: [] };

  await deleteChildren(supabase, "quote_items", "quote_id", [quoteId], progress, "the quote line items");
  await deleteByIds(supabase, "quotes", [quoteId], progress, label, label);

  return progress.done;
}

export async function deleteContractRecord(supabase: SupabaseServerClient, contractId: string, label: string) {
  const progress: Progress = { done: [] };

  await clearLink(supabase, "invoices", "contract_id", contractId, progress, `the link from invoices to ${label}`);
  await clearLink(supabase, "guarantees", "contract_id", contractId, progress, `the link from guarantees to ${label}`);
  await clearLink(supabase, "schedule_events", "contract_id", contractId, progress, `the link from Schedule appointments to ${label}`);
  await deleteByIds(supabase, "contracts", [contractId], progress, label, label);

  return progress.done;
}

export async function deleteGuaranteeRecord(supabase: SupabaseServerClient, guaranteeId: string, label: string) {
  const progress: Progress = { done: [] };
  await deleteByIds(supabase, "guarantees", [guaranteeId], progress, label, label);
  return progress.done;
}

export async function deleteVariationRecord(supabase: SupabaseServerClient, variationId: string, label: string) {
  const progress: Progress = { done: [] };

  await deleteChildren(supabase, "variation_items", "variation_id", [variationId], progress, "the variation line items");
  await deleteByIds(supabase, "variations", [variationId], progress, label, label);

  return progress.done;
}
