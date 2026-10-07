import { NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import {
  buildRecipientList,
} from "@/lib/email-recipients";
import { loadClientSecondaryEmail } from "@/lib/client-secondary-email";
import {
  buildInvoiceEmailDefaults,
  deliverInvoiceEmail,
  isValidEmail,
  loadInvoiceContext,
  sanitiseAttachmentFilename,
} from "@/lib/invoice-email";

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
    await loadInvoiceContext(
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
    invoice,
    client,
  } = context;

  const secondaryEmail =
    await loadClientSecondaryEmail(
      supabase,
      client?.id
    );

  /*
   * Primary email first, then the secondary email (if any).
   */

  const [
    recipient,
    secondaryRecipient = "",
  ] = buildRecipientList(
    client?.email,
    secondaryEmail
  );

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

  if (
    !invoice.public_token
  ) {
    return Response.json(
      {
        error:
          "This invoice does not have a secure customer link.",
      },
      {
        status: 400,
      }
    );
  }

  const {
    subject,
    body,
  } =
    buildInvoiceEmailDefaults(
      context,
      appUrl
    );

  return Response.json({
    recipient,
    secondaryRecipient,
    subject,
    body,
  });
}

/* =========================================================
   SEND
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
    await loadInvoiceContext(
      supabase,
      id
    );

  if (
    !context.success
  ) {
    return sendErrorResponse(
      wantsJson,
      id,
      context.error,
      context.status
    );
  }

  const {
    invoice,
    client,
  } = context;

  if (
    !invoice.public_token
  ) {
    return sendErrorResponse(
      wantsJson,
      id,
      "This invoice does not have a secure customer link.",
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

  const secondaryEmail =
    await loadClientSecondaryEmail(
      supabase,
      client?.id
    );

  const [
    defaultRecipient = "",
    defaultSecondaryRecipient = "",
  ] = buildRecipientList(
    client?.email,
    secondaryEmail
  );

  const recipient =
    String(
      formData?.get(
        "recipient"
      ) ??
        defaultRecipient
    ).trim();

  /*
   * The composer always sends this field (blank when removed).
   * If it is missing entirely, fall back to the client's
   * secondary email.
   */

  const secondaryRecipient =
    String(
      formData?.get(
        "secondary_recipient"
      ) ??
        defaultSecondaryRecipient
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

  if (
    secondaryRecipient &&
    !isValidEmail(
      secondaryRecipient
    )
  ) {
    return sendErrorResponse(
      wantsJson,
      id,
      "Please enter a valid secondary email address.",
      400
    );
  }

  const recipients =
    buildRecipientList(
      recipient,
      secondaryRecipient
    );

  const {
    customerUrl,
    invoiceTotal,
    amountOutstanding,
    subject: defaultSubject,
    body: defaultBody,
  } =
    buildInvoiceEmailDefaults(
      context,
      appUrl
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
     ATTACHMENTS
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
     PDF + EMAIL + MARK AS SENT
     Shared with the Book Survey flow (src/lib/invoice-email.ts).
     ========================================================= */

  const delivered =
    await deliverInvoiceEmail({
      supabase,
      id,
      invoice,
      recipients,
      subject,
      body,
      customerUrl,
      invoiceTotal,
      amountOutstanding,
      extraAttachments,
      resendApiKey,
    });

  if (
    !delivered.ok
  ) {
    return sendErrorResponse(
      wantsJson,
      id,
      delivered.error,
      delivered.status
    );
  }

  if (
    delivered.warning
  ) {
    if (
      wantsJson
    ) {
      return Response.json({
        success:
          true,

        warning:
          delivered.warning,
      });
    }

    return redirectToInvoice(
      id,
      "warning",
      delivered.warning
    );
  }

  if (
    wantsJson
  ) {
    return Response.json({
      success: true,
    });
  }

  return redirectToInvoice(
    id,
    "sent",
    "1"
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

  return redirectToInvoice(
    id,
    "error",
    message
  );
}

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
