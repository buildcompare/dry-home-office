import Link from "next/link";
import { notFound } from "next/navigation";

import Sidebar from "@/components/Sidebar";
import EmailContractButton from "@/components/EmailContractButton";
import { createClient } from "@/lib/supabase/server";

type ContractPageProps = {
  params: Promise<{
    id: string;
  }>;

  searchParams: Promise<{
    sent?: string;
    error?: string;
    warning?: string;
  }>;
};

export default async function ContractPage({
  params,
  searchParams,
}: ContractPageProps) {
  const { id } = await params;
  const query = await searchParams;

  const supabase = await createClient();

  const {
    data: contract,
    error,
  } = await supabase
    .from("contracts")
    .select(`
      id,
      contract_number,
      client_id,
      job_id,
      quote_id,
      title,
      status,
      contract_date,
      description,
      terms,
      customer_message,
      internal_notes,
      amount,
      sent_to,
      sent_at,
      viewed_at,
      signed_at,
      signed_name,
      signed_email,
      signed_ip,
      public_token,
      created_at,

      clients (
        id,
        display_name,
        first_name,
        last_name,
        email,
        phone,
        address_line_1,
        address_line_2,
        town,
        county,
        postcode
      ),

      jobs (
        id,
        job_number,
        title,
        job_type,
        status
      ),

      quotes (
        id,
        quote_number,
        title,
        status,
        amount
      )
    `)
    .eq("id", id)
    .single();

  if (
    error ||
    !contract
  ) {
    notFound();
  }

  const client =
    Array.isArray(
      contract.clients
    )
      ? contract.clients[0]
      : contract.clients;

  const job =
    Array.isArray(
      contract.jobs
    )
      ? contract.jobs[0]
      : contract.jobs;

  const quote =
    Array.isArray(
      contract.quotes
    )
      ? contract.quotes[0]
      : contract.quotes;

  const clientName =
    client?.display_name ||
    [
      client?.first_name,
      client?.last_name,
    ]
      .filter(Boolean)
      .join(" ") ||
    "Unknown client";

  /*
   * Related records are view-only here.
   *
   * The Quote Hub remains the place where
   * Schedule / Invoice / Guarantee actions live.
   */
  const [
    scheduleResult,
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
        assigned_to
      `)
      .eq(
        "contract_id",
        contract.id
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
        "contract_id",
        contract.id
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
        "contract_id",
        contract.id
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

  const invoices =
    invoicesResult.data ?? [];

  const guarantees =
    guaranteesResult.data ?? [];

  const signed =
    contract.status ===
    "Signed";

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-7xl">

          {/* SUCCESS / ERROR MESSAGES */}

          {query.sent ===
            "1" && (
            <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800">
              Contract emailed successfully to{" "}
              {contract.sent_to ||
                client?.email}.
            </div>
          )}

          {query.error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
              {query.error}
            </div>
          )}

          {query.warning && (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-800">
              {query.warning}
            </div>
          )}

          {/* HEADER */}

          <div className="mb-8">
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/contracts"
                className="text-sm font-medium text-slate-500 hover:text-slate-900"
              >
                ← Back to Contracts
              </Link>

              {quote?.id && (
                <Link
                  href={`/quotes/${quote.id}`}
                  className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
                >
                  ← Back to Quote Hub
                </Link>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  {
                    contract.contract_number
                  }
                </p>

                <h1 className="mt-1 text-3xl font-bold text-slate-900">
                  {contract.title ||
                    "Contract"}
                </h1>

                <p className="mt-2 text-slate-500">
                  {clientName}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <EmailContractButton
                  contractId={
                    contract.id
                  }
                  recipient={
                    client?.email ||
                    null
                  }
                  status={
                    contract.status
                  }
                />

                {quote?.id && (
                  <Link
                    href={`/quotes/${quote.id}`}
                    className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    View Quote Hub
                  </Link>
                )}

                <StatusBadge
                  status={
                    contract.status
                  }
                />
              </div>
            </div>

            {!client?.email && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                This client does not have an email address saved.
                Add an email to the client record before sending
                the contract.
              </div>
            )}
          </div>

          {/* SUMMARY */}

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Contract Value"
              value={formatCurrency(
                contract.amount
              )}
            />

            <SummaryCard
              title="Contract Date"
              value={formatDate(
                contract.contract_date
              )}
            />

            <SummaryCard
              title="Status"
              value={
                contract.status
              }
            />

            <SummaryCard
              title="Signed"
              value={
                contract.signed_at
                  ? formatDate(
                      contract.signed_at
                    )
                  : "Not signed"
              }
            />
          </div>

          {/* RELATIONSHIPS */}

          <div className="mt-8 grid gap-6 lg:grid-cols-3">

            {/* CLIENT */}

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">
                  Client
                </h2>

                {client?.id && (
                  <Link
                    href={`/clients/${client.id}`}
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
                  label="Email"
                  value={
                    client?.email
                  }
                />

                <DetailRow
                  label="Phone"
                  value={
                    client?.phone
                  }
                />
              </div>
            </section>

            {/* JOB */}

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">
                  Job
                </h2>

                {job?.id && (
                  <Link
                    href={`/jobs/${job.id}`}
                    className="text-sm font-semibold text-slate-700 hover:underline"
                  >
                    View Job →
                  </Link>
                )}
              </div>

              {job ? (
                <div className="mt-5 space-y-4">
                  <DetailRow
                    label="Job Number"
                    value={
                      job.job_number
                    }
                  />

                  <DetailRow
                    label="Title"
                    value={
                      job.title
                    }
                  />

                  <DetailRow
                    label="Type"
                    value={
                      job.job_type
                    }
                  />

                  <DetailRow
                    label="Status"
                    value={
                      job.status
                    }
                  />
                </div>
              ) : (
                <p className="mt-5 text-sm text-slate-500">
                  No linked job.
                </p>
              )}
            </section>

            {/* QUOTE */}

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">
                  Quote
                </h2>

                {quote?.id && (
                  <Link
                    href={`/quotes/${quote.id}`}
                    className="text-sm font-semibold text-emerald-700 hover:underline"
                  >
                    Open Hub →
                  </Link>
                )}
              </div>

              {quote ? (
                <div className="mt-5 space-y-4">
                  <DetailRow
                    label="Quote Number"
                    value={
                      quote.quote_number
                    }
                  />

                  <DetailRow
                    label="Title"
                    value={
                      quote.title
                    }
                  />

                  <DetailRow
                    label="Status"
                    value={
                      quote.status
                    }
                  />

                  <DetailRow
                    label="Value"
                    value={formatCurrency(
                      quote.amount
                    )}
                  />
                </div>
              ) : (
                <p className="mt-5 text-sm text-slate-500">
                  No linked quote.
                </p>
              )}
            </section>
          </div>

          {/* SCOPE */}

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">
              Scope of Works
            </h2>

            <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {contract.description ||
                "No scope of works recorded."}
            </p>
          </section>

          {/* TERMS */}

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">
              Terms & Conditions
            </h2>

            <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {contract.terms ||
                "No terms recorded."}
            </p>
          </section>

          {/* CUSTOMER MESSAGE / INTERNAL NOTES */}

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Customer Message
              </h2>

              <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {contract.customer_message ||
                  "No customer message recorded."}
              </p>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Internal Notes
              </h2>

              <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {contract.internal_notes ||
                  "No internal notes recorded."}
              </p>

              <p className="mt-4 text-xs text-slate-400">
                Internal notes are not shown to the customer.
              </p>
            </section>
          </div>

          {/* SIGNATURE */}

          {signed && (
            <section className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Signed Contract
                  </p>

                  <h2 className="mt-2 text-xl font-bold text-emerald-950">
                    Agreement Recorded
                  </h2>

                  <p className="mt-2 text-sm text-emerald-800">
                    The customer has signed this agreement.
                    Continue the workflow from the Quote Hub.
                  </p>
                </div>

                {quote?.id && (
                  <Link
                    href={`/quotes/${quote.id}`}
                    className="rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800"
                  >
                    Return to Quote Hub
                  </Link>
                )}
              </div>

              <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                <DetailRow
                  label="Signed By"
                  value={
                    contract.signed_name
                  }
                />

                <DetailRow
                  label="Email"
                  value={
                    contract.signed_email
                  }
                />

                <DetailRow
                  label="Date & Time"
                  value={formatDateTime(
                    contract.signed_at
                  )}
                />

                <DetailRow
                  label="IP Address"
                  value={
                    contract.signed_ip ||
                    "Not recorded"
                  }
                />
              </div>
            </section>
          )}

          {/* RELATED RECORDS */}

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Related Records
              </p>

              <h2 className="mt-1 text-xl font-semibold text-slate-900">
                Contract Activity
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                These records are shown for reference. New workflow
                actions are managed from the Quote Hub.
              </p>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-3">
              <RelatedCard
                title="Schedule"
                count={
                  scheduleEvents.length
                }
                label={
                  scheduleEvents.length ===
                  1
                    ? "appointment"
                    : "appointments"
                }
                href={
                  job?.id
                    ? `/jobs/${job.id}`
                    : undefined
                }
                actionLabel="View Job"
              />

              <RelatedCard
                title="Invoices"
                count={
                  invoices.length
                }
                label={
                  invoices.length ===
                  1
                    ? "invoice"
                    : "invoices"
                }
                href={
                  quote?.id
                    ? `/quotes/${quote.id}`
                    : "/invoices"
                }
                actionLabel={
                  quote?.id
                    ? "View Quote Hub"
                    : "View Invoices"
                }
              />

              <RelatedCard
                title="Guarantees"
                count={
                  guarantees.length
                }
                label={
                  guarantees.length ===
                  1
                    ? "guarantee"
                    : "guarantees"
                }
                href="/guarantees"
                actionLabel="View Guarantees"
              />
            </div>
          </section>

          {/* INVOICE HISTORY — VIEW ONLY */}

          {invoices.length > 0 && (
            <RecordSection
              title="Linked Invoices"
              subtitle="Invoices created from this contract"
            >
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
                      (invoice) => (
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
            </RecordSection>
          )}

          {/* GUARANTEES — VIEW ONLY */}

          {guarantees.length > 0 && (
            <RecordSection
              title="Linked Guarantees"
              subtitle="Guarantees connected to this contract"
            >
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
            </RecordSection>
          )}

          {/* CONTRACT ACTIVITY */}

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Contract Activity
            </h2>

            <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <DetailRow
                label="Sent To"
                value={
                  contract.sent_to ||
                  "Not sent"
                }
              />

              <DetailRow
                label="Sent"
                value={formatDateTime(
                  contract.sent_at
                )}
              />

              <DetailRow
                label="Viewed"
                value={formatDateTime(
                  contract.viewed_at
                )}
              />

              <DetailRow
                label="Signed"
                value={formatDateTime(
                  contract.signed_at
                )}
              />
            </div>
          </section>

          {/* CUSTOMER CONTRACT */}

          {contract.public_token && (
            <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Customer Contract Link
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                This is the secure customer-facing contract page.
              </p>

              <Link
                href={`/c/${contract.public_token}`}
                target="_blank"
                className="mt-5 inline-flex rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Preview Customer Contract →
              </Link>
            </section>
          )}
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
   RELATED CARD
   ========================================================= */

function RelatedCard({
  title,
  count,
  label,
  href,
  actionLabel,
}: {
  title: string;
  count: number;
  label: string;
  href?: string;
  actionLabel: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </p>

      <p className="mt-2 text-2xl font-bold text-slate-900">
        {count}
      </p>

      <p className="mt-1 text-sm text-slate-500">
        {label}
      </p>

      {href && (
        <Link
          href={href}
          className="mt-4 inline-flex text-sm font-semibold text-slate-900 hover:underline"
        >
          {actionLabel} →
        </Link>
      )}
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
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-5">
        <h2 className="text-xl font-semibold text-slate-900">
          {title}
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          {subtitle}
        </p>
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
    status === "Signed" ||
    status === "Paid" ||
    status === "Issued" ||
    status === "Completed"
      ? "bg-emerald-100 text-emerald-800"

      : status === "Part Paid" ||
          status === "Expired"
        ? "bg-amber-100 text-amber-800"

        : status === "Sent" ||
            status === "Viewed" ||
            status === "Scheduled" ||
            status === "Work" ||
            status === "Survey"
          ? "bg-blue-100 text-blue-800"

          : status === "Cancelled" ||
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
   CURRENCY
   ========================================================= */

function formatCurrency(
  value:
    | number
    | string
    | null
) {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "GBP",
    }
  ).format(
    Number(
      value ?? 0
    )
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
   DATE / TIME
   ========================================================= */

function formatDateTime(
  value: string | null
) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone:
        "Europe/London",

      day: "2-digit",
      month: "short",
      year: "numeric",

      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(
    new Date(value)
  );
}