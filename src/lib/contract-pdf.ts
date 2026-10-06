import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";

import ContractPdfDocument from "@/components/ContractPdfDocument";
import { loadPdfLogoDataUri } from "@/lib/pdf-logo";

/*
 * Builds the contract PDF. Used by both the download route
 * (/contracts/[id]/pdf) and the email attachment
 * (/contracts/[id]/send) so they always render identically.
 */

type Address = {
  address_line_1?: string | null;
  address_line_2?: string | null;
  town?: string | null;
  county?: string | null;
  postcode?: string | null;
};

export type ContractPdfSource = {
  contract: {
    contract_number: string;
    title?: string | null;
    status?: string | null;
    contract_date?: string | null;
    description?: string | null;
    terms?: string | null;
    customer_message?: string | null;
    amount?: number | string | null;
    signed_at?: string | null;
    signed_name?: string | null;
    signed_email?: string | null;
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
  job:
    | (Address & {
        job_number?: string | null;
        title?: string | null;
        job_type?: string | null;
      })
    | null
    | undefined;
  quote:
    | {
        quote_number?: string | null;
      }
    | null
    | undefined;
  customerUrl: string;
};

/* Columns the contract PDF needs, for a contracts select. */
export const CONTRACT_PDF_SELECT = `
  id,
  contract_number,
  title,
  status,
  amount,
  public_token,
  contract_date,
  description,
  terms,
  customer_message,
  signed_at,
  signed_name,
  signed_email,
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
    job_type,
    address_line_1,
    address_line_2,
    town,
    county,
    postcode
  ),
  quotes (
    id,
    quote_number
  )
`;

export async function renderContractPdf({
  contract,
  client,
  job,
  quote,
  customerUrl,
}: ContractPdfSource): Promise<Buffer> {
  const clientAddressLines = addressLines(client);
  const jobAddressLines = addressLines(job);

  const logoDataUri = await loadPdfLogoDataUri();

  const document = React.createElement(ContractPdfDocument, {
    logoDataUri,

    contractNumber: contract.contract_number,
    title: contract.title || "Customer Contract",
    status: contract.status || "Contract",
    contractDate: contract.contract_date ?? null,

    clientName: contractClientName(client),
    clientCompanyName: client?.company_name || null,
    clientEmail: client?.email || null,
    clientPhone: client?.phone || null,
    clientAddressLines,

    jobNumber: job?.job_number || null,
    jobTitle: job?.title || null,
    jobType: job?.job_type || null,
    propertyAddressLines:
      jobAddressLines.length > 0 ? jobAddressLines : clientAddressLines,

    quoteNumber: quote?.quote_number || null,

    description: contract.description ?? null,
    terms: contract.terms ?? null,
    customerMessage: contract.customer_message ?? null,

    total: Number(contract.amount ?? 0),

    signedAt: contract.signed_at ?? null,
    signedName: contract.signed_name ?? null,
    signedEmail: contract.signed_email ?? null,

    customerUrl,
  });

  return renderToBuffer(document);
}

export function contractPdfFilename(
  contractNumber: string,
  title: string | null | undefined
) {
  return `${contractNumber}-${title || "Contract"}`
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function contractClientName(
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
