import {
  NextRequest,
  NextResponse,
} from "next/server";

import { Resend } from "resend";

import { createClient } from "@/lib/supabase/server";

export const runtime =
  "nodejs";

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

const MAX_ATTACHMENTS = 5;

const MAX_TOTAL_SIZE =
  4 * 1024 * 1024;

const FALLBACK_SUBJECT =
  "Variation {{variation_number}} from Dry Home Damp Proofing Solutions";

const FALLBACK_BODY = `Hi {{client_name}},

During the course of the works, additional works have been identified which fall outside the scope of the original quotation.

Please find variation {{variation_number}} for {{job_title}}.

Variation total: {{variation_total}}

You can review the additional works and accept or decline them using the secure link provided in this email.

If you have any questions regarding the variation or proposed additional works, simply reply to this email.

Kind regards,

James
Dry Home Damp Proofing Solutions`;

export async function GET(
  _request: NextRequest,
  {
    params,
  }: RouteProps
) {
  const {
    id,
  } = await params;

  const supabase =
    await createClient();

  const {
    data: authData,
  } =
    await supabase.auth.getUser();

  if (
    !authData.user
  ) {
    return NextResponse.json(
      {
        error:
          "You must be signed in to send a variation.",
      },
      {
        status: 401,
      }
    );
  }

  const result =
    await loadVariation(
      supabase,
      id
    );

  if (
    !result
  ) {
    return NextResponse.json(
      {
        error:
          "Variation could not be found.",
      },
      {
        status: 404,
      }
    );
  }

  const {
    variation,
    client,
    job,
  } = result;

  if (
    !variation.public_token
  ) {
    return NextResponse.json(
      {
        error:
          "This variation does not have a secure customer link.",
      },
      {
        status: 400,
      }
    );
  }

  const template =
    await loadTemplate(
      supabase
    );

  const values = {
    client_name:
      getClientName(
        client
      ),

    variation_number:
      variation.variation_number,

    job_title:
      job?.title ||
      variation.title ||
      "Additional Works",

    variation_total:
      formatCurrency(
        variation.amount
      ),

    view_link: "",
  };

  const subject =
    renderTemplate(
      template.subject,
      values
    ).trim();

  const body =
    renderTemplate(
      template.body,
      values
    )
      .replace(
        /\n{3,}/g,
        "\n\n"
      )
      .trim();

  return NextResponse.json({
    recipient:
      client?.email?.trim() ||
      "",

    subject,

    body,
  });
}

export async function POST(
  request: NextRequest,
  {
    params,
  }: RouteProps
) {
  const {
    id,
  } = await params;

  const supabase =
    await createClient();

  const {
    data: authData,
  } =
    await supabase.auth.getUser();

  if (
    !authData.user
  ) {
    return NextResponse.json(
      {
        error:
          "You must be signed in to send a variation.",
      },
      {
        status: 401,
      }
    );
  }

  const result =
    await loadVariation(
      supabase,
      id
    );

  if (
    !result
  ) {
    return NextResponse.json(
      {
        error:
          "Variation could not be found.",
      },
      {
        status: 404,
      }
    );
  }

  const {
    variation,
    client,
    job,
  } = result;

  if (
    !variation.public_token
  ) {
    return NextResponse.json(
      {
        error:
          "This variation does not have a secure customer link.",
      },
      {
        status: 400,
      }
    );
  }

  const appUrl =
    process.env
      .NEXT_PUBLIC_APP_URL
      ?.trim()
      .replace(
        /\/$/,
        ""
      );

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

  const resendApiKey =
    process.env
      .RESEND_API_KEY
      ?.trim();

  if (
    !resendApiKey
  ) {
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

  let formData: FormData;

  try {
    formData =
      await request.formData();
  } catch {
    return NextResponse.json(
      {
        error:
          "Unable to read the email form.",
      },
      {
        status: 400,
      }
    );
  }

  const recipient =
    String(
      formData.get(
        "recipient"
      ) ?? ""
    ).trim();

  const subject =
    String(
      formData.get(
        "subject"
      ) ?? ""
    ).trim();

  const body =
    String(
      formData.get(
        "body"
      ) ?? ""
    ).trim();

  if (
    !recipient ||
    !recipient.includes(
      "@"
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Please enter a valid recipient email address.",
      },
      {
        status: 400,
      }
    );
  }

  if (!subject) {
    return NextResponse.json(
      {
        error:
          "Email subject is required.",
      },
      {
        status: 400,
      }
    );
  }

  if (!body) {
    return NextResponse.json(
      {
        error:
          "Email message is required.",
      },
      {
        status: 400,
      }
    );
  }

  const attachmentFiles =
    formData
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
      );

  if (
    attachmentFiles.length >
    MAX_ATTACHMENTS
  ) {
    return NextResponse.json(
      {
        error:
          `You can attach a maximum of ${MAX_ATTACHMENTS} files.`,
      },
      {
        status: 400,
      }
    );
  }

  const totalAttachmentSize =
    attachmentFiles.reduce(
      (
        total,
        file
      ) =>
        total +
        file.size,
      0
    );

  if (
    totalAttachmentSize >
    MAX_TOTAL_SIZE
  ) {
    return NextResponse.json(
      {
        error:
          "Attachments must be no more than 4 MB combined.",
      },
      {
        status: 400,
      }
    );
  }

  const attachments =
    await Promise.all(
      attachmentFiles.map(
        async (
          file
        ) => ({
          filename:
            sanitizeFilename(
              file.name
            ),

          content:
            Buffer.from(
              await file.arrayBuffer()
            ).toString(
              "base64"
            ),
        })
      )
    );

  const customerUrl =
    `${appUrl}/v/${variation.public_token}`;

  const fromAddress =
    process.env
      .RESEND_FROM_EMAIL
      ?.trim() ||
    "Dry Home Damp Proofing Solutions <quotes@admin.dryhomedampproofing.co.uk>";

  const replyTo =
    process.env
      .DRYHOME_REPLY_TO_EMAIL
      ?.trim();

  const clientName =
    getClientName(
      client
    );

  const jobTitle =
    job?.title ||
    variation.title ||
    "Additional Works";

  const variationTotal =
    formatCurrency(
      variation.amount
    );

  const resend =
    new Resend(
      resendApiKey
    );

  const html =
    buildEmailHtml({
      body,
      variationNumber:
        variation.variation_number,
      variationTitle:
        variation.title ||
        "Additional Works",
      variationTotal,
      jobTitle,
      customerUrl,
    });

  const text = [
    body,
    "",
    "--------------------------------",
    "",
    `Variation: ${variation.variation_number}`,
    `Job: ${jobTitle}`,
    `Variation total: ${variationTotal}`,
    "",
    "View the variation securely here:",
    customerUrl,
    "",
    "The secure link above is required to review the additional works.",
  ].join(
    "\n"
  );

  const sendResult =
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

      ...(attachments.length >
      0
        ? {
            attachments,
          }
        : {}),
    });

  if (
    sendResult.error
  ) {
    console.error(
      "Variation email error:",
      sendResult.error
    );

    return NextResponse.json(
      {
        error:
          sendResult.error
            .message ||
          "Variation email could not be sent.",
      },
      {
        status: 500,
      }
    );
  }

  const newStatus =
    variation.status ===
      "Accepted" ||
    variation.status ===
      "Declined" ||
    variation.status ===
      "Cancelled"
      ? variation.status
      : "Sent";

  const {
    error:
      trackingError,
  } = await supabase
    .from(
      "variations"
    )
    .update({
      status:
        newStatus,

      sent_to:
        recipient,

      sent_at:
        new Date()
          .toISOString(),

      updated_at:
        new Date()
          .toISOString(),
    })
    .eq(
      "id",
      variation.id
    );

  if (
    trackingError
  ) {
    console.error(
      "Variation send tracking error:",
      trackingError
    );

    return NextResponse.json(
      {
        error:
          "The email was sent, but the variation activity could not be updated.",
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json({
    success: true,
    sentTo:
      recipient,
    messageId:
      sendResult.data?.id ??
      null,
  });
}

/* =========================================================
   LOAD VARIATION
   ========================================================= */

async function loadVariation(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  id: string
) {
  const {
    data: variation,
    error,
  } = await supabase
    .from(
      "variations"
    )
    .select(`
      id,
      variation_number,
      title,
      status,
      amount,
      public_token,
      client_id,
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
    !variation
  ) {
    console.error(
      "Variation email load error:",
      error
    );

    return null;
  }

  const client =
    Array.isArray(
      variation.clients
    )
      ? variation.clients[0]
      : variation.clients;

  let job:
    | {
        id: string;
        title:
          | string
          | null;
      }
    | null =
    null;

  if (
    variation.job_id
  ) {
    const {
      data: jobData,
    } = await supabase
      .from(
        "jobs"
      )
      .select(`
        id,
        title
      `)
      .eq(
        "id",
        variation.job_id
      )
      .maybeSingle();

    job =
      jobData ??
      null;
  }

  return {
    variation,
    client,
    job,
  };
}

/* =========================================================
   EMAIL TEMPLATE
   ========================================================= */

async function loadTemplate(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >
) {
  const {
    data,
    error,
  } = await supabase
    .from(
      "email_templates"
    )
    .select(`
      subject,
      body
    `)
    .eq(
      "template_key",
      "variation"
    )
    .maybeSingle();

  if (
    error
  ) {
    console.error(
      "Variation email template load error:",
      error
    );
  }

  return {
    subject:
      data?.subject ||
      FALLBACK_SUBJECT,

    body:
      data?.body ||
      FALLBACK_BODY,
  };
}

/* =========================================================
   TEMPLATE RENDERING
   ========================================================= */

function renderTemplate(
  template: string,
  values: Record<
    string,
    string
  >
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
      result.replace(
        new RegExp(
          `{{\\s*${escapeRegExp(
            key
          )}\\s*}}`,
          "g"
        ),
        value
      );
  }

  return result;
}

function escapeRegExp(
  value: string
) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

/* =========================================================
   EMAIL HTML
   ========================================================= */

function buildEmailHtml({
  body,
  variationNumber,
  variationTitle,
  variationTotal,
  jobTitle,
  customerUrl,
}: {
  body: string;
  variationNumber: string;
  variationTitle: string;
  variationTotal: string;
  jobTitle: string;
  customerUrl: string;
}) {
  return `
    <!DOCTYPE html>
    <html>
      <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
          <tr>
            <td align="center">

              <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden;">

                <tr>
                  <td style="background:#d97706;padding:30px 32px;">
                    <div style="font-size:23px;font-weight:700;color:#ffffff;">
                      Dry Home Damp Proofing Solutions
                    </div>

                    <div style="margin-top:6px;font-size:14px;color:#fef3c7;">
                      Variation / Additional Works
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:32px;">

                    ${renderMessageBody(
                      body
                    )}

                    <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;background:#f8fafc;border-radius:12px;">
                      <tr>
                        <td style="padding:20px;">
                          <div style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;">
                            Variation
                          </div>

                          <div style="margin-top:5px;font-size:17px;font-weight:700;color:#0f172a;">
                            ${escapeHtml(
                              variationNumber
                            )}
                          </div>

                          <div style="margin-top:14px;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;">
                            Additional Works
                          </div>

                          <div style="margin-top:5px;font-size:15px;font-weight:600;color:#334155;">
                            ${escapeHtml(
                              variationTitle
                            )}
                          </div>

                          <div style="margin-top:14px;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;">
                            Job
                          </div>

                          <div style="margin-top:5px;font-size:14px;color:#475569;">
                            ${escapeHtml(
                              jobTitle
                            )}
                          </div>

                          <div style="margin-top:14px;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;">
                            Variation Total
                          </div>

                          <div style="margin-top:5px;font-size:22px;font-weight:700;color:#0f172a;">
                            ${escapeHtml(
                              variationTotal
                            )}
                          </div>
                        </td>
                      </tr>
                    </table>

                    <table cellpadding="0" cellspacing="0" style="margin:28px 0;">
                      <tr>
                        <td style="border-radius:8px;background:#d97706;">
                          <a
                            href="${escapeAttribute(
                              customerUrl
                            )}"
                            style="display:inline-block;padding:14px 22px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;"
                          >
                            View Variation
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">
                      This is a secure link to the additional works associated with your job.
                    </p>

                  </td>
                </tr>

              </table>

            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

function renderMessageBody(
  value: string
) {
  return value
    .split(
      /\n\s*\n/
    )
    .map(
      (
        paragraph
      ) => {
        const escaped =
          escapeHtml(
            paragraph.trim()
          ).replace(
            /\n/g,
            "<br />"
          );

        return `<p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#475569;">${escaped}</p>`;
      }
    )
    .join("");
}

/* =========================================================
   HELPERS
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

function formatCurrency(
  value:
    | number
    | string
    | null
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
    Number(
      value ?? 0
    )
  );
}

function sanitizeFilename(
  value: string
) {
  const cleaned =
    value
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

function escapeAttribute(
  value: string
) {
  return escapeHtml(
    value
  );
}