import { NextRequest } from "next/server";
import { Resend } from "resend";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type TemplateValues = {
  client_name: string;
  job_title: string;
  contract_number: string;
  view_link: string;
};

const fallbackContractTemplate = {
  subject:
    "Contract {{contract_number}} from Dry Home Damp Proofing Solutions",

  body: `Hi {{client_name}},

Please find your contract {{contract_number}} for {{job_title}}.

You can view the contract using the link below:

{{view_link}}

If you have any questions regarding the contract or proposed works, simply reply to this email.

Kind regards,

James
Dry Home Damp Proofing Solutions`,
};

/* =========================================================
   SEND CONTRACT
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
     CONTRACT
     ========================================================= */

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
    !contract
  ) {
    console.error(
      "Unable to load contract:",
      error
    );

    return redirectToContract(
      id,
      "error",
      "Contract could not be found."
    );
  }

  /* =========================================================
     CLIENT
     ========================================================= */

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

  if (
    !contract.public_token
  ) {
    return redirectToContract(
      id,
      "error",
      "This contract does not have a secure customer link."
    );
  }

  /* =========================================================
     EMAIL CONFIG
     ========================================================= */

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
        "contract"
      )
      .maybeSingle(),

    contract.job_id
      ? supabase
          .from("jobs")
          .select(`
            id,
            title
          `)
          .eq(
            "id",
            contract.job_id
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
      "Unable to load contract email template. Using fallback:",
      templateResult.error
    );
  }

  if (
    jobResult.error
  ) {
    console.error(
      "Unable to load contract job:",
      jobResult.error
    );
  }

  const emailTemplate = {
    subject:
      templateResult.data?.subject?.trim() ||
      fallbackContractTemplate.subject,

    body:
      templateResult.data?.body?.trim() ||
      fallbackContractTemplate.body,
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
    contract.title ||
    "your works";

  const contractTotal =
    Number(
      contract.amount ??
        0
    );

  const customerUrl =
    `${appUrl}/c/${contract.public_token}`;

  const templateValues: TemplateValues = {
    client_name:
      clientName,

    job_title:
      jobTitle,

    contract_number:
      contract.contract_number,

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

      contractNumber:
        contract.contract_number,

      contractTitle:
        contract.title ||
        "Contract",

      contractTotal,
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
      "Resend contract error:",
      result.error
    );

    return redirectToContract(
      id,
      "error",
      "The contract email could not be sent."
    );
  }

  /* =========================================================
     UPDATE CONTRACT STATUS
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
   * Never overwrite Signed with Sent.
   */

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
  contractNumber,
  contractTitle,
  contractTotal,
}: {
  templateBody: string;

  values:
    TemplateValues;

  customerUrl:
    string;

  contractNumber:
    string;

  contractTitle:
    string;

  contractTotal:
    number;
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
            Customer Contract
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

        <!-- CONTRACT SUMMARY -->

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
            Contract
          </div>

          <div style="
            margin-top:5px;
            color:#0f172a;
            font-size:18px;
            font-weight:700;
          ">
            ${escapeHtml(
              contractNumber
            )}
          </div>

          <div style="
            margin-top:7px;
            color:#475569;
            font-size:14px;
          ">
            ${escapeHtml(
              contractTitle
            )}
          </div>

          ${
            contractTotal >
            0
              ? `
                <div style="
                  margin-top:18px;
                  font-size:11px;
                  text-transform:uppercase;
                  letter-spacing:0.06em;
                  color:#94a3b8;
                ">
                  Contract Value
                </div>

                <div style="
                  margin-top:4px;
                  color:#0f172a;
                  font-size:22px;
                  font-weight:700;
                ">
                  ${escapeHtml(
                    formatCurrency(
                      contractTotal
                    )
                  )}
                </div>
              `
              : ""
          }
        </div>

        <!-- NOTE -->

        <div style="
          margin:0 32px 32px 32px;
          padding:16px 18px;
          border-radius:8px;
          background:#f8fafc;
          color:#64748b;
          font-size:13px;
          line-height:1.6;
        ">
          Please review the scope of works and terms carefully before confirming your agreement.
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
   * In the HTML email, {{view_link}} becomes
   * a proper View & Sign Contract button.
   */

  const viewLinkMarker =
    "__DRYHOME_VIEW_CONTRACT_BUTTON__";

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

    contract_number:
      values.contract_number,
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
   * Escape editable customer content before
   * inserting it into the HTML email.
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
          return buildContractButton(
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
                    buildContractButton(
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
   VIEW CONTRACT BUTTON
   ========================================================= */

function buildContractButton(
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
        View &amp; Sign Contract
      </a>
    </div>
  `;
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

function redirectToContract(
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
          `/contracts/${id}?${params.toString()}`,
      },
    }
  );
}