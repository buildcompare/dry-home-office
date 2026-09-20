import { NextRequest } from "next/server";
import { Resend } from "resend";

import { createClient } from "@/lib/supabase/server";

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
  invoice_number: string;
  invoice_total: string;
  amount_outstanding: string;
  view_link: string;
};

const fallbackInvoiceTemplate = {
  subject:
    "Invoice {{invoice_number}} from Dry Home Damp Proofing Solutions",

  body: `Hi {{client_name}},

Please find invoice {{invoice_number}} for {{job_title}}.

Invoice total: {{invoice_total}}

Amount outstanding: {{amount_outstanding}}

You can view the invoice using the link below:

{{view_link}}

If you have any questions regarding this invoice, simply reply to this email.

Kind regards,

James
Dry Home Damp Proofing Solutions`,
};

/* =========================================================
   LOAD COMPOSER
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
    await loadInvoiceContext(
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
    invoice,
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
          "The client does not have an email address.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    !invoice.public_token
  ) {
    return Response.json(
      {
        error:
          "This invoice does not have a secure customer link.",
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
    invoice.title ||
    invoice.invoice_type ||
    "your works";

  const invoiceTotal =
    getInvoiceValue(
      invoice
    );

  const amountPaid =
    Number(
      invoice.amount_paid ??
        0
    );

  const amountOutstanding =
    money(
      Math.max(
        invoiceTotal -
          amountPaid,
        0
      )
    );

  const customerUrl =
    `${appUrl}/i/${invoice.public_token}`;

  const values: TemplateValues = {
    client_name:
      clientName,

    job_title:
      jobTitle,

    invoice_number:
      invoice.invoice_number,

    invoice_total:
      formatCurrency(
        invoiceTotal
      ),

    amount_outstanding:
      formatCurrency(
        amountOutstanding
      ),

    view_link:
      customerUrl,
  };

  const subject =
    replaceTemplatePlaceholders(
      template.subject,
      values
    );

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

  return Response.json({
    recipient,
    subject,
    body,
  });
}

/* =========================================================
   SEND
   ========================================================= */

export async function POST(
  request: NextRequest,
  { params }: RouteProps
) {
  const { id } =
    await params;

  const wantsJson =
    request.headers.get(
      "x-dryhome-composer"
    ) === "1";

  const resendApiKey =
    process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    return sendErrorResponse(
      wantsJson,
      id,
      "RESEND_API_KEY is missing."
    );
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(
      /\/$/,
      ""
    );

  if (!appUrl) {
    return sendErrorResponse(
      wantsJson,
      id,
      "NEXT_PUBLIC_APP_URL is missing."
    );
  }

  const supabase =
    await createClient();

  const context =
    await loadInvoiceContext(
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
    invoice,
    client,
    job,
    template,
  } = context;

  if (
    !invoice.public_token
  ) {
    return sendErrorResponse(
      wantsJson,
      id,
      "This invoice does not have a secure customer link.",
      400
    );
  }

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
    invoice.title ||
    invoice.invoice_type ||
    "your works";

  const invoiceTotal =
    getInvoiceValue(
      invoice
    );

  const amountPaid =
    Number(
      invoice.amount_paid ??
        0
    );

  const amountOutstanding =
    money(
      Math.max(
        invoiceTotal -
          amountPaid,
        0
      )
    );

  const customerUrl =
    `${appUrl}/i/${invoice.public_token}`;

  const values: TemplateValues = {
    client_name:
      clientName,

    job_title:
      jobTitle,

    invoice_number:
      invoice.invoice_number,

    invoice_total:
      formatCurrency(
        invoiceTotal
      ),

    amount_outstanding:
      formatCurrency(
        amountOutstanding
      ),

    view_link:
      customerUrl,
  };

  const defaultSubject =
    replaceTemplatePlaceholders(
      template.subject,
      values
    );

  const defaultBody =
    cleanComposerBody(
      replaceTemplatePlaceholders(
        template.body,
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
     ATTACHMENTS
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
     DISPLAY DATA
     ========================================================= */

  const dueDate =
    invoice.due_date
      ? formatDate(
          invoice.due_date
        )
      : "Not set";

  const invoiceTitle =
    invoice.title ||
    invoice.invoice_type ||
    "Invoice";

  const html =
    buildComposerEmailHtml({
      body,

      customerUrl,

      invoiceNumber:
        invoice.invoice_number,

      invoiceTitle,

      invoiceTotal,

      amountOutstanding,

      dueDate,
    });

  const text = [
    body,

    "",

    "View your invoice securely online:",

    customerUrl,
  ].join("\n");

  /* =========================================================
     RESEND
     ========================================================= */

  const fromAddress =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Dry Home Damp Proofing Solutions <quotes@admin.dryhomedampproofing.co.uk>";

  const replyTo =
    process.env.DRYHOME_REPLY_TO_EMAIL?.trim();

  const resend =
    new Resend(
      resendApiKey
    );

  const result =
    await resend.emails.send({
      from:
        fromAddress,

      to:
        recipient,

      ...(replyTo
        ? {
            replyTo,
          }
        : {}),

      subject,

      text,

      html,

      ...(extraAttachments.length >
      0
        ? {
            attachments:
              extraAttachments,
          }
        : {}),
    });

  if (
    result.error
  ) {
    console.error(
      "Resend invoice error:",
      result.error
    );

    return sendErrorResponse(
      wantsJson,
      id,
      "The invoice email could not be sent."
    );
  }

  /* =========================================================
     UPDATE STATUS
     ========================================================= */

  const sentAt =
    new Date().toISOString();

  const updateData: {
    status?: string;
    sent_to: string;
    sent_at: string;
  } = {
    sent_to:
      recipient,

    sent_at:
      sentAt,
  };

  if (
    invoice.status !==
      "Paid" &&
    invoice.status !==
      "Part Paid"
  ) {
    updateData.status =
      "Sent";
  }

  const {
    error: updateError,
  } = await supabase
    .from("invoices")
    .update(
      updateData
    )
    .eq(
      "id",
      id
    );

  if (
    updateError
  ) {
    console.error(
      "Invoice sent status update error:",
      updateError
    );

    if (
      wantsJson
    ) {
      return Response.json({
        success:
          true,

        warning:
          "The email was sent, but the invoice status could not be updated.",
      });
    }

    return redirectToInvoice(
      id,
      "warning",
      "The email was sent, but the invoice status could not be updated."
    );
  }

  if (
    wantsJson
  ) {
    return Response.json({
      success: true,
    });
  }

  return redirectToInvoice(
    id,
    "sent",
    "1"
  );
}

/* =========================================================
   LOAD INVOICE CONTEXT
   ========================================================= */

async function loadInvoiceContext(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  id: string
) {
  const [
    invoiceResult,
    templateResult,
  ] = await Promise.all([
    supabase
      .from("invoices")
      .select(`
        id,
        invoice_number,
        title,
        invoice_type,
        status,
        amount,
        subtotal,
        vat_amount,
        amount_paid,
        due_date,
        public_token,

        clients (
          id,
          display_name,
          first_name,
          last_name,
          email
        ),

        jobs (
          id,
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
        "invoice"
      )
      .maybeSingle(),
  ]);

  if (
    invoiceResult.error ||
    !invoiceResult.data
  ) {
    console.error(
      "Unable to load invoice:",
      invoiceResult.error
    );

    return {
      success:
        false as const,

      error:
        "Invoice could not be found.",

      status:
        404,
    };
  }

  if (
    templateResult.error
  ) {
    console.error(
      "Unable to load invoice email template. Using fallback:",
      templateResult.error
    );
  }

  const invoice =
    invoiceResult.data;

  const client =
    Array.isArray(
      invoice.clients
    )
      ? invoice.clients[0]
      : invoice.clients;

  const job =
    Array.isArray(
      invoice.jobs
    )
      ? invoice.jobs[0]
      : invoice.jobs;

  const template = {
    subject:
      templateResult.data?.subject?.trim() ||
      fallbackInvoiceTemplate.subject,

    body:
      templateResult.data?.body?.trim() ||
      fallbackInvoiceTemplate.body,
  };

  return {
    success:
      true as const,

    invoice,
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
   TEMPLATE
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
   HTML
   ========================================================= */

function buildComposerEmailHtml({
  body,
  customerUrl,
  invoiceNumber,
  invoiceTitle,
  invoiceTotal,
  amountOutstanding,
  dueDate,
}: {
  body: string;

  customerUrl:
    string;

  invoiceNumber:
    string;

  invoiceTitle:
    string;

  invoiceTotal:
    number;

  amountOutstanding:
    number;

  dueDate:
    string;
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
            Customer Invoice
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
            Invoice
          </div>

          <div style="
            margin-top:5px;
            color:#0f172a;
            font-size:18px;
            font-weight:700;
          ">
            ${escapeHtml(
              invoiceNumber
            )}
          </div>

          <div style="
            margin-top:7px;
            color:#475569;
            font-size:14px;
          ">
            ${escapeHtml(
              invoiceTitle
            )}
          </div>

          <table
            role="presentation"
            style="
              width:100%;
              margin-top:20px;
              border-collapse:collapse;
            "
          >

            <tr>
              <td style="
                padding:6px 0;
                color:#64748b;
                font-size:13px;
              ">
                Invoice Total
              </td>

              <td style="
                padding:6px 0;
                text-align:right;
                color:#0f172a;
                font-size:15px;
                font-weight:700;
              ">
                ${escapeHtml(
                  formatCurrency(
                    invoiceTotal
                  )
                )}
              </td>
            </tr>

            <tr>
              <td style="
                padding:6px 0;
                color:#64748b;
                font-size:13px;
              ">
                Outstanding
              </td>

              <td style="
                padding:6px 0;
                text-align:right;
                color:#0f172a;
                font-size:15px;
                font-weight:700;
              ">
                ${escapeHtml(
                  formatCurrency(
                    amountOutstanding
                  )
                )}
              </td>
            </tr>

            <tr>
              <td style="
                padding:6px 0;
                color:#64748b;
                font-size:13px;
              ">
                Due Date
              </td>

              <td style="
                padding:6px 0;
                text-align:right;
                color:#0f172a;
                font-size:14px;
                font-weight:600;
              ">
                ${escapeHtml(
                  dueDate
                )}
              </td>
            </tr>

          </table>
        </div>

        <div style="
          text-align:center;
          margin:28px 32px 36px 32px;
        ">

          <a
            href="${escapeHtml(
              customerUrl
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
            View Invoice
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
   ATTACHMENTS
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
   INVOICE TOTAL
   ========================================================= */

function getInvoiceValue(
  invoice: {
    amount?:
      | number
      | string
      | null;

    subtotal?:
      | number
      | string
      | null;

    vat_amount?:
      | number
      | string
      | null;
  }
) {
  const amount =
    Number(
      invoice.amount ??
        0
    );

  if (
    Number.isFinite(
      amount
    ) &&
    amount >
      0
  ) {
    return money(
      amount
    );
  }

  const subtotal =
    Number(
      invoice.subtotal ??
        0
    );

  const vatAmount =
    Number(
      invoice.vat_amount ??
        0
    );

  return money(
    (
      Number.isFinite(
        subtotal
      )
        ? subtotal
        : 0
    ) +
      (
        Number.isFinite(
          vatAmount
        )
          ? vatAmount
          : 0
      )
  );
}

function money(
  value: number
) {
  return Math.round(
    (
      value +
      Number.EPSILON
    ) *
      100
  ) / 100;
}

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
    money(
      value
    )
  );
}

/* =========================================================
   DATE
   ========================================================= */

function formatDate(
  value: string
) {
  const [
    year,
    month,
    day,
  ] = value
    .slice(
      0,
      10
    )
    .split("-")
    .map(
      Number
    );

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day:
        "2-digit",

      month:
        "long",

      year:
        "numeric",

      timeZone:
        "UTC",
    }
  ).format(
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    )
  );
}

/* =========================================================
   VALIDATION
   ========================================================= */

function isValidEmail(
  value: string
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value
  );
}

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
   RESPONSES
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

  return redirectToInvoice(
    id,
    "error",
    message
  );
}

function redirectToInvoice(
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
          `/invoices/${id}?${params.toString()}`,
      },
    }
  );
}