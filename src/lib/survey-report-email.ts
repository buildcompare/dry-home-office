/*
 * Email a survey report to the customer through Resend, with the same
 * sender and branding as the other customer emails. PDFs up to 10 MB
 * are attached; bigger ones are sent as a time-limited signed link.
 */

import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";

import { formatSentTo, toResendRecipients } from "@/lib/email-recipients";
import { buildBrandedEmailHtml, getEmailSender } from "@/lib/email-layout";
import { sanitiseAttachmentFilename } from "@/lib/invoice-email";
import {
  SURVEY_REPORTS_BUCKET,
  SURVEY_REPORT_EMAIL_LINK_SECONDS,
  reportDownloadName,
  reportSendsAsLink,
  type SurveyReportRow,
} from "@/lib/survey-report-shared";
import { signedReportUrl } from "@/lib/survey-reports";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any, any, any>;

export type SurveyReportDelivery =
  | { ok: true; asLink: boolean; sentAt: string; warning?: string }
  | { ok: false; error: string };

function formatExpiry(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export async function deliverSurveyReportEmail({
  supabase,
  report,
  recipients,
  subject,
  body,
  siteText,
}: {
  supabase: AnySupabase;
  report: SurveyReportRow;
  recipients: string[];
  subject: string;
  body: string;
  siteText: string | null;
}): Promise<SurveyReportDelivery> {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    return { ok: false, error: "Email is not set up (RESEND_API_KEY is missing)." };
  }

  const fileName = sanitiseAttachmentFilename(reportDownloadName(report));
  const title = report.title?.trim() || "Damp survey report";
  const asLink = reportSendsAsLink(report.size_bytes);

  let attachments: { filename: string; content: string }[] = [];
  let link: string | null = null;
  let expiryText = "";

  if (asLink) {
    link = await signedReportUrl(supabase, report, SURVEY_REPORT_EMAIL_LINK_SECONDS, fileName);

    if (!link) {
      return { ok: false, error: "A download link for the report could not be created." };
    }

    expiryText = `This secure link works until ${formatExpiry(
      new Date(Date.now() + SURVEY_REPORT_EMAIL_LINK_SECONDS * 1000)
    )}.`;
  } else {
    const { data, error } = await supabase.storage
      .from(SURVEY_REPORTS_BUCKET)
      .download(report.file_path);

    if (error || !data) {
      console.error("Survey report download error:", error);
      return { ok: false, error: "The report file could not be read from storage." };
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    attachments = [{ filename: fileName, content: buffer.toString("base64") }];
  }

  const html = buildBrandedEmailHtml({
    label: "Damp Survey Report",
    body,
    card: {
      eyebrow: asLink ? "Report (download link)" : "Report (attached)",
      heading: title,
      detail: siteText || undefined,
    },
    button: link ? { href: link, label: "Download report" } : undefined,
    footnote: link ? expiryText : undefined,
  });

  const text = link
    ? [body, "", "Download your report:", link, expiryText].join("\n")
    : body;

  const { from, replyTo } = getEmailSender();
  const resend = new Resend(resendApiKey);

  const result = await resend.emails.send({
    from,
    to: toResendRecipients(recipients),
    ...(replyTo ? { replyTo } : {}),
    subject,
    text,
    html,
    ...(attachments.length > 0 ? { attachments } : {}),
  });

  if (result.error) {
    console.error("Resend survey report error:", result.error);
    return { ok: false, error: "The report email could not be sent." };
  }

  const sentAt = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("survey_reports")
    .update({ sent_at: sentAt, sent_to: formatSentTo(recipients) })
    .eq("id", report.id);

  if (updateError) {
    console.error("Survey report sent update error:", updateError);
    return {
      ok: true,
      asLink,
      sentAt,
      warning: "The email was sent, but the sent date could not be saved.",
    };
  }

  return { ok: true, asLink, sentAt };
}
