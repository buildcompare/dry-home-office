import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";

import InvoicePdfDocument, {
  type InvoicePdfItem,
} from "@/components/InvoicePdfDocument";
import { loadClientSecondaryEmail } from "@/lib/client-secondary-email";
import {
  invoicePaymentDetails,
  invoicePaymentTerms,
} from "@/lib/company-payment-details";
import { invoiceRowTotal, money } from "@/lib/money";
import { loadPdfLogoDataUri } from "@/lib/pdf-logo";
import type { createClient } from "@/lib/supabase/server";

/*
 * Builds the invoice PDF. Used by both the download route
 * (/invoices/[id]/pdf) and the email attachment
 * (/invoices/[id]/send) so they always render identically.
 */

type Address = {
  address_line_1?: string | null;
  address_line_2?: string | null;
  town?: string | null;
  county?: string | null;
  postcode?: string | null;
};

type Numeric = number | string | null | undefined;

export type InvoicePdfSource = {
  invoice: {
    invoice_number: string;
    title?: string | null;
    invoice_type?: string | null;
    description?: string | null;
    invoice_date?: string | null;
    due_date?: string | null;
    subtotal?: Numeric;
    vat_enabled?: boolean | null;
    vat_rate?: Numeric;
    vat_amount?: Numeric;
    amount?: Numeric;
    amount_paid?: Numeric;
    customer_message?: string | null;
    payment_terms?: string | null;
  };
  client:
    | (Address & {
        display_name?: string | null;
        first_name?: string | null;
        last_name?: string | null;
        company_name?: string | null;
        email?: string | null;
        phone?: string | null;
      })
    | null
    | undefined;
  clientSecondaryEmail?: string | null;
  job:
    | (Address & {
        job_number?: string | null;
        title?: string | null;
      })
    | null
    | undefined;
  quote:
    | {
        quote_number?: string | null;
      }
    | null
    | undefined;
  contract:
    | {
        contract_number?: string | null;
      }
    | null
    | undefined;
  items: Array<{
    id: string;
    description?: string | null;
    quantity?: Numeric;
    unit?: string | null;
    unit_price?: Numeric;
    item_type?: string | null;
  }>;
};

/* Columns the invoice PDF needs, for an invoices select. */
export const INVOICE_PDF_SELECT = `
  id,
  invoice_number,
  client_id,
  title,
  invoice_type,
  description,
  status,
  invoice_date,
  due_date,
  subtotal,
  vat_enabled,
  vat_rate,
  vat_amount,
  amount,
  amount_paid,
  customer_message,
  payment_terms,
  public_token,
  clients (
    id,
    display_name,
    first_name,
    last_name,
    email,
    phone,
    company_name,
    address_line_1,
    address_line_2,
    town,
    county,
    postcode
  ),
  jobs (
    id,
    job_number,
    title,
    address_line_1,
    address_line_2,
    town,
    county,
    postcode
  ),
  quotes (
    id,
    quote_number
  ),
  contracts (
    id,
    contract_number
  )
`;

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

function single<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

/*
 * Loads everything the invoice PDF needs (invoice, client, job,
 * linked quote/contract, line items, client secondary email).
 */
export async function loadInvoicePdfSource(
  supabase: ServerSupabase,
  id: string
): Promise<
  | (InvoicePdfSource & { publicToken: string | null })
  | null
> {
  const [invoiceResult, itemsResult] = await Promise.all([
    supabase
      .from("invoices")
      .select(INVOICE_PDF_SELECT)
      .eq("id", id)
      .single(),

    supabase
      .from("invoice_items")
      .select(`
        id,
        description,
        quantity,
        unit,
        unit_price,
        item_type,
        sort_order
      `)
      .eq("invoice_id", id)
      .order("sort_order", {
        ascending: true,
      }),
  ]);

  if (invoiceResult.error || !invoiceResult.data) {
    console.error(
      "Unable to load invoice for PDF:",
      invoiceResult.error
    );

    return null;
  }

  if (itemsResult.error) {
    console.error(
      "Unable to load invoice items for PDF:",
      itemsResult.error
    );
  }

  const invoice = invoiceResult.data;
  const client = single(invoice.clients);

  const clientSecondaryEmail = await loadClientSecondaryEmail(
    supabase,
    client?.id ?? invoice.client_id
  );

  return {
    invoice,
    client,
    clientSecondaryEmail,
    job: single(invoice.jobs),
    quote: single(invoice.quotes),
    contract: single(invoice.contracts),
    items: itemsResult.data ?? [],
    publicToken: invoice.public_token ?? null,
  };
}

export async function renderInvoicePdf({
  invoice,
  client,
  clientSecondaryEmail,
  job,
  quote,
  contract,
  items,
}: InvoicePdfSource): Promise<Buffer> {
  const clientAddressLines = addressLines(client);
  const jobAddressLines = addressLines(job);

  const pdfItems = items.map(
    (item): InvoicePdfItem & { item_type?: string | null } => ({
      id: item.id,
      description: item.description || "",
      quantity: toNumber(item.quantity),
      unit: item.unit || null,
      unit_price: toNumber(item.unit_price),
      item_type: item.item_type,
    })
  );

  /*
   * Same figures as the invoice page and email: stored amount,
   * falling back to subtotal + VAT for older invoices.
   */
  const total = invoiceRowTotal(invoice);
  const amountPaid = toNumber(invoice.amount_paid);
  const balanceDue = money(Math.max(total - amountPaid, 0));

  const logoDataUri = await loadPdfLogoDataUri();

  const document = React.createElement(InvoicePdfDocument, {
    logoDataUri,

    invoiceNumber: invoice.invoice_number,
    title: invoice.title || invoice.invoice_type || "Invoice",
    description: invoice.description?.trim() || null,
    invoiceDate: invoice.invoice_date ?? null,
    dueDate: invoice.due_date ?? null,

    clientName: invoiceClientName(client),
    clientCompanyName: client?.company_name || null,
    clientEmail: client?.email || null,
    clientSecondaryEmail: clientSecondaryEmail || null,
    clientPhone: client?.phone || null,
    clientAddressLines,

    jobNumber: job?.job_number || null,
    jobTitle: job?.title || null,
    siteAddressLines:
      jobAddressLines.length > 0 ? jobAddressLines : clientAddressLines,

    quoteNumber: quote?.quote_number || null,
    contractNumber: contract?.contract_number || null,

    labourItems: pdfItems.filter((item) => item.item_type !== "Materials"),
    materialItems: pdfItems.filter((item) => item.item_type === "Materials"),

    subtotal: toNumber(invoice.subtotal),
    vatEnabled: Boolean(invoice.vat_enabled),
    vatRate: Number(invoice.vat_rate ?? 20),
    vatAmount: toNumber(invoice.vat_amount),
    total,
    amountPaid,
    balanceDue,

    customerMessage: invoice.customer_message?.trim() || null,
    paymentTerms: invoicePaymentTerms(invoice.payment_terms),
    paymentDetails: invoicePaymentDetails(invoice.invoice_number),
  });

  return renderToBuffer(document);
}

export function invoicePdfFilename(
  invoiceNumber: string,
  title: string | null | undefined
) {
  return `${invoiceNumber}-${title || "Invoice"}`
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function invoiceClientName(
  client:
    | {
        display_name?: string | null;
        first_name?: string | null;
        last_name?: string | null;
      }
    | null
    | undefined
) {
  return (
    client?.display_name ||
    [client?.first_name, client?.last_name].filter(Boolean).join(" ") ||
    "Customer"
  );
}

function toNumber(value: Numeric) {
  const number = Number(value ?? 0);

  return Number.isFinite(number) ? number : 0;
}

function addressLines(record: Address | null | undefined) {
  return [
    record?.address_line_1,
    record?.address_line_2,
    record?.town,
    record?.county,
    record?.postcode,
  ].filter((value): value is string => Boolean(value?.trim()));
}
