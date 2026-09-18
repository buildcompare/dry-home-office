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

  const supabase =
    await createClient();

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

  if (error || !contract) {
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

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-7xl">
          {query.sent === "1" && (
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

          <div className="mb-8">
            <Link
              href="/contracts"
              className="text-sm font-medium text-slate-500 hover:text-slate-900"
            >
              ← Back to Contracts
            </Link>

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

                {contract.status ===
                  "Signed" && (
                  <Link
                    href={`/invoices/new?contract=${contract.id}`}
                    className="rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800"
                  >
                    Create Invoice
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
                This client does not have an email
                address saved. Add an email to the
                client record before sending the
                contract.
              </div>
            )}
          </div>

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
                  ? formatDateTime(
                      contract.signed_at
                    )
                  : "Not signed"
              }
            />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
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
                  value={clientName}
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

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">
                  Quote
                </h2>

                {quote?.id && (
                  <Link
                    href={`/quotes/${quote.id}`}
                    className="text-sm font-semibold text-slate-700 hover:underline"
                  >
                    View Quote →
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

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">
              Scope of Works
            </h2>

            <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {contract.description ||
                "No scope of works recorded."}
            </p>
          </section>

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">
              Terms & Conditions
            </h2>

            <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {contract.terms ||
                "No terms recorded."}
            </p>
          </section>

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
                Internal notes are not shown to
                the customer.
              </p>
            </section>
          </div>

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

          {contract.status ===
            "Signed" && (
            <section className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Signed Contract
                  </p>

                  <h2 className="mt-2 text-xl font-bold text-emerald-950">
                    Agreement Recorded
                  </h2>
                </div>

                <span className="rounded-full bg-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-900">
                  Signed
                </span>
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

          {contract.public_token && (
            <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Customer Contract Link
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                This is the secure customer-facing
                contract page.
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
    status === "Signed"
      ? "bg-emerald-100 text-emerald-800"
      : status === "Sent"
        ? "bg-blue-100 text-blue-800"
        : status === "Viewed"
          ? "bg-violet-100 text-violet-800"
          : status === "Cancelled"
            ? "bg-red-100 text-red-800"
            : "bg-slate-100 text-slate-700";

  return (
    <span
      className={`rounded-full px-4 py-2 text-sm font-semibold ${classes}`}
    >
      {status}
    </span>
  );
}

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
    Number(value ?? 0)
  );
}

function formatDate(
  value: string | null
) {
  if (!value) {
    return "Not set";
  }

  const [year, month, day] =
    value
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