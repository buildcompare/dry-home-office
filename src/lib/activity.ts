/*
 * Activity log (server side).
 *
 * - logActivity / logRecordActivity / logPublicView write to
 *   public.activity_events. They NEVER throw: if the table is missing
 *   (supabase/activity_events.sql not run yet) or RLS blocks the insert,
 *   the main action carries on and a warning is logged.
 * - loadActivityFeed merges logged events with activity derived from
 *   existing timestamp columns (sent_at, viewed_at, accepted_at …), so
 *   the feed is useful before any events have been logged.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildActivitySummary,
  categoryTypes,
  mergeActivity,
  type ActivityEventType,
  type ActivityItem,
  type ActivityRecordType,
} from "@/lib/activity-shared";
import { SURVEY_JOB_TYPE } from "@/lib/survey";

// Both the session client and the service-role client are SupabaseClients.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any, any, any>;

export type ActivityInput = {
  event_type: ActivityEventType;
  record_type: ActivityRecordType | null;
  record_id: string | null;
  record_number?: string | null;
  client_id?: string | null;
  client_name?: string | null;
  summary?: string;
  metadata?: Record<string, unknown>;
};

const VIEW_THROTTLE_MS = 60 * 60 * 1000;

type ClientNameParts = {
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
} | null | undefined;

export function clientDisplayName(client: ClientNameParts | ClientNameParts[]) {
  const value = Array.isArray(client) ? client[0] : client;
  if (!value) return null;
  return (
    value.display_name?.trim() ||
    [value.first_name, value.last_name].filter(Boolean).join(" ").trim() ||
    null
  );
}

function warn(message: string, error: unknown) {
  console.warn(`[activity] ${message}:`, error instanceof Error ? error.message : error);
}

/** Insert one event. Never throws. Returns true when it was stored. */
export async function logActivity(supabase: AnySupabase, input: ActivityInput) {
  try {
    const metadata = input.metadata ?? {};
    const row = {
      event_type: input.event_type,
      record_type: input.record_type,
      record_id: input.record_id,
      record_number: input.record_number ?? null,
      client_id: input.client_id ?? null,
      client_name: input.client_name ?? null,
      metadata,
      summary:
        input.summary ||
        buildActivitySummary({
          event_type: input.event_type,
          record_type: input.record_type,
          record_number: input.record_number ?? null,
          client_name: input.client_name ?? null,
          metadata,
        }),
    };

    const { error } = await supabase.from("activity_events").insert(row);

    if (error) {
      warn(`could not log ${input.event_type}`, error.message);
      return false;
    }

    return true;
  } catch (error) {
    warn(`could not log ${input.event_type}`, error);
    return false;
  }
}

/* ---------- record lookup ---------- */

const RECORD_SOURCES: Partial<Record<ActivityRecordType, { table: string; number: string | null }>> = {
  quote: { table: "quotes", number: "quote_number" },
  contract: { table: "contracts", number: "contract_number" },
  invoice: { table: "invoices", number: "invoice_number" },
  guarantee: { table: "guarantees", number: "guarantee_number" },
  variation: { table: "variations", number: "variation_number" },
  job: { table: "jobs", number: "job_number" },
  survey: { table: "jobs", number: "job_number" },
  client: { table: "clients", number: null },
};

type RecordInfo = { record_number: string | null; client_id: string | null; client_name: string | null };

export async function lookupRecord(
  supabase: AnySupabase,
  recordType: ActivityRecordType,
  recordId: string
): Promise<RecordInfo> {
  const empty: RecordInfo = { record_number: null, client_id: null, client_name: null };
  const source = RECORD_SOURCES[recordType];
  if (!source) return empty;

  try {
    if (recordType === "client") {
      const { data } = await supabase
        .from("clients")
        .select("id, display_name, first_name, last_name")
        .eq("id", recordId)
        .maybeSingle();
      return { record_number: null, client_id: recordId, client_name: clientDisplayName(data) };
    }

    const number = source.number ? `${source.number}, ` : "";
    const attempts = [
      `${number}client_id, clients ( display_name, first_name, last_name )`,
      `${number}client_id`,
    ];

    for (const columns of attempts) {
      const { data, error } = await supabase.from(source.table).select(columns).eq("id", recordId).maybeSingle();
      if (error) continue;
      const row = (data ?? {}) as Record<string, unknown>;
      return {
        record_number: source.number ? ((row[source.number] as string | null) ?? null) : null,
        client_id: row.client_id != null ? String(row.client_id) : null,
        client_name: clientDisplayName(row.clients as ClientNameParts),
      };
    }
  } catch (error) {
    warn(`could not look up ${recordType}`, error);
  }

  return empty;
}

/** Log an event for a record, looking up its number and client. Never throws. */
export async function logRecordActivity(
  supabase: AnySupabase,
  input: {
    event_type: ActivityEventType;
    record_type: ActivityRecordType;
    record_id: string;
    metadata?: Record<string, unknown>;
    known?: Partial<RecordInfo>;
  }
) {
  try {
    const known = input.known ?? {};
    const needsLookup = !known.record_number || !known.client_name;
    const looked = needsLookup ? await lookupRecord(supabase, input.record_type, input.record_id) : null;

    return await logActivity(supabase, {
      event_type: input.event_type,
      record_type: input.record_type,
      record_id: input.record_id,
      record_number: known.record_number ?? looked?.record_number ?? null,
      client_id: known.client_id ?? looked?.client_id ?? null,
      client_name: known.client_name ?? looked?.client_name ?? null,
      metadata: input.metadata,
    });
  } catch (error) {
    warn(`could not log ${input.event_type}`, error);
    return false;
  }
}

/**
 * Log a customer opening a public link (/q, /c, /i, /g, /v). The first
 * view is always logged; repeat views at most once per hour per record.
 */
export async function logPublicView(
  supabase: AnySupabase,
  recordType: ActivityRecordType,
  recordId: string,
  options: { firstView: boolean }
) {
  try {
    const { data, error } = await supabase
      .from("activity_events")
      .select("created_at")
      .eq("event_type", "link.viewed")
      .eq("record_type", recordType)
      .eq("record_id", recordId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) return false; // table not set up yet

    const last = data?.[0]?.created_at ? new Date(data[0].created_at).getTime() : null;

    if (last && Date.now() - last < VIEW_THROTTLE_MS) return false;

    return await logRecordActivity(supabase, {
      event_type: "link.viewed",
      record_type: recordType,
      record_id: recordId,
      metadata: { first: options.firstView && !last },
    });
  } catch (error) {
    warn("could not log a link view", error);
    return false;
  }
}

/* =========================================================
   FEED
   ========================================================= */

type Row = Record<string, unknown>;

function str(value: unknown) {
  return value == null || value === "" ? null : String(value);
}

function derivedItem(
  event_type: ActivityEventType,
  record_type: ActivityRecordType,
  _row: Row,
  at: unknown,
  info: { record_id: string | null; record_number: string | null; client_id: string | null; client_name: string | null },
  metadata: Record<string, unknown> = {}
): ActivityItem | null {
  const created_at = str(at);
  if (!created_at || !Number.isFinite(new Date(created_at).getTime())) return null;

  const item: ActivityItem = {
    id: `derived:${event_type}:${record_type}:${info.record_id ?? ""}:${created_at}`,
    created_at: new Date(created_at).toISOString(),
    event_type,
    record_type,
    record_id: info.record_id,
    record_number: info.record_number,
    client_id: info.client_id,
    client_name: info.client_name,
    metadata,
    summary: "",
    derived: true,
  };

  item.summary = buildActivitySummary(item);
  return item;
}

type DerivedSource = {
  table: string;
  recordType: ActivityRecordType;
  number: string | null;
  /** column lists to try, most detailed first */
  columns: string[];
  toItems: (row: Row) => (ActivityItem | null)[];
};

function infoFor(row: Row, number: string | null) {
  return {
    record_id: str(row.id),
    record_number: number ? str(row[number]) : null,
    client_id: str(row.client_id),
    client_name: clientDisplayName(row.clients as ClientNameParts),
  };
}

const CLIENT_EMBED = "clients ( display_name, first_name, last_name )";

function documentSource(
  table: string,
  recordType: ActivityRecordType,
  number: string,
  extra: string[],
  events: (row: Row, info: ReturnType<typeof infoFor>) => (ActivityItem | null)[]
): DerivedSource {
  const base = ["id", number, "client_id", "created_at", "sent_at", "sent_to", "viewed_at", ...extra].join(", ");
  const minimal = ["id", number, "client_id", "sent_at", "viewed_at"].join(", ");
  return {
    table,
    recordType,
    number,
    columns: [`${base}, ${CLIENT_EMBED}`, base, `${minimal}, ${CLIENT_EMBED}`, minimal],
    toItems: (row) => {
      const info = infoFor(row, number);
      return [
        derivedItem("record.created", recordType, row, row.created_at, info),
        derivedItem("email.sent", recordType, row, row.sent_at, info, { recipients: str(row.sent_to) ?? undefined }),
        derivedItem("link.viewed", recordType, row, row.viewed_at, info, { first: true }),
        ...events(row, info),
      ];
    },
  };
}

const DERIVED_SOURCES: DerivedSource[] = [
  documentSource("quotes", "quote", "quote_number", ["accepted_at", "declined_at"], (row, info) => [
    derivedItem("quote.accepted", "quote", row, row.accepted_at, info),
    derivedItem("quote.declined", "quote", row, row.declined_at, info),
  ]),
  documentSource("contracts", "contract", "contract_number", ["signed_at", "signed_name"], (row, info) => [
    derivedItem("contract.signed", "contract", row, row.signed_at, info, { signed_name: str(row.signed_name) ?? undefined }),
  ]),
  documentSource("invoices", "invoice", "invoice_number", ["paid_at"], (row, info) => [
    derivedItem("invoice.paid", "invoice", row, row.paid_at, info),
  ]),
  documentSource("guarantees", "guarantee", "guarantee_number", [], () => []),
  documentSource("variations", "variation", "variation_number", ["accepted_at", "declined_at"], (row, info) => [
    derivedItem("variation.accepted", "variation", row, row.accepted_at, info),
    derivedItem("variation.declined", "variation", row, row.declined_at, info),
  ]),
  {
    table: "invoice_payments",
    recordType: "invoice",
    number: null,
    columns: [
      `id, invoice_id, amount, payment_date, created_at, invoices ( invoice_number, client_id, ${CLIENT_EMBED} )`,
      "id, invoice_id, amount, payment_date, created_at",
      "id, invoice_id, amount, payment_date",
    ],
    toItems: (row) => {
      const invoice = (Array.isArray(row.invoices) ? row.invoices[0] : row.invoices) as Row | null;
      const info = {
        record_id: str(row.invoice_id),
        record_number: invoice ? str(invoice.invoice_number) : null,
        client_id: invoice ? str(invoice.client_id) : null,
        client_name: invoice ? clientDisplayName(invoice.clients as ClientNameParts) : null,
      };
      const item = derivedItem("payment.recorded", "invoice", row, row.created_at ?? row.payment_date, info, {
        amount: row.amount,
      });
      if (item) item.id = `derived:payment:${String(row.id)}`;
      return [item];
    },
  },
  {
    table: "clients",
    recordType: "client",
    number: null,
    columns: ["id, display_name, first_name, last_name, created_at"],
    toItems: (row) => [
      derivedItem("client.created", "client", row, row.created_at, {
        record_id: str(row.id),
        record_number: null,
        client_id: str(row.id),
        client_name: clientDisplayName(row as ClientNameParts),
      }),
    ],
  },
  {
    table: "jobs",
    recordType: "job",
    number: "job_number",
    columns: [
      `id, job_number, job_type, client_id, created_at, ${CLIENT_EMBED}`,
      "id, job_number, job_type, client_id, created_at",
    ],
    toItems: (row) => {
      const info = infoFor(row, "job_number");
      return row.job_type === SURVEY_JOB_TYPE
        ? [derivedItem("survey.booked", "survey", row, row.created_at, info)]
        : [derivedItem("record.created", "job", row, row.created_at, info)];
    },
  },
  {
    table: "survey_reports",
    recordType: "survey_report",
    number: null,
    columns: ["id, job_id, client_id, title, file_name, uploaded_at, sent_at, sent_to"],
    toItems: (row) => {
      const info = { record_id: str(row.id), record_number: null, client_id: str(row.client_id), client_name: null };
      const metadata = { job_id: str(row.job_id), title: str(row.title) ?? str(row.file_name) };
      return [
        derivedItem("survey_report.uploaded", "survey_report", row, row.uploaded_at, info, metadata),
        derivedItem("email.sent", "survey_report", row, row.sent_at, info, {
          ...metadata,
          recipients: str(row.sent_to) ?? undefined,
        }),
      ];
    },
  },
];

const DERIVED_ROW_LIMIT = 500;

async function loadDerived(supabase: AnySupabase): Promise<ActivityItem[]> {
  const results = await Promise.all(
    DERIVED_SOURCES.map(async (source) => {
      const orderColumn = source.table === "survey_reports" ? "uploaded_at" : "created_at";

      for (const columns of source.columns) {
        // Newest rows first where the table has the column; otherwise any order.
        for (const ordered of [true, false]) {
          try {
            let query = supabase.from(source.table).select(columns);
            if (ordered) query = query.order(orderColumn, { ascending: false });
            const { data, error } = await query.limit(DERIVED_ROW_LIMIT);
            if (error) continue;
            return ((data ?? []) as unknown as Row[]).flatMap((row) => source.toItems(row));
          } catch {
            continue;
          }
        }
      }
      return [];
    })
  );

  return results.flat().filter((item): item is ActivityItem => Boolean(item));
}

export type ActivityFeed = {
  items: ActivityItem[];
  total: number;
  /** false when activity_events isn't set up yet (derived only) */
  logAvailable: boolean;
};

const LOGGED_LIMIT = 1000;

export async function loadActivityFeed(
  supabase: AnySupabase,
  options: { limit: number; offset?: number; category?: string | null; clientId?: string | null }
): Promise<ActivityFeed> {
  const types = categoryTypes(options.category);

  let logAvailable = true;
  let logged: ActivityItem[] = [];

  try {
    let query = supabase
      .from("activity_events")
      .select("id, created_at, event_type, record_type, record_id, record_number, client_id, client_name, summary, metadata")
      .order("created_at", { ascending: false })
      .limit(LOGGED_LIMIT);

    if (types) query = query.in("event_type", [...types]);
    if (options.clientId) query = query.eq("client_id", options.clientId);

    const { data, error } = await query;

    if (error) {
      logAvailable = false;
    } else {
      logged = ((data ?? []) as Row[]).map((row) => ({
        id: String(row.id),
        created_at: String(row.created_at),
        event_type: String(row.event_type),
        record_type: str(row.record_type),
        record_id: str(row.record_id),
        record_number: str(row.record_number),
        client_id: str(row.client_id),
        client_name: str(row.client_name),
        summary: str(row.summary) ?? "",
        metadata: (row.metadata as Record<string, unknown>) ?? {},
      }));
      for (const item of logged) {
        if (!item.summary) item.summary = buildActivitySummary(item);
      }
    }
  } catch {
    logAvailable = false;
  }

  const derived = (await loadDerived(supabase)).filter(
    (item) =>
      (!types || types.includes(item.event_type)) &&
      (!options.clientId || item.client_id === options.clientId)
  );

  const merged = mergeActivity(logged, derived);
  const offset = Math.max(0, options.offset ?? 0);

  return {
    items: merged.slice(offset, offset + options.limit),
    total: merged.length,
    logAvailable,
  };
}

/** Log a survey report event, labelled with its survey job number and client. Never throws. */
export async function logSurveyReportActivity(
  supabase: AnySupabase,
  event_type: "survey_report.uploaded" | "email.sent",
  report: { id: string; job_id: string; title?: string | null; file_name?: string | null },
  metadata: Record<string, unknown> = {}
) {
  try {
    const job = await lookupRecord(supabase, "survey", report.job_id);
    return await logActivity(supabase, {
      event_type,
      record_type: "survey_report",
      record_id: report.id,
      record_number: job.record_number,
      client_id: job.client_id,
      client_name: job.client_name,
      metadata: { job_id: report.job_id, title: report.title || report.file_name || null, ...metadata },
    });
  } catch (error) {
    warn(`could not log ${event_type}`, error);
    return false;
  }
}

/** Metadata for an email.sent event, including the Resend id used to match webhooks. */
export function emailSentMetadata(recipients: string[], resendId: string | null | undefined, subject: string) {
  return { recipients, resend_id: resendId ?? null, subject };
}
