/*
 * Shared customer email pieces: HTML escaping, message paragraphs,
 * the Dry Home branded wrapper and the Resend sender settings.
 * Used by the invoice email and the survey report email.
 */

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/** Plain text message → paragraphs, keeping single line breaks. */
export function renderMessageHtml(value: string) {
  return escapeHtml(value)
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map(
      (paragraph) => `
        <p style="
          margin:0 0 18px 0;
          line-height:1.7;
        ">
          ${paragraph.replace(/\n/g, "<br>")}
        </p>
      `
    )
    .join("");
}

/** From and Reply-To, exactly as every customer email uses them. */
export function getEmailSender() {
  return {
    from:
      process.env.RESEND_FROM_EMAIL?.trim() ||
      "Dry Home Damp Proofing Solutions <quotes@admin.dryhomedampproofing.co.uk>",
    replyTo: process.env.DRYHOME_REPLY_TO_EMAIL?.trim() || undefined,
  };
}

/**
 * Branded wrapper used by the customer emails: dark header with the
 * company name, the message, an optional summary card, an optional
 * button and the footer.
 */
export function buildBrandedEmailHtml({
  label,
  body,
  card,
  button,
  footnote,
}: {
  label: string;
  body: string;
  card?: { eyebrow: string; heading: string; detail?: string };
  button?: { href: string; label: string };
  footnote?: string;
}) {
  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#334155;">
    <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
      <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
        <div style="background:#0f172a;padding:28px 32px;">
          <div style="color:#ffffff;font-size:22px;font-weight:700;">
            Dry Home Damp Proofing Solutions
          </div>
          <div style="margin-top:6px;color:#cbd5e1;font-size:13px;">
            ${escapeHtml(label)}
          </div>
        </div>

        <div style="padding:32px 32px 10px 32px;font-size:15px;line-height:1.7;color:#334155;">
          ${renderMessageHtml(body)}
        </div>
${
  card
    ? `
        <div style="margin:10px 32px 28px 32px;padding:20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#94a3b8;">
            ${escapeHtml(card.eyebrow)}
          </div>
          <div style="margin-top:5px;color:#0f172a;font-size:18px;font-weight:700;">
            ${escapeHtml(card.heading)}
          </div>${
            card.detail
              ? `
          <div style="margin-top:7px;color:#475569;font-size:14px;">
            ${escapeHtml(card.detail)}
          </div>`
              : ""
          }
        </div>`
    : ""
}${
  button
    ? `
        <div style="text-align:center;margin:28px 32px 20px 32px;">
          <a href="${escapeHtml(button.href)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:16px;font-weight:700;">
            ${escapeHtml(button.label)}
          </a>
        </div>`
    : ""
}${
  footnote
    ? `
        <div style="margin:0 32px 28px 32px;text-align:center;color:#64748b;font-size:12px;">
          ${escapeHtml(footnote)}
        </div>`
    : ""
}
        <div style="border-top:1px solid #e2e8f0;padding:22px 32px;font-size:12px;line-height:1.6;color:#94a3b8;background:#f8fafc;">
          Dry Home Damp Proofing Solutions LTD<br>
          dryhomedampproofing.co.uk
        </div>
      </div>
    </div>
  </body>
</html>
`;
}
