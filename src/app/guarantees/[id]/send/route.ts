import { NextResponse } from "next/server";
import { Resend } from "resend";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

type TemplateValues = {
  client_name: string;
  job_title: string;
  guarantee_number: string;
  view_link: string;
};

const fallbackGuaranteeTemplate = {
  subject:
    "Guarantee {{guarantee_number}} from Dry Home Damp Proofing Solutions",

  body: `Hi {{client_name}},

Please find your guarantee {{guarantee_number}} for {{job_title}}.

You can view the guarantee using the link below:

{{view_link}}

Please keep this document for your records.

If you have any questions, simply reply to this email.

Kind regards,

James
Dry Home Damp Proofing Solutions`,
};

/* =========================================================
   SEND GUARANTEE
   ========================================================= */

export async function POST(
  _request: Request,
  { params }: RouteProps
) {
  const { id } =
    await params;

  const supabase =
    await createClient();

  /* =========================================================
     AUTH
     ========================================================= */

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

  /* =========================================================
     GUARANTEE
     ========================================================= */

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
      job_id,

      clients (
        display_name,
        email
      )
    `)
    .eq(
      "id",
      id
    )
    .single();

  if (
    guaranteeError ||
    !guarantee
  ) {
    console.error(
      "Unable to load guarantee:",
      guaranteeError
    );

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

  /* =========================================================
     CLIENT
     ========================================================= */

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

  /* =========================================================
     EMAIL CONFIG
     ========================================================= */

  const resendApiKey =
    process.env.RESEND_API_KEY;

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
    process.env.NEXT_PUBLIC_APP_URL?.replace(
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
        "guarantee"
      )
      .maybeSingle(),

    guarantee.job_id
      ? supabase
          .from("jobs")
          .select(`
            id,
            title
          `)
          .eq(
            "id",
            guarantee.job_id
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
      "Unable to load guarantee email template. Using fallback:",
      templateResult.error
    );
  }

  if (
    jobResult.error
  ) {
    console.error(
      "Unable to load guarantee job:",
      jobResult.error
    );
  }

  const emailTemplate = {
    subject:
      templateResult.data?.subject?.trim() ||
      fallbackGuaranteeTemplate.subject,

    body:
      templateResult.data?.body?.trim() ||
      fallbackGuaranteeTemplate.body,
  };

  /* =========================================================
     VALUES
     ========================================================= */

  const customerName =
    client?.display_name ||
    "Customer";

  const jobTitle =
    jobResult.data?.title ||
    guarantee.title ||
    "your works";

  const customerUrl =
    `${appUrl}/g/${guarantee.public_token}`;

  const formattedIssueDate =
    formatDate(
      guarantee.issue_date
    );

  const formattedExpiryDate =
    formatDate(
      guarantee.expiry_date
    );

  const guaranteeType =
    guarantee.guarantee_type ||
    "Works Guarantee";

  const templateValues: TemplateValues = {
    client_name:
      customerName,

    job_title:
      jobTitle,

    guarantee_number:
      guarantee.guarantee_number,

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
     TEXT
     ========================================================= */

  const text =
    replaceTemplatePlaceholders(
      emailTemplate.body,
      templateValues
    );

  /* =========================================================
     HTML
     ========================================================= */

  const html =
    buildTemplateEmailHtml({
      templateBody:
        emailTemplate.body,

      values:
        templateValues,

      customerUrl,

      guaranteeNumber:
        guarantee.guarantee_number,

      guaranteeType,

      issueDate:
        formattedIssueDate,

      expiryDate:
        formattedExpiryDate,
    });

  /* =========================================================
     RESEND
     ========================================================= */

  const fromEmail =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Dry Home Damp Proofing Solutions <quotes@admin.dryhomedampproofing.co.uk>";

  const replyTo =
    process.env.DRYHOME_REPLY_TO_EMAIL?.trim();

  const resend =
    new Resend(
      resendApiKey
    );

  const {
    error: sendError,
  } =
    await resend.emails.send({
      from:
        fromEmail,

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
    });

  if (
    sendError
  ) {
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

  /* =========================================================
     UPDATE GUARANTEE
     ========================================================= */

  const sentAt =
    new Date().toISOString();

  const {
    error: updateError,
  } = await supabase
    .from("guarantees")
    .update({
      sent_to:
        recipient,

      sent_at:
        sentAt,

      /*
       * If the customer has already viewed the
       * guarantee, don't move it backwards to Issued.
       */

      status:
        guarantee.status ===
          "Viewed"
          ? "Viewed"
          : "Issued",

      updated_at:
        sentAt,
    })
    .eq(
      "id",
      guarantee.id
    );

  if (
    updateError
  ) {
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
  guaranteeNumber,
  guaranteeType,
  issueDate,
  expiryDate,
}: {
  templateBody: string;

  values:
    TemplateValues;

  customerUrl:
    string;

  guaranteeNumber:
    string;

  guaranteeType:
    string;

  issueDate:
    string;

  expiryDate:
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
            Customer Guarantee
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

        <!-- GUARANTEE SUMMARY -->

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
            Guarantee
          </div>

          <div style="
            margin-top:5px;
            color:#0f172a;
            font-size:18px;
            font-weight:700;
          ">
            ${escapeHtml(
              guaranteeNumber
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
                Guarantee Type
              </td>

              <td style="
                padding:6px 0;
                text-align:right;
                color:#0f172a;
                font-size:14px;
                font-weight:700;
              ">
                ${escapeHtml(
                  guaranteeType
                )}
              </td>
            </tr>

            <tr>
              <td style="
                padding:6px 0;
                color:#64748b;
                font-size:13px;
              ">
                Issue Date
              </td>

              <td style="
                padding:6px 0;
                text-align:right;
                color:#0f172a;
                font-size:14px;
                font-weight:700;
              ">
                ${escapeHtml(
                  issueDate
                )}
              </td>
            </tr>

            <tr>
              <td style="
                padding:6px 0;
                color:#64748b;
                font-size:13px;
              ">
                Valid Until
              </td>

              <td style="
                padding:6px 0;
                text-align:right;
                color:#0f172a;
                font-size:14px;
                font-weight:700;
              ">
                ${escapeHtml(
                  expiryDate
                )}
              </td>
            </tr>

          </table>
        </div>

        <!-- RETAIN NOTICE -->

        <div style="
          margin:0 32px 32px 32px;
          padding:16px 18px;
          border-radius:8px;
          background:#ecfdf5;
          color:#065f46;
          font-size:13px;
          line-height:1.6;
        ">
          Please retain this guarantee with your property records.
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
  /*
   * {{view_link}} becomes the customer-facing
   * View Guarantee button in HTML emails.
   */

  const viewLinkMarker =
    "__DRYHOME_VIEW_GUARANTEE_BUTTON__";

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

    guarantee_number:
      values.guarantee_number,
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
          return buildGuaranteeButton(
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
                    buildGuaranteeButton(
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
   VIEW GUARANTEE BUTTON
   ========================================================= */

function buildGuaranteeButton(
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
          background:#047857;
          color:#ffffff;
          text-decoration:none;
          padding:14px 28px;
          border-radius:8px;
          font-size:16px;
          font-weight:700;
        "
      >
        View Guarantee
      </a>

    </div>
  `;
}

/* =========================================================
   DATE
   ========================================================= */

function formatDate(
  value:
    | string
    | null
) {
  if (!value) {
    return "Not set";
  }

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