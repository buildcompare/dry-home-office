import Link from "next/link";

import Sidebar from "@/components/Sidebar";
import StatusBadge from "@/components/StatusBadge";
import { createClient } from "@/lib/supabase/server";
import { loadUnpaidSurveys } from "@/lib/survey-payments";
import { formatSurveyWhen, isSurveyDueSoon } from "@/lib/survey";
import {
  money,
  formatCurrency,
  invoiceRowTotal,
} from "@/lib/money";
import {
  getLondonDateKey,
  addDays,
  getMonthRange,
  formatLongDate,
  formatShortDate,
  formatMonthLabel,
  formatEventTime,
  dateDifferenceInDays,
} from "@/lib/dates";

export default async function DashboardPage() {
  const supabase = await createClient();

  /* =========================================================
     DATE RANGE
     ========================================================= */

  const today =
    getLondonDateKey(
      new Date()
    );

  const tomorrow =
    addDays(
      today,
      1
    );

  const {
    monthStart,
    nextMonthStart,
  } = getMonthRange(
    today
  );

  /* =========================================================
     DASHBOARD DATA
     ========================================================= */

  const [
    scheduleResult,
    activeJobsResult,
    invoicesResult,
    quotesResult,
    overdueInvoicesResult,
  ] = await Promise.all([
    /*
     * TODAY + TOMORROW
     */

    supabase
      .from("schedule_events")
      .select(`
        id,
        job_id,
        title,
        event_type,
        status,
        start_date,
        end_date,
        start_time,
        end_time,
        all_day,
        location,
        assigned_to,

        jobs (
          id,
          job_number,
          title,
          town,
          postcode,

          clients (
            display_name,
            first_name,
            last_name
          )
        )
      `)
      .in(
        "start_date",
        [
          today,
          tomorrow,
        ]
      )
      .neq(
        "status",
        "Cancelled"
      )
      .order(
        "start_date",
        {
          ascending: true,
        }
      )
      .order(
        "start_time",
        {
          ascending: true,
        }
      ),

    /*
     * ACTIVE JOBS
     *
     * Active now means:
     * status = In Progress
     */

    supabase
      .from("jobs")
      .select(
        `
          id,
          job_number,
          title,
          job_type,
          status,
          town,
          postcode,
          start_date,
          survey_date,
          estimated_value,
          created_at,

          clients (
            display_name,
            first_name,
            last_name
          )
        `,
        {
          count: "exact",
        }
      )
      .eq(
        "status",
        "In Progress"
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .limit(10),

    /*
     * INVOICED THIS MONTH
     */

    supabase
      .from("invoices")
      .select(`
        id,
        status,
        amount,
        subtotal,
        vat_amount,
        invoice_date
      `)
      .gte(
        "invoice_date",
        monthStart
      )
      .lt(
        "invoice_date",
        nextMonthStart
      )
      .neq(
        "status",
        "Cancelled"
      ),

    /*
     * QUOTED THIS MONTH
     */

    supabase
      .from("quotes")
      .select(`
        id,
        status,
        amount,
        quote_date
      `)
      .gte(
        "quote_date",
        monthStart
      )
      .lt(
        "quote_date",
        nextMonthStart
      )
      .neq(
        "status",
        "Draft"
      )
      .neq(
        "status",
        "Cancelled"
      ),

    /*
     * POSSIBLE OVERDUE INVOICES
     */

    supabase
      .from("invoices")
      .select(`
        id,
        invoice_number,
        invoice_type,
        title,
        status,
        amount,
        subtotal,
        vat_amount,
        amount_paid,
        invoice_date,
        due_date,
        client_id,

        clients (
          id,
          display_name,
          first_name,
          last_name
        )
      `)
      .lt(
        "due_date",
        today
      )
      .neq(
        "status",
        "Cancelled"
      )
      .order(
        "due_date",
        {
          ascending: true,
        }
      ),
  ]);

  /*
   * UNPAID SURVEYS (panel at the bottom, only when there are any)
   */

  const unpaidSurveys =
    await loadUnpaidSurveys(
      supabase
    );

  /* =========================================================
     NORMALISE DATA
     ========================================================= */

  const scheduleEvents =
    scheduleResult.data ?? [];

  const todayEvents =
    scheduleEvents.filter(
      (event) =>
        event.start_date ===
        today
    );

  const tomorrowEvents =
    scheduleEvents.filter(
      (event) =>
        event.start_date ===
        tomorrow
    );

  const activeJobs =
    activeJobsResult.data ?? [];

  const activeJobCount =
    activeJobsResult.count ??
    activeJobs.length;

  const monthlyInvoices =
    invoicesResult.data ?? [];

  const monthlyQuotes =
    quotesResult.data ?? [];

  /* =========================================================
     MONTHLY VALUES
     ========================================================= */

  const invoicedThisMonth =
    money(
      monthlyInvoices.reduce(
        (
          total,
          invoice
        ) =>
          total +
          invoiceRowTotal(
            invoice
          ),
        0
      )
    );

  const quotedThisMonth =
    money(
      monthlyQuotes.reduce(
        (
          total,
          quote
        ) =>
          total +
          Number(
            quote.amount ?? 0
          ),
        0
      )
    );

  const monthLabel =
    formatMonthLabel(
      monthStart
    );

  /* =========================================================
     OVERDUE INVOICES
     ========================================================= */

  const overdueInvoices =
    (
      overdueInvoicesResult.data ??
      []
    )
      .map(
        (invoice) => {
          const invoiceTotal =
            invoiceRowTotal(
              invoice
            );

          const amountPaid =
            Number(
              invoice.amount_paid ??
                0
            );

          const outstanding =
            money(
              Math.max(
                invoiceTotal -
                  amountPaid,
                0
              )
            );

          return {
            ...invoice,
            invoiceTotal,
            amountPaid,
            outstanding,
          };
        }
      )
      .filter(
        (invoice) =>
          invoice.outstanding >
          0.009
      );

  const overdueTotal =
    money(
      overdueInvoices.reduce(
        (
          total,
          invoice
        ) =>
          total +
          invoice.outstanding,
        0
      )
    );

  /* =========================================================
     SCHEDULE PANEL
     ========================================================= */

  const renderSchedulePanel = (
    title: string,
    subtitle: string,
    events: typeof scheduleEvents,
    emptyText: string
  ) => (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            {title}
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {subtitle}
          </p>
        </div>

        <Link
          href="/schedule"
          className="text-sm font-semibold text-slate-700 hover:underline"
        >
          View schedule →
        </Link>
      </div>

      {events.length ===
      0 ? (
        <div className="p-10 text-center">
          <p className="font-medium text-slate-700">
            {emptyText}
          </p>

          <p className="mt-2 text-sm text-slate-400">
            Nothing currently booked.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {events.map(
            (event) => {
              const job =
                Array.isArray(
                  event.jobs
                )
                  ? event.jobs[0]
                  : event.jobs;

              const clientData =
                Array.isArray(
                  job?.clients
                )
                  ? job.clients[0]
                  : job?.clients;

              const clientName =
                clientData?.display_name ||
                [
                  clientData?.first_name,
                  clientData?.last_name,
                ]
                  .filter(Boolean)
                  .join(" ") ||
                null;

              const location =
                event.location ||
                [
                  job?.town,
                  job?.postcode,
                ]
                  .filter(Boolean)
                  .join(", ") ||
                "No location";

              const content = (
                <div className="flex flex-wrap items-center justify-between gap-5 px-6 py-5 transition hover:bg-slate-50">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">
                        {event.title ||
                          job?.title ||
                          "Appointment"}
                      </p>

                      <StatusBadge
                        status={
                          event.event_type ||
                          "Appointment"
                        }
                      />

                      {event.status && (
                        <StatusBadge
                          status={
                            event.status
                          }
                        />
                      )}
                    </div>

                    {job?.job_number && (
                      <p className="mt-2 text-sm font-medium text-slate-600">
                        {
                          job.job_number
                        }

                        {clientName
                          ? ` · ${clientName}`
                          : ""}
                      </p>
                    )}

                    {!job?.job_number &&
                      clientName && (
                        <p className="mt-2 text-sm font-medium text-slate-600">
                          {clientName}
                        </p>
                      )}

                    <p className="mt-1 text-sm text-slate-400">
                      {location}
                    </p>

                    {event.assigned_to && (
                      <p className="mt-1 text-xs text-slate-400">
                        Assigned to{" "}
                        {
                          event.assigned_to
                        }
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="text-xl font-bold text-slate-900">
                      {event.all_day
                        ? "All day"
                        : formatEventTime(
                            event.start_time,
                            event.end_time
                          )}
                    </p>

                    <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                      {formatShortDate(
                        event.start_date
                      )}
                    </p>
                  </div>
                </div>
              );

              if (job?.id) {
                return (
                  <Link
                    key={
                      event.id
                    }
                    href={`/jobs/${job.id}`}
                  >
                    {content}
                  </Link>
                );
              }

              return (
                <div
                  key={
                    event.id
                  }
                >
                  {content}
                </div>
              );
            }
          )}
        </div>
      )}
    </section>
  );

  return (
    <div className="flex min-h-screen bg-[#f4f6f8]">
      <Sidebar />

      <main className="min-w-0 flex-1 overflow-x-auto p-4 pt-20 md:overflow-visible md:p-8">
        <div className="mx-auto max-w-7xl">

          {/* =================================================
              HEADER
              ================================================= */}

          <div className="mb-8">
            <p className="text-sm font-medium text-slate-500">
              Dry Home Damp Proofing Solutions
            </p>

            <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">
                  Dashboard
                </h1>

                <p className="mt-2 text-slate-500">
                  {formatLongDate(
                    today
                  )}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href="/surveys/new"
                  className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Book Survey
                </Link>

                <Link
                  href="/jobs/new"
                  className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  + New Job
                </Link>

                <Link
                  href="/schedule"
                  className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700"
                >
                  Open Schedule
                </Link>
              </div>
            </div>
          </div>

          {/* =================================================
              TOP CARDS
              ================================================= */}

          <div className="grid w-full min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <DashboardCard
              title="Invoiced This Month"
              value={formatCurrency(
                invoicedThisMonth
              )}
              description={
                monthLabel
              }
              href="/invoices"
            />

            <DashboardCard
              title="Quoted This Month"
              value={formatCurrency(
                quotedThisMonth
              )}
              description={
                monthLabel
              }
              href="/quotes"
            />

            <DashboardCard
              title="Active Jobs"
              value={String(
                activeJobCount
              )}
              description="Currently in progress"
              href="/jobs?view=active"
            />

            <DashboardCard
              title="Today"
              value={String(
                todayEvents.length
              )}
              description={
                todayEvents.length ===
                1
                  ? "appointment"
                  : "appointments"
              }
              href="/schedule"
            />

            <DashboardCard
              title="Overdue Invoices"
              value={formatCurrency(
                overdueTotal
              )}
              description={`${overdueInvoices.length} ${
                overdueInvoices.length ===
                1
                  ? "invoice"
                  : "invoices"
              } overdue`}
              href="/invoices"
              danger={
                overdueInvoices.length >
                0
              }
            />
          </div>

          {/* =================================================
              TODAY / TOMORROW
              ================================================= */}

          <div className="mt-10 grid gap-6 xl:grid-cols-2">
            {renderSchedulePanel(
              "What's on Today?",
              formatLongDate(
                today
              ),
              todayEvents,
              "Nothing booked today"
            )}

            {renderSchedulePanel(
              "Tomorrow at a Glance",
              formatLongDate(
                tomorrow
              ),
              tomorrowEvents,
              "Nothing booked tomorrow"
            )}
          </div>

          {/* =================================================
              OVERDUE INVOICES
              ================================================= */}

          <section className="mt-10 overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Overdue Invoices
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Invoices past their due date with an outstanding balance.
                </p>
              </div>

              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Outstanding
                </p>

                <p
                  className={`mt-1 text-xl font-bold ${
                    overdueTotal >
                    0
                      ? "text-red-700"
                      : "text-emerald-700"
                  }`}
                >
                  {formatCurrency(
                    overdueTotal
                  )}
                </p>
              </div>
            </div>

            {overdueInvoices.length ===
            0 ? (
              <div className="p-10 text-center">
                <p className="font-semibold text-emerald-700">
                  No overdue invoices
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  Everything currently due has been paid.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <Heading>
                        Invoice
                      </Heading>

                      <Heading>
                        Client
                      </Heading>

                      <Heading>
                        Due Date
                      </Heading>

                      <Heading>
                        Overdue
                      </Heading>

                      <Heading right>
                        Invoice Total
                      </Heading>

                      <Heading right>
                        Outstanding
                      </Heading>

                      <Heading right>
                        Action
                      </Heading>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {overdueInvoices.map(
                      (invoice) => {
                        const clientData =
                          Array.isArray(
                            invoice.clients
                          )
                            ? invoice.clients[0]
                            : invoice.clients;

                        const clientName =
                          clientData?.display_name ||
                          [
                            clientData?.first_name,
                            clientData?.last_name,
                          ]
                            .filter(Boolean)
                            .join(" ") ||
                          "Unknown client";

                        const daysOverdue =
                          invoice.due_date
                            ? dateDifferenceInDays(
                                invoice.due_date,
                                today
                              )
                            : 0;

                        return (
                          <tr
                            key={
                              invoice.id
                            }
                            className="hover:bg-slate-50"
                          >
                            <TableCell>
                              <Link
                                href={`/invoices/${invoice.id}`}
                                className="font-semibold text-slate-900 hover:underline"
                              >
                                {
                                  invoice.invoice_number
                                }
                              </Link>

                              <p className="mt-1 text-xs text-slate-400">
                                {invoice.invoice_type ||
                                  "Invoice"}
                              </p>
                            </TableCell>

                            <TableCell>
                              {
                                clientName
                              }
                            </TableCell>

                            <TableCell>
                              <span className="font-medium text-red-700">
                                {formatShortDate(
                                  invoice.due_date
                                )}
                              </span>
                            </TableCell>

                            <TableCell>
                              <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                                {daysOverdue}{" "}
                                {daysOverdue ===
                                1
                                  ? "day"
                                  : "days"}
                              </span>
                            </TableCell>

                            <TableCell right>
                              {formatCurrency(
                                invoice.invoiceTotal
                              )}
                            </TableCell>

                            <TableCell right>
                              <span className="font-bold text-red-700">
                                {formatCurrency(
                                  invoice.outstanding
                                )}
                              </span>
                            </TableCell>

                            <TableCell right>
                              <Link
                                href={`/invoices/${invoice.id}`}
                                className="inline-flex rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                              >
                                View Invoice
                              </Link>
                            </TableCell>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* =================================================
              ACTIVE JOBS
              ================================================= */}

          <section className="mt-10 overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Active Jobs
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Jobs where work is currently in progress.
                </p>
              </div>

              <Link
                href="/jobs?view=active"
                className="text-sm font-semibold text-slate-700 hover:underline"
              >
                View all active jobs →
              </Link>
            </div>

            {activeJobs.length ===
            0 ? (
              <div className="p-12 text-center">
                <p className="font-medium text-slate-700">
                  No active jobs
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  Jobs will appear here when their status is changed to In Progress.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <Heading>
                        Job
                      </Heading>

                      <Heading>
                        Client
                      </Heading>

                      <Heading>
                        Status
                      </Heading>

                      <Heading>
                        Location
                      </Heading>

                      <Heading>
                        Start Date
                      </Heading>

                      <Heading right>
                        Action
                      </Heading>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {activeJobs.map(
                      (job) => {
                        const clientData =
                          Array.isArray(
                            job.clients
                          )
                            ? job.clients[0]
                            : job.clients;

                        const clientName =
                          clientData?.display_name ||
                          [
                            clientData?.first_name,
                            clientData?.last_name,
                          ]
                            .filter(Boolean)
                            .join(" ") ||
                          "Unknown client";

                        const location =
                          [
                            job.town,
                            job.postcode,
                          ]
                            .filter(Boolean)
                            .join(", ") ||
                          "No location";

                        return (
                          <tr
                            key={
                              job.id
                            }
                            className="hover:bg-slate-50"
                          >
                            <TableCell>
                              <Link
                                href={`/jobs/${job.id}`}
                                className="font-semibold text-slate-900 hover:underline"
                              >
                                {
                                  job.job_number
                                }
                              </Link>

                              <p className="mt-1 text-sm text-slate-500">
                                {job.title ||
                                  "Untitled job"}
                              </p>

                              {job.job_type && (
                                <p className="mt-1 text-xs text-slate-400">
                                  {
                                    job.job_type
                                  }
                                </p>
                              )}
                            </TableCell>

                            <TableCell>
                              {
                                clientName
                              }
                            </TableCell>

                            <TableCell>
                              <StatusBadge
                                status={
                                  job.status
                                }
                              />
                            </TableCell>

                            <TableCell>
                              {
                                location
                              }
                            </TableCell>

                            <TableCell>
                              {job.start_date
                                ? formatShortDate(
                                    job.start_date
                                  )
                                : "Not set"}
                            </TableCell>

                            <TableCell right>
                              <Link
                                href={`/jobs/${job.id}`}
                                className="inline-flex rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                              >
                                Open Job Hub
                              </Link>
                            </TableCell>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* =================================================
              UNPAID SURVEYS
              Only shown when a survey invoice is still unpaid.
              ================================================= */}

          {unpaidSurveys.length >
            0 && (
            <section className="mt-10 overflow-hidden rounded-2xl bg-white shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    Unpaid Surveys
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Issued survey invoices still waiting for payment. Surveys in the next 3 days are highlighted.
                  </p>
                </div>

                <Link
                  href="/surveys"
                  className="text-sm font-semibold text-slate-700 hover:text-slate-900 hover:underline"
                >
                  View all surveys →
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <Heading>
                        Client
                      </Heading>

                      <Heading>
                        Survey
                      </Heading>

                      <Heading>
                        Invoice
                      </Heading>

                      <Heading right>
                        Amount
                      </Heading>

                      <Heading right>
                        Action
                      </Heading>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {unpaidSurveys.map(
                      (survey) => {
                        const dueSoon =
                          isSurveyDueSoon(
                            survey.surveyDate,
                            today
                          );

                        return (
                          <tr
                            key={
                              survey.invoiceId
                            }
                            className={
                              dueSoon
                                ? "bg-red-50"
                                : "hover:bg-slate-50"
                            }
                          >
                            <TableCell>
                              <span className="font-semibold text-slate-900">
                                {
                                  survey.clientName
                                }
                              </span>

                              {survey.jobNumber && (
                                <p className="mt-1 text-xs text-slate-400">
                                  {
                                    survey.jobNumber
                                  }
                                </p>
                              )}
                            </TableCell>

                            <TableCell>
                              <span
                                className={
                                  dueSoon
                                    ? "font-semibold text-[#be1e2d]"
                                    : ""
                                }
                              >
                                {survey.surveyDate
                                  ? formatSurveyWhen(
                                      survey.surveyDate,
                                      survey.startTime,
                                      survey.endTime
                                    )
                                  : "Not set"}
                              </span>

                              {dueSoon && (
                                <p className="mt-1 text-xs font-semibold text-[#be1e2d]">
                                  Unpaid – survey due soon
                                </p>
                              )}
                            </TableCell>

                            <TableCell>
                              <Link
                                href={`/invoices/${survey.invoiceId}`}
                                className="font-semibold text-slate-900 hover:underline"
                              >
                                {
                                  survey.invoiceNumber
                                }
                              </Link>
                            </TableCell>

                            <TableCell right>
                              <span
                                className={
                                  dueSoon
                                    ? "font-bold text-[#be1e2d]"
                                    : "font-semibold text-slate-900"
                                }
                              >
                                {formatCurrency(
                                  survey.total
                                )}
                              </span>

                              {survey.outstanding <
                                survey.total && (
                                <p className="mt-1 text-xs text-slate-500">
                                  {formatCurrency(
                                    survey.outstanding
                                  )}{" "}
                                  outstanding
                                </p>
                              )}
                            </TableCell>

                            <TableCell right>
                              <Link
                                href={`/surveys/${survey.jobId}`}
                                className="inline-flex whitespace-nowrap rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                              >
                                Open Survey
                              </Link>
                            </TableCell>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

/* =========================================================
   DASHBOARD CARD
   ========================================================= */

function DashboardCard({
  title,
  value,
  description,
  href,
  danger = false,
}: {
  title: string;
  value: string;
  description: string;
  href: string;
  danger?: boolean;
}) {
  return (
    <Link
      href={href}
      className="mx-auto flex aspect-square w-full max-w-full min-w-0 flex-col items-center justify-center overflow-hidden rounded-full border-2 border-[#be1e2d] bg-white px-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:px-5"
    >
      <p className="text-xs font-medium leading-tight text-slate-500">
        {title}
      </p>

      <p
        className={`mt-1 text-2xl font-bold leading-none ${
          danger
            ? "text-red-800"
            : "text-slate-900"
        }`}
      >
        {value}
      </p>

      <p className="mt-1 text-xs leading-tight text-slate-400">
        {description}
      </p>
    </Link>
  );
}

function Heading({
  children,
  right = false,
}: {
  children: React.ReactNode;
  right?: boolean;
}) {
  return (
    <th
      className={`px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500 ${
        right
          ? "text-right"
          : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function TableCell({
  children,
  right = false,
}: {
  children: React.ReactNode;
  right?: boolean;
}) {
  return (
    <td
      className={`px-6 py-5 text-sm text-slate-600 ${
        right
          ? "text-right"
          : ""
      }`}
    >
      {children}
    </td>
  );
}
