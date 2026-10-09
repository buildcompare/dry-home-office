/*
 * Survey report helpers that are safe in client components and on the
 * server (no Supabase, no Node APIs).
 */

export const SURVEY_REPORTS_BUCKET = "survey-reports";

/** Matches the bucket's file_size_limit in supabase/survey_reports.sql. */
export const SURVEY_REPORT_MAX_BYTES = 25 * 1024 * 1024;

/** Bigger files are sent as a time-limited link instead of an attachment. */
export const SURVEY_REPORT_ATTACH_MAX_BYTES = 10 * 1024 * 1024;

/** Signed link lifetime for the customer email (14 days). */
export const SURVEY_REPORT_EMAIL_LINK_SECONDS = 14 * 24 * 60 * 60;

export const SURVEY_REPORTS_NOT_SET_UP =
  "Reports storage not set up yet. Run supabase/survey_reports.sql in the Supabase SQL Editor to turn on survey reports.";

export type SurveyReportRow = {
  id: string;
  job_id: string;
  client_id: string | null;
  file_path: string;
  file_name: string;
  title: string | null;
  size_bytes: number | null;
  uploaded_at: string;
  sent_at: string | null;
  sent_to: string | null;
};

export function isPdfFileName(name: string) {
  return /\.pdf$/i.test(name.trim());
}

export function isPdfFile(file: { name: string; type?: string | null }) {
  const type = (file.type ?? "").toLowerCase();
  return type === "application/pdf" || (type === "" && isPdfFileName(file.name)) || (type === "application/octet-stream" && isPdfFileName(file.name));
}

/** "Damp Report – 12 Oak Lane.pdf" → "Damp Report – 12 Oak Lane" */
export function defaultReportTitle(fileName: string) {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  return base.replace(/\.pdf$/i, "").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim() || "Survey report";
}

/** Storage-safe object name: letters, digits, dot, dash, underscore. */
export function safeStorageName(fileName: string) {
  const base = (fileName.split(/[\\/]/).pop() ?? "")
    .replace(/\.pdf$/i, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80)
    .replace(/^[-.]+|[-.]+$/g, "");

  return `${base || "report"}.pdf`;
}

/** Every report for a job lives under "<jobId>/". */
export function buildReportPath(jobId: string, uniqueId: string, fileName: string) {
  return `${jobId}/${uniqueId}-${safeStorageName(fileName)}`;
}

export function isReportPathForJob(path: string, jobId: string) {
  if (!jobId || !/^[A-Za-z0-9-]+$/.test(jobId)) return false;
  const prefix = `${jobId}/`;
  if (!path.startsWith(prefix)) return false;
  const rest = path.slice(prefix.length);
  return /^[A-Za-z0-9._-]+\.pdf$/i.test(rest) && !rest.includes("..");
}

/** Display name for the file the customer receives. */
export function reportDownloadName(report: { title: string | null; file_name: string }) {
  const name = (report.title?.trim() || defaultReportTitle(report.file_name)).replace(/[\r\n"\\/:*?<>|]+/g, " ").trim();
  return `${name || "Survey report"}.pdf`;
}

export function formatFileSize(bytes: number | null | undefined) {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function reportSendsAsLink(sizeBytes: number | null | undefined) {
  return (sizeBytes ?? 0) > SURVEY_REPORT_ATTACH_MAX_BYTES;
}

export function buildReportEmailDefaults({
  clientName,
  siteText,
  asLink,
}: {
  clientName: string | null;
  siteText: string | null;
  asLink: boolean;
}) {
  const site = siteText?.trim() || "";
  const greeting = clientName?.trim() ? `Hi ${clientName.trim()},` : "Hello,";

  const subject = site
    ? `Your damp survey report – ${site}`
    : "Your damp survey report";

  const where = site ? ` for ${site}` : "";

  const body = [
    greeting,
    "",
    asLink
      ? `Thank you for having us out. Your damp survey report${where} is ready. It is too large to attach, so you can download it using the secure link below.`
      : `Thank you for having us out. Please find attached your damp survey report${where}.`,
    "",
    "If you have any questions about the findings, or would like to go ahead with any of the recommended work, simply reply to this email.",
    "",
    "Kind regards,",
    "",
    "James",
    "Dry Home Damp Proofing Solutions",
  ].join("\n");

  return { subject, body };
}

/** First 5 bytes of every PDF are "%PDF-". */
export function looksLikePdf(bytes: Uint8Array) {
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}
