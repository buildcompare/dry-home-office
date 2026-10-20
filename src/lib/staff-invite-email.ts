/*
 * Staff invite email, sent by the app through Resend (same sender as the
 * quote/invoice emails) instead of Supabase's default "Supabase Auth" mail.
 */

import { Resend } from "resend";
import { escapeHtml, getEmailSender } from "@/lib/email-layout";

export const STAFF_INVITE_SUBJECT = "You're invited to DryHome Office";

/** Link to /auth/set-password carrying the invite token hash (verified there with verifyOtp). */
export function staffInviteLink(
  origin: string,
  properties: { hashed_token?: string | null; action_link?: string | null } | null | undefined,
  type: "invite" | "email" = "invite"
) {
  if (properties?.hashed_token) {
    const params = new URLSearchParams({ token_hash: properties.hashed_token, type });
    return `${origin}/auth/set-password?${params.toString()}`;
  }
  return properties?.action_link || null;
}

export function buildStaffInviteHtml({ name, link, origin }: { name: string; link: string; origin: string }) {
  const first = name.trim().split(/\s+/)[0] || "there";
  return `<!DOCTYPE html>
<html lang="en-GB">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#334155;">
    <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
      <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
        <div style="background:#252525;padding:24px 32px;text-align:center;border-bottom:4px solid #f29e23;">
          <img src="${escapeHtml(origin)}/dryhome-logo.png" width="160" height="160" alt="Dry Home Damp Proofing Solutions" style="display:block;margin:-40px auto -44px auto;width:160px;height:160px;border:0;">
          <div style="margin-top:4px;color:#cbd5e1;font-size:12px;letter-spacing:0.25em;font-weight:700;">STAFF</div>
        </div>
        <div style="height:4px;background:#be1e2d;line-height:4px;font-size:0;">&nbsp;</div>

        <div style="padding:32px 32px 8px 32px;font-size:15px;line-height:1.7;color:#334155;">
          <p style="margin:0 0 14px 0;">Hi ${escapeHtml(first)},</p>
          <p style="margin:0 0 14px 0;">You've been invited to the DryHome staff portal, where you can fill in your timesheets, request holiday and see the work schedule.</p>
          <p style="margin:0;">Click the button below to choose your password. After that, sign in at any time with your email address and password.</p>
        </div>

        <div style="text-align:center;margin:28px 32px 20px 32px;">
          <a href="${escapeHtml(link)}" style="display:inline-block;background:#be1e2d;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:16px;font-weight:700;">
            Choose your password
          </a>
        </div>

        <div style="margin:0 32px 28px 32px;text-align:center;color:#64748b;font-size:12px;line-height:1.6;">
          The link can only be used once and expires after 24 hours. If it has expired, ask the office for a new invite.<br>
          If you weren't expecting this email, you can ignore it.
        </div>

        <div style="border-top:1px solid #e2e8f0;padding:22px 32px;font-size:12px;line-height:1.6;color:#94a3b8;background:#f8fafc;">
          Dry Home Damp Proofing Solutions Ltd<br>
          Fullbrook Avenue, Spencers Wood, Reading, Berkshire, RG7 1FE<br>
          0118 9740 020 · dryhomedampproofing.co.uk
        </div>
      </div>
    </div>
  </body>
</html>
`;
}

export function buildStaffInviteText({ name, link }: { name: string; link: string }) {
  const first = name.trim().split(/\s+/)[0] || "there";
  return [
    `Hi ${first},`,
    "",
    "You've been invited to the DryHome staff portal, where you can fill in your timesheets, request holiday and see the work schedule.",
    "",
    "Choose your password here (the link can only be used once and expires after 24 hours):",
    link,
    "",
    "Dry Home Damp Proofing Solutions Ltd",
    "Fullbrook Avenue, Spencers Wood, Reading, Berkshire, RG7 1FE · 0118 9740 020",
  ].join("\n");
}

export async function sendStaffInviteEmail({
  to,
  name,
  link,
  origin,
}: {
  to: string;
  name: string;
  link: string;
  origin: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "Email is not set up (RESEND_API_KEY is missing)." };
  try {
    const { from, replyTo } = getEmailSender();
    const result = await new Resend(apiKey).emails.send({
      from,
      to: [to],
      ...(replyTo ? { replyTo } : {}),
      subject: STAFF_INVITE_SUBJECT,
      html: buildStaffInviteHtml({ name, link, origin }),
      text: buildStaffInviteText({ name, link }),
    });
    if (result.error) return { ok: false, error: "The email service rejected the invite." };
    return { ok: true };
  } catch {
    return { ok: false, error: "The invite email couldn't be sent." };
  }
}
