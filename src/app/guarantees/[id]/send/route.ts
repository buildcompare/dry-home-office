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

  const {
    data: authData,
  } =
    await supabase.auth.getUser();

  if (!authData.user) {
    return Response.json(
      {
        error:
          "You must be signed in to send a guarantee.",
      },
      {
        status: 401,
      }
    );
  }

  const context =
    await loadGuaranteeContext(
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
    guarantee,
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
    return Response.json(
      {
        error:
          "This guarantee does not have a secure customer link.",
      },
      {
        status: 400,
      }
    );
  }

  const clientName =
    client?.display_name ||
    "Customer";

  const jobTitle =
    job?.title ||
    guarantee.title ||
    "your works";

  const customerUrl =
    `${appUrl}/g/${guarantee.public_token}`;

  const values: TemplateValues = {
    client_name:
      clientName,

    job_title:
      jobTitle,

    guarantee_number:
      guarantee.guarantee_number,

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
   SEND GUARANTEE
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
      "RESEND_API_KEY is missing.",
      500
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
      "NEXT_PUBLIC_APP_URL is missing.",
      500
    );
  }

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
    return sendErrorResponse(
      wantsJson,
      "You must be signed in to send a guarantee.",
      401
    );
  }

  const context =
    await loadGuaranteeContext(
      supabase,
      id
    );

  if (
    !context.success
  ) {
    return sendErrorResponse(
      wantsJson,
      context.error,
      context.status
    );
  }

  const {
    guarantee,
    client,
    job,
    template,
  } = context;

  if (
    !guarantee.public_token
  ) {
    return sendErrorResponse(
      wantsJson,
      "This guarantee does not have a secure customer link.",
      400
    );
  }

  /* =========================================================
     FORM DATA
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
      "Please enter a valid recipient email address.",
      400
    );
  }

  const clientName =
    client?.display_name ||
    "Customer";

  const jobTitle =
    job?.title ||
    guarantee.title ||
    "your works";

  const customerUrl =
    `${appUrl}/g/${guarantee.public_token}`;

  const values: TemplateValues = {
    client_name:
      clientName,

    job_title:
      jobTitle,

    guarantee_number:
      guarantee.guarantee_number,

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
      "Please enter an email subject.",
      400
    );
  }

  if (!body) {
    return sendErrorResponse(
      wantsJson,
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
     GUARANTEE DETAILS
     ========================================================= */

  const guaranteeType =
    guarantee.guarantee_type ||
    "Works Guarantee";

  const issueDate =
    formatDate(
      guarantee.issue_date
    );

  const expiryDate =
    formatDate(
      guarantee.expiry_date
    );

  const html =
    buildComposerEmailHtml({
      body,

      customerUrl,

      guaranteeNumber:
        guarantee.guarantee_number,

      guaranteeType,

      issueDate,

      expiryDate,
    });

  const text = [
    body,

    "",

    "View your guarantee securely online:",

    customerUrl,
  ].join("\n");

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

      ...(extraAttachments.length >
      0
        ? {
            attachments:
              extraAttachments,
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

    return sendErrorResponse(
      wantsJson,
      "Guarantee email could not be sent.",
      500
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
       * Never move a Viewed guarantee
       * backwards to Issued.
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

    if (
      wantsJson
    ) {
      return Response.json({
        success:
          true,

        warning:
          "The email was sent, but the guarantee activity could not be updated.",
      });
    }

    return Response.json(
      {
        error:
          "The email was sent, but the guarantee activity could not be updated.",
      },
      {
        status: 500,
      }
    );
  }

  return Response.json({
    success: true,
  });
}

/* =========================================================
   LOAD GUARANTEE
   ========================================================= */

async function loadGuaranteeContext(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  id: string
) {
  const [
    guaranteeResult,
    templateResult,
  ] = await Promise.all([
    supabase
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
        "guarantee"
      )
      .maybeSingle(),
  ]);

  if (
    guaranteeResult.error ||
    !guaranteeResult.data
  ) {
    console.error(
      "Unable to load guarantee:",
      guaranteeResult.error
    );

    return {
      success:
        false as const,

      error:
        "Guarantee could not be found.",

      status:
        404,
    };
  }

  if (
    templateResult.error
  ) {
    console.error(
      "Unable to load guarantee email template. Using fallback:",
      templateResult.error
    );
  }

  const guarantee =
    guaranteeResult.data;

  const client =
    Array.isArray(
      guarantee.clients
    )
      ? guarantee.clients[0]
      : guarantee.clients;

  let job:
    | {
        id: string;
        title:
          | string
          | null;
      }
    | null = null;

  if (
    guarantee.job_id
  ) {
    const {
      data: jobData,
      error: jobError,
    } = await supabase
      .from("jobs")
      .select(`
        id,
        title
      `)
      .eq(
        "id",
        guarantee.job_id
      )
      .maybeSingle();

    if (
      jobError
    ) {
      console.error(
        "Unable to load guarantee job:",
        jobError
      );
    }

    job =
      jobData ||
      null;
  }

  const template = {
    subject:
      templateResult.data?.subject?.trim() ||
      fallbackGuaranteeTemplate.subject,

    body:
      templateResult.data?.body?.trim() ||
      fallbackGuaranteeTemplate.body,
  };

  return {
    success:
      true as const,

    guarantee,
    client,
    job,
    template,
  };
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
   EMAIL HTML
   ========================================================= */

function buildComposerEmailHtml({
  body,
  customerUrl,
  guaranteeNumber,
  guaranteeType,
  issueDate,
  expiryDate,
}: {
  body: string;

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
            Customer Guarantee
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
  _wantsJson: boolean,
  message: string,
  status = 500
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