import Link from "next/link";
import { notFound } from "next/navigation";

import Sidebar from "@/components/Sidebar";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import SurveyPaymentBadge from "@/components/SurveyPaymentBadge";
import StatusBadge from "@/components/StatusBadge";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/money";
import { describeRecipients } from "@/lib/email-recipients";
import { formatSurveyWhen, surveyFeeLock } from "@/lib/survey";
import { loadSurveyRecord } from "@/lib/survey-records";
import { cancelSurvey } from "../actions";
import {
  Banners,
  MarkPaidForm,
  ResendInvoiceForm,
  formatSentAt,
  surveyRecipients,
} from "../survey-ui";
import SurveyEditForm from "./survey-edit-form";
import AddToScheduleForm from "./add-to-schedule-form";

type SurveyPageProps = {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{
    notice?: string;
    warning?: string;
    error?: string;
  }>;
};

const outlineButton =
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50";

export default async function SurveyPage({ params, searchParams }: SurveyPageProps) {
  const { jobId } = await params;
  const query = await searchParams;

  const supabase = await createClient();
  const record = await loadSurveyRecord(supabase, jobId);

  if (!record) {
    notFound();
  }

  const invoice = record.invoice;
  const recipients = surveyRecipients(record);
  const back = `/surveys/${record.jobId}`;
  const sentAt = formatSentAt(invoice?.sentAt ?? null);

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="min-w-0 flex-1 p-4 pt-20 md:p-8">
        <div className="mx-auto max-w-6xl">
          <Link href="/surveys" className="text-sm font-medium text-slate-500 hover:text-slate-900">
            ← All surveys
          </Link>

          <div className="mb-6 mt-4">
            <div className="flex flex-wrap items-center gap-2">
              {record.jobNumber && (
                <p className="text-sm font-medium text-slate-500">{record.jobNumber}</p>
              )}
              {record.jobStatus && <StatusBadge status={record.jobStatus} />}
              {invoice && <SurveyPaymentBadge state={invoice.state} />}
              {!record.event && !record.cancelled && (
                <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                  Not on Schedule
                </span>
              )}
            </div>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              {record.jobTitle || "Damp survey"}
            </h1>
            <p className="mt-2 text-slate-500">
              {record.surveyDate
                ? formatSurveyWhen(record.surveyDate, record.startTime, record.endTime)
                : "Date not set"}
              {record.allDay && " (all day)"}
            </p>
          </div>

          <Banners notice={query.notice} warning={query.warning} error={query.error}>
            {" "}
            <Link href="/surveys" className="font-semibold underline underline-offset-2">
              View all surveys
            </Link>
          </Banners>

          {record.cancelled && (
            <div className="mb-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              This survey is cancelled.
              {invoice
                ? ` Invoice ${invoice.invoiceNumber} has not been changed${
                    invoice.state === "paid" ? " and is paid, so you may want to refund it." : ", so you may want to void it."
                  }`
                : ""}
            </div>
          )}

          {/* ACTIONS */}

          <div className="mb-6 flex flex-wrap gap-2">
            {invoice && !record.cancelled && (
              <ResendInvoiceForm record={record} back={back} className={outlineButton} />
            )}
            {invoice && (
              <>
                <a href={`/invoices/${invoice.id}/pdf`} className={outlineButton}>
                  Download invoice PDF
                </a>
                <Link href={`/invoices/${invoice.id}`} className={outlineButton}>
                  View invoice
                </Link>
              </>
            )}
            <Link href={`/jobs/${record.jobId}`} className={outlineButton}>
              View job
            </Link>
            {!record.cancelled && (
              <form action={cancelSurvey}>
                <input type="hidden" name="job_id" value={record.jobId} />
                <ConfirmSubmitButton
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"
                  pendingLabel="Cancelling…"
                  confirmMessage={`Cancel this survey? The job will be marked Cancelled and the appointment removed from the Schedule${
                    record.event?.google_event_id ? " and Google Calendar" : ""
                  }.${invoice ? ` Invoice ${invoice.invoiceNumber} will NOT be changed.` : ""}`}
                >
                  Cancel survey
                </ConfirmSubmitButton>
              </form>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* EDIT */}

            <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6 lg:col-span-2">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Survey details</h2>

              {record.cancelled ? (
                <dl className="space-y-3 text-sm">
                  <Row label="Site">{record.siteText || "—"}</Row>
                  <Row label="Fee">{invoice ? formatCurrency(invoice.total) : "—"}</Row>
                  <Row label="Notes">{record.notes || "—"}</Row>
                </dl>
              ) : (
                <SurveyEditForm
                  values={{
                    jobId: record.jobId,
                    surveyDate: record.surveyDate ?? "",
                    startTime: record.startTime ?? "",
                    endTime: record.endTime ?? "",
                    hasEvent: Boolean(record.event),
                    allDay: record.allDay,
                    addressLine1: record.site.address_line_1 ?? "",
                    addressLine2: record.site.address_line_2 ?? "",
                    town: record.site.town ?? "",
                    county: record.site.county ?? "",
                    postcode: record.site.postcode ?? "",
                    fee: invoice?.items[0]
                      ? invoice.items[0].unit_price.toFixed(2)
                      : invoice
                        ? invoice.total.toFixed(2)
                        : "",
                    feeLock: surveyFeeLock(invoice),
                    notes: record.notes ?? "",
                  }}
                />
              )}
            </section>

            <div className="space-y-6">
              {/* CLIENT */}

              <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
                <h2 className="mb-3 text-lg font-semibold text-slate-900">Client</h2>
                {record.client ? (
                  <div className="space-y-1 text-sm">
                    <Link href={`/clients/${record.client.id}`} className="font-semibold text-slate-900 hover:underline">
                      {record.client.name}
                    </Link>
                    {record.client.email && <p className="break-words text-slate-600">{record.client.email}</p>}
                    {record.client.secondaryEmail && (
                      <p className="break-words text-slate-600">{record.client.secondaryEmail}</p>
                    )}
                    {!record.client.email && !record.client.secondaryEmail && (
                      <p className="text-slate-500">No email address</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No client linked.</p>
                )}
              </section>

              {/* SCHEDULE */}

              <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
                <h2 className="mb-3 text-lg font-semibold text-slate-900">Schedule</h2>
                {record.event ? (
                  <div className="space-y-1 text-sm text-slate-600">
                    <p className="font-medium text-slate-900">
                      {formatSurveyWhen(record.event.start_date, record.event.start_time, record.event.end_time)}
                      {record.event.all_day && " (all day)"}
                    </p>
                    <p>{record.event.google_event_id ? "On Google Calendar" : "Not copied to Google Calendar"}</p>
                    <Link href={`/schedule?month=${record.event.start_date.slice(0, 7)}`} className="font-semibold text-slate-700 hover:underline">
                      Open Schedule →
                    </Link>
                  </div>
                ) : record.cancelled ? (
                  <p className="text-sm text-slate-500">Removed from the Schedule.</p>
                ) : (
                  <div>
                    <p className="mb-3 text-sm font-semibold text-[#be1e2d]">Not on Schedule</p>
                    {record.hadCancelledEvent && (
                      <p className="mb-3 text-xs text-slate-500">
                        Its appointment was cancelled (for example removed from Google Calendar).
                      </p>
                    )}
                    <AddToScheduleForm jobId={record.jobId} surveyDate={record.surveyDate ?? ""} />
                  </div>
                )}
              </section>

              {/* INVOICE */}

              <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
                <h2 className="mb-3 text-lg font-semibold text-slate-900">Invoice</h2>
                {invoice ? (
                  <div className="space-y-3 text-sm">
                    <dl className="space-y-2">
                      <Row label="Number">
                        <Link href={`/invoices/${invoice.id}`} className="font-semibold text-slate-900 hover:underline">
                          {invoice.invoiceNumber}
                        </Link>
                      </Row>
                      <Row label="Status">{invoice.status || "—"}</Row>
                      <Row label="Total">{formatCurrency(invoice.total)}</Row>
                      {invoice.outstanding > 0 && invoice.outstanding < invoice.total && (
                        <Row label="Outstanding">{formatCurrency(invoice.outstanding)}</Row>
                      )}
                      <Row label="Email">
                        {sentAt ? `Sent ${sentAt}${invoice.sentTo ? ` to ${invoice.sentTo}` : ""}` : "Not sent"}
                      </Row>
                    </dl>
                    {!sentAt && recipients.length > 0 && !record.cancelled && (
                      <p className="text-xs text-slate-500">Sending goes to {describeRecipients(recipients)}.</p>
                    )}
                    <MarkPaidForm
                      record={record}
                      back={back}
                      withMethod
                      className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                    />
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No survey invoice is linked to this job.</p>
                )}
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right text-slate-800">{children}</dd>
    </div>
  );
}
