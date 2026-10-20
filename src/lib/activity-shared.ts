/*
 * Activity feed: pure types and helpers (safe for client and server).
 */

export type ActivityRecordType =
  | "quote"
  | "contract"
  | "invoice"
  | "guarantee"
  | "variation"
  | "job"
  | "survey"
  | "survey_report"
  | "client";

export type ActivityEventType =
  | "email.sent"
  | "email.delivered"
  | "email.opened"
  | "email.clicked"
  | "email.bounced"
  | "email.complained"
  | "link.viewed"
  | "quote.accepted"
  | "quote.declined"
  | "contract.signed"
  | "variation.accepted"
  | "variation.declined"
  | "payment.recorded"
  | "invoice.paid"
  | "survey.booked"
  | "survey.updated"
  | "survey.cancelled"
  | "survey_report.uploaded"
  | "record.created"
  | "record.deleted"
  | "client.created"
  | "client.imported"
  | "staff.signed_up";

export type ActivityItem = {
  id: string;
  created_at: string;
  event_type: string;
  record_type: string | null;
  record_id: string | null;
  record_number: string | null;
  client_id: string | null;
  client_name: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  /** true when derived from existing timestamps rather than logged */
  derived?: boolean;
};

export const RECORD_LABELS: Record<ActivityRecordType, string> = {
  quote: "Quote",
  contract: "Contract",
  invoice: "Invoice",
  guarantee: "Guarantee",
  variation: "Variation",
  job: "Job",
  survey: "Survey",
  survey_report: "Survey report",
  client: "Client",
};

const RECORD_PATHS: Partial<Record<ActivityRecordType, string>> = {
  quote: "/quotes",
  contract: "/contracts",
  invoice: "/invoices",
  guarantee: "/guarantees",
  variation: "/variations",
  job: "/jobs",
  survey: "/surveys",
  client: "/clients",
};

export function isRecordType(value: unknown): value is ActivityRecordType {
  return typeof value === "string" && value in RECORD_LABELS;
}

/* ---------- filter categories ---------- */

export const ACTIVITY_CATEGORIES = [
  { key: "email", label: "Emails sent", types: ["email.sent"] },
  {
    key: "tracking",
    label: "Delivered / opened",
    types: ["email.delivered", "email.opened", "email.clicked", "email.bounced", "email.complained"],
  },
  { key: "viewed", label: "Links viewed", types: ["link.viewed"] },
  {
    key: "responses",
    label: "Accepted / signed",
    types: ["quote.accepted", "quote.declined", "contract.signed", "variation.accepted", "variation.declined"],
  },
  { key: "payments", label: "Payments", types: ["payment.recorded", "invoice.paid"] },
  {
    key: "surveys",
    label: "Surveys",
    types: ["survey.booked", "survey.updated", "survey.cancelled", "survey_report.uploaded"],
  },
  { key: "clients", label: "Clients", types: ["client.created", "client.imported"] },
  { key: "staff", label: "Staff", types: ["staff.signed_up"] },
  { key: "created", label: "Records created", types: ["record.created"] },
  { key: "deleted", label: "Deleted", types: ["record.deleted"] },
] as const;

export type ActivityCategoryKey = (typeof ACTIVITY_CATEGORIES)[number]["key"];

export function categoryTypes(key: string | null | undefined): readonly string[] | null {
  const found = ACTIVITY_CATEGORIES.find((category) => category.key === key);
  return found ? found.types : null;
}

/* ---------- display ---------- */

export type ActivityTone = "slate" | "blue" | "sky" | "emerald" | "amber" | "red" | "violet" | "gold";

export function activityTone(eventType: string): ActivityTone {
  switch (eventType) {
    case "email.sent":
      return "blue";
    case "email.delivered":
    case "email.opened":
    case "email.clicked":
    case "link.viewed":
      return "sky";
    case "quote.accepted":
    case "contract.signed":
    case "variation.accepted":
    case "payment.recorded":
    case "invoice.paid":
      return "emerald";
    case "quote.declined":
    case "variation.declined":
    case "survey.cancelled":
    case "email.bounced":
    case "email.complained":
    case "record.deleted":
      return "red";
    case "survey.booked":
    case "survey.updated":
    case "survey_report.uploaded":
      return "gold";
    case "client.created":
    case "client.imported":
      return "violet";
    case "staff.signed_up":
      return "emerald";
    default:
      return "slate";
  }
}

export const TONE_DOT: Record<ActivityTone, string> = {
  slate: "bg-slate-400",
  blue: "bg-blue-500",
  sky: "bg-sky-400",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-[#be1e2d]",
  violet: "bg-violet-500",
  gold: "bg-[#f29e23]",
};

export function activityHref(item: Pick<ActivityItem, "event_type" | "record_type" | "record_id" | "metadata">) {
  if (item.event_type === "record.deleted") return null;
  if (item.record_type === "survey_report") {
    const jobId = item.metadata?.job_id;
    return typeof jobId === "string" && jobId ? `/surveys/${jobId}` : null;
  }
  if (!item.record_id || !isRecordType(item.record_type)) return null;
  const base = RECORD_PATHS[item.record_type];
  return base ? `${base}/${item.record_id}` : null;
}

function recordLabel(recordType: string | null, recordNumber: string | null) {
  const label = isRecordType(recordType) ? RECORD_LABELS[recordType] : "Record";
  return recordNumber ? `${label} ${recordNumber}` : label;
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    return value.split(/[,;]/).map((part) => part.trim()).filter(Boolean);
  }
  return [];
}

function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function gbp(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);
}

/**
 * Plain-English sentence for an event, e.g.
 * "Invoice INV-1022 viewed by Michael and Christina".
 */
export function buildActivitySummary(event: {
  event_type: string;
  record_type: string | null;
  record_number: string | null;
  client_name: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const meta = event.metadata ?? {};
  const record = recordLabel(event.record_type, event.record_number);
  const client = event.client_name?.trim() || "";
  const by = client ? ` by ${client}` : "";
  const recipients = joinNames(asList(meta.recipients));
  const emailOf = event.record_type ? `${record} email` : `Email${meta.subject ? ` “${String(meta.subject)}”` : ""}`;

  switch (event.event_type) {
    case "email.sent":
      return `${record} emailed${recipients ? ` to ${recipients}` : client ? ` to ${client}` : ""}`;
    case "email.delivered":
      return `${emailOf} delivered${recipients ? ` to ${recipients}` : ""}`;
    case "email.opened":
      return `${emailOf} opened${client ? ` by ${client}` : recipients ? ` by ${recipients}` : ""}`;
    case "email.clicked":
      return `${emailOf} link clicked${client ? ` by ${client}` : recipients ? ` by ${recipients}` : ""}`;
    case "email.bounced":
      return `${emailOf} bounced${recipients ? ` (${recipients})` : ""}`;
    case "email.complained":
      return `${emailOf} marked as spam${recipients ? ` by ${recipients}` : ""}`;
    case "link.viewed":
      return `${record} ${meta.first ? "opened for the first time" : "viewed"}${by}`;
    case "quote.accepted":
    case "variation.accepted":
      return `${record} accepted${meta.manual ? " (marked manually)" : by}`;
    case "quote.declined":
    case "variation.declined":
      return `${record} declined${by}`;
    case "contract.signed": {
      const signer = typeof meta.signed_name === "string" && meta.signed_name ? meta.signed_name : client;
      return `${record} signed${signer ? ` by ${signer}` : ""}`;
    }
    case "payment.recorded": {
      const amount = gbp(meta.amount);
      return `Payment${amount ? ` of ${amount}` : ""} recorded on ${record}${client ? ` (${client})` : ""}`;
    }
    case "invoice.paid":
      return `${record} paid in full${client ? ` (${client})` : ""}`;
    case "survey.booked":
      return `Survey booked${client ? ` for ${client}` : ""}${meta.when ? ` – ${String(meta.when)}` : ""}`;
    case "survey.updated":
      return `Survey ${event.record_number ?? ""}`.trim() + ` updated${client ? ` (${client})` : ""}`;
    case "survey.cancelled":
      return `Survey ${event.record_number ?? ""}`.trim() + ` cancelled${client ? ` (${client})` : ""}`;
    case "survey_report.uploaded":
      return `Survey report${meta.title ? ` “${String(meta.title)}”` : ""} uploaded${client ? ` for ${client}` : ""}`;
    case "record.created":
      return `${record} created${client ? ` for ${client}` : ""}`;
    case "record.deleted":
      return `${typeof meta.label === "string" && meta.label ? meta.label : record} deleted${client ? ` (${client})` : ""}`;
    case "client.created":
      return client ? `New client ${client} added` : "New client added";
    case "client.imported": {
      const count = Number(meta.count);
      return Number.isFinite(count) && count > 0
        ? `${count} client${count === 1 ? "" : "s"} imported`
        : "Clients imported";
    }
    case "staff.signed_up":
      return `${typeof meta.name === "string" && meta.name ? meta.name : "An employee"} signed up to the staff portal`;
    default:
      return `${record} ${event.event_type}`;
  }
}

/* ---------- time ---------- */

export function formatRelativeTime(iso: string, now: Date = new Date()) {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const seconds = Math.round((now.getTime() - then) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.round(days / 7);
  if (days < 31) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  const months = Math.round(days / 30.4);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.round(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

export function formatUkDateTime(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

/* ---------- merge / dedupe ---------- */

const DEDUPE_WINDOW_MS = 15 * 60 * 1000;

function dedupeKey(item: ActivityItem) {
  return `${item.event_type}|${item.record_type ?? ""}|${item.record_id ?? ""}`;
}

/**
 * Merge logged events with ones derived from timestamps. A derived item
 * is dropped when a logged event of the same type for the same record
 * sits within 15 minutes of it. Newest first.
 */
export function mergeActivity(logged: ActivityItem[], derived: ActivityItem[]) {
  const loggedTimes = new Map<string, number[]>();

  for (const item of logged) {
    const key = dedupeKey(item);
    const list = loggedTimes.get(key) ?? [];
    list.push(new Date(item.created_at).getTime());
    loggedTimes.set(key, list);
  }

  const seenDerived = new Set<string>();
  const keptDerived = derived.filter((item) => {
    const time = new Date(item.created_at).getTime();
    if (!Number.isFinite(time)) return false;
    const exact = `${dedupeKey(item)}|${time}`;
    if (seenDerived.has(exact)) return false;
    seenDerived.add(exact);
    const times = loggedTimes.get(dedupeKey(item));
    return !times?.some((t) => Math.abs(t - time) <= DEDUPE_WINDOW_MS);
  });

  return [...logged, ...keptDerived].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}
