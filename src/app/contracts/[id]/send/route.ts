import React from "react";
import path from "path";
import { readFile } from "fs/promises";

import { NextRequest } from "next/server";
import { Resend } from "resend";
import {
  renderToBuffer,
} from "@react-pdf/renderer";

import { createClient } from "@/lib/supabase/server";
import ContractPdfDocument from "@/components/ContractPdfDocument";
import build from "next/dist/build";

export const runtime = "nodejs";

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
    await loadContractContext(
      supabase,
      id
    );

  if (!context.success) {
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
    contract,
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

  if (!contract.public_token) {
    return Response.json(
      {
        error:
          "This contract does not have a secure customer link.",
      },
      {
        status: 400,
      }
    );
  }

  const clientName =
    getClientName(client);

  const jobTitle =
    job?.title ||
    contract.title ||
    "your works";

  const customerUrl =
    `${appUrl}/c/${contract.public_token}`;

  const values: TemplateValues = {
    client_name:
      clientName,

    job_title:
      jobTitle,

    contract_number:
      contract.contract_number,

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
    automaticAttachment:
      "Contract PDF",
  });
}

/* =========================================================
   SEND CONTRACT
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
    await loadContractContext(
      supabase,
      id
    );

  if (!context.success) {
    return sendErrorResponse(
      wantsJson,
      id,
      context.error,
      context.status
    );
  }

  const {
    contract,
    client,
    job,
    quote,
    template,
  } = context;

  if (!contract.public_token) {
    return sendErrorResponse(
      wantsJson,
      id,
      "This contract does not have a secure customer link.",
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
    getClientName(client);

  const jobTitle =
    job?.title ||
    contract.title ||
    "your works";

  const customerUrl =
    `${appUrl}/c/${contract.public_token}`;

  const values: TemplateValues = {
    client_name:
      clientName,

    job_title:
      jobTitle,

    contract_number:
      contract.contract_number,

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
     CONTRACT PDF
     ========================================================= */

  const clientAddressLines =
    getAddressLines(
      client
    );

  const jobAddressLines =
    getAddressLines(
      job
    );

  const propertyAddressLines =
    jobAddressLines.length >
    0
      ? jobAddressLines
      : clientAddressLines;

  const logoDataUri =
    await loadLogoFromDisk();

  let pdfBuffer: Buffer;

  try {
    const pdfDocument =
      React.createElement(
        ContractPdfDocument,
        {
          logoDataUri,

          contractNumber:
            contract.contract_number,

          title:
            contract.title ||
            "Customer Contract",

          status:
            contract.status ||
            "Contract",

          contractDate:
            contract.contract_date,

          clientName,

          clientEmail:
            client?.email ||
            null,

          clientPhone:
            client?.phone ||
            null,

          clientAddressLines,

          jobNumber:
            job?.job_number ||
            null,

          jobTitle:
            job?.title ||
            null,

          jobType:
            job?.job_type ||
            null,

          propertyAddressLines,

          quoteNumber:
            quote?.quote_number ||
            null,

          description:
            contract.description,

          terms:
            contract.terms,

          customerMessage:
            contract.customer_message,

          total:
            Number(
              contract.amount ??
                0
            ),

          signedAt:
            contract.signed_at,

          signedName:
            contract.signed_name,

          signedEmail:
            contract.signed_email,

          customerUrl,
        }
      );

    pdfBuffer =
      await renderToBuffer(
        pdfDocument
      );
  } catch (pdfError) {
    console.error(
      "Unable to generate contract PDF:",
      pdfError
    );

    return sendErrorResponse(
      wantsJson,
      id,
      "Unable to generate the contract PDF attachment."
    );
  }

  const pdfFilename =
    makePdfFilename(
      contract.contract_number,
      contract.title ||
        "Contract"
    );

  /* =========================================================
     EMAIL
     ========================================================= */

  const contractTotal =
    Number(
      contract.amount ??
        0
    );

  const contractTitle =
    contract.title ||
    "Contract";

  const html =
    buildComposerEmailHtml({
      body,
      customerUrl,

      contractNumber:
        contract.contract_number,

      contractTitle,
      contractTotal,
    });

  const text = [
    body,
    "",
    "A PDF copy of your contract is attached.",
    "",
    "View and sign your contract securely online:",
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
      "Resend contract error:",
      result.error
    );

    return sendErrorResponse(
      wantsJson,
      id,
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
   * Never move a signed contract back to Sent.
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

    if (
      wantsJson
    ) {
      return Response.json({
        success:
          true,

        warning:
          "The email was sent, but the contract status could not be updated.",
      });
    }

    return redirectToContract(
      id,
      "warning",
      "The email was sent, but the contract status could not be updated."
    );
  }

  if (
    wantsJson
  ) {
    return Response.json({
      success: true,
    });
  }

  return redirectToContract(
    id,
    "sent",
    "1"
  );
}

/* =========================================================
   LOAD CONTRACT
   ========================================================= */

async function loadContractContext(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,

  id: string
) {
  const [
    contractResult,
    templateResult,
  ] = await Promise.all([
    supabase
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
        quote_id,
        contract_date,
        description,
        terms,
        customer_message,
        signed_at,
        signed_name,
        signed_email,

        clients (
          id,
          display_name,
          first_name,
          last_name,
          email,
          phone,
          address_line_1,
          address_line_2,
          town,
          county,
          postcode
        ),

        jobs (
          id,
          job_number,
          title,
          job_type,
          address_line_1,
          address_line_2,
          town,
          county,
          postcode
        ),

        quotes (
          id,
          quote_number
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
        "contract"
      )
      .maybeSingle(),
  ]);

  if (
    contractResult.error ||
    !contractResult.data
  ) {
    console.error(
      "Unable to load contract:",
      contractResult.error
    );

    return {
      success:
        false as const,

      error:
        "Contract could not be found.",

      status:
        404,
    };
  }

  if (
    templateResult.error
  ) {
    console.error(
      "Unable to load contract email template. Using fallback:",
      templateResult.error
    );
  }

  const contract =
    contractResult.data;

  const client =
    Array.isArray(
      contract.clients
    )
      ? contract.clients[0] ||
        null
      : contract.clients;

  const job =
    Array.isArray(
      contract.jobs
    )
      ? contract.jobs[0] ||
        null
      : contract.jobs;

  const quote =
    Array.isArray(
      contract.quotes
    )
      ? contract.quotes[0] ||
        null
      : contract.quotes;

  const template = {
    subject:
      templateResult.data?.subject?.trim() ||
      fallbackContractTemplate.subject,

    body:
      templateResult.data?.body?.trim() ||
      fallbackContractTemplate.body,
  };

  return {
    success:
      true as const,

    contract,
    client,
    job,
    quote,
    template,
  };
}

/* =========================================================
   PDF LOGO
   ========================================================= */

async function loadLogoFromDisk():
  Promise<string | null> {
  try {
    const logoPath =
      path.join(
        process.cwd(),
        "public",
        "dryhome-logo.png"
      );

    const logoBuffer =
      await readFile(
        logoPath
      );

    return `data:image/png;base64,${logoBuffer.toString(
      "base64"
    )}`;
  } catch (error) {
    console.error(
      "Unable to load contract PDF logo:",
      error
    );

    return null;
  }
}

/* =========================================================
   CLIENT / ADDRESS
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

function getAddressLines(
  record:
    | {
        address_line_1?:
          | string
          | null;

        address_line_2?:
          | string
          | null;

        town?:
          | string
          | null;

        county?:
          | string
          | null;

        postcode?:
          | string
          | null;
      }
    | null
    | undefined
) {
  return [
    record?.address_line_1,
    record?.address_line_2,
    record?.town,
    record?.county,
    record?.postcode,
  ].filter(
    (
      value
    ): value is string =>
      Boolean(
        value?.trim()
      )
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
   HTML EMAIL
   ========================================================= */

function buildComposerEmailHtml({
  body,
  customerUrl,
  contractNumber,
  contractTitle,
  contractTotal,
}: {
  body: string;

  customerUrl:
    string;

  contractNumber:
    string;

  contractTitle:
    string;

  contractTotal:
    number;
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
            Works Contract
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
          margin:10px 32px 20px 32px;
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

        <div style="
          margin:0 32px 24px 32px;
          padding:14px 16px;
          background:#f8fafc;
          border-radius:8px;
          color:#64748b;
          font-size:13px;
          line-height:1.6;
        ">
          A PDF copy of the contract is attached to this email.
          Please use the secure button below to review and sign
          the contract online.
        </div>

        <div style="
          text-align:center;
          margin:24px 32px 34px 32px;
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

        <div style="
          margin:0 32px 32px 32px;
          padding:16px 18px;
          border-radius:8px;
          background:#f8fafc;
          color:#64748b;
          font-size:13px;
          line-height:1.6;
        ">
          Please review the scope of works, contract value and
          terms carefully before confirming your agreement.
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
   ATTACHMENTS / FILENAMES
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

function makePdfFilename(
  contractNumber: string,
  title: string
) {
  return `${contractNumber}-${title}`
    .replace(
      /[^a-zA-Z0-9-_ ]/g,
      ""
    )
    .replace(
      /\s+/g,
      "-"
    )
    .replace(
      /-+/g,
      "-"
    )
    .replace(
      /^-|-$/g,
      ""
    );
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
    value
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

  return redirectToContract(
    id,
    "error",
    message
  );
}

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