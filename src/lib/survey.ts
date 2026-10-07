/*
 * Pure helpers for the Book Survey flow and the survey payment badges.
 *
 * No server imports, so this file is safe to use from client
 * components, server components, server actions and tsx tests.
 */

/* =========================================================
   CONSTANTS
   ========================================================= */

/*
 * jobs.job_type: "Damp Survey" is the survey value from the job type
 * list the Add Job form used to offer. If the database rejects it, the
 * booking action falls back to "Other" and the title still says
 * "Damp survey – …".
 */
export const SURVEY_JOB_TYPE = "Damp Survey";
export const SURVEY_JOB_TYPE_FALLBACK = "Other";

/*
 * jobs.status: "Survey Booked" is part of the job workflow
 * (see updateJobStatus). "Enquiry" is the existing default.
 */
export const SURVEY_JOB_STATUS = "Survey Booked";
export const SURVEY_JOB_STATUS_FALLBACK = "Enquiry";

/* schedule_events.event_type used by the Schedule page for surveys. */
export const SURVEY_EVENT_TYPE = "Survey";

/*
 * Invoice title and line item name. The title is also how a survey
 * invoice is told apart from any later works invoices on the job.
 */
export const SURVEY_INVOICE_TITLE = "Damp survey";

/* invoices.invoice_type: the survey fee is the whole (final) amount. */
export const SURVEY_INVOICE_TYPE = "Final";

export const SURVEY_PAYMENT_TERMS = "Payment due on receipt.";

export const SURVEY_TITLE_PREFIX = "Damp survey";

export const DEFAULT_SURVEY_MINUTES = 60;

/* =========================================================
   CLIENT SEARCH
   ========================================================= */

export type SurveyClientOption = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  secondaryEmail: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  town: string | null;
  county: string | null;
  postcode: string | null;
};

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

/*
 * Phone numbers are matched on digits only, and a +44 / 44 prefix is
 * treated the same as a leading 0.
 */
function phoneVariants(phone: string | null | undefined) {
  const digits = digitsOnly(String(phone ?? ""));

  if (!digits) {
    return [];
  }

  const variants = [digits];

  if (digits.startsWith("44")) {
    variants.push(`0${digits.slice(2)}`);
  } else if (digits.startsWith("0")) {
    variants.push(`44${digits.slice(1)}`);
  }

  return variants;
}

function clientHaystack(client: SurveyClientOption) {
  const text = [
    client.name,
    client.company,
    client.email,
    client.secondaryEmail,
    client.postcode,
    client.phone,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const postcodeCompact = String(client.postcode ?? "")
    .replace(/\s+/g, "")
    .toLowerCase();

  return [text, postcodeCompact, ...phoneVariants(client.phone)].join(" ");
}

/**
 * True when every word typed matches the client's name, company,
 * email, secondary email, phone or postcode.
 */
export function clientMatchesQuery(
  client: SurveyClientOption,
  query: string
) {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

  if (tokens.length === 0) {
    return false;
  }

  const haystack = clientHaystack(client);
  const compactQuery = query.replace(/\s+/g, "").toLowerCase();
  const queryDigits = digitsOnly(query);

  // A phone number typed with or without spaces or a +44 prefix.
  if (/^[\d\s+()-]+$/.test(query.trim()) && queryDigits.length >= 5) {
    const queryVariants = phoneVariants(queryDigits);

    if (
      phoneVariants(client.phone).some((variant) =>
        queryVariants.some((candidate) => variant.includes(candidate))
      )
    ) {
      return true;
    }
  }

  // A postcode typed with or without the space.
  if (
    compactQuery.length >= 3 &&
    String(client.postcode ?? "")
      .replace(/\s+/g, "")
      .toLowerCase()
      .includes(compactQuery)
  ) {
    return true;
  }

  return tokens.every((token) => haystack.includes(token));
}

function matchRank(client: SurveyClientOption, query: string) {
  const needle = query.trim().toLowerCase();
  const name = client.name.toLowerCase();

  if (name === needle) return 0;
  if (name.startsWith(needle)) return 1;
  if (name.split(/\s+/).some((part) => part.startsWith(needle))) return 2;
  if ((client.company ?? "").toLowerCase().startsWith(needle)) return 3;
  return 4;
}

/**
 * Matching clients for the search box, best matches first.
 */
export function searchClients(
  clients: SurveyClientOption[],
  query: string,
  limit = 8
) {
  if (!query.trim()) {
    return [];
  }

  return clients
    .filter((client) => clientMatchesQuery(client, query))
    .map((client, index) => ({
      client,
      index,
      rank: matchRank(client, query),
    }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.client);
}

/**
 * Prefill the new client name from the search text, but not when the
 * search was obviously an email, phone number or postcode.
 */
export function suggestedNameFromQuery(query: string) {
  const trimmed = query.trim();

  if (
    !trimmed ||
    trimmed.includes("@") ||
    /\d/.test(trimmed)
  ) {
    return "";
  }

  return trimmed;
}

/* =========================================================
   ADDRESS + TITLE
   ========================================================= */

export type AddressParts = {
  address_line_1?: string | null;
  address_line_2?: string | null;
  town?: string | null;
  county?: string | null;
  postcode?: string | null;
};

function clean(value: string | null | undefined) {
  return String(value ?? "").trim();
}

export function formatAddress(address: AddressParts | null | undefined) {
  if (!address) {
    return "";
  }

  return [
    address.address_line_1,
    address.address_line_2,
    address.town,
    address.county,
    address.postcode,
  ]
    .map(clean)
    .filter(Boolean)
    .join(", ");
}

export function hasAddress(address: AddressParts | null | undefined) {
  return formatAddress(address) !== "";
}

/**
 * "Damp survey – <site town or first address line>".
 */
export function buildSurveyJobTitle(address: AddressParts | null | undefined) {
  const place =
    clean(address?.town) ||
    clean(address?.address_line_1) ||
    clean(address?.postcode);

  return place
    ? `${SURVEY_TITLE_PREFIX} – ${place}`
    : SURVEY_TITLE_PREFIX;
}

/* =========================================================
   DATE + TIME
   ========================================================= */

export function isValidDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value);
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Add minutes to "HH:MM", stopping at 23:59 so the survey never
 * spills into the next day.
 */
export function addMinutesToTime(value: string, minutes: number) {
  if (!isValidTime(value)) {
    return "";
  }

  const total = Math.min(timeToMinutes(value) + minutes, 23 * 60 + 59);
  const hours = Math.floor(total / 60);
  const mins = total % 60;

  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function isEndAfterStart(start: string, end: string) {
  return (
    isValidTime(start) &&
    isValidTime(end) &&
    timeToMinutes(end) > timeToMinutes(start)
  );
}

/**
 * "Thursday 8 October 2026"
 */
export function formatSurveyDate(dateKey: string) {
  if (!isValidDateKey(dateKey)) {
    return dateKey;
  }

  const [year, month, day] = dateKey.split("-").map(Number);

  const parts = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).formatToParts(new Date(Date.UTC(year, month - 1, day)));

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";

  // Built from parts so it reads the same everywhere (no stray comma).
  return `${part("weekday")} ${part("day")} ${part("month")} ${part("year")}`;
}

/**
 * "Thursday 8 October 2026 at 09:00–10:00"
 */
export function formatSurveyWhen(
  dateKey: string,
  startTime?: string | null,
  endTime?: string | null
) {
  const date = formatSurveyDate(dateKey);
  const start = startTime ? startTime.slice(0, 5) : "";
  const end = endTime ? endTime.slice(0, 5) : "";

  if (!start) {
    return date;
  }

  return end ? `${date} at ${start}–${end}` : `${date} at ${start}`;
}

/**
 * Invoice line description, e.g.
 * "Damp survey – Thursday 8 October 2026 at 09:00 – 12 Oak Lane, Reading, RG1 2AB"
 */
export function buildSurveyItemDescription(
  dateKey: string,
  startTime: string | null,
  address: AddressParts | null | undefined
) {
  const when = formatSurveyWhen(dateKey, startTime);
  const site = formatAddress(address);

  return [SURVEY_INVOICE_TITLE, when, site].filter(Boolean).join(" – ");
}

function dateKeyToUtc(dateKey: string) {
  const [year, month, day] = dateKey.slice(0, 10).split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

/**
 * True when the survey is today or within the next `days` days.
 */
export function isSurveyDueSoon(
  surveyDate: string | null | undefined,
  today: string,
  days = 3
) {
  if (!surveyDate || !isValidDateKey(surveyDate.slice(0, 10))) {
    return false;
  }

  const difference = Math.round(
    (dateKeyToUtc(surveyDate) - dateKeyToUtc(today)) / 86400000
  );

  return difference >= 0 && difference <= days;
}

/* =========================================================
   FEE
   ========================================================= */

/**
 * Parse the survey fee. Returns null unless it is a positive amount
 * with at most two decimal places.
 */
export function parseSurveyFee(value: string) {
  const trimmed = value.trim().replace(/^£/, "").replace(/,/g, "");

  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }

  const amount = Number(trimmed);

  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) {
    return null;
  }

  return Math.round(amount * 100) / 100;
}

/* =========================================================
   SURVEY JOBS + PAYMENT STATE
   ========================================================= */

export function isSurveyJob(job: {
  job_type?: string | null;
  title?: string | null;
} | null | undefined) {
  if (!job) {
    return false;
  }

  return (
    clean(job.job_type).toLowerCase() === SURVEY_JOB_TYPE.toLowerCase() ||
    clean(job.title).toLowerCase().startsWith(SURVEY_TITLE_PREFIX.toLowerCase())
  );
}

export function isSurveyInvoice(invoice: {
  title?: string | null;
} | null | undefined) {
  return clean(invoice?.title)
    .toLowerCase()
    .startsWith(SURVEY_INVOICE_TITLE.toLowerCase());
}

type Numeric = number | string | null | undefined;

export type SurveyInvoiceLike = {
  title?: string | null;
  status?: string | null;
  amount?: Numeric;
  subtotal?: Numeric;
  vat_amount?: Numeric;
  amount_paid?: Numeric;
};

function num(value: Numeric) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function invoiceTotal(invoice: SurveyInvoiceLike) {
  const amount = num(invoice.amount);

  if (amount > 0) {
    return Math.round(amount * 100) / 100;
  }

  return Math.round((num(invoice.subtotal) + num(invoice.vat_amount)) * 100) / 100;
}

export function invoiceOutstanding(invoice: SurveyInvoiceLike) {
  return Math.max(
    0,
    Math.round((invoiceTotal(invoice) - num(invoice.amount_paid)) * 100) / 100
  );
}

export function isInvoicePaid(invoice: SurveyInvoiceLike) {
  if (invoice.status === "Paid") {
    return true;
  }

  return invoiceTotal(invoice) > 0 && invoiceOutstanding(invoice) <= 0.009;
}

/**
 * "paid" / "unpaid" for a survey job from its linked survey
 * invoice(s). null when there is no survey invoice to go on.
 */
export function surveyPaymentState(
  job: { job_type?: string | null; title?: string | null } | null | undefined,
  invoices: SurveyInvoiceLike[]
): "paid" | "unpaid" | null {
  if (!isSurveyJob(job)) {
    return null;
  }

  const surveyInvoices = invoices.filter(
    (invoice) =>
      invoice.status !== "Cancelled" &&
      isSurveyInvoice(invoice)
  );

  if (surveyInvoices.length === 0) {
    return null;
  }

  return surveyInvoices.every(isInvoicePaid) ? "paid" : "unpaid";
}

/* =========================================================
   BOOKING RESULT
   ========================================================= */

export type BookSurveyState = {
  error: string | null;
  /*
   * Set when a new client was saved but the booking then stopped,
   * so the form can select that client instead of adding it twice.
   */
  newClient?: SurveyClientOption | null;
};

export type SurveyEmailOutcome =
  | { status: "sent"; recipients: string[] }
  | { status: "no-email" }
  | { status: "not-requested" }
  | { status: "failed"; error: string }
  | { status: "no-invoice" };

function listRecipients(recipients: string[]) {
  if (recipients.length <= 1) {
    return recipients[0] ?? "";
  }

  return `${recipients.slice(0, -1).join(", ")} and ${
    recipients[recipients.length - 1]
  }`;
}

/**
 * Success banner, e.g. "Survey booked for Thursday 8 October 2026 at
 * 09:00–10:00. Invoice INV-1042 created and emailed to jo@example.com."
 */
export function buildSurveyBookedNotice({
  when,
  invoiceNumber,
  email,
}: {
  when: string;
  invoiceNumber: string | null;
  email: SurveyEmailOutcome;
}) {
  const first = `Survey booked for ${when}.`;

  if (!invoiceNumber) {
    return first;
  }

  switch (email.status) {
    case "sent":
      return `${first} Invoice ${invoiceNumber} created and emailed to ${listRecipients(
        email.recipients
      )}.`;

    case "no-email":
      return `${first} Invoice ${invoiceNumber} created. It was not emailed because the client has no email address.`;

    case "failed":
      return `${first} Invoice ${invoiceNumber} created, but it could not be emailed (${email.error}). Use Email Invoice on the invoice to send it.`;

    default:
      return `${first} Invoice ${invoiceNumber} created (not emailed).`;
  }
}
