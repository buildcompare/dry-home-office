import Link from "next/link";
import { notFound } from "next/navigation";

import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";

type JobPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function JobPage({
  params,
}: JobPageProps) {
  const { id } = await params;

  const supabase =
    await createClient();

  const {
    data: job,
    error,
  } = await supabase
    .from("jobs")
    .select(`
      id,
      job_number,
      client_id,
      title,
      job_type,
      status,
      address_line_1,
      address_line_2,
      town,
      county,
      postcode,
      survey_date,
      start_date,
      completion_date,
      description,
      notes,
      estimated_value,
      created_at,

      clients (
        id,
        display_name,
        first_name,
        last_name,
        email,
        phone
      )
    `)
    .eq("id", id)
    .single();

  if (
    error ||
    !job
  ) {
    notFound();
  }

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

  const [
    scheduleResult,
    quotesResult,
    contractsResult,
    invoicesResult,
    guaranteesResult,
  ] = await Promise.all([
    supabase
      .from("schedule_events")
      .select(`
        id,
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
        contract_id
      `)
      .eq(
        "job_id",
        id
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

    supabase
      .from("quotes")
      .select(`
        id,
        quote_number,
        title,
        status,
        amount,
        quote_date,
        created_at
      `)
      .eq(
        "job_id",
        id
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      ),

    supabase
      .from("contracts")
      .select(`
        id,
        contract_number,
        title,
        status,
        amount,
        contract_date,
        signed_at,
        created_at
      `)
      .eq(
        "job_id",
        id
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      ),

    supabase
      .from("invoices")
      .select(`
        id,
        invoice_number,
        invoice_type,
        status,
        amount,
        amount_paid,
        invoice_date,
        due_date,
        paid_at,
        created_at
      `)
      .eq(
        "job_id",
        id
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      ),

    supabase
      .from("guarantees")
      .select(`
        id,
        guarantee_number,
        title,
        guarantee_type,
        status,
        issue_date,
        expiry_date,
        created_at
      `)
      .eq(
        "job_id",
        id
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      ),
  ]);

  const scheduleEvents =
    scheduleResult.data ?? [];

  const quotes =
    quotesResult.data ?? [];

  const contracts =
    contractsResult.data ?? [];

  const invoices =
    invoicesResult.data ?? [];

  const guarantees =
    guaranteesResult.data ?? [];

  /*
   * -------------------------------------------------------
   * JOB COMMERCIAL SUMMARY
   * -------------------------------------------------------
   *
   * The Job page is an overview only.
   * Commercial actions remain on the Quote Hub.
   */

  const latestQuote =
    quotes.length > 0
      ? quotes[0]
      : null;

  const acceptedQuote =
    quotes.find(
      (quote) =>
        quote.status ===
        "Accepted"
    ) ?? null;

  const activeInvoices =
    invoices.filter(
      (invoice) =>
        invoice.status !==
        "Cancelled"
    );

  const totalInvoiced =
    activeInvoices.reduce(
      (total, invoice) =>
        total +
        Number(
          invoice.amount ?? 0
        ),
      0
    );

  const totalPaid =
    activeInvoices.reduce(
      (total, invoice) =>
        total +
        Number(
          invoice.amount_paid ??
            0
        ),
      0
    );

  const outstanding =
    Math.max(
      totalInvoiced -
        totalPaid,
      0
    );

  const acceptedValue =
    acceptedQuote
      ? Number(
          acceptedQuote.amount ??
            0
        )
      : null;

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-7xl">

          {/* HEADER */}

          <div className="mb-8">
            <Link
              href="/jobs"
              className="text-sm font-medium text-slate-500 hover:text-slate-900"
            >
              ← Back to Jobs
            </Link>

            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  {
                    job.job_number
                  }
                </p>

                <h1 className="mt-1 text-3xl font-bold text-slate-900">
                  {job.title ||
                    "Untitled Job"}
                </h1>

                <p className="mt-2 text-slate-500">
                  {clientName}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">

                {/* Survey remains a Job-level action */}

                <Link
                  href={`/schedule/new?job=${job.id}&type=Survey`}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Schedule Survey
                </Link>

                {/* Quote creation also starts at Job level */}

                <Link
                  href={`/quotes/new?job=${job.id}`}
                  className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700"
                >
                  + Create Quote
                </Link>
              </div>
            </div>
          </div>

          {/* JOB SUMMARY */}

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
            <SummaryCard
              title="Status"
              value={
                job.status
              }
            />

            <SummaryCard
              title="Job Type"
              value={
                job.job_type ||
                "Not set"
              }
            />

            <SummaryCard
              title="Appointments"
              value={String(
                scheduleEvents.length
              )}
            />

            <SummaryCard
              title="Quotes"
              value={String(
                quotes.length
              )}
            />

            <SummaryCard
              title="Estimated Value"
              value={
                job.estimated_value !==
                null
                  ? formatCurrency(
                      job.estimated_value
                    )
                  : "Not set"
              }
            />
          </div>

          {/* COMMERCIAL OVERVIEW */}

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Commercial Overview
                </p>

                <h2 className="mt-1 text-xl font-semibold text-slate-900">
                  Job Financial Position
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  A summary of the financial records linked to this job.
                  Actions such as invoicing, scheduling work and contracts
                  are managed from the Quote Hub.
                </p>
              </div>

              {acceptedQuote ? (
                <Link
                  href={`/quotes/${acceptedQuote.id}`}
                  className="rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800"
                >
                  Open Quote Hub
                </Link>
              ) : latestQuote ? (
                <Link
                  href={`/quotes/${latestQuote.id}`}
                  className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  View Latest Quote
                </Link>
              ) : null}
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <FinanceCard
                title="Accepted Value"
                value={
                  acceptedValue !==
                  null
                    ? formatCurrency(
                        acceptedValue
                      )
                    : "No accepted quote"
                }
              />

              <FinanceCard
                title="Invoiced"
                value={formatCurrency(
                  totalInvoiced
                )}
              />

              <FinanceCard
                title="Paid"
                value={formatCurrency(
                  totalPaid
                )}
              />

              <FinanceCard
                title="Outstanding"
                value={formatCurrency(
                  outstanding
                )}
                strong={
                  outstanding > 0
                }
              />
            </div>
          </section>

          {/* CLIENT / ADDRESS / DATES */}

          <div className="mt-8 grid gap-6 lg:grid-cols-3">

            {/* CLIENT */}

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">
                  Client
                </h2>

                {clientData?.id && (
                  <Link
                    href={`/clients/${clientData.id}`}
                    className="text-sm font-semibold text-slate-700 hover:underline"
                  >
                    View Client →
                  </Link>
                )}
              </div>

              <div className="mt-5 space-y-4">
                <DetailRow
                  label="Name"
                  value={
                    clientName
                  }
                />

                <DetailRow
                  label="Phone"
                  value={
                    clientData?.phone
                  }
                />

                <DetailRow
                  label="Email"
                  value={
                    clientData?.email
                  }
                />
              </div>
            </section>

            {/* ADDRESS */}

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Job Address
              </h2>

              <div className="mt-5 text-sm leading-6 text-slate-700">
                {job.address_line_1 ? (
                  <>
                    <p>
                      {
                        job.address_line_1
                      }
                    </p>

                    {job.address_line_2 && (
                      <p>
                        {
                          job.address_line_2
                        }
                      </p>
                    )}

                    {job.town && (
                      <p>
                        {
                          job.town
                        }
                      </p>
                    )}

                    {job.county && (
                      <p>
                        {
                          job.county
                        }
                      </p>
                    )}

                    {job.postcode && (
                      <p className="mt-1 font-semibold">
                        {
                          job.postcode
                        }
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-slate-400">
                    No address recorded
                  </p>
                )}
              </div>
            </section>

            {/* DATES */}

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Dates
              </h2>

              <div className="mt-5 space-y-4">
                <DetailRow
                  label="Survey Date"
                  value={formatDate(
                    job.survey_date
                  )}
                />

                <DetailRow
                  label="Start Date"
                  value={formatDate(
                    job.start_date
                  )}
                />

                <DetailRow
                  label="Completion Date"
                  value={formatDate(
                    job.completion_date
                  )}
                />
              </div>
            </section>
          </div>

          {/* DESCRIPTION / NOTES */}

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Description
              </h2>

              <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {job.description ||
                  "No description recorded."}
              </p>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Internal Notes
              </h2>

              <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {job.notes ||
                  "No notes recorded."}
              </p>
            </section>
          </div>

          {/* SCHEDULE — VIEW / SURVEY ONLY */}

          <RecordSection
            title="Schedule"
            subtitle={`${scheduleEvents.length} appointments linked to this job`}
            action={
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/schedule/new?job=${job.id}&type=Survey`}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  + Schedule Survey
                </Link>

                <Link
                  href="/schedule"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                >
                  View Schedule
                </Link>
              </div>
            }
          >
            {scheduleEvents.length ===
            0 ? (
              <EmptyState text="No appointments scheduled for this job yet." />
            ) : (
              <div className="divide-y divide-slate-100">
                {scheduleEvents.map(
                  (event) => (
                    <div
                      key={
                        event.id
                      }
                      className="flex flex-wrap items-center justify-between gap-4 px-6 py-5"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900">
                            {
                              event.title
                            }
                          </p>

                          <StatusBadge
                            status={
                              event.event_type
                            }
                          />

                          <StatusBadge
                            status={
                              event.status
                            }
                          />
                        </div>

                        <p className="mt-2 text-sm text-slate-500">
                          {formatDate(
                            event.start_date
                          )}

                          {event.end_date &&
                            event.end_date !==
                              event.start_date &&
                            ` – ${formatDate(
                              event.end_date
                            )}`}
                        </p>

                        {event.location && (
                          <p className="mt-1 text-sm text-slate-500">
                            {
                              event.location
                            }
                          </p>
                        )}
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-medium text-slate-700">
                          {event.all_day
                            ? "All day"
                            : formatEventTime(
                                event.start_time,
                                event.end_time
                              )}
                        </p>

                        {event.assigned_to && (
                          <p className="mt-1 text-xs text-slate-500">
                            {
                              event.assigned_to
                            }
                          </p>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </RecordSection>

          {/* QUOTES */}

          <RecordSection
            title="Quotes"
            subtitle={`${quotes.length} quotes linked to this job`}
            action={
              <Link
                href={`/quotes/new?job=${job.id}`}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
              >
                + Create Quote
              </Link>
            }
          >
            {quotes.length ===
            0 ? (
              <EmptyState text="No quotes created for this job yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <Heading>
                        Quote
                      </Heading>

                      <Heading>
                        Status
                      </Heading>

                      <Heading>
                        Date
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
                    {quotes.map(
                      (quote) => (
                        <tr
                          key={
                            quote.id
                          }
                        >
                          <TableCell>
                            <Link
                              href={`/quotes/${quote.id}`}
                              className="font-semibold text-slate-900 hover:underline"
                            >
                              {
                                quote.quote_number
                              }
                            </Link>

                            <p className="mt-1 text-sm text-slate-500">
                              {quote.title ||
                                "Quote"}
                            </p>
                          </TableCell>

                          <TableCell>
                            <StatusBadge
                              status={
                                quote.status
                              }
                            />
                          </TableCell>

                          <TableCell>
                            {formatDate(
                              quote.quote_date
                            )}
                          </TableCell>

                          <TableCell right>
                            {formatCurrency(
                              quote.amount
                            )}
                          </TableCell>

                          <TableCell right>
                            <Link
                              href={`/quotes/${quote.id}`}
                              className={
                                quote.status ===
                                "Accepted"
                                  ? "inline-flex rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                                  : "inline-flex rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                              }
                            >
                              {quote.status ===
                              "Accepted"
                                ? "Open Hub"
                                : "View"}
                            </Link>
                          </TableCell>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </RecordSection>

          {/* CONTRACTS — VIEW ONLY */}

          <RecordSection
            title="Contracts"
            subtitle={`${contracts.length} contracts linked to this job`}
          >
            {contracts.length ===
            0 ? (
              <EmptyState text="No contracts linked to this job yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <Heading>
                        Contract
                      </Heading>

                      <Heading>
                        Title
                      </Heading>

                      <Heading>
                        Status
                      </Heading>

                      <Heading>
                        Signed
                      </Heading>

                      <Heading right>
                        Action
                      </Heading>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {contracts.map(
                      (contract) => (
                        <tr
                          key={
                            contract.id
                          }
                        >
                          <TableCell>
                            <Link
                              href={`/contracts/${contract.id}`}
                              className="font-semibold text-slate-900 hover:underline"
                            >
                              {
                                contract.contract_number
                              }
                            </Link>
                          </TableCell>

                          <TableCell>
                            {contract.title ||
                              "Contract"}
                          </TableCell>

                          <TableCell>
                            <StatusBadge
                              status={
                                contract.status
                              }
                            />
                          </TableCell>

                          <TableCell>
                            {contract.signed_at
                              ? formatDate(
                                  contract.signed_at
                                )
                              : "—"}
                          </TableCell>

                          <TableCell right>
                            <RecordLink
                              href={`/contracts/${contract.id}`}
                            />
                          </TableCell>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </RecordSection>

          {/* INVOICES — VIEW ONLY */}

          <RecordSection
            title="Invoices"
            subtitle={`${invoices.length} invoices linked to this job`}
          >
            {invoices.length ===
            0 ? (
              <EmptyState text="No invoices linked to this job yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <Heading>
                        Invoice
                      </Heading>

                      <Heading>
                        Type
                      </Heading>

                      <Heading>
                        Status
                      </Heading>

                      <Heading>
                        Due Date
                      </Heading>

                      <Heading right>
                        Amount
                      </Heading>

                      <Heading right>
                        Paid
                      </Heading>

                      <Heading right>
                        Action
                      </Heading>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {invoices.map(
                      (invoice) => {
                        const invoiceAmount =
                          Number(
                            invoice.amount ??
                              0
                          );

                        const paid =
                          Number(
                            invoice.amount_paid ??
                              0
                          );

                        const derivedStatus =
                          invoiceAmount >
                            0 &&
                          paid >=
                            invoiceAmount -
                              0.009
                            ? "Paid"
                            : paid > 0
                              ? "Part Paid"
                              : invoice.status;

                        return (
                          <tr
                            key={
                              invoice.id
                            }
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
                            </TableCell>

                            <TableCell>
                              {invoice.invoice_type ||
                                "—"}
                            </TableCell>

                            <TableCell>
                              <StatusBadge
                                status={
                                  derivedStatus
                                }
                              />
                            </TableCell>

                            <TableCell>
                              {formatDate(
                                invoice.due_date
                              )}
                            </TableCell>

                            <TableCell right>
                              {formatCurrency(
                                invoiceAmount
                              )}
                            </TableCell>

                            <TableCell right>
                              {formatCurrency(
                                paid
                              )}
                            </TableCell>

                            <TableCell right>
                              <RecordLink
                                href={`/invoices/${invoice.id}`}
                              />
                            </TableCell>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </RecordSection>

          {/* GUARANTEES — VIEW ONLY */}

          <RecordSection
            title="Guarantees"
            subtitle={`${guarantees.length} guarantees linked to this job`}
          >
            {guarantees.length ===
            0 ? (
              <EmptyState text="No guarantees linked to this job yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <Heading>
                        Guarantee
                      </Heading>

                      <Heading>
                        Type
                      </Heading>

                      <Heading>
                        Status
                      </Heading>

                      <Heading>
                        Issue Date
                      </Heading>

                      <Heading>
                        Expiry Date
                      </Heading>

                      <Heading right>
                        Action
                      </Heading>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {guarantees.map(
                      (guarantee) => {
                        const expired =
                          guarantee.expiry_date
                            ? new Date(
                                `${guarantee.expiry_date}T23:59:59`
                              ) <
                              new Date()
                            : false;

                        const displayStatus =
                          guarantee.status ===
                          "Cancelled"
                            ? "Cancelled"
                            : expired
                              ? "Expired"
                              : guarantee.status;

                        return (
                          <tr
                            key={
                              guarantee.id
                            }
                          >
                            <TableCell>
                              <Link
                                href={`/guarantees/${guarantee.id}`}
                                className="font-semibold text-slate-900 hover:underline"
                              >
                                {
                                  guarantee.guarantee_number
                                }
                              </Link>

                              <p className="mt-1 text-sm text-slate-500">
                                {guarantee.title ||
                                  "Works Guarantee"}
                              </p>
                            </TableCell>

                            <TableCell>
                              {guarantee.guarantee_type ||
                                "—"}
                            </TableCell>

                            <TableCell>
                              <StatusBadge
                                status={
                                  displayStatus
                                }
                              />
                            </TableCell>

                            <TableCell>
                              {formatDate(
                                guarantee.issue_date
                              )}
                            </TableCell>

                            <TableCell>
                              {formatDate(
                                guarantee.expiry_date
                              )}
                            </TableCell>

                            <TableCell right>
                              <RecordLink
                                href={`/guarantees/${guarantee.id}`}
                              />
                            </TableCell>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </RecordSection>
        </div>
      </main>
    </div>
  );
}

/* =========================================================
   SUMMARY CARD
   ========================================================= */

function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">
        {title}
      </p>

      <p className="mt-2 text-xl font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}

/* =========================================================
   FINANCE CARD
   ========================================================= */

function FinanceCard({
  title,
  value,
  strong = false,
}: {
  title: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={
        strong
          ? "rounded-xl bg-slate-900 p-5"
          : "rounded-xl bg-slate-50 p-5"
      }
    >
      <p
        className={
          strong
            ? "text-xs font-semibold uppercase tracking-wide text-slate-300"
            : "text-xs font-semibold uppercase tracking-wide text-slate-500"
        }
      >
        {title}
      </p>

      <p
        className={
          strong
            ? "mt-2 text-2xl font-bold text-white"
            : "mt-2 text-2xl font-bold text-slate-900"
        }
      >
        {value}
      </p>
    </div>
  );
}

/* =========================================================
   RECORD SECTION
   ========================================================= */

function RecordSection({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            {title}
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {subtitle}
          </p>
        </div>

        {action}
      </div>

      {children}
    </section>
  );
}

/* =========================================================
   DETAIL ROW
   ========================================================= */

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-sm text-slate-700">
        {value ||
          "Not recorded"}
      </p>
    </div>
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
    status === "Completed" ||
    status === "Complete"
      ? "bg-emerald-100 text-emerald-800"

      : status === "Part Paid" ||
          status === "Expired"
        ? "bg-amber-100 text-amber-800"

        : status === "Sent" ||
            status === "Viewed" ||
            status === "Scheduled" ||
            status === "Survey" ||
            status === "Work"
          ? "bg-blue-100 text-blue-800"

          : status === "Cancelled" ||
              status === "Declined" ||
              status === "Overdue"
            ? "bg-red-100 text-red-700"

            : "bg-slate-100 text-slate-700";

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${classes}`}
    >
      {status}
    </span>
  );
}

/* =========================================================
   TABLE HEADING
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

/* =========================================================
   TABLE CELL
   ========================================================= */

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
   RECORD LINK
   ========================================================= */

function RecordLink({
  href,
}: {
  href: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
    >
      View
    </Link>
  );
}

/* =========================================================
   EMPTY STATE
   ========================================================= */

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div className="p-10 text-center">
      <p className="text-sm text-slate-500">
        {text}
      </p>
    </div>
  );
}

/* =========================================================
   CURRENCY
   ========================================================= */

function formatCurrency(
  value:
    | number
    | string
    | null
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "—";
  }

  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "GBP",
    }
  ).format(
    Number(value)
  );
}

/* =========================================================
   DATE
   ========================================================= */

function formatDate(
  value: string | null
) {
  if (!value) {
    return "Not set";
  }

  const [
    year,
    month,
    day,
  ] = value
    .slice(0, 10)
    .split("-")
    .map(Number);

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  ).format(
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    )
  );
}

/* =========================================================
   EVENT TIME
   ========================================================= */

function formatEventTime(
  start: string | null,
  end: string | null
) {
  if (!start) {
    return "Time not set";
  }

  const startTime =
    start.slice(0, 5);

  if (!end) {
    return startTime;
  }

  return `${startTime} – ${end.slice(
    0,
    5
  )}`;
}