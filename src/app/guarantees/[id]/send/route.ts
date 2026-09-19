import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: RouteProps
) {
  const { id } =
    await params;

  const supabase =
    await createClient();

  const {
    data: authData,
  } =
    await supabase.auth.getUser();

  if (!authData.user) {
    return NextResponse.json(
      {
        error:
          "You must be signed in to send a guarantee.",
      },
      {
        status: 401,
      }
    );
  }

  const {
    data: guarantee,
    error: guaranteeError,
  } = await supabase
    .from("guarantees")
    .select(`
      id,
      guarantee_number,
      title,
      guarantee_type,
      status,
      issue_date,
      expiry_date,
      public_token,
      client_id,
      clients (
        display_name,
        email
      )
    `)
    .eq("id", id)
    .single();

  if (
    guaranteeError ||
    !guarantee
  ) {
    return NextResponse.json(
      {
        error:
          "Guarantee could not be found.",
      },
      {
        status: 404,
      }
    );
  }

  const client =
    Array.isArray(
      guarantee.clients
    )
      ? guarantee.clients[0]
      : guarantee.clients;

  const recipient =
    client?.email?.trim();

  if (!recipient) {
    return NextResponse.json(
      {
        error:
          "This client does not have an email address saved.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    !guarantee.public_token
  ) {
    return NextResponse.json(
      {
        error:
          "This guarantee does not have a secure customer link.",
      },
      {
        status: 400,
      }
    );
  }

  const resendApiKey =
    process.env
      .RESEND_API_KEY;

  if (!resendApiKey) {
    return NextResponse.json(
      {
        error:
          "RESEND_API_KEY is missing.",
      },
      {
        status: 500,
      }
    );
  }

  const appUrl =
    process.env
      .NEXT_PUBLIC_APP_URL;

  if (!appUrl) {
    return NextResponse.json(
      {
        error:
          "NEXT_PUBLIC_APP_URL is missing.",
      },
      {
        status: 500,
      }
    );
  }

  const fromEmail =
    process.env
      .RESEND_FROM_EMAIL ||
    "Dry Home Damp Proofing Solutions <quotes@admin.dryhomedampproofing.co.uk>";

  const replyTo =
    process.env
      .DRYHOME_REPLY_TO_EMAIL;

  const customerUrl =
    `${appUrl}/g/${guarantee.public_token}`;

  const customerName =
    client?.display_name ||
    "Customer";

  const subject =
    `Your Guarantee - ${guarantee.guarantee_number}`;

  const resend =
    new Resend(
      resendApiKey
    );

  const formattedIssueDate =
    formatDate(
      guarantee.issue_date
    );

  const formattedExpiryDate =
    formatDate(
      guarantee.expiry_date
    );

  const html = `
    <!DOCTYPE html>
    <html>
      <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden;">
                <tr>
                  <td style="background:#020617;padding:32px;">
                    <h1 style="margin:0;color:#ffffff;font-size:24px;">
                      Dry Home Damp Proofing Solutions LTD
                    </h1>

                    <p style="margin:10px 0 0;color:#94a3b8;font-size:14px;">
                      Customer Guarantee
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:32px;">
                    <p style="margin:0 0 16px;font-size:16px;">
                      Dear ${escapeHtml(customerName)},
                    </p>

                    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#475569;">
                      Your guarantee from Dry Home Damp Proofing Solutions LTD is now available to view securely online.
                    </p>

                    <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#f8fafc;border-radius:12px;padding:20px;">
                      <tr>
                        <td style="font-size:14px;color:#64748b;padding-bottom:8px;">
                          Guarantee Number
                        </td>

                        <td align="right" style="font-size:14px;font-weight:bold;color:#0f172a;padding-bottom:8px;">
                          ${escapeHtml(
                            guarantee.guarantee_number
                          )}
                        </td>
                      </tr>

                      <tr>
                        <td style="font-size:14px;color:#64748b;padding-bottom:8px;">
                          Guarantee Type
                        </td>

                        <td align="right" style="font-size:14px;font-weight:bold;color:#0f172a;padding-bottom:8px;">
                          ${escapeHtml(
                            guarantee.guarantee_type ||
                              "Works Guarantee"
                          )}
                        </td>
                      </tr>

                      <tr>
                        <td style="font-size:14px;color:#64748b;padding-bottom:8px;">
                          Issue Date
                        </td>

                        <td align="right" style="font-size:14px;font-weight:bold;color:#0f172a;padding-bottom:8px;">
                          ${escapeHtml(
                            formattedIssueDate
                          )}
                        </td>
                      </tr>

                      <tr>
                        <td style="font-size:14px;color:#64748b;">
                          Valid Until
                        </td>

                        <td align="right" style="font-size:14px;font-weight:bold;color:#0f172a;">
                          ${escapeHtml(
                            formattedExpiryDate
                          )}
                        </td>
                      </tr>
                    </table>

                    <p style="margin:24px 0;text-align:center;">
                      <a
                        href="${customerUrl}"
                        style="display:inline-block;background:#047857;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 24px;border-radius:8px;"
                      >
                        View Guarantee
                      </a>
                    </p>

                    <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#64748b;">
                      Please retain this guarantee with your property records.
                    </p>

                    <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#64748b;">
                      If you have any questions regarding the covered works, please contact Dry Home Damp Proofing Solutions LTD and quote guarantee number ${escapeHtml(
                        guarantee.guarantee_number
                      )}.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;">
                Dry Home Damp Proofing Solutions LTD
              </p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const text = `
Dear ${customerName},

Your guarantee from Dry Home Damp Proofing Solutions LTD is now available.

Guarantee Number: ${guarantee.guarantee_number}
Guarantee Type: ${guarantee.guarantee_type || "Works Guarantee"}
Issue Date: ${formattedIssueDate}
Valid Until: ${formattedExpiryDate}

View your guarantee securely here:
${customerUrl}

Please retain this guarantee with your property records.

Dry Home Damp Proofing Solutions LTD
  `.trim();

  const {
    error: sendError,
  } = await resend.emails.send({
    from:
      fromEmail,

    to: recipient,

    subject,

    html,

    text,

    ...(replyTo
      ? {
          replyTo,
        }
      : {}),
  });

  if (sendError) {
    console.error(
      "Guarantee email error:",
      sendError
    );

    return NextResponse.json(
      {
        error:
          "Guarantee email could not be sent.",
      },
      {
        status: 500,
      }
    );
  }

  const {
    error: updateError,
  } = await supabase
    .from("guarantees")
    .update({
      sent_to:
        recipient,

      sent_at:
        new Date().toISOString(),

      status:
        guarantee.status ===
          "Viewed"
          ? "Viewed"
          : "Issued",

      updated_at:
        new Date().toISOString(),
    })
    .eq(
      "id",
      guarantee.id
    );

  if (updateError) {
    console.error(
      "Guarantee send tracking error:",
      updateError
    );

    return NextResponse.json(
      {
        error:
          "The email was sent, but the guarantee activity could not be updated.",
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json({
    success: true,
  });
}

function formatDate(
  value: string | null
) {
  if (!value) {
    return "Not set";
  }

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

function escapeHtml(
  value: string
) {
  return value
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}