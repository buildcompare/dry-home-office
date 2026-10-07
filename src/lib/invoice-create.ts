/*
 * Shared invoice creation: totals maths, invoice number, the invoice row
 * and its line items. Used by the New Invoice form (addInvoice) and the
 * Book Survey flow so both create invoices in exactly the same way.
 */

import type { createClient } from "@/lib/supabase/server";
import { allocateDocumentNumber } from "@/lib/numbering";
import { money } from "@/lib/money";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type CleanInvoiceItem = {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  item_type: string;
};

/**
 * Same maths as the invoice form: subtotal of quantity x unit price,
 * VAT only when enabled, every figure rounded to pence.
 */
export function calculateInvoiceTotals(
  items: Pick<CleanInvoiceItem, "quantity" | "unit_price">[],
  vatEnabled: boolean,
  vatRate: number
) {
  const subtotal = money(
    items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
  );

  const vatAmount = vatEnabled ? money(subtotal * (vatRate / 100)) : 0;

  const total = money(subtotal + vatAmount);

  return { subtotal, vatAmount, total };
}

export type NewInvoiceFields = {
  clientId: string;
  jobId: string | null;
  quoteId: string | null;
  contractId: string | null;
  invoiceType: string;
  title: string;
  description: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  customerMessage: string | null;
  paymentTerms: string | null;
  internalNotes: string | null;
  vatEnabled: boolean;
  vatRate: number;
};

/**
 * Allocate the next invoice number, insert the invoice as a Draft and
 * then its items. If the items cannot be saved the invoice row is
 * removed again so no half-made invoice is left behind.
 *
 * Throws an Error with a readable message on failure.
 */
export async function insertInvoiceWithItems(
  supabase: SupabaseServerClient,
  fields: NewInvoiceFields,
  items: CleanInvoiceItem[]
) {
  const { subtotal, vatAmount, total } = calculateInvoiceTotals(
    items,
    fields.vatEnabled,
    fields.vatRate
  );

  const invoiceNumber = await allocateDocumentNumber("invoice");

  /* =======================================================
     INSERT INVOICE
     ======================================================= */

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      invoice_number: invoiceNumber,
      client_id: fields.clientId,
      job_id: fields.jobId,
      quote_id: fields.quoteId,
      contract_id: fields.contractId,
      invoice_type: fields.invoiceType,
      title: fields.title,
      description: fields.description,
      invoice_date: fields.invoiceDate,
      due_date: fields.dueDate,
      status: "Draft",
      subtotal,
      vat_enabled: fields.vatEnabled,
      vat_rate: fields.vatEnabled ? fields.vatRate : 0,
      vat_amount: vatAmount,
      amount: total,
      amount_paid: 0,
      customer_message: fields.customerMessage,
      payment_terms: fields.paymentTerms,
      internal_notes: fields.internalNotes,
      public_token: crypto.randomUUID(),
    })
    .select("id")
    .single();

  if (invoiceError || !invoice) {
    console.error(invoiceError);

    throw new Error(
      invoiceError?.message || "The invoice could not be created."
    );
  }

  /* =======================================================
     INVOICE ITEMS
     ======================================================= */

  const invoiceItems = items.map((item, index) => ({
    invoice_id: invoice.id,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    unit_price: item.unit_price,
    item_type: item.item_type,
    sort_order: index,
  }));

  const { error: itemsError } = await supabase
    .from("invoice_items")
    .insert(invoiceItems);

  if (itemsError) {
    await supabase.from("invoices").delete().eq("id", invoice.id);

    console.error(itemsError);

    throw new Error(
      itemsError.message || "The invoice items could not be saved."
    );
  }

  return {
    id: invoice.id as string,
    invoiceNumber,
    subtotal,
    vatAmount,
    total,
  };
}
