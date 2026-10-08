import Link from "next/link";

import Sidebar from "@/components/Sidebar";
import SurveyPaymentBadge from "@/components/SurveyPaymentBadge";
import { createClient } from "@/lib/supabase/server";
import { getLondonDateKey } from "@/lib/dates";
import { formatCurrency } from "@/lib/money";
import { formatSurveyWhen } from "@/lib/survey";
import { loadSurveyRecords, type SurveyRecord } from "@/lib/survey-records";
import {
  Banners,
  MarkPaidForm,
  ResendInvoiceForm,
  formatSentAt,
} from "./survey-ui";

type SurveysPageProps = {
  searchParams: Promise<{
    view?: string;
    notice?: string;
    warning?: string;
    error?: string;
  }>;
};

export default async function SurveysPage({ searchParams }: SurveysPageProps) {
  const params = await searchParams;
  const view = params.view === "past" ? "past" : "upcoming";
  const back = `/surveys?view=${view}`;

  const supabase = await createClient();
  const { records, error } = await loadSurveyRecords(supabase);
  const today = getLondonDateKey(new Date());

  const upcoming = records
    .filter(
      (record) =>
        !record.cancelled &&
        (!record.surveyDate || record.surveyDate >= today)
    )
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

  const past = records
    .filter(
      (record) =>
        record.cancelled ||
        (record.surveyDate !== null && record.surveyDate < today)
    )
    .sort((a, b) => sortKey(b).localeCompare(sortKey(a)));

  const shown = view === "past" ? past : upcoming;

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="min-w-0 flex-1 p-4 pt-20 md:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4 md:mb-8">
            <div>
              <p className="text-sm font-medium text-slate-500">DryHome Office</p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900">Surveys</h1>
              <p className="mt-2 text-slate-500">
                Every damp survey with its appointment, invoice and payment.
              </p>
            </div>

            <Link
              href="/surveys/new"
              className="rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-700"
            >
              Book Survey
            </Link>
          </div>

          <Banners notice={params.notice} warning={params.warning} error={params.error} />

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              Surveys could not be loaded. Please refresh the page.
            </div>
          )}

          <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-4 py-4 md:px-6 md:py-5">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {view === "past" ? "Past & cancelled surveys" : "Upcoming surveys"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {view === "past" ? "Most recent first." : "Soonest first."}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Tab href="/surveys?view=upcoming" active={view === "upcoming"} label={`Upcoming (${upcoming.length})`} />
                <Tab href="/surveys?view=past" active={view === "past"} label={`Past (${past.length})`} />
              </div>
            </div>

            {shown.length === 0 ? (
              <div className="p-10 text-center">
                <p className="font-medium text-slate-700">
                  {view === "past" ? "No past surveys yet." : "No upcoming surveys."}
                </p>
                <Link
                  href="/surveys/new"
                  className="mt-4 inline-flex rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700"
                >
                  Book Survey
                </Link>
              </div>
            ) : (
              <>
                {/* Phones: cards */}
                <ul className="divide-y divide-slate-100 md:hidden">
                  {shown.map((record) => (
                    <li key={record.jobId} className="space-y-3 px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <When record={record} />
                          <p className="mt-1 font-medium text-slate-700">
                            {record.client?.name ?? "Unknown client"}
                          </p>
                          <p className="text-sm text-slate-500">{record.siteText || "No address"}</p>
                        </div>
                        <p className="shrink-0 font-semibold text-slate-900">
                          {record.invoice ? formatCurrency(record.invoice.total) : "—"}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Status record={record} />
                        <span className="text-slate-500">
                          {record.invoice ? record.invoice.invoiceNumber : "No invoice"} · <EmailStatus record={record} />
                        </span>
                      </div>

                      <Actions record={record} back={back} />
                    </li>
                  ))}
                </ul>

                {/* Desktop: table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <Heading>Survey</Heading>
                        <Heading>Client</Heading>
                        <Heading>Site</Heading>
                        <Heading right>Fee</Heading>
                        <Heading>Invoice</Heading>
                        <Heading>Payment</Heading>
                        <Heading>Email</Heading>
                        <Heading right>Actions</Heading>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {shown.map((record) => (
                        <tr key={record.jobId} className="align-top hover:bg-slate-50">
                          <Cell>
                            <When record={record} />
                            {record.jobNumber && (
                              <p className="mt-1 text-xs text-slate-400">{record.jobNumber}</p>
                            )}
                          </Cell>
                          <Cell>
                            {record.client ? (
                              <Link href={`/clients/${record.client.id}`} className="font-medium text-slate-800 hover:underline">
                                {record.client.name}
                              </Link>
                            ) : (
                              "Unknown client"
                            )}
                          </Cell>
                          <Cell>{record.siteText || "—"}</Cell>
                          <Cell right>
                            <span className="font-semibold text-slate-900">
                              {record.invoice ? formatCurrency(record.invoice.total) : "—"}
                            </span>
                          </Cell>
                          <Cell>
                            {record.invoice ? (
                              <Link href={`/invoices/${record.invoice.id}`} className="whitespace-nowrap font-medium text-slate-800 hover:underline">
                                {record.invoice.invoiceNumber}
                              </Link>
                            ) : (
                              <span className="text-slate-400">No invoice</span>
                            )}
                          </Cell>
                          <Cell>
                            <Status record={record} />
                          </Cell>
                          <Cell>
                            <EmailStatus record={record} />
                          </Cell>
                          <Cell right>
                            <Actions record={record} back={back} />
                          </Cell>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function sortKey(record: SurveyRecord) {
  return `${record.surveyDate ?? "9999-12-31"} ${record.startTime ?? "99:99"}`;
}

function When({ record }: { record: SurveyRecord }) {
  return (
    <div>
      <p className="font-semibold text-slate-900">
        {record.surveyDate
          ? formatSurveyWhen(record.surveyDate, record.startTime, record.endTime)
          : "Date not set"}
        {record.allDay && " (all day)"}
      </p>
      {!record.event && !record.cancelled && (
        <p className="mt-1 text-xs font-semibold text-[#be1e2d]">Not on Schedule</p>
      )}
    </div>
  );
}

function Status({ record }: { record: SurveyRecord }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {record.cancelled && (
        <span className="inline-flex rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
          Cancelled
        </span>
      )}
      {record.invoice ? (
        <SurveyPaymentBadge state={record.invoice.state} short />
      ) : (
        <span className="text-xs text-slate-400">—</span>
      )}
    </div>
  );
}

function EmailStatus({ record }: { record: SurveyRecord }) {
  const sent = formatSentAt(record.invoice?.sentAt ?? null);

  if (!record.invoice) return <span className="text-slate-400">—</span>;

  return sent ? (
    <span className="text-slate-600" title={record.invoice.sentTo ?? undefined}>
      Sent {sent}
    </span>
  ) : (
    <span className="font-medium text-slate-500">Not sent</span>
  );
}

function Actions({ record, back }: { record: SurveyRecord; back: string }) {
  const button =
    "whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50";

  return (
    <div className="flex flex-wrap gap-2 md:justify-end xl:flex-nowrap">
      <Link
        href={`/surveys/${record.jobId}`}
        className="whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
      >
        Open
      </Link>
      {!record.cancelled && <ResendInvoiceForm record={record} back={back} className={button} />}
      <MarkPaidForm record={record} back={back} className={button} />
    </div>
  );
}

function Tab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-4 py-2 text-sm font-semibold ${
        active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      }`}
    >
      {label}
    </Link>
  );
}

function Heading({ children, right = false }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`px-4 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500 ${
        right ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Cell({ children, right = false }: { children: React.ReactNode; right?: boolean }) {
  return (
    <td className={`px-4 py-4 text-sm text-slate-600 ${right ? "text-right" : ""}`}>
      {children}
    </td>
  );
}
