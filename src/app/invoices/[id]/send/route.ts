import { NextRequest } from "next/server";
import { Resend } from "resend";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

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
   SEND INVOICE
   ========================================================= */

export async function POST(
  _request: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const { id } =
    await context.params;

  const supabase =
    await createClient();

  /* =========================================================
     INVOICE
     ========================================================= */

  const {
    data: invoice,
    error,
  } = await supabase
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
      job_id,

      clients (
        id,
        display_name,
        first_name,
        last_name,
        email
      )
    `)
    .eq(
      "id",
      id
    )
    .single();

  if (
    error ||
    !invoice
  ) {
    console.error(
      "Unable to load invoice:",
      error
    );

    return redirectToInvoice(
      id,
      "error",
      "Invoice could not be found."
    );
  }

  /* =========================================================
     CLIENT
     ========================================================= */

  const client =
    Array.isArray(
      invoice.clients
    )
      ? invoice.clients[0]
      : invoice.clients;

  const recipient =
    client?.email?.trim();

  if (!recipient) {
    return redirectToInvoice(
      id,
      "error",
      "The client does not have an email address."
    );
  }

  if (
    !invoice.public_token
  ) {
    return redirectToInvoice(
      id,
      "error",
      "This invoice does not have a secure customer link."
    );
  }

  /* =========================================================
     EMAIL CONFIG
     ========================================================= */

  const resendApiKey =
    process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    return redirectToInvoice(
      id,
      "error",
      "RESEND_API_KEY is missing."
    );
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(
      /\/$/,
      ""
    );

  if (!appUrl) {
    return redirectToInvoice(
      id,
      "error",
      "NEXT_PUBLIC_APP_URL is missing."
    );
  }

  /* =========================================================
     EMAIL TEMPLATE + JOB
     ========================================================= */

  const [
    templateResult,
    jobResult,
  ] = await Promise.all([
    supabase
      .from("email_templates")
      .select(`
        subject,
        body
      `)
      .eq(
        "template_key",
        "invoice"
      )
      .maybeSingle(),

    invoice.job_id
      ? supabase
          .from("jobs")
          .select(`
            id,
            title
          `)
          .eq(
            "id",
            invoice.job_id
          )
          .maybeSingle()
      : Promise.resolve({
          data: null,
          error: null,
        }),
  ]);

  if (
    templateResult.error
  ) {
    console.error(
      "Unable to load invoice email template. Using fallback:",
      templateResult.error
    );
  }

  if (
    jobResult.error
  ) {
    console.error(
      "Unable to load invoice job:",
      jobResult.error
    );
  }

  const emailTemplate = {
    subject:
      templateResult.data?.subject?.trim() ||
      fallbackInvoiceTemplate.subject,

    body:
      templateResult.data?.body?.trim() ||
      fallbackInvoiceTemplate.body,
  };

  /* =========================================================
     VALUES
     ========================================================= */

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
    jobResult.data?.title ||
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

  const dueDate =
    invoice.due_date
      ? formatDate(
          invoice.due_date
        )
      : "Not set";

  const customerUrl =
    `${appUrl}/i/${invoice.public_token}`;

  const templateValues: TemplateValues = {
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

      customerUrl,

      invoiceNumber:
        invoice.invoice_number,

      invoiceTitle:
        invoice.title ||
        invoice.invoice_type ||
        "Invoice",

      invoiceTotal,

      amountOutstanding,

      dueDate,
    });

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
    });

  if (
    result.error
  ) {
    console.error(
      "Resend invoice error:",
      result.error
    );

    return redirectToInvoice(
      id,
      "error",
      "The invoice email could not be sent."
    );
  }

  /* =========================================================
     UPDATE INVOICE STATUS
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

  /*
   * Don't overwrite the financial status if the
   * invoice has already been part-paid or paid.
   */

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

    return redirectToInvoice(
      id,
      "warning",
      "The email was sent, but the invoice status could not be updated."
    );
  }

  return redirectToInvoice(
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
  customerUrl,
  invoiceNumber,
  invoiceTitle,
  invoiceTotal,
  amountOutstanding,
  dueDate,
}: {
  templateBody: string;

  values:
    TemplateValues;

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
  const bodyHtml =
    renderTemplateBodyHtml(
      templateBody,
      values,
      customerUrl
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
            Customer Invoice
          </div>
        </div>

        <!-- TEMPLATE CONTENT -->

        <div style="
          padding:32px 32px 10px 32px;
          font-size:15px;
          line-height:1.7;
          color:#334155;
        ">
          ${bodyHtml}
        </div>

        <!-- INVOICE SUMMARY -->

        <div style="
          margin:10px 32px 32px 32px;
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
                Invoice total
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
                Amount outstanding
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
                Due date
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
  customerUrl: string
) {
  const viewLinkMarker =
    "__DRYHOME_VIEW_INVOICE_BUTTON__";

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

    invoice_number:
      values.invoice_number,

    invoice_total:
      values.invoice_total,

    amount_outstanding:
      values.amount_outstanding,
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

  /*
   * Escape the editable template before rendering it
   * into the HTML email.
   */

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
        (paragraph) =>
          paragraph.trim()
      )
      .filter(
        Boolean
      );

  return paragraphs
    .map(
      (paragraph) => {
        if (
          paragraph ===
          viewLinkMarker
        ) {
          return buildInvoiceButton(
            customerUrl
          );
        }

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
                    buildInvoiceButton(
                      customerUrl
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
   PARAGRAPH
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
   VIEW INVOICE BUTTON
   ========================================================= */

function buildInvoiceButton(
  customerUrl: string
) {
  return `
    <div style="
      text-align:center;
      margin:28px 0;
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
  `;
}

/* =========================================================
   INVOICE VALUE
   ========================================================= */

function getInvoiceValue(invoice: {
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
}) {
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

/* =========================================================
   MONEY
   ========================================================= */

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