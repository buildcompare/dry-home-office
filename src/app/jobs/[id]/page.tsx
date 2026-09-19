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
      .eq("job_id", id)
      .order("start_date", {
        ascending: true,
      })
      .order("start_time", {
        ascending: true,
      }),

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
      .eq("job_id", id)
      .order("created_at", {
        ascending: false,
      }),

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
      .eq("job_id", id)
      .order("created_at", {
        ascending: false,
      }),

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
      .eq("job_id", id)
      .order("created_at", {
        ascending: false,
      }),

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
      .eq("job_id", id)
      .order("created_at", {
        ascending: false,
      }),
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

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-7xl">
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

              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/schedule/new?job=${job.id}&type=Survey`}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Schedule Survey
                </Link>

                <Link
                  href={`/schedule/new?job=${job.id}&type=Work`}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Schedule Work
                </Link>

                <Link
                  href={`/quotes/new?job=${job.id}`}
                  className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700"
                >
                  + Create Quote
                </Link>
              </div>
            </div>
          </div>

          <div className="mb-8 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
            <SummaryCard
              title="Status"
              value={job.status}
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
              title="Invoices"
              value={String(
                invoices.length
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

          <div className="grid gap-6 lg:grid-cols-3">
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Client
              </h2>

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

                {clientData?.id && (
                  <Link
                    href={`/clients/${clientData.id}`}
                    className="inline-flex text-sm font-semibold text-slate-900 hover:underline"
                  >
                    View Client Record →
                  </Link>
                )}
              </div>
            </section>

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

          <RecordSection
            title="Schedule"
            subtitle={`${scheduleEvents.length} appointments linked to this job`}
            action={
              <Link
                href={`/schedule/new?job=${job.id}`}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
              >
                + Add Appointment
              </Link>
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
                            <RecordLink
                              href={`/quotes/${quote.id}`}
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
                      (
                        contract
                      ) => (
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
                      (
                        invoice
                      ) => (
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
                                invoice.status
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
                              invoice.amount
                            )}
                          </TableCell>

                          <TableCell right>
                            {formatCurrency(
                              Number(
                                invoice.amount_paid ??
                                  0
                              )
                            )}
                          </TableCell>

                          <TableCell right>
                            <RecordLink
                              href={`/invoices/${invoice.id}`}
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
                      (
                        guarantee
                      ) => {
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
    status === "Completed"
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