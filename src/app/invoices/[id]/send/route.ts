import { NextRequest } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function redirectToInvoice(
  id: string,
  key: string,
  value: string
) {
  const params =
    new URLSearchParams();

  params.set(key, value);

  return new Response(null, {
    status: 303,
    headers: {
      Location: `/invoices/${id}?${params.toString()}`,
    },
  });
}

export async function POST(
  request: NextRequest,
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
      due_date,
      public_token,
      clients (
        id,
        display_name,
        first_name,
        last_name,
        email
      )
    `)
    .eq("id", id)
    .single();

  if (error || !invoice) {
    return redirectToInvoice(
      id,
      "error",
      "Invoice could not be found."
    );
  }

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

  if (!invoice.public_token) {
    return redirectToInvoice(
      id,
      "error",
      "This invoice does not have a secure customer link."
    );
  }

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

  const customerUrl =
    `${appUrl}/i/${invoice.public_token}`;

  const fromAddress =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Dry Home Damp Proofing Solutions <quotes@admin.dryhomedampproofing.co.uk>";

  const replyTo =
    process.env.DRYHOME_REPLY_TO_EMAIL?.trim();

  const clientName =
    client?.display_name ||
    [
      client?.first_name,
      client?.last_name,
    ]
      .filter(Boolean)
      .join(" ") ||
    "Customer";

  const resend =
    new Resend(
      resendApiKey
    );

  const total =
    new Intl.NumberFormat(
      "en-GB",
      {
        style: "currency",
        currency: "GBP",
      }
    ).format(
      Number(
        invoice.amount ?? 0
      )
    );

  const dueDate =
    invoice.due_date
      ? formatDate(
          invoice.due_date
        )
      : "Not set";

  const result =
    await resend.emails.send({
      from: fromAddress,

      to: recipient,

      ...(replyTo
        ? {
            replyTo,
          }
        : {}),

      subject: `${invoice.invoice_number} – Invoice from Dry Home Damp Proofing Solutions`,

      text: [
        `Dear ${clientName},`,
        "",
        "Please find your invoice from Dry Home Damp Proofing Solutions.",
        "",
        `Invoice: ${invoice.invoice_number}`,
        `Type: ${invoice.invoice_type || "Invoice"}`,
        `Total: ${total}`,
        `Due date: ${dueDate}`,
        "",
        "Please use the secure link below to view the invoice:",
        "",
        customerUrl,
        "",
        "Kind regards,",
        "Dry Home Damp Proofing Solutions",
      ].join("\n"),

      html: `
        <div style="margin:0;padding:30px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
          <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">

            <div style="background:#0f172a;padding:28px 32px;color:#ffffff;">
              <div style="font-size:22px;font-weight:700;">
                Dry Home Damp Proofing Solutions
              </div>

              <div style="margin-top:6px;color:#cbd5e1;font-size:14px;">
                Customer Invoice
              </div>
            </div>

            <div style="padding:32px;">
              <p style="margin-top:0;">
                Dear ${escapeHtml(clientName)},
              </p>

              <p style="line-height:1.6;color:#475569;">
                Please find your invoice below.
              </p>

              <div style="margin:24px 0;padding:20px;background:#f8fafc;border-radius:10px;">
                <div style="font-size:13px;color:#64748b;">
                  Invoice
                </div>

                <div style="margin-top:4px;font-size:18px;font-weight:700;">
                  ${escapeHtml(invoice.invoice_number)}
                </div>

                <div style="margin-top:14px;font-size:13px;color:#64748b;">
                  ${escapeHtml(invoice.title || invoice.invoice_type || "Invoice")}
                </div>

                <div style="margin-top:4px;font-size:22px;font-weight:700;">
                  ${total}
                </div>

                <div style="margin-top:10px;font-size:13px;color:#64748b;">
                  Due ${dueDate}
                </div>
              </div>

              <div style="margin:30px 0;">
                <a
                  href="${customerUrl}"
                  style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:8px;font-weight:700;"
                >
                  View Invoice
                </a>
              </div>

              <p style="font-size:13px;line-height:1.6;color:#64748b;">
                This secure link is unique to your invoice.
              </p>

              <p style="margin-bottom:0;line-height:1.6;color:#475569;">
                Kind regards,<br />
                <strong>Dry Home Damp Proofing Solutions</strong>
              </p>
            </div>
          </div>
        </div>
      `,
    });

  if (result.error) {
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

  const sentAt =
    new Date().toISOString();

  const updateData: {
    status?: string;
    sent_to: string;
    sent_at: string;
  } = {
    sent_to: recipient,
    sent_at: sentAt,
  };

  if (
    invoice.status !== "Paid" &&
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
    .update(updateData)
    .eq("id", id);

  if (updateError) {
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

function escapeHtml(
  value: string
) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(
  value: string
) {
  const [
    year,
    month,
    day,
  ] = value
    .slice(0, 10)
    .split("-")
    .map(Number);

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
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