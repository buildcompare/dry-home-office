/*
 * Shared quote form parsing and totals, used by Create Quote and Edit
 * Quote so both read the form and calculate totals in exactly the same
 * way.
 */

export type RawQuoteItem = {
  id?: string;
  description?: string;
  quantity?: number | string;
  unit?: string;
  unit_price?: number | string;
  item_type?: string;
};

export type QuoteFormItem = {
  id: string | null;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  item_type: "Labour" | "Materials";
  sort_order: number;
};

export type QuoteFormFields = {
  clientId: string;
  jobId: string | null;
  title: string;
  description: string;
  quoteDate: string;
  validUntil: string | null;
  customerMessage: string | null;
  terms: string | null;
  internalNotes: string | null;
  vatEnabled: boolean;
};

export const QUOTE_VAT_RATE = 20;

function text(formData: FormData, name: string) {
  return String(formData.get(name) || "").trim();
}

export function readQuoteFields(formData: FormData): QuoteFormFields {
  return {
    clientId: text(formData, "client_id"),
    jobId: text(formData, "job_id") || null,
    title: text(formData, "title"),
    description: text(formData, "description"),
    quoteDate: text(formData, "quote_date"),
    validUntil: text(formData, "valid_until") || null,
    customerMessage: text(formData, "customer_message") || null,
    // Additional terms: blank stays blank (standard terms only).
    terms: text(formData, "terms") || null,
    internalNotes: text(formData, "internal_notes") || null,
    vatEnabled: String(formData.get("vat_enabled") || "false") === "true",
  };
}

/**
 * Parse the hidden "items" JSON from QuoteFormItems. Returns null when
 * it can't be read. Rows without a description are dropped; sort order
 * follows the form (labour first, then materials).
 */
export function readQuoteItems(formData: FormData): QuoteFormItem[] | null {
  let parsed: RawQuoteItem[];

  try {
    parsed = JSON.parse(String(formData.get("items") || "[]"));
  } catch {
    return null;
  }

  if (!Array.isArray(parsed)) return null;

  return parsed
    .map((item, index) => {
      const quantity = Number(item.quantity ?? 0);
      const unitPrice = Number(item.unit_price ?? 0);

      return {
        id: typeof item.id === "string" && item.id ? item.id : null,
        description: String(item.description || "").trim(),
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
        unit: String(item.unit || "").trim() || "item",
        unit_price: Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0,
        item_type: item.item_type === "Materials" ? ("Materials" as const) : ("Labour" as const),
        sort_order: index,
      };
    })
    .filter((item) => item.description.length > 0);
}

/** Same maths as quote creation has always used. */
export function calculateQuoteTotals(
  items: { quantity: number; unit_price: number }[],
  vatEnabled: boolean
) {
  const subtotal = items.reduce((total, item) => total + item.quantity * item.unit_price, 0);
  const vatRate = QUOTE_VAT_RATE;
  const vatAmount = vatEnabled ? subtotal * (vatRate / 100) : 0;
  const total = subtotal + vatAmount;

  return { subtotal, vatRate, vatAmount, total };
}

/** Which statuses can be edited, and what the editor must show. */
export function quoteEditRules(status: string | null | undefined) {
  const value = String(status ?? "Draft");

  return {
    editable: true,
    needsAcceptedAck: value === "Accepted",
    clientHasOlderVersion: value === "Sent" || value === "Viewed",
  };
}
