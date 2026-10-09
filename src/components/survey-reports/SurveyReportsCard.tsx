/*
 * "Survey reports" card. mode="manage" on /surveys/[jobId] (upload,
 * view, download, send, delete); mode="readonly" on the job page.
 */

import Link from "next/link";

import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { deleteSurveyReport } from "@/app/surveys/report-actions";
import {
  SURVEY_REPORTS_NOT_SET_UP,
  defaultReportTitle,
  formatFileSize,
  type SurveyReportRow,
} from "@/lib/survey-report-shared";
import type { SurveyReportsResult } from "@/lib/survey-reports";
import ReportUploader from "./ReportUploader";
import SendReportButton from "./SendReportButton";

const smallButton =
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50";

function formatWhen(value: string | null, withTime = true) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

export type SurveyReportsCustomer = {
  clientName: string | null;
  primaryEmail: string | null;
  secondaryEmail: string | null;
  siteText: string | null;
};

export default function SurveyReportsCard({
  jobId,
  result,
  mode,
  customer,
  className = "",
}: {
  jobId: string;
  result: SurveyReportsResult;
  mode: "manage" | "readonly";
  customer?: SurveyReportsCustomer;
  className?: string;
}) {
  const reports = result.status === "ok" ? result.reports : [];
  const hasEmail = Boolean(customer?.primaryEmail || customer?.secondaryEmail);

  return (
    <section className={`rounded-2xl bg-white p-4 shadow-sm sm:p-6 ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Survey reports</h2>
          {result.status === "ok" && (
            <p className="mt-1 text-sm text-slate-500">
              {reports.length === 0
                ? "No reports yet."
                : `${reports.length} report${reports.length === 1 ? "" : "s"}`}
            </p>
          )}
        </div>
        {mode === "readonly" && (
          <Link href={`/surveys/${jobId}#survey-reports`} className="text-sm font-semibold text-slate-700 hover:text-slate-900 hover:underline">
            Manage reports →
          </Link>
        )}
      </div>

      {result.status === "not-set-up" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {SURVEY_REPORTS_NOT_SET_UP}
        </div>
      )}

      {result.status === "error" && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Reports could not be loaded. Please refresh the page.
        </div>
      )}

      {reports.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {reports.map((report) => (
            <ReportRow
              key={report.id}
              jobId={jobId}
              report={report}
              mode={mode}
              customer={customer}
              hasEmail={hasEmail}
            />
          ))}
        </ul>
      )}

      {mode === "manage" && result.status === "ok" && (
        <div className={reports.length > 0 ? "mt-4" : ""}>
          <ReportUploader jobId={jobId} />
        </div>
      )}
    </section>
  );
}

function ReportRow({
  jobId,
  report,
  mode,
  customer,
  hasEmail,
}: {
  jobId: string;
  report: SurveyReportRow;
  mode: "manage" | "readonly";
  customer?: SurveyReportsCustomer;
  hasEmail: boolean;
}) {
  const title = report.title?.trim() || defaultReportTitle(report.file_name);
  const uploaded = formatWhen(report.uploaded_at, false);
  const sent = formatWhen(report.sent_at);
  const base = `/surveys/${jobId}/reports/${report.id}`;

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{title}</p>
          <p className="mt-0.5 break-all text-xs text-slate-500">
            {report.file_name}
            {report.size_bytes ? ` · ${formatFileSize(report.size_bytes)}` : ""}
            {uploaded ? ` · Uploaded ${uploaded}` : ""}
          </p>
        </div>
        {sent ? (
          <span
            className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800"
            title={report.sent_to ?? undefined}
          >
            Sent {sent}
          </span>
        ) : (
          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            Not sent
          </span>
        )}
      </div>

      {sent && report.sent_to && (
        <p className="mt-1 break-words text-xs text-slate-500">To {report.sent_to}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a href={base} target="_blank" rel="noopener noreferrer" className={smallButton}>
          View
        </a>
        <a href={`${base}?download=1`} className={smallButton}>
          Download
        </a>

        {mode === "manage" && customer && (
          <>
            {hasEmail ? (
              <SendReportButton
                jobId={jobId}
                reportId={report.id}
                reportTitle={title}
                sizeBytes={report.size_bytes}
                alreadySent={Boolean(report.sent_at)}
                clientName={customer.clientName}
                primaryEmail={customer.primaryEmail}
                secondaryEmail={customer.secondaryEmail}
                siteText={customer.siteText}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
              />
            ) : (
              <span className="text-xs text-slate-400" title="Add an email address to the client first">
                No client email
              </span>
            )}

            <form action={deleteSurveyReport} className="ml-auto">
              <input type="hidden" name="job_id" value={jobId} />
              <input type="hidden" name="report_id" value={report.id} />
              <input type="hidden" name="back" value={`/surveys/${jobId}`} />
              <ConfirmSubmitButton
                confirmMessage={`Delete the report “${title}”? The PDF is removed for good.`}
                pendingLabel="Deleting…"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
              >
                Delete
              </ConfirmSubmitButton>
            </form>
          </>
        )}
      </div>
    </li>
  );
}
