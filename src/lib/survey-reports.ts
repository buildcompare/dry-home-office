/*
 * Survey reports: PDFs in the private "survey-reports" Storage bucket,
 * one public.survey_reports row each. See supabase/survey_reports.sql.
 *
 * Until that SQL has been run the table and bucket do not exist. Every
 * loader here reports { status: "not-set-up" } instead of throwing, so
 * the pages show "Reports storage not set up yet".
 */

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  SURVEY_REPORTS_BUCKET,
  SURVEY_REPORT_MAX_BYTES,
  buildReportPath,
  defaultReportTitle,
  isReportPathForJob,
  looksLikePdf,
  type SurveyReportRow,
} from "@/lib/survey-report-shared";

// Works with the cookie (signed-in user) client and the service-role client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any, any, any>;

type ErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
  statusCode?: string | number | null;
  status?: number | null;
} | null | undefined;

const REPORT_COLUMNS =
  "id, job_id, client_id, file_path, file_name, title, size_bytes, uploaded_at, sent_at, sent_to";

/** True when the error means the SQL has not been run yet. */
export function isReportsSetupError(error: ErrorLike) {
  if (!error) return false;

  const text = [error.message, error.details, error.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    (text.includes("survey_reports") &&
      (text.includes("does not exist") || text.includes("could not find"))) ||
    text.includes("bucket not found")
  );
}

export type SurveyReportsResult =
  | { status: "ok"; reports: SurveyReportRow[] }
  | { status: "not-set-up" }
  | { status: "error" };

export async function loadSurveyReports(
  supabase: AnySupabase,
  jobId: string
): Promise<SurveyReportsResult> {
  try {
    const { data, error } = await supabase
      .from("survey_reports")
      .select(REPORT_COLUMNS)
      .eq("job_id", jobId)
      .order("uploaded_at", { ascending: false });

    if (error) {
      if (isReportsSetupError(error)) return { status: "not-set-up" };
      console.error("Survey reports load error:", error);
      return { status: "error" };
    }

    return { status: "ok", reports: (data ?? []) as SurveyReportRow[] };
  } catch (error) {
    console.error("Survey reports load error:", error);
    return { status: "error" };
  }
}

export async function loadSurveyReport(
  supabase: AnySupabase,
  jobId: string,
  reportId: string
): Promise<SurveyReportRow | null | "not-set-up"> {
  const { data, error } = await supabase
    .from("survey_reports")
    .select(REPORT_COLUMNS)
    .eq("id", reportId)
    .eq("job_id", jobId)
    .maybeSingle();

  if (error) {
    if (isReportsSetupError(error)) return "not-set-up";
    console.error("Survey report load error:", error);
    return null;
  }

  return (data as SurveyReportRow | null) ?? null;
}

export function newReportPath(jobId: string, fileName: string) {
  return buildReportPath(jobId, randomUUID(), fileName);
}

export type SaveReportResult =
  | { ok: true; report: SurveyReportRow }
  | { ok: false; error: string; notSetUp?: boolean; status: number };

/**
 * Insert the survey_reports row for a file that is already in Storage
 * (browser upload or signed upload URL). Checks the object really is
 * there and is a PDF within the size limit. Removes the object again if
 * the row cannot be saved, so no orphan files are left behind.
 */
export async function recordUploadedReport(
  supabase: AnySupabase,
  {
    jobId,
    clientId,
    path,
    fileName,
    title,
  }: {
    jobId: string;
    clientId: string | null;
    path: string;
    fileName: string;
    title?: string | null;
  }
): Promise<SaveReportResult> {
  if (!isReportPathForJob(path, jobId)) {
    return { ok: false, error: "That file does not belong to this survey.", status: 400 };
  }

  const bucket = supabase.storage.from(SURVEY_REPORTS_BUCKET);
  const stored = await storedObjectInfo(supabase, path);

  if (!stored.ok) {
    if (stored.notSetUp) {
      return { ok: false, error: "Reports storage not set up yet.", notSetUp: true, status: 503 };
    }
    return { ok: false, error: "The uploaded file could not be found. Please upload it again.", status: 400 };
  }

  const { size, contentType } = stored;

  if (size > SURVEY_REPORT_MAX_BYTES || (contentType && contentType !== "application/pdf")) {
    await bucket.remove([path]);
    return { ok: false, error: "Only PDF files up to 25 MB can be added.", status: 400 };
  }

  return insertReportRow(supabase, { jobId, clientId, path, fileName, title, size });
}

/** Size and content type of a stored object (info, falling back to list). */
async function storedObjectInfo(
  supabase: AnySupabase,
  path: string
): Promise<{ ok: true; size: number; contentType: string } | { ok: false; notSetUp: boolean }> {
  const bucket = supabase.storage.from(SURVEY_REPORTS_BUCKET);
  const { data: info, error: infoError } = await bucket.info(path);

  if (!infoError && info) {
    return {
      ok: true,
      size: Number(info.size ?? 0),
      contentType: String(info.contentType ?? "").toLowerCase(),
    };
  }

  if (isReportsSetupError(infoError as ErrorLike)) {
    return { ok: false, notSetUp: true };
  }

  const slash = path.lastIndexOf("/");
  const folder = path.slice(0, slash);
  const name = path.slice(slash + 1);
  const { data: listed, error: listError } = await bucket.list(folder, { search: name, limit: 5 });
  const match = listed?.find((item) => item.name === name);

  if (listError || !match) {
    console.error("Survey report lookup error:", infoError, listError);
    return { ok: false, notSetUp: isReportsSetupError(listError as ErrorLike) };
  }

  const metadata = (match.metadata ?? {}) as { size?: number; mimetype?: string };
  return {
    ok: true,
    size: Number(metadata.size ?? 0),
    contentType: String(metadata.mimetype ?? "").toLowerCase(),
  };
}

/**
 * Upload bytes from the server (agent API) and insert the row.
 */
export async function uploadReportFile(
  supabase: AnySupabase,
  {
    jobId,
    clientId,
    fileName,
    bytes,
    title,
  }: {
    jobId: string;
    clientId: string | null;
    fileName: string;
    bytes: Uint8Array;
    title?: string | null;
  }
): Promise<SaveReportResult> {
  if (bytes.byteLength === 0) {
    return { ok: false, error: "The file is empty.", status: 400 };
  }

  if (bytes.byteLength > SURVEY_REPORT_MAX_BYTES) {
    return { ok: false, error: "The file is over 25 MB.", status: 413 };
  }

  if (!looksLikePdf(bytes)) {
    return { ok: false, error: "Only PDF files can be added.", status: 415 };
  }

  const path = newReportPath(jobId, fileName);

  const { error: uploadError } = await supabase.storage
    .from(SURVEY_REPORTS_BUCKET)
    .upload(path, bytes, { contentType: "application/pdf", upsert: false });

  if (uploadError) {
    if (isReportsSetupError(uploadError as ErrorLike)) {
      return { ok: false, error: "Reports storage not set up yet.", notSetUp: true, status: 503 };
    }
    console.error("Survey report upload error:", uploadError);
    return { ok: false, error: "The file could not be uploaded.", status: 500 };
  }

  return insertReportRow(supabase, {
    jobId,
    clientId,
    path,
    fileName,
    title,
    size: bytes.byteLength,
  });
}

async function insertReportRow(
  supabase: AnySupabase,
  {
    jobId,
    clientId,
    path,
    fileName,
    title,
    size,
  }: {
    jobId: string;
    clientId: string | null;
    path: string;
    fileName: string;
    title?: string | null;
    size: number;
  }
): Promise<SaveReportResult> {
  const cleanName = (fileName.split(/[\\/]/).pop() ?? fileName).replace(/[\r\n]/g, "").trim().slice(0, 200) || "report.pdf";
  const cleanTitle = (title ?? "").replace(/\s+/g, " ").trim().slice(0, 200) || defaultReportTitle(cleanName);

  const { data, error } = await supabase
    .from("survey_reports")
    .insert({
      job_id: jobId,
      client_id: clientId,
      file_path: path,
      file_name: cleanName,
      title: cleanTitle,
      size_bytes: size,
    })
    .select(REPORT_COLUMNS)
    .single();

  if (error || !data) {
    console.error("Survey report insert error:", error);
    await supabase.storage.from(SURVEY_REPORTS_BUCKET).remove([path]);

    if (isReportsSetupError(error)) {
      return { ok: false, error: "Reports storage not set up yet.", notSetUp: true, status: 503 };
    }

    return { ok: false, error: "The report could not be saved.", status: 500 };
  }

  return { ok: true, report: data as SurveyReportRow };
}

export async function signedReportUrl(
  supabase: AnySupabase,
  report: Pick<SurveyReportRow, "file_path">,
  expiresInSeconds: number,
  downloadName?: string
) {
  const { data, error } = await supabase.storage
    .from(SURVEY_REPORTS_BUCKET)
    .createSignedUrl(
      report.file_path,
      expiresInSeconds,
      downloadName ? { download: downloadName } : undefined
    );

  if (error || !data?.signedUrl) {
    console.error("Survey report signed URL error:", error);
    return null;
  }

  return data.signedUrl;
}
