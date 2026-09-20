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

type TemplateValues = {
  client_name: string;
  job_title: string;
  quote_number: string;
  quote_total: string;
  view_link: string;
};

const fallbackQuoteTemplate = {
  subject:
    "Quotation {{quote_number}} from Dry Home Damp Proofing Solutions",

  body: `Hi {{client_name}},

Thank you for giving us the opportunity to quote for the works at your property.

Please find quotation {{quote_number}} for {{job_title}}.

Quote total: {{quote_total}}

You can view the quotation and accept or decline it using the link below:

{{view_link}}

If you have any questions regarding the quotation or proposed works, simply reply to this email.

Kind regards,

James
Dry Home Damp Proofing Solutions`,
};

/* =========================================================
   SEND QUOTE
   ========================================================= */

export async function POST(
  _request: Request,
  { params }: RouteProps
) {
  const { id } =
    await params;

  const apiKey =
    process.env.RESEND_API_KEY;

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(
      /\/$/,
      ""
    );

  /* =========================================================
     CONFIG
     ========================================================= */

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

  /* =========================================================
     QUOTE
     ========================================================= */

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
    .eq(
      "id",
      id
    )
    .single();

  if (
    quoteError ||
    !quote
  ) {
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

  if (
    !quote.public_token
  ) {
    console.error(
      "Quote public token missing"
    );

    return redirectToQuote(
      id,
      "error",
      "This quotation does not have a customer access link."
    );
  }

  /* =========================================================
     QUOTE ITEMS + EMAIL TEMPLATE
     ========================================================= */

  const [
    itemsResult,
    templateResult,
  ] = await Promise.all([
    supabase
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
      .eq(
        "quote_id",
        id
      )
      .order(
        "sort_order",
        {
          ascending: true,
        }
      ),

    supabase
      .from("email_templates")
      .select(`
        subject,
        body
      `)
      .eq(
        "template_key",
        "quote"
      )
      .maybeSingle(),
  ]);

  if (
    itemsResult.error
  ) {
    console.error(
      "Unable to load quote items:",
      itemsResult.error
    );

    return redirectToQuote(
      id,
      "error",
      "Unable to load the quotation items."
    );
  }

  /*
   * Email templates deliberately have a fallback.
   *
   * If the database template ever disappears or cannot
   * be read, quote emails can still be sent.
   */

  if (
    templateResult.error
  ) {
    console.error(
      "Unable to load quote email template. Using fallback:",
      templateResult.error
    );
  }

  const emailTemplate = {
    subject:
      templateResult.data?.subject?.trim() ||
      fallbackQuoteTemplate.subject,

    body:
      templateResult.data?.body?.trim() ||
      fallbackQuoteTemplate.body,
  };

  const quoteItems =
    itemsResult.data ??
    [];

  /* =========================================================
     CLIENT / JOB
     ========================================================= */

  const client =
    Array.isArray(
      quote.clients
    )
      ? quote.clients[0]
      : quote.clients;

  const job =
    Array.isArray(
      quote.jobs
    )
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

  const jobTitle =
    job?.title ||
    quote.title ||
    "your job";

  const clientAddressLines = [
    client?.address_line_1,
    client?.address_line_2,
    client?.town,
    client?.county,
    client?.postcode,
  ].filter(
    (
      value
    ): value is string =>
      Boolean(value)
  );

  /* =========================================================
     QUOTE ITEMS
     ========================================================= */

  const labourItems =
    quoteItems
      .filter(
        (item) =>
          item.item_type !==
          "Materials"
      )
      .map(
        (item) => ({
          id:
            item.id,

          description:
            item.description,

          quantity:
            Number(
              item.quantity
            ),

          unit:
            item.unit,

          unit_price:
            Number(
              item.unit_price
            ),
        })
      );

  const materialItems =
    quoteItems
      .filter(
        (item) =>
          item.item_type ===
          "Materials"
      )
      .map(
        (item) => ({
          id:
            item.id,

          description:
            item.description,

          quantity:
            Number(
              item.quantity
            ),

          unit:
            item.unit,

          unit_price:
            Number(
              item.unit_price
            ),
        })
      );

  /* =========================================================
     PDF
     ========================================================= */

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

          subtotal:
            Number(
              quote.subtotal ??
                0
            ),

          vatEnabled:
            Boolean(
              quote.vat_enabled
            ),

          vatRate:
            Number(
              quote.vat_rate ??
                20
            ),

          vatAmount:
            Number(
              quote.vat_amount ??
                0
            ),

          total:
            Number(
              quote.amount ??
                0
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
  } catch (
    pdfError
  ) {
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

  /* =========================================================
     CUSTOMER URL
     ========================================================= */

  const customerQuoteUrl =
    `${appUrl}/q/${quote.public_token}`;

  /* =========================================================
     TEMPLATE VALUES
     ========================================================= */

  const templateValues: TemplateValues = {
    client_name:
      clientName,

    job_title:
      jobTitle,

    quote_number:
      quote.quote_number,

    quote_total:
      formatCurrency(
        Number(
          quote.amount ??
            0
        )
      ),

    view_link:
      customerQuoteUrl,
  };

  /* =========================================================
     SUBJECT
     ========================================================= */

  const subject =
    replaceTemplatePlaceholders(
      emailTemplate.subject,
      templateValues
    );

  /* =========================================================
     TEXT EMAIL
     ========================================================= */

  const text =
    replaceTemplatePlaceholders(
      emailTemplate.body,
      templateValues
    );

  /* =========================================================
     HTML EMAIL
     ========================================================= */

  const html =
    buildTemplateEmailHtml({
      templateBody:
        emailTemplate.body,

      values:
        templateValues,

      customerQuoteUrl,

      quoteNumber:
        quote.quote_number,

      quoteTitle:
        quote.title,

      quoteTotal:
        Number(
          quote.amount ??
            0
        ),
    });

  /* =========================================================
     EMAIL CONFIG
     ========================================================= */

  const fromAddress =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Dry Home Damp Proofing Solutions <quotes@admin.dryhomedampproofing.co.uk>";

  const replyTo =
    process.env.DRYHOME_REPLY_TO_EMAIL?.trim();

  const resend =
    new Resend(
      apiKey
    );

  const filename =
    `${quote.quote_number}-${quote.title}`
      .replace(
        /[^a-zA-Z0-9-_ ]/g,
        ""
      )
      .replace(
        /\s+/g,
        "-"
      );

  /* =========================================================
     SEND
     ========================================================= */

  const {
    data: emailData,
    error: sendError,
  } =
    await resend.emails.send({
      from:
        fromAddress,

      to:
        recipient,

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

  if (
    sendError
  ) {
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

  /* =========================================================
     UPDATE QUOTE
     ========================================================= */

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

      sent_to:
        recipient,

      sent_at:
        sentAt,
    })
    .eq(
      "id",
      id
    );

  if (
    updateError
  ) {
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

/* =========================================================
   TEMPLATE PLACEHOLDERS
   ========================================================= */

function replaceTemplatePlaceholders(
  template: string,
  values: TemplateValues
) {
  let result =
    template;

  for (
    const [
      key,
      value,
    ] of Object.entries(
      values
    )
  ) {
    result =
      result.replaceAll(
        `{{${key}}}`,
        value
      );
  }

  return result;
}

/* =========================================================
   HTML EMAIL
   ========================================================= */

function buildTemplateEmailHtml({
  templateBody,
  values,
  customerQuoteUrl,
  quoteNumber,
  quoteTitle,
  quoteTotal,
}: {
  templateBody: string;

  values:
    TemplateValues;

  customerQuoteUrl:
    string;

  quoteNumber:
    string;

  quoteTitle:
    string;

  quoteTotal:
    number;
}) {
  const bodyHtml =
    renderTemplateBodyHtml(
      templateBody,
      values,
      customerQuoteUrl
    );

  return `
<!DOCTYPE html>

<html>
  <head>
    <meta charset="utf-8">

    <meta
      name="viewport"
      content="width=device-width, initial-scale=1"
    >
  </head>

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
        border:1px solid #e2e8f0;
      ">

        <!-- HEADER -->

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
            Professional Damp Proofing &amp; Property Solutions
          </div>
        </div>

        <!-- TEMPLATE CONTENT -->

        <div style="
          padding:32px;
          font-size:15px;
          line-height:1.7;
          color:#334155;
        ">

          ${bodyHtml}

        </div>

        <!-- QUOTE SUMMARY -->

        <div style="
          margin:0 32px 32px 32px;
          padding:20px;
          background:#f8fafc;
          border:1px solid #e2e8f0;
          border-radius:8px;
        ">

          <div style="
            font-size:11px;
            text-transform:uppercase;
            letter-spacing:0.06em;
            color:#94a3b8;
          ">
            Quotation
          </div>

          <div style="
            margin-top:5px;
            color:#0f172a;
            font-size:18px;
            font-weight:700;
          ">
            ${escapeHtml(
              quoteNumber
            )}
          </div>

          <div style="
            margin-top:7px;
            color:#475569;
            font-size:14px;
          ">
            ${escapeHtml(
              quoteTitle
            )}
          </div>

          <div style="
            margin-top:18px;
            font-size:11px;
            text-transform:uppercase;
            letter-spacing:0.06em;
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
            ${escapeHtml(
              formatCurrency(
                quoteTotal
              )
            )}
          </div>
        </div>

        <!-- FOOTER -->

        <div style="
          border-top:1px solid #e2e8f0;
          padding:22px 32px;
          font-size:12px;
          line-height:1.6;
          color:#94a3b8;
          background:#f8fafc;
        ">
          Dry Home Damp Proofing Solutions LTD<br>
          dryhomedampproofing.co.uk
        </div>

      </div>
    </div>
  </body>
</html>
`;
}

/* =========================================================
   TEMPLATE BODY → HTML
   ========================================================= */

function renderTemplateBodyHtml(
  templateBody: string,
  values: TemplateValues,
  customerQuoteUrl: string
) {
  /*
   * We handle {{view_link}} separately because in
   * the HTML version it becomes a proper button.
   */

  const viewLinkMarker =
    "__DRYHOME_VIEW_QUOTE_BUTTON__";

  let body =
    templateBody.replaceAll(
      "{{view_link}}",
      viewLinkMarker
    );

  const htmlValues: Omit<
    TemplateValues,
    "view_link"
  > = {
    client_name:
      values.client_name,

    job_title:
      values.job_title,

    quote_number:
      values.quote_number,

    quote_total:
      values.quote_total,
  };

  for (
    const [
      key,
      value,
    ] of Object.entries(
      htmlValues
    )
  ) {
    body =
      body.replaceAll(
        `{{${key}}}`,
        value
      );
  }

  const escaped =
    escapeHtml(
      body
    );

  const paragraphs =
    escaped
      .split(
        /\n\s*\n/
      )
      .map(
        (
          paragraph
        ) =>
          paragraph.trim()
      )
      .filter(Boolean);

  return paragraphs
    .map(
      (
        paragraph
      ) => {
        if (
          paragraph ===
          viewLinkMarker
        ) {
          return buildQuoteButton(
            customerQuoteUrl
          );
        }

        /*
         * If the marker appears inside a paragraph,
         * split the paragraph around the button.
         */

        if (
          paragraph.includes(
            viewLinkMarker
          )
        ) {
          const parts =
            paragraph.split(
              viewLinkMarker
            );

          return parts
            .map(
              (
                part,
                index
              ) => {
                const blocks: string[] =
                  [];

                if (
                  part.trim()
                ) {
                  blocks.push(
                    buildParagraph(
                      part
                    )
                  );
                }

                if (
                  index <
                  parts.length -
                    1
                ) {
                  blocks.push(
                    buildQuoteButton(
                      customerQuoteUrl
                    )
                  );
                }

                return blocks.join(
                  ""
                );
              }
            )
            .join("");
        }

        return buildParagraph(
          paragraph
        );
      }
    )
    .join("");
}

/* =========================================================
   HTML PARAGRAPH
   ========================================================= */

function buildParagraph(
  value: string
) {
  const withBreaks =
    value.replace(
      /\n/g,
      "<br>"
    );

  return `
    <p style="
      margin:0 0 18px 0;
      line-height:1.7;
    ">
      ${withBreaks}
    </p>
  `;
}

/* =========================================================
   VIEW QUOTE BUTTON
   ========================================================= */

function buildQuoteButton(
  customerQuoteUrl: string
) {
  return `
    <div style="
      text-align:center;
      margin:28px 0;
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
  `;
}

/* =========================================================
   PDF LOGO
   ========================================================= */

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
  } catch (
    error
  ) {
    console.error(
      "Unable to load PDF logo:",
      error
    );

    return null;
  }
}

/* =========================================================
   CURRENCY
   ========================================================= */

function formatCurrency(
  value: number
) {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style:
        "currency",

      currency:
        "GBP",
    }
  ).format(
    value
  );
}

/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHtml(
  value: string
) {
  return value
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}

/* =========================================================
   REDIRECT
   ========================================================= */

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

  return new Response(
    null,
    {
      status:
        303,

      headers: {
        Location:
          `/quotes/${id}?${params.toString()}`,
      },
    }
  );
}