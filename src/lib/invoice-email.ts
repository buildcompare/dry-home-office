/*
 * Shared invoice email logic.
 *
 * Used by the Email Invoice composer route (/invoices/[id]/send) and by
 * the Book Survey flow, so both build the same email, attach the same
 * invoice PDF, include the same /i/[token] link and mark the invoice as
 * sent in the same way.
 */

import { Resend } from "resend";

import type { createClient } from "@/lib/supabase/server";
import {
  buildRecipientList,
  formatSentTo,
  toResendRecipients,
} from "@/lib/email-recipients";
import { loadClientSecondaryEmail } from "@/lib/client-secondary-email";
import {
  invoicePdfFilename,
  loadInvoicePdfSource,
  renderInvoicePdf,
} from "@/lib/invoice-pdf";

type SupabaseServerClient = Awaited<
  ReturnType<
    typeof createClient
  >
>;

export type TemplateValues = {
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
   LOAD INVOICE CONTEXT
   ========================================================= */

export async function loadInvoiceContext(
  supabase: SupabaseServerClient,
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

export function getClientName(
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

export function replaceTemplatePlaceholders(
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

export function cleanComposerBody(
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

export function sanitiseAttachmentFilename(
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

export function getInvoiceValue(
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

export function isValidEmail(
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
   CONTEXT TYPES
   ========================================================= */

export type InvoiceEmailContext = Extract<
  Awaited<
    ReturnType<
      typeof loadInvoiceContext
    >
  >,
  {
    success: true;
  }
>;

/* =========================================================
   DEFAULT SUBJECT + BODY
   ========================================================= */

/**
 * Template values, default subject and default body for an invoice
 * email, exactly as the composer shows them.
 */
export function buildInvoiceEmailDefaults(
  context: Pick<
    InvoiceEmailContext,
    | "invoice"
    | "client"
    | "job"
    | "template"
  >,
  appUrl: string
) {
  const {
    invoice,
    client,
    job,
    template,
  } = context;

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

  return {
    values,
    customerUrl,
    invoiceTotal,
    amountOutstanding,
    subject,
    body,
  };
}

/* =========================================================
   DELIVER
   PDF + HTML + Resend + mark as sent.
   ========================================================= */

export type InvoiceEmailDelivery =
  | {
      ok: true;
      warning?: string;
    }
  | {
      ok: false;
      error: string;
      status: number;
    };

export async function deliverInvoiceEmail({
  supabase,
  id,
  invoice,
  recipients,
  subject,
  body,
  customerUrl,
  invoiceTotal,
  amountOutstanding,
  extraAttachments = [],
  resendApiKey,
}: {
  supabase: SupabaseServerClient;
  id: string;
  invoice: InvoiceEmailContext["invoice"];
  recipients: string[];
  subject: string;
  body: string;
  customerUrl: string;
  invoiceTotal: number;
  amountOutstanding: number;
  extraAttachments?: {
    filename: string;
    content: string;
  }[];
  resendApiKey: string;
}): Promise<InvoiceEmailDelivery> {
  /* =========================================================
     INVOICE PDF
     Same builder as the /invoices/[id]/pdf download route.
     ========================================================= */

  let pdfBuffer: Buffer;
  let pdfFilename: string;

  try {
    const pdfSource =
      await loadInvoicePdfSource(
        supabase,
        id
      );

    if (!pdfSource) {
      throw new Error(
        "Invoice PDF data could not be loaded."
      );
    }

    pdfBuffer =
      await renderInvoicePdf(
        pdfSource
      );

    pdfFilename =
      invoicePdfFilename(
        pdfSource.invoice.invoice_number,
        pdfSource.invoice.title ||
          pdfSource.invoice.invoice_type
      );
  } catch (pdfError) {
    console.error(
      "Unable to generate invoice PDF:",
      pdfError
    );

    return {
      ok: false,
      error:
        "Unable to generate the invoice PDF attachment.",
      status: 500,
    };
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
        toResendRecipients(
          recipients
        ),

      ...(replyTo
        ? {
            replyTo,
          }
        : {}),

      subject,

      text,

      html,

      attachments: [
        {
          filename:
            `${pdfFilename}.pdf`,

          content:
            pdfBuffer.toString(
              "base64"
            ),
        },

        ...extraAttachments,
      ],
    });

  if (
    result.error
  ) {
    console.error(
      "Resend invoice error:",
      result.error
    );

    return {
      ok: false,
      error:
        "The invoice email could not be sent.",
      status: 500,
    };
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
      formatSentTo(
        recipients
      ),

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

    return {
      ok: true,
      warning:
        "The email was sent, but the invoice status could not be updated.",
    };
  }

  return {
    ok: true,
  };
}

/* =========================================================
   SEND WITH DEFAULTS
   Used by Book Survey: the template subject/body, the client's
   primary email plus secondary email, and the invoice PDF.
   ========================================================= */

export type InvoiceEmailToClientResult =
  | {
      status: "sent";
      recipients: string[];
      warning?: string;
    }
  | {
      status: "no-email";
    }
  | {
      status: "failed";
      error: string;
    };

export async function emailInvoiceToClient(
  supabase: SupabaseServerClient,
  invoiceId: string
): Promise<InvoiceEmailToClientResult> {
  const resendApiKey =
    process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    return {
      status: "failed",
      error:
        "RESEND_API_KEY is missing.",
    };
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(
      /\/$/,
      ""
    );

  if (!appUrl) {
    return {
      status: "failed",
      error:
        "NEXT_PUBLIC_APP_URL is missing.",
    };
  }

  const context =
    await loadInvoiceContext(
      supabase,
      invoiceId
    );

  if (
    !context.success
  ) {
    return {
      status: "failed",
      error:
        context.error,
    };
  }

  if (
    !context.invoice.public_token
  ) {
    return {
      status: "failed",
      error:
        "This invoice does not have a secure customer link.",
    };
  }

  const secondaryEmail =
    await loadClientSecondaryEmail(
      supabase,
      context.client?.id
    );

  const recipients =
    buildRecipientList(
      context.client?.email,
      secondaryEmail
    ).filter((email) =>
      isValidEmail(email)
    );

  if (
    recipients.length ===
    0
  ) {
    return {
      status: "no-email",
    };
  }

  const defaults =
    buildInvoiceEmailDefaults(
      context,
      appUrl
    );

  const delivered =
    await deliverInvoiceEmail({
      supabase,
      id: invoiceId,
      invoice:
        context.invoice,
      recipients,
      subject:
        defaults.subject,
      body:
        defaults.body,
      customerUrl:
        defaults.customerUrl,
      invoiceTotal:
        defaults.invoiceTotal,
      amountOutstanding:
        defaults.amountOutstanding,
      resendApiKey,
    });

  if (!delivered.ok) {
    return {
      status: "failed",
      error:
        delivered.error,
    };
  }

  return {
    status: "sent",
    recipients,
    warning:
      delivered.warning,
  };
}
