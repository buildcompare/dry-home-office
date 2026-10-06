import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";

import { createClient } from "@/lib/supabase/server";
import { loadPdfLogoDataUri } from "@/lib/pdf-logo";
import QuotePdfDocument from "@/components/QuotePdfDocument";

export const runtime = "nodejs";

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: Request,
  { params }: RouteProps
) {
  const { id } = await params;

  const supabase = await createClient();

  const { data: quote, error } =
    await supabase
      .from("quotes")
      .select(`
        id,
        quote_number,
        title,
        description,
        quote_date,
        valid_until,
        subtotal,
        vat_enabled,
        vat_rate,
        vat_amount,
        amount,
        customer_message,
        terms,
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
        )
      `)
      .eq("id", id)
      .single();

  if (error || !quote) {
    return new Response(
      "Quote not found",
      {
        status: 404,
      }
    );
  }

  const {
    data: quoteItems,
    error: itemsError,
  } = await supabase
    .from("quote_items")
    .select(`
      id,
      description,
      quantity,
      unit,
      unit_price,
      item_type,
      sort_order
    `)
    .eq("quote_id", id)
    .order("sort_order", {
      ascending: true,
    });

  if (itemsError) {
    console.error(
      "PDF quote items error:",
      itemsError
    );

    return new Response(
      "Unable to load quote items",
      {
        status: 500,
      }
    );
  }

  const client =
    Array.isArray(quote.clients)
      ? quote.clients[0]
      : quote.clients;

  const job =
    Array.isArray(quote.jobs)
      ? quote.jobs[0]
      : quote.jobs;

  const clientName =
    client?.display_name ||
    [
      client?.first_name,
      client?.last_name,
    ]
      .filter(Boolean)
      .join(" ") ||
    "Customer";

  const clientAddressLines = filledAddress([
    client?.address_line_1,
    client?.address_line_2,
    client?.town,
    client?.county,
    client?.postcode,
  ]);

  const jobAddressLines = filledAddress([
    job?.address_line_1,
    job?.address_line_2,
    job?.town,
    job?.county,
    job?.postcode,
  ]);

  const siteAddressLines =
    jobAddressLines.length > 0
      ? jobAddressLines
      : clientAddressLines;

  const labourItems =
    quoteItems
      ?.filter(
        (item) =>
          item.item_type !== "Materials"
      )
      .map((item) => ({
        id: item.id,
        description: item.description,
        quantity: Number(item.quantity),
        unit: item.unit,
        unit_price: Number(
          item.unit_price
        ),
      })) ?? [];

  const materialItems =
    quoteItems
      ?.filter(
        (item) =>
          item.item_type === "Materials"
      )
      .map((item) => ({
        id: item.id,
        description: item.description,
        quantity: Number(item.quantity),
        unit: item.unit,
        unit_price: Number(
          item.unit_price
        ),
      })) ?? [];

  const logoDataUri =
    await loadPdfLogoDataUri();

  const document =
    React.createElement(
      QuotePdfDocument,
      {
        logoDataUri,

        quoteNumber:
          quote.quote_number,

        title:
          quote.title,

        description:
          quote.description,

        quoteDate:
          quote.quote_date,

        validUntil:
          quote.valid_until,

        clientName,

        clientCompanyName:
          client?.company_name || null,

        clientEmail:
          client?.email || null,

        clientPhone:
          client?.phone || null,

        clientAddressLines,

        jobNumber:
          job?.job_number || null,

        jobTitle:
          job?.title || null,

        siteAddressLines,

        labourItems,
        materialItems,

        subtotal: Number(
          quote.subtotal ?? 0
        ),

        vatEnabled: Boolean(
          quote.vat_enabled
        ),

        vatRate: Number(
          quote.vat_rate ?? 20
        ),

        vatAmount: Number(
          quote.vat_amount ?? 0
        ),

        total: Number(
          quote.amount ?? 0
        ),

        customerMessage:
          quote.customer_message,

        terms:
          quote.terms,
      }
    );

  const pdfBuffer =
    await renderToBuffer(
      document
    );

  const filename =
    `${quote.quote_number}-${quote.title}`
      .replace(
        /[^a-zA-Z0-9-_ ]/g,
        ""
      )
      .replace(/\s+/g, "-");

  return new Response(
    new Uint8Array(pdfBuffer),
    {
      status: 200,

      headers: {
        "Content-Type":
          "application/pdf",

        "Content-Disposition":
          `attachment; filename="${filename}.pdf"`,

        "Cache-Control":
          "private, no-store",
      },
    }
  );
}


function filledAddress(
  values: Array<string | null | undefined>
) {
  return values
    .map((value) => value?.trim() ?? "")
    .filter((value) => value.length > 0);
}

