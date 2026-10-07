import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";

import GuaranteePdfDocument from "@/components/GuaranteePdfDocument";
import { loadClientSecondaryEmail } from "@/lib/client-secondary-email";
import { loadPdfLogoDataUri } from "@/lib/pdf-logo";
import type { createClient } from "@/lib/supabase/server";

/*
 * Builds the guarantee PDF. Used by both the download route
 * (/guarantees/[id]/pdf) and the email attachment
 * (/guarantees/[id]/send) so they always render identically.
 */

type Address = {
  address_line_1?: string | null;
  address_line_2?: string | null;
  town?: string | null;
  county?: string | null;
  postcode?: string | null;
};

export type GuaranteePdfSource = {
  guarantee: {
    guarantee_number: string;
    title?: string | null;
    guarantee_type?: string | null;
    issue_date?: string | null;
    expiry_date?: string | null;
    duration_years?: number | string | null;
    covered_works?: string | null;
    terms?: string | null;
    exclusions?: string | null;
    customer_message?: string | null;
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
  contract:
    | {
        contract_number?: string | null;
      }
    | null
    | undefined;
  invoice:
    | {
        invoice_number?: string | null;
      }
    | null
    | undefined;
};

/* Columns the guarantee PDF needs, for a guarantees select. */
export const GUARANTEE_PDF_SELECT = `
  id,
  guarantee_number,
  client_id,
  guarantee_type,
  title,
  status,
  issue_date,
  duration_years,
  expiry_date,
  covered_works,
  terms,
  exclusions,
  customer_message,
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
  contracts (
    id,
    contract_number
  ),
  invoices (
    id,
    invoice_number
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
 * Loads everything the guarantee PDF needs (guarantee, client, job,
 * linked contract/invoice, client secondary email).
 */
export async function loadGuaranteePdfSource(
  supabase: ServerSupabase,
  id: string
): Promise<GuaranteePdfSource | null> {
  const { data: guarantee, error } = await supabase
    .from("guarantees")
    .select(GUARANTEE_PDF_SELECT)
    .eq("id", id)
    .single();

  if (error || !guarantee) {
    console.error("Unable to load guarantee for PDF:", error);

    return null;
  }

  const client = single(guarantee.clients);

  const clientSecondaryEmail = await loadClientSecondaryEmail(
    supabase,
    client?.id ?? guarantee.client_id
  );

  return {
    guarantee,
    client,
    clientSecondaryEmail,
    job: single(guarantee.jobs),
    contract: single(guarantee.contracts),
    invoice: single(guarantee.invoices),
  };
}

export async function renderGuaranteePdf({
  guarantee,
  client,
  clientSecondaryEmail,
  job,
  contract,
  invoice,
}: GuaranteePdfSource): Promise<Buffer> {
  const clientAddressLines = addressLines(client);
  const jobAddressLines = addressLines(job);

  const durationYears = Number(guarantee.duration_years ?? 0);

  const logoDataUri = await loadPdfLogoDataUri();

  const document = React.createElement(GuaranteePdfDocument, {
    logoDataUri,

    guaranteeNumber: guarantee.guarantee_number,
    title: guarantee.title || "Works Guarantee",
    guaranteeType: guarantee.guarantee_type || "Works Guarantee",
    issueDate: guarantee.issue_date ?? null,
    expiryDate: guarantee.expiry_date ?? null,
    durationYears:
      Number.isFinite(durationYears) && durationYears > 0
        ? durationYears
        : null,

    clientName: guaranteeClientName(client),
    clientCompanyName: client?.company_name || null,
    clientEmail: client?.email || null,
    clientSecondaryEmail: clientSecondaryEmail || null,
    clientPhone: client?.phone || null,
    clientAddressLines,

    jobNumber: job?.job_number || null,
    jobTitle: job?.title || null,
    siteAddressLines:
      jobAddressLines.length > 0 ? jobAddressLines : clientAddressLines,

    contractNumber: contract?.contract_number || null,
    invoiceNumber: invoice?.invoice_number || null,

    coveredWorks: guarantee.covered_works?.trim() || null,
    terms: guarantee.terms?.trim() || null,
    exclusions: guarantee.exclusions?.trim() || null,
    customerMessage: guarantee.customer_message?.trim() || null,
  });

  return renderToBuffer(document);
}

export function guaranteePdfFilename(
  guaranteeNumber: string,
  title: string | null | undefined
) {
  return `${guaranteeNumber}-${title || "Guarantee"}`
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function guaranteeClientName(
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

function addressLines(record: Address | null | undefined) {
  return [
    record?.address_line_1,
    record?.address_line_2,
    record?.town,
    record?.county,
    record?.postcode,
  ].filter((value): value is string => Boolean(value?.trim()));
}
