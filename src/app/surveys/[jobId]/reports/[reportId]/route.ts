/*
 * View or download a survey report: makes a short-lived signed URL for
 * the private file and redirects to it. ?download=1 downloads it.
 */

import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { reportDownloadName } from "@/lib/survey-report-shared";
import { loadSurveyReport, signedReportUrl } from "@/lib/survey-reports";

const VIEW_LINK_SECONDS = 5 * 60;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string; reportId: string }> }
) {
  const { jobId, reportId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const report = await loadSurveyReport(supabase, jobId, reportId);

  if (report === "not-set-up" || !report) {
    return new NextResponse(
      report === "not-set-up" ? "Reports storage not set up yet." : "Report not found.",
      { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } }
    );
  }

  const download = request.nextUrl.searchParams.get("download") === "1";
  const url = await signedReportUrl(
    supabase,
    report,
    VIEW_LINK_SECONDS,
    download ? reportDownloadName(report) : undefined
  );

  if (!url) {
    return new NextResponse("The report file could not be opened.", {
      status: 502,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const response = NextResponse.redirect(url, 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
