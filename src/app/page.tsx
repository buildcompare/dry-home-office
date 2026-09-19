import Link from "next/link";

import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase =
    await createClient();

  /*
   * -------------------------------------------------------
   * DATE RANGE
   * -------------------------------------------------------
   */

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

  /*
   * -------------------------------------------------------
   * DASHBOARD DATA
   * -------------------------------------------------------
   */

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
      .not(
        "status",
        "in",
        '("Complete","Completed","Cancelled")'
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
     *
     * Final outstanding calculation is done
     * below so fully-paid invoices are ignored
     * even if their stored status is old.
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
   * -------------------------------------------------------
   * NORMALISE DATA
   * -------------------------------------------------------
   */

  const scheduleEvents =
    scheduleResult.data ??
    [];

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
    activeJobsResult.data ??
    [];

  const activeJobCount =
    activeJobsResult.count ??
    activeJobs.length;

  const monthlyInvoices =
    invoicesResult.data ??
    [];

  const monthlyQuotes =
    quotesResult.data ??
    [];

  /*
   * -------------------------------------------------------
   * MONTHLY VALUES
   * -------------------------------------------------------
   */

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
            quote.amount ??
              0
          ),
        0
      )
    );

  const monthLabel =
    formatMonthLabel(
      monthStart
    );

  /*
   * -------------------------------------------------------
   * OVERDUE INVOICES
   * -------------------------------------------------------
   *
   * Do not trust invoice.status alone.
   *
   * An invoice is overdue when:
   *
   * - Due date is before today
   * - It is not cancelled
   * - It still has money outstanding
   */

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

  /*
   * -------------------------------------------------------
   * SCHEDULE PANEL
   * -------------------------------------------------------
   */

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
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-7xl">

          {/* HEADER */}

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

          {/* TOP CARDS */}

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
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
              description="Open jobs"
              href="/jobs"
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

          {/* TODAY / TOMORROW */}

          <div className="mt-8 grid gap-6 xl:grid-cols-2">
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

          {/* OVERDUE INVOICES */}

          <section className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm">
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
                  <thead className="bg-red-50">
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

          {/* ACTIVE JOBS */}

          <section className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Active Jobs
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Jobs currently moving through the DryHome workflow.
                </p>
              </div>

              <Link
                href="/jobs"
                className="text-sm font-semibold text-slate-700 hover:underline"
              >
                View all jobs →
              </Link>
            </div>

            {activeJobs.length ===
            0 ? (
              <div className="p-12 text-center">
                <p className="font-medium text-slate-700">
                  No active jobs
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  Your active work will appear here.
                </p>

                <Link
                  href="/jobs/new"
                  className="mt-5 inline-flex rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700"
                >
                  + Add Job
                </Link>
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
                                : job.survey_date
                                  ? `Survey ${formatShortDate(
                                      job.survey_date
                                    )}`
                                  : "Not set"}
                            </TableCell>

                            <TableCell right>
                              <Link
                                href={`/jobs/${job.id}`}
                                className="inline-flex rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                              >
                                View
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
      className={`rounded-2xl p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        danger
          ? "border border-red-200 bg-red-50"
          : "bg-white"
      }`}
    >
      <p
        className={`text-sm font-medium ${
          danger
            ? "text-red-600"
            : "text-slate-500"
        }`}
      >
        {title}
      </p>

      <p
        className={`mt-3 text-3xl font-bold ${
          danger
            ? "text-red-800"
            : "text-slate-900"
        }`}
      >
        {value}
      </p>

      <p
        className={`mt-2 text-sm ${
          danger
            ? "text-red-500"
            : "text-slate-400"
        }`}
      >
        {description}
      </p>
    </Link>
  );
}

/* =========================================================
   STATUS BADGE
   ========================================================= */

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const classes =
    status === "Paid" ||
    status === "Signed" ||
    status === "Accepted" ||
    status === "Issued" ||
    status === "Complete" ||
    status === "Completed"
      ? "bg-emerald-100 text-emerald-800"

      : status === "Part Paid" ||
          status === "Expired"
        ? "bg-amber-100 text-amber-800"

        : status === "Sent" ||
            status === "Viewed" ||
            status === "Scheduled" ||
            status === "Survey" ||
            status === "Survey Booked" ||
            status === "Work" ||
            status === "In Progress"
          ? "bg-blue-100 text-blue-800"

          : status === "Cancelled" ||
              status === "Declined" ||
              status === "Overdue"
            ? "bg-red-100 text-red-700"

            : "bg-slate-100 text-slate-700";

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${classes}`}
    >
      {status}
    </span>
  );
}

/* =========================================================
   TABLE
   ========================================================= */

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

/* =========================================================
   INVOICE TOTAL
   ========================================================= */

function invoiceRowTotal(invoice: {
  amount?:
    | number
    | string
    | null;

  subtotal?:
    | number
    | string
    | null;

  vat_amount?:
    | number
    | string
    | null;
}) {
  const amount =
    Number(
      invoice.amount ?? 0
    );

  if (
    Number.isFinite(
      amount
    ) &&
    amount > 0
  ) {
    return money(
      amount
    );
  }

  const subtotal =
    Number(
      invoice.subtotal ??
        0
    );

  const vatAmount =
    Number(
      invoice.vat_amount ??
        0
    );

  return money(
    (
      Number.isFinite(
        subtotal
      )
        ? subtotal
        : 0
    ) +
      (
        Number.isFinite(
          vatAmount
        )
          ? vatAmount
          : 0
      )
  );
}

/* =========================================================
   MONEY
   ========================================================= */

function money(
  value: number
) {
  return Math.round(
    (
      value +
      Number.EPSILON
    ) *
      100
  ) / 100;
}

/* =========================================================
   CURRENCY
   ========================================================= */

function formatCurrency(
  value: number
) {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "GBP",
    }
  ).format(
    money(
      value
    )
  );
}

/* =========================================================
   UK DATE HELPERS
   ========================================================= */

function getLondonDateKey(
  date: Date
) {
  const parts =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone:
          "Europe/London",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",
      }
    ).formatToParts(
      date
    );

  const year =
    parts.find(
      (part) =>
        part.type ===
        "year"
    )?.value;

  const month =
    parts.find(
      (part) =>
        part.type ===
        "month"
    )?.value;

  const day =
    parts.find(
      (part) =>
        part.type ===
        "day"
    )?.value;

  return `${year}-${month}-${day}`;
}

function addDays(
  dateKey: string,
  days: number
) {
  const [
    year,
    month,
    day,
  ] = dateKey
    .split("-")
    .map(Number);

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day + days
      )
    );

  return date
    .toISOString()
    .slice(
      0,
      10
    );
}

function getMonthRange(
  dateKey: string
) {
  const [
    year,
    month,
  ] = dateKey
    .split("-")
    .map(Number);

  const monthStart =
    `${year}-${String(
      month
    ).padStart(
      2,
      "0"
    )}-01`;

  const nextMonth =
    new Date(
      Date.UTC(
        year,
        month,
        1
      )
    );

  const nextMonthStart =
    nextMonth
      .toISOString()
      .slice(
        0,
        10
      );

  return {
    monthStart,
    nextMonthStart,
  };
}

/* =========================================================
   DATE FORMATTING
   ========================================================= */

function parseDateKey(
  value: string
) {
  const [
    year,
    month,
    day,
  ] = value
    .slice(
      0,
      10
    )
    .split("-")
    .map(Number);

  return new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  );
}

function formatLongDate(
  value: string
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      weekday:
        "long",

      day:
        "numeric",

      month:
        "long",

      year:
        "numeric",

      timeZone:
        "UTC",
    }
  ).format(
    parseDateKey(
      value
    )
  );
}

function formatShortDate(
  value:
    | string
    | null
) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day:
        "2-digit",

      month:
        "short",

      year:
        "numeric",

      timeZone:
        "UTC",
    }
  ).format(
    parseDateKey(
      value
    )
  );
}

function formatMonthLabel(
  value: string
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      month:
        "long",

      year:
        "numeric",

      timeZone:
        "UTC",
    }
  ).format(
    parseDateKey(
      value
    )
  );
}

function dateDifferenceInDays(
  from: string,
  to: string
) {
  const fromDate =
    parseDateKey(
      from
    );

  const toDate =
    parseDateKey(
      to
    );

  const difference =
    toDate.getTime() -
    fromDate.getTime();

  return Math.max(
    Math.floor(
      difference /
        86400000
    ),
    0
  );
}

/* =========================================================
   EVENT TIME
   ========================================================= */

function formatEventTime(
  start:
    | string
    | null,
  end:
    | string
    | null
) {
  if (!start) {
    return "Time not set";
  }

  const startTime =
    start.slice(
      0,
      5
    );

  if (!end) {
    return startTime;
  }

  return `${startTime} – ${end.slice(
    0,
    5
  )}`;
}