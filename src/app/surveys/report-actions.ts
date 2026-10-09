"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  buildRecipientList,
  describeRecipients,
  isValidEmailAddress,
} from "@/lib/email-recipients";
import { loadSurveyRecord } from "@/lib/survey-records";
import { safeSurveysPath, withQueryParam } from "@/lib/survey";
import {
  SURVEY_REPORTS_BUCKET,
  SURVEY_REPORTS_NOT_SET_UP,
} from "@/lib/survey-report-shared";
import {
  isReportsSetupError,
  loadSurveyReport,
  recordUploadedReport,
} from "@/lib/survey-reports";
import { deliverSurveyReportEmail } from "@/lib/survey-report-email";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function signedIn(supabase: SupabaseServerClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return Boolean(user);
}

function refresh(jobId: string) {
  revalidatePath(`/surveys/${jobId}`);
  revalidatePath(`/jobs/${jobId}`);
}

/* =========================================================
   RECORD AN UPLOAD
   The browser uploads the PDF straight to Storage (so big files do not
   pass through the server), then calls this to save the row.
   ========================================================= */

export async function recordSurveyReportUpload(input: {
  jobId: string;
  path: string;
  fileName: string;
  title: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();

  if (!(await signedIn(supabase))) {
    return { ok: false, error: "Please sign in again." };
  }

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, client_id")
    .eq("id", input.jobId)
    .maybeSingle();

  if (jobError || !job) {
    return { ok: false, error: "This survey could not be found." };
  }

  const saved = await recordUploadedReport(supabase, {
    jobId: String(job.id),
    clientId: job.client_id ? String(job.client_id) : null,
    path: input.path,
    fileName: input.fileName,
    title: input.title,
  });

  if (!saved.ok) {
    return { ok: false, error: saved.notSetUp ? SURVEY_REPORTS_NOT_SET_UP : saved.error };
  }

  refresh(String(job.id));
  return { ok: true };
}

/* =========================================================
   DELETE
   ========================================================= */

export async function deleteSurveyReport(formData: FormData) {
  const supabase = await createClient();

  if (!(await signedIn(supabase))) {
    redirect("/login");
  }

  const jobId = String(formData.get("job_id") ?? "");
  const reportId = String(formData.get("report_id") ?? "");
  const back = safeSurveysPath(String(formData.get("back") ?? ""), `/surveys/${jobId}`);

  const report = await loadSurveyReport(supabase, jobId, reportId);

  if (report === "not-set-up") {
    redirect(withQueryParam(back, "error", SURVEY_REPORTS_NOT_SET_UP));
  }

  if (!report) {
    redirect(withQueryParam(back, "error", "That report could not be found."));
  }

  const { error: deleteError } = await supabase
    .from("survey_reports")
    .delete()
    .eq("id", report.id);

  if (deleteError) {
    console.error("Survey report delete error:", deleteError);
    redirect(withQueryParam(back, "error", "The report could not be deleted."));
  }

  const { error: removeError } = await supabase.storage
    .from(SURVEY_REPORTS_BUCKET)
    .remove([report.file_path]);

  if (removeError && !isReportsSetupError(removeError)) {
    // The row is gone, so the report no longer shows anywhere; the
    // stored file is only left behind in the private bucket.
    console.error("Survey report file remove error:", removeError);
  }

  refresh(jobId);
  redirect(withQueryParam(back, "notice", `Report “${report.title || report.file_name}” deleted.`));
}

/* =========================================================
   SEND TO CUSTOMER (only from the confirm dialog)
   ========================================================= */

export async function sendSurveyReport(input: {
  jobId: string;
  reportId: string;
  to: string;
  also: string;
  subject: string;
  body: string;
}): Promise<{ ok: true; message: string; warning?: string } | { ok: false; error: string }> {
  const supabase = await createClient();

  if (!(await signedIn(supabase))) {
    return { ok: false, error: "Please sign in again." };
  }

  const to = input.to.trim();
  const also = input.also.trim();
  const subject = input.subject.replace(/[\r\n]+/g, " ").trim();
  const body = input.body.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  if (!isValidEmailAddress(to)) {
    return { ok: false, error: "Please enter a valid email address to send to." };
  }

  if (also && !isValidEmailAddress(also)) {
    return { ok: false, error: "The “Also send to” address is not a valid email address." };
  }

  if (!subject) {
    return { ok: false, error: "Please enter a subject." };
  }

  if (!body) {
    return { ok: false, error: "Please enter a message." };
  }

  const report = await loadSurveyReport(supabase, input.jobId, input.reportId);

  if (report === "not-set-up") {
    return { ok: false, error: SURVEY_REPORTS_NOT_SET_UP };
  }

  if (!report) {
    return { ok: false, error: "That report could not be found." };
  }

  const record = await loadSurveyRecord(supabase, input.jobId);
  const recipients = buildRecipientList(to, also);

  const delivered = await deliverSurveyReportEmail({
    supabase,
    report,
    recipients,
    subject,
    body,
    siteText: record?.siteText || null,
  });

  if (!delivered.ok) {
    return { ok: false, error: delivered.error };
  }

  refresh(input.jobId);

  return {
    ok: true,
    message: `Report emailed to ${describeRecipients(recipients)}${
      delivered.asLink ? " as a secure download link (too large to attach)" : ""
    }.`,
    warning: delivered.warning,
  };
}
