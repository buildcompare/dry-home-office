import { NextRequest } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function redirectToContract(
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
      Location: `/contracts/${id}?${params.toString()}`,
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
    data: contract,
    error,
  } = await supabase
    .from("contracts")
    .select(`
      id,
      contract_number,
      title,
      status,
      amount,
      public_token,
      client_id,
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

  if (error || !contract) {
    return redirectToContract(
      id,
      "error",
      "Contract could not be found."
    );
  }

  const client =
    Array.isArray(
      contract.clients
    )
      ? contract.clients[0]
      : contract.clients;

  const recipient =
    client?.email?.trim();

  if (!recipient) {
    return redirectToContract(
      id,
      "error",
      "The client does not have an email address."
    );
  }

  if (!contract.public_token) {
    return redirectToContract(
      id,
      "error",
      "This contract does not have a secure customer link."
    );
  }

  const resendApiKey =
    process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    return redirectToContract(
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
    return redirectToContract(
      id,
      "error",
      "NEXT_PUBLIC_APP_URL is missing."
    );
  }

  const customerUrl =
    `${appUrl}/c/${contract.public_token}`;

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
        contract.amount ?? 0
      )
    );

  const result =
    await resend.emails.send({
      from: fromAddress,

      to: recipient,

      ...(replyTo
        ? {
            replyTo,
          }
        : {}),

      subject: `${contract.contract_number} – Contract from Dry Home Damp Proofing Solutions`,

      text: [
        `Dear ${clientName},`,
        "",
        "Your contract from Dry Home Damp Proofing Solutions is ready to review.",
        "",
        `Contract: ${contract.contract_number}`,
        `Title: ${contract.title || "Contract"}`,
        `Contract value: ${total}`,
        "",
        "Please use the secure link below to review the contract and confirm your agreement:",
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
                Customer Contract
              </div>
            </div>

            <div style="padding:32px;">
              <p style="margin-top:0;">
                Dear ${escapeHtml(clientName)},
              </p>

              <p style="line-height:1.6;color:#475569;">
                Your contract is ready for review and confirmation.
              </p>

              <div style="margin:24px 0;padding:20px;background:#f8fafc;border-radius:10px;">
                <div style="font-size:13px;color:#64748b;">
                  Contract
                </div>

                <div style="margin-top:4px;font-size:18px;font-weight:700;">
                  ${escapeHtml(contract.contract_number)}
                </div>

                <div style="margin-top:14px;font-size:13px;color:#64748b;">
                  ${escapeHtml(contract.title || "Contract")}
                </div>

                <div style="margin-top:4px;font-size:20px;font-weight:700;">
                  ${total}
                </div>
              </div>

              <p style="line-height:1.6;color:#475569;">
                Please review the scope of works and terms carefully before confirming your agreement.
              </p>

              <div style="margin:30px 0;">
                <a
                  href="${customerUrl}"
                  style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:8px;font-weight:700;"
                >
                  View & Sign Contract
                </a>
              </div>

              <p style="font-size:13px;line-height:1.6;color:#64748b;">
                This secure link is unique to your contract.
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
      "Resend contract error:",
      result.error
    );

    return redirectToContract(
      id,
      "error",
      "The contract email could not be sent."
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
    contract.status !==
    "Signed"
  ) {
    updateData.status =
      "Sent";
  }

  const {
    error: updateError,
  } = await supabase
    .from("contracts")
    .update(updateData)
    .eq("id", id);

  if (updateError) {
    console.error(
      "Contract sent status update error:",
      updateError
    );

    return redirectToContract(
      id,
      "warning",
      "The email was sent, but the contract status could not be updated."
    );
  }

  return redirectToContract(
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