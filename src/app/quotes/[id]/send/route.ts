import React from "react";
import path from "path";
import { readFile } from "fs/promises";
import { Resend } from "resend";
import { renderToBuffer } from "@react-pdf/renderer";

import { createClient } from "@/lib/supabase/server";
import QuotePdfDocument from "@/components/QuotePdfDocument";

export const runtime =
  "nodejs";

const MAX_ATTACHMENTS = 5;
const MAX_TOTAL_ATTACHMENT_SIZE =
  4 * 1024 * 1024;

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
   LOAD EMAIL COMPOSER
   ========================================================= */

export async function GET(
  _request: Request,
  { params }: RouteProps
) {
  const { id } =
    await params;

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(
      /\/$/,
      ""
    );

  if (!appUrl) {
    return Response.json(
      {
        error:
          "NEXT_PUBLIC_APP_URL is missing.",
      },
      {
        status: 500,
      }
    );
  }

  const supabase =
    await createClient();

  const context =
    await loadQuoteContext(
      supabase,
      id
    );

  if (
    !context.success
  ) {
    return Response.json(
      {
        error:
          context.error,
      },
      {
        status:
          context.status,
      }
    );
  }

  const {
    quote,
    client,
    job,
    template,
  } = context;

  const recipient =
    client?.email?.trim();

  if (!recipient) {
    return Response.json(
      {
        error:
          "This client does not have an email address.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    !quote.public_token
  ) {
    return Response.json(
      {
        error:
          "This quotation does not have a customer access link.",
      },
      {
        status: 400,
      }
    );
  }

  const clientName =
    getClientName(
      client
    );

  const jobTitle =
    job?.title ||
    quote.title ||
    "your works";

  const customerQuoteUrl =
    `${appUrl}/q/${quote.public_token}`;

  const values: TemplateValues = {
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

  const subject =
    replaceTemplatePlaceholders(
      template.subject,
      values
    );

  /*
   * The secure link is not put into the editable textarea.
   * It is always added automatically as a button when sent.
   */

  const body =
    cleanComposerBody(
      replaceTemplatePlaceholders(
        template.body,
        {
          ...values,
          view_link: "",
        }
      )
    );

  const filename =
    buildQuoteFilename(
      quote.quote_number,
      quote.title
    );

  return Response.json({
    recipient,
    subject,
    body,

    automaticAttachment:
      `${filename}.pdf`,
  });
}

/* =========================================================
   SEND QUOTE
   ========================================================= */

export async function POST(
  request: Request,
  { params }: RouteProps
) {
  const { id } =
    await params;

  const wantsJson =
    request.headers.get(
      "x-dryhome-composer"
    ) === "1";

  const apiKey =
    process.env.RESEND_API_KEY;

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(
      /\/$/,
      ""
    );

  if (!apiKey) {
    return sendErrorResponse(
      wantsJson,
      id,
      "Email service is not configured."
    );
  }

  if (!appUrl) {
    return sendErrorResponse(
      wantsJson,
      id,
      "The customer quote link is not configured."
    );
  }

  const supabase =
    await createClient();

  const context =
    await loadQuoteContext(
      supabase,
      id
    );

  if (
    !context.success
  ) {
    return sendErrorResponse(
      wantsJson,
      id,
      context.error,
      context.status
    );
  }

  const {
    quote,
    client,
    job,
  } = context;

  if (
    !quote.public_token
  ) {
    return sendErrorResponse(
      wantsJson,
      id,
      "This quotation does not have a customer access link.",
      400
    );
  }

  /* =========================================================
     COMPOSER FORM
     ========================================================= */

  let formData:
    FormData | null =
    null;

  try {
    formData =
      await request.formData();
  } catch {
    formData =
      null;
  }

  const defaultRecipient =
    client?.email?.trim() ||
    "";

  const recipient =
    String(
      formData?.get(
        "recipient"
      ) ??
        defaultRecipient
    ).trim();

  if (
    !recipient ||
    !isValidEmail(
      recipient
    )
  ) {
    return sendErrorResponse(
      wantsJson,
      id,
      "Please enter a valid recipient email address.",
      400
    );
  }

  const clientName =
    getClientName(
      client
    );

  const jobTitle =
    job?.title ||
    quote.title ||
    "your works";

  const customerQuoteUrl =
    `${appUrl}/q/${quote.public_token}`;

  const values: TemplateValues = {
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

  const defaultSubject =
    replaceTemplatePlaceholders(
      context.template.subject,
      values
    );

  const defaultBody =
    cleanComposerBody(
      replaceTemplatePlaceholders(
        context.template.body,
        {
          ...values,
          view_link: "",
        }
      )
    );

  const subject =
    String(
      formData?.get(
        "subject"
      ) ??
        defaultSubject
    ).trim();

  const body =
    String(
      formData?.get(
        "body"
      ) ??
        defaultBody
    ).trim();

  if (!subject) {
    return sendErrorResponse(
      wantsJson,
      id,
      "Please enter an email subject.",
      400
    );
  }

  if (!body) {
    return sendErrorResponse(
      wantsJson,
      id,
      "Please enter an email message.",
      400
    );
  }

  if (
    subject.length >
    250
  ) {
    return sendErrorResponse(
      wantsJson,
      id,
      "The email subject is too long.",
      400
    );
  }

  if (
    body.length >
    20000
  ) {
    return sendErrorResponse(
      wantsJson,
      id,
      "The email message is too long.",
      400
    );
  }

  /* =========================================================
     EXTRA ATTACHMENTS
     ========================================================= */

  const extraFiles =
    formData
      ? formData
          .getAll(
            "attachments"
          )
          .filter(
            (
              value
            ): value is File =>
              value instanceof
              File &&
              value.size >
                0
          )
      : [];

  if (
    extraFiles.length >
    MAX_ATTACHMENTS
  ) {
    return sendErrorResponse(
      wantsJson,
      id,
      `You can add up to ${MAX_ATTACHMENTS} extra attachments.`,
      400
    );
  }

  const totalExtraSize =
    extraFiles.reduce(
      (
        total,
        file
      ) =>
        total +
        file.size,
      0
    );

  if (
    totalExtraSize >
    MAX_TOTAL_ATTACHMENT_SIZE
  ) {
    return sendErrorResponse(
      wantsJson,
      id,
      "Extra attachments must be under 4 MB in total.",
      400
    );
  }

  const extraAttachments: {
    filename: string;
    content: string;
  }[] = [];

  for (
    const file of
      extraFiles
  ) {
    const fileBuffer =
      Buffer.from(
        await file.arrayBuffer()
      );

    extraAttachments.push({
      filename:
        sanitiseAttachmentFilename(
          file.name
        ),

      content:
        fileBuffer.toString(
          "base64"
        ),
    });
  }

  /* =========================================================
     QUOTE ITEMS
     ========================================================= */

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
    .eq(
      "quote_id",
      id
    )
    .order(
      "sort_order",
      {
        ascending:
          true,
      }
    );

  if (
    itemsError
  ) {
    console.error(
      "Unable to load quote items:",
      itemsError
    );

    return sendErrorResponse(
      wantsJson,
      id,
      "Unable to load the quotation items."
    );
  }

  const labourItems =
    (
      quoteItems ??
      []
    )
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
    (
      quoteItems ??
      []
    )
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
     CLIENT ADDRESS
     ========================================================= */

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
     PDF
     ========================================================= */

  const logoDataUri =
    await loadLogoFromDisk();

  let pdfBuffer:
    Buffer;

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

    return sendErrorResponse(
      wantsJson,
      id,
      "Unable to generate the PDF attachment."
    );
  }

  const filename =
    buildQuoteFilename(
      quote.quote_number,
      quote.title
    );

  /* =========================================================
     EMAIL
     ========================================================= */

  const html =
    buildComposerEmailHtml({
      body,

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

  const text = [
    body,

    "",

    "View your quotation securely online:",

    customerQuoteUrl,

    "",

    "A PDF copy of the quotation is attached.",
  ].join("\n");

  const fromAddress =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Dry Home Damp Proofing Solutions <quotes@admin.dryhomedampproofing.co.uk>";

  const replyTo =
    process.env.DRYHOME_REPLY_TO_EMAIL?.trim();

  const resend =
    new Resend(
      apiKey
    );

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

        ...extraAttachments,
      ],
    });

  if (
    sendError
  ) {
    console.error(
      "Resend email error:",
      sendError
    );

    return sendErrorResponse(
      wantsJson,
      id,
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

    if (
      wantsJson
    ) {
      return Response.json(
        {
          success:
            true,

          warning:
            "The email was sent, but DryHome Office could not update the quote status.",
        }
      );
    }

    return redirectToQuote(
      id,
      "warning",
      "The email was sent, but DryHome Office could not update the quote status."
    );
  }

  if (
    wantsJson
  ) {
    return Response.json({
      success: true,
    });
  }

  return redirectToQuote(
    id,
    "sent",
    "1"
  );
}

/* =========================================================
   LOAD QUOTE CONTEXT
   ========================================================= */

async function loadQuoteContext(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  id: string
) {
  const [
    quoteResult,
    templateResult,
  ] = await Promise.all([
    supabase
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
      .single(),

    supabase
      .from(
        "email_templates"
      )
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
    quoteResult.error ||
    !quoteResult.data
  ) {
    console.error(
      "Unable to load quote:",
      quoteResult.error
    );

    return {
      success:
        false as const,

      error:
        "Unable to find the quotation.",

      status:
        404,
    };
  }

  if (
    templateResult.error
  ) {
    console.error(
      "Unable to load quote email template. Using fallback:",
      templateResult.error
    );
  }

  const quote =
    quoteResult.data;

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

  const template = {
    subject:
      templateResult.data?.subject?.trim() ||
      fallbackQuoteTemplate.subject,

    body:
      templateResult.data?.body?.trim() ||
      fallbackQuoteTemplate.body,
  };

  return {
    success:
      true as const,

    quote,
    client,
    job,
    template,
  };
}

/* =========================================================
   CLIENT NAME
   ========================================================= */

function getClientName(
  client:
    | {
        display_name?:
          | string
          | null;

        first_name?:
          | string
          | null;

        last_name?:
          | string
          | null;
      }
    | null
    | undefined
) {
  return (
    client?.display_name ||
    [
      client?.first_name,
      client?.last_name,
    ]
      .filter(Boolean)
      .join(" ") ||
    "Customer"
  );
}

/* =========================================================
   PLACEHOLDERS
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
   CLEAN COMPOSER BODY
   ========================================================= */

function cleanComposerBody(
  value: string
) {
  return value
    .replace(
      /\n{3,}/g,
      "\n\n"
    )
    .trim();
}

/* =========================================================
   HTML EMAIL
   ========================================================= */

function buildComposerEmailHtml({
  body,
  customerQuoteUrl,
  quoteNumber,
  quoteTitle,
  quoteTotal,
}: {
  body: string;

  customerQuoteUrl:
    string;

  quoteNumber:
    string;

  quoteTitle:
    string;

  quoteTotal:
    number;
}) {
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

        <div style="
          padding:32px 32px 10px 32px;
          font-size:15px;
          line-height:1.7;
          color:#334155;
        ">
          ${renderMessageHtml(
            body
          )}
        </div>

        <div style="
          margin:10px 32px 28px 32px;
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

        <div style="
          text-align:center;
          margin:28px 32px 36px 32px;
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
   MESSAGE HTML
   ========================================================= */

function renderMessageHtml(
  value: string
) {
  const escaped =
    escapeHtml(
      value
    );

  return escaped
    .split(
      /\n\s*\n/
    )
    .map(
      (paragraph) =>
        paragraph.trim()
    )
    .filter(Boolean)
    .map(
      (paragraph) => `
        <p style="
          margin:0 0 18px 0;
          line-height:1.7;
        ">
          ${paragraph.replace(
            /\n/g,
            "<br>"
          )}
        </p>
      `
    )
    .join("");
}

/* =========================================================
   QUOTE FILENAME
   ========================================================= */

function buildQuoteFilename(
  quoteNumber: string,
  title:
    | string
    | null
) {
  const raw =
    `${quoteNumber}-${title || "Quotation"}`;

  return raw
    .replace(
      /[^a-zA-Z0-9-_ ]/g,
      ""
    )
    .replace(
      /\s+/g,
      "-"
    );
}

/* =========================================================
   ATTACHMENT FILENAME
   ========================================================= */

function sanitiseAttachmentFilename(
  filename: string
) {
  const cleaned =
    filename
      .replace(
        /[\r\n]/g,
        ""
      )
      .trim();

  return (
    cleaned ||
    "attachment"
  );
}

/* =========================================================
   EMAIL VALIDATION
   ========================================================= */

function isValidEmail(
  value: string
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value
  );
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
   HTML ESCAPE
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
   ERROR RESPONSE
   ========================================================= */

function sendErrorResponse(
  wantsJson: boolean,
  id: string,
  message: string,
  status = 500
) {
  if (
    wantsJson
  ) {
    return Response.json(
      {
        error:
          message,
      },
      {
        status,
      }
    );
  }

  return redirectToQuote(
    id,
    "error",
    message
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