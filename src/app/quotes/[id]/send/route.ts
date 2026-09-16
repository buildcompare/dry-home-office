import React from "react";
import path from "path";
import { readFile } from "fs/promises";
import { Resend } from "resend";
import { renderToBuffer } from "@react-pdf/renderer";

import { createClient } from "@/lib/supabase/server";
import QuotePdfDocument from "@/components/QuotePdfDocument";

export const runtime = "nodejs";

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
  _request: Request,
  { params }: RouteProps
) {
  const { id } = await params;

  const apiKey =
    process.env.RESEND_API_KEY;

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(
      /\/$/,
      ""
    );

  if (!apiKey) {
    console.error(
      "RESEND_API_KEY is missing"
    );

    return redirectToQuote(
      id,
      "error",
      "Email service is not configured."
    );
  }

  if (!appUrl) {
    console.error(
      "NEXT_PUBLIC_APP_URL is missing"
    );

    return redirectToQuote(
      id,
      "error",
      "The customer quote link is not configured."
    );
  }

  const supabase =
    await createClient();

  const {
    data: quote,
    error: quoteError,
  } = await supabase
    .from("quotes")
    .select(`
      id,
      quote_number,
      public_token,
      title,
      description,
      status,
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
        address_line_1,
        address_line_2,
        town,
        county,
        postcode
      ),
      jobs (
        id,
        job_number,
        title
      )
    `)
    .eq("id", id)
    .single();

  if (quoteError || !quote) {
    console.error(
      "Unable to load quote:",
      quoteError
    );

    return redirectToQuote(
      id,
      "error",
      "Unable to find the quotation."
    );
  }

  if (!quote.public_token) {
    console.error(
      "Quote public token missing"
    );

    return redirectToQuote(
      id,
      "error",
      "This quotation does not have a customer access link."
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
      "Unable to load quote items:",
      itemsError
    );

    return redirectToQuote(
      id,
      "error",
      "Unable to load the quotation items."
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

  const recipient =
    client?.email?.trim();

  if (!recipient) {
    return redirectToQuote(
      id,
      "error",
      "This client does not have an email address."
    );
  }

  const clientName =
    client?.display_name ||
    [
      client?.first_name,
      client?.last_name,
    ]
      .filter(Boolean)
      .join(" ") ||
    "Customer";

  const clientAddressLines = [
    client?.address_line_1,
    client?.address_line_2,
    client?.town,
    client?.county,
    client?.postcode,
  ].filter(
    (value): value is string =>
      Boolean(value)
  );

  const labourItems =
    quoteItems
      ?.filter(
        (item) =>
          item.item_type !==
          "Materials"
      )
      .map((item) => ({
        id: item.id,
        description:
          item.description,
        quantity: Number(
          item.quantity
        ),
        unit: item.unit,
        unit_price: Number(
          item.unit_price
        ),
      })) ?? [];

  const materialItems =
    quoteItems
      ?.filter(
        (item) =>
          item.item_type ===
          "Materials"
      )
      .map((item) => ({
        id: item.id,
        description:
          item.description,
        quantity: Number(
          item.quantity
        ),
        unit: item.unit,
        unit_price: Number(
          item.unit_price
        ),
      })) ?? [];

  const logoDataUri =
    await loadLogoFromDisk();

  let pdfBuffer: Buffer;

  try {
    const pdfDocument =
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

          clientEmail:
            client?.email ||
            null,

          clientPhone:
            client?.phone ||
            null,

          clientAddressLines,

          jobNumber:
            job?.job_number ||
            null,

          jobTitle:
            job?.title ||
            null,

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

    pdfBuffer =
      await renderToBuffer(
        pdfDocument
      );
  } catch (pdfError) {
    console.error(
      "Unable to generate email PDF:",
      pdfError
    );

    return redirectToQuote(
      id,
      "error",
      "Unable to generate the PDF attachment."
    );
  }

  const filename =
    `${quote.quote_number}-${quote.title}`
      .replace(
        /[^a-zA-Z0-9-_ ]/g,
        ""
      )
      .replace(/\s+/g, "-");

  const customerQuoteUrl =
    `${appUrl}/q/${quote.public_token}`;

  const fromAddress =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Dry Home Damp Proofing Solutions <quotes@admin.dryhomedampproofing.co.uk>";

  const replyTo =
    process.env.DRYHOME_REPLY_TO_EMAIL?.trim();

  const resend =
    new Resend(apiKey);

  const subject =
    `Quotation ${quote.quote_number} – ${quote.title}`;

  const html =
    buildEmailHtml({
      clientName,
      quoteNumber:
        quote.quote_number,
      title:
        quote.title,
      total: Number(
        quote.amount ?? 0
      ),
      customerQuoteUrl,
    });

  const text =
    buildEmailText({
      clientName,
      quoteNumber:
        quote.quote_number,
      title:
        quote.title,
      total: Number(
        quote.amount ?? 0
      ),
      customerQuoteUrl,
    });

  const {
    data: emailData,
    error: sendError,
  } = await resend.emails.send({
    from: fromAddress,
    to: recipient,
    subject,
    html,
    text,

    ...(replyTo
      ? {
          replyTo,
        }
      : {}),

    attachments: [
      {
        content:
          pdfBuffer.toString(
            "base64"
          ),

        filename:
          `${filename}.pdf`,
      },
    ],
  });

  if (sendError) {
    console.error(
      "Resend email error:",
      sendError
    );

    return redirectToQuote(
      id,
      "error",
      "The quotation could not be emailed. Please try again."
    );
  }

  console.log(
    "Quote email sent:",
    emailData?.id
  );

  const sentAt =
    new Date().toISOString();

  const {
    error: updateError,
  } = await supabase
    .from("quotes")
    .update({
      status:
        quote.status ===
          "Accepted" ||
        quote.status ===
          "Declined"
          ? quote.status
          : "Sent",

      sent_to: recipient,
      sent_at: sentAt,
    })
    .eq("id", id);

  if (updateError) {
    console.error(
      "Email sent but quote status update failed:",
      updateError
    );

    return redirectToQuote(
      id,
      "warning",
      "The email was sent, but DryHome Office could not update the quote status."
    );
  }

  return redirectToQuote(
    id,
    "sent",
    "1"
  );
}

async function loadLogoFromDisk():
  Promise<string | null> {
  try {
    const logoPath =
      path.join(
        process.cwd(),
        "public",
        "dryhome-logo-light.png"
      );

    const logoBuffer =
      await readFile(
        logoPath
      );

    return `data:image/png;base64,${logoBuffer.toString(
      "base64"
    )}`;
  } catch (error) {
    console.error(
      "Unable to load PDF logo:",
      error
    );

    return null;
  }
}

function buildEmailHtml({
  clientName,
  quoteNumber,
  title,
  total,
  customerQuoteUrl,
}: {
  clientName: string;
  quoteNumber: string;
  title: string;
  total: number;
  customerQuoteUrl: string;
}) {
  return `
<!DOCTYPE html>
<html>
  <body style="
    margin:0;
    padding:0;
    background:#f1f5f9;
    font-family:Arial,Helvetica,sans-serif;
    color:#334155;
  ">
    <div style="
      max-width:640px;
      margin:0 auto;
      padding:32px 20px;
    ">
      <div style="
        background:#ffffff;
        border-radius:12px;
        overflow:hidden;
      ">
        <div style="
          background:#0f172a;
          padding:28px 32px;
        ">
          <div style="
            color:#ffffff;
            font-size:22px;
            font-weight:700;
          ">
            Dry Home Damp Proofing Solutions
          </div>

          <div style="
            margin-top:6px;
            color:#cbd5e1;
            font-size:13px;
          ">
            Professional Damp Proofing & Property Solutions
          </div>
        </div>

        <div style="
          padding:32px;
        ">
          <p style="
            margin:0 0 18px 0;
            font-size:16px;
          ">
            Dear ${escapeHtml(
              clientName
            )},
          </p>

          <p style="
            margin:0 0 18px 0;
            line-height:1.6;
          ">
            Thank you for the opportunity to provide a quotation for the proposed works.
          </p>

          <p style="
            margin:0 0 22px 0;
            line-height:1.6;
          ">
            You can view your quotation online using the button below. A PDF copy is also attached for your records.
          </p>

          <div style="
            background:#f8fafc;
            border:1px solid #e2e8f0;
            border-radius:8px;
            padding:20px;
            margin:24px 0;
          ">
            <div style="
              font-size:12px;
              text-transform:uppercase;
              color:#94a3b8;
              margin-bottom:5px;
            ">
              Quotation
            </div>

            <div style="
              color:#0f172a;
              font-size:18px;
              font-weight:700;
            ">
              ${escapeHtml(
                quoteNumber
              )}
            </div>

            <div style="
              margin-top:8px;
              color:#475569;
            ">
              ${escapeHtml(title)}
            </div>

            <div style="
              margin-top:18px;
              font-size:12px;
              text-transform:uppercase;
              color:#94a3b8;
            ">
              Total
            </div>

            <div style="
              margin-top:4px;
              color:#0f172a;
              font-size:24px;
              font-weight:700;
            ">
              ${formatCurrency(
                total
              )}
            </div>
          </div>

          <div style="
            text-align:center;
            margin:30px 0;
          ">
            <a
              href="${escapeHtml(
                customerQuoteUrl
              )}"
              style="
                display:inline-block;
                background:#0f172a;
                color:#ffffff;
                text-decoration:none;
                padding:14px 28px;
                border-radius:8px;
                font-size:16px;
                font-weight:700;
              "
            >
              View Quote
            </a>
          </div>

          <p style="
            margin:0 0 18px 0;
            line-height:1.6;
            font-size:14px;
            color:#64748b;
          ">
            From the online quotation you can review the works and accept or decline the quotation.
          </p>

          <p style="
            margin:0 0 18px 0;
            line-height:1.6;
          ">
            If you have any questions, please get in touch and we will be happy to help.
          </p>

          <p style="
            margin:28px 0 0 0;
            line-height:1.6;
          ">
            Kind regards,<br>
            <strong>
              Dry Home Damp Proofing Solutions LTD
            </strong><br>
            dryhomedampproofing.co.uk
          </p>
        </div>
      </div>
    </div>
  </body>
</html>
`;
}

function buildEmailText({
  clientName,
  quoteNumber,
  title,
  total,
  customerQuoteUrl,
}: {
  clientName: string;
  quoteNumber: string;
  title: string;
  total: number;
  customerQuoteUrl: string;
}) {
  return [
    `Dear ${clientName},`,
    "",
    "Thank you for the opportunity to provide a quotation for the proposed works.",
    "",
    `Quotation: ${quoteNumber}`,
    `Title: ${title}`,
    `Total: ${formatCurrency(
      total
    )}`,
    "",
    "View your quotation online:",
    customerQuoteUrl,
    "",
    "You can review and accept or decline the quotation using the secure link above.",
    "",
    "A PDF copy is also attached for your records.",
    "",
    "If you have any questions, please get in touch and we will be happy to help.",
    "",
    "Kind regards,",
    "Dry Home Damp Proofing Solutions LTD",
    "dryhomedampproofing.co.uk",
  ].join("\n");
}

function formatCurrency(
  value: number
) {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "GBP",
    }
  ).format(value);
}

function escapeHtml(
  value: string
) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}

function redirectToQuote(
  id: string,
  key: string,
  value: string
) {
  const params =
    new URLSearchParams();

  params.set(
    key,
    value
  );

  return new Response(null, {
    status: 303,

    headers: {
      Location:
        `/quotes/${id}?${params.toString()}`,
    },
  });
}