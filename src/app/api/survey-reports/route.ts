/*
 * POST /api/survey-reports – upload a survey report PDF (upload only).
 *
 * Auth: a signed-in office session, OR `Authorization: Bearer <token>`
 * when SURVEY_REPORTS_UPLOAD_TOKEN is set in Vercel. Never sends or
 * deletes anything. See README "Survey report upload API".
 *
 * 1. multipart/form-data: job_id or job_number, file (PDF), title?
 *    (Vercel limits request bodies to about 4.5 MB.)
 * 2. Bigger files, JSON in two steps:
 *    { "action": "create-upload", job_id|job_number, file_name }
 *      → { path, signed_url, token }   then PUT the PDF to signed_url
 *    { "action": "complete", job_id|job_number, path, file_name, title? }
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bearerToken, configuredUploadToken, tokensMatch } from "@/lib/upload-token";
import {
  SURVEY_REPORTS_BUCKET,
  isPdfFileName,
} from "@/lib/survey-report-shared";
import {
  isReportsSetupError,
  newReportPath,
  recordUploadedReport,
  uploadReportFile,
} from "@/lib/survey-reports";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any, any, any>;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function authorise(request: Request): Promise<
  { ok: true; supabase: AnySupabase; via: "session" | "token" } | { ok: false; response: Response }
> {
  const header = request.headers.get("authorization");

  if (header) {
    const expected = configuredUploadToken();

    if (!expected) {
      return { ok: false, response: json({ error: "Token uploads are disabled." }, 403) };
    }

    const provided = bearerToken(header);

    if (!provided || !tokensMatch(provided, expected)) {
      return { ok: false, response: json({ error: "Invalid token." }, 401) };
    }

    try {
      return { ok: true, supabase: createAdminClient(), via: "token" };
    } catch (error) {
      console.error("Survey report API admin client error:", error);
      return { ok: false, response: json({ error: "Server storage is not configured." }, 500) };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, response: json({ error: "Not signed in." }, 401) };
  }

  return { ok: true, supabase, via: "session" };
}

async function findJob(supabase: AnySupabase, jobId: string, jobNumber: string) {
  if (!jobId && !jobNumber) return { error: "Send job_id or job_number.", status: 400 } as const;

  let query = supabase.from("jobs").select("id, job_number, client_id");

  if (jobId) {
    if (!/^[0-9a-f-]{36}$/i.test(jobId)) return { error: "job_id is not valid.", status: 400 } as const;
    query = query.eq("id", jobId);
  } else {
    query = query.eq("job_number", jobNumber);
  }

  const { data, error } = await query.limit(2);

  if (error) {
    console.error("Survey report API job lookup error:", error);
    return { error: "The job could not be looked up.", status: 500 } as const;
  }

  if (!data || data.length === 0) return { error: "Job not found.", status: 404 } as const;
  if (data.length > 1) return { error: "More than one job has that number. Use job_id.", status: 409 } as const;

  const job = data[0] as { id: string; job_number: string | null; client_id: string | null };
  return { job } as const;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const auth = await authorise(request);
  if (!auth.ok) return auth.response;

  const { supabase } = auth;
  const contentType = request.headers.get("content-type") ?? "";

  /* ---------- JSON: signed upload for big files ---------- */

  if (contentType.includes("application/json")) {
    let body: Record<string, unknown>;

    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "Invalid JSON." }, 400);
    }

    const found = await findJob(supabase, text(body.job_id), text(body.job_number));
    if ("error" in found) return json({ error: found.error }, found.status);

    const fileName = text(body.file_name) || "report.pdf";

    if (!isPdfFileName(fileName)) {
      return json({ error: "file_name must end in .pdf." }, 415);
    }

    if (body.action === "create-upload") {
      const path = newReportPath(found.job.id, fileName);
      const { data, error } = await supabase.storage
        .from(SURVEY_REPORTS_BUCKET)
        .createSignedUploadUrl(path);

      if (error || !data) {
        if (isReportsSetupError(error)) return json({ error: "Reports storage not set up yet." }, 503);
        console.error("Survey report signed upload error:", error);
        return json({ error: "An upload link could not be created." }, 500);
      }

      return json({
        path: data.path,
        signed_url: data.signedUrl,
        token: data.token,
        next: "PUT the PDF to signed_url with Content-Type: application/pdf, then POST action=complete.",
      });
    }

    if (body.action === "complete") {
      const saved = await recordUploadedReport(supabase, {
        jobId: found.job.id,
        clientId: found.job.client_id,
        path: text(body.path),
        fileName,
        title: text(body.title) || null,
      });

      if (!saved.ok) return json({ error: saved.error }, saved.status);
      return json({ report: saved.report, job_number: found.job.job_number }, 201);
    }

    return json({ error: 'action must be "create-upload" or "complete".' }, 400);
  }

  /* ---------- multipart: file in the request ---------- */

  if (!contentType.includes("multipart/form-data")) {
    return json({ error: "Send multipart/form-data or application/json." }, 415);
  }

  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return json({ error: "The upload could not be read (Vercel allows about 4.5 MB; use the JSON signed upload for bigger files)." }, 413);
  }

  const found = await findJob(supabase, text(form.get("job_id")), text(form.get("job_number")));
  if ("error" in found) return json({ error: found.error }, found.status);

  const file = form.get("file");

  if (!(file instanceof File)) {
    return json({ error: "Attach the PDF as the 'file' field." }, 400);
  }

  const fileName = file.name || "report.pdf";
  const bytes = new Uint8Array(await file.arrayBuffer());

  const saved = await uploadReportFile(supabase, {
    jobId: found.job.id,
    clientId: found.job.client_id,
    fileName: isPdfFileName(fileName) ? fileName : `${fileName}.pdf`,
    bytes,
    title: text(form.get("title")) || null,
  });

  if (!saved.ok) return json({ error: saved.error }, saved.status);
  return json({ report: saved.report, job_number: found.job.job_number }, 201);
}
