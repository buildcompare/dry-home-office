import Link from "next/link";
import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import EmailGuaranteeButton from "@/components/EmailGuaranteeButton";
import { createClient } from "@/lib/supabase/server";

type GuaranteePageProps = {
  params: Promise<{
    id: string;
  }>;

  searchParams: Promise<{
    error?: string;
    sent?: string;
  }>;
};

export default async function GuaranteePage({
  params,
  searchParams,
}: GuaranteePageProps) {
  const { id } = await params;
  const query =
    await searchParams;

  const supabase =
    await createClient();

  const {
    data: guarantee,
    error,
  } = await supabase
    .from("guarantees")
    .select(`
      id,
      guarantee_number,
      client_id,
      job_id,
      contract_id,
      invoice_id,
      guarantee_type,
      title,
      status,
      issue_date,
      duration_years,
      expiry_date,
      covered_works,
      terms,
      exclusions,
      customer_message,
      internal_notes,
      public_token,
      sent_to,
      sent_at,
      viewed_at,
      created_at,
      updated_at,
      clients (
        id,
        display_name,
        email,
        phone
      ),
      jobs (
        id,
        job_number,
        title,
        status
      ),
      contracts (
        id,
        contract_number,
        title,
        status
      ),
      invoices (
        id,
        invoice_number,
        invoice_type,
        status,
        amount,
        amount_paid
      )
    `)
    .eq("id", id)
    .single();

  if (
    error ||
    !guarantee
  ) {
    notFound();
  }

  const client =
    Array.isArray(
      guarantee.clients
    )
      ? guarantee.clients[0]
      : guarantee.clients;

  const job =
    Array.isArray(
      guarantee.jobs
    )
      ? guarantee.jobs[0]
      : guarantee.jobs;

  const contract =
    Array.isArray(
      guarantee.contracts
    )
      ? guarantee.contracts[0]
      : guarantee.contracts;

  const invoice =
    Array.isArray(
      guarantee.invoices
    )
      ? guarantee.invoices[0]
      : guarantee.invoices;

  const clientName =
    client?.display_name ||
    "Unknown client";

  const isExpired =
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
      : isExpired
        ? "Expired"
        : guarantee.status;

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-7xl">
          <Link
            href={
              guarantee.invoice_id
                ? `/invoices/${guarantee.invoice_id}`
                : "/invoices"
            }
            className="text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            ← Back to Invoice
          </Link>

          {query.error && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
              {query.error}
            </div>
          )}

          {query.sent ===
            "1" && (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800">
              Guarantee sent successfully to{" "}
              {guarantee.sent_to ||
                client?.email}.
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-emerald-700">
                {
                  guarantee.guarantee_number
                }
              </p>

              <h1 className="mt-1 text-3xl font-bold text-slate-900">
                {guarantee.title ||
                  "Works Guarantee"}
              </h1>

              <p className="mt-2 text-slate-500">
                {clientName}
              </p>
            </div>

            <StatusBadge
              status={
                displayStatus
              }
            />
          </div>

          {!client?.email && (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              This client does not have an email address saved, so the guarantee cannot be emailed yet.
            </div>
          )}

          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Guarantee Type"
              value={
                guarantee.guarantee_type ||
                "Not specified"
              }
            />

            <SummaryCard
              title="Issue Date"
              value={formatDate(
                guarantee.issue_date
              )}
            />

            <SummaryCard
              title="Guarantee Period"
              value={
                guarantee.duration_years
                  ? `${guarantee.duration_years} ${
                      guarantee.duration_years ===
                      1
                        ? "year"
                        : "years"
                    }`
                  : "Not specified"
              }
            />

            <SummaryCard
              title="Expiry Date"
              value={formatDate(
                guarantee.expiry_date
              )}
            />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-4">
            <InfoCard
              title="Client"
              value={
                clientName
              }
              href={
                client?.id
                  ? `/clients/${client.id}`
                  : undefined
              }
            />

            <InfoCard
              title="Job"
              value={
                job?.job_number ||
                "No linked job"
              }
              href={
                job?.id
                  ? `/jobs/${job.id}`
                  : undefined
              }
            />

            <InfoCard
              title="Contract"
              value={
                contract?.contract_number ||
                "No linked contract"
              }
              href={
                contract?.id
                  ? `/contracts/${contract.id}`
                  : undefined
              }
            />

            <InfoCard
              title="Invoice"
              value={
                invoice?.invoice_number ||
                "No linked invoice"
              }
              href={
                invoice?.id
                  ? `/invoices/${invoice.id}`
                  : undefined
              }
            />
          </div>

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">
              Covered Works
            </h2>

            <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {guarantee.covered_works ||
                "No covered works have been recorded."}
            </p>
          </section>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                Guarantee Terms
              </h2>

              <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {guarantee.terms ||
                  "No guarantee terms have been recorded."}
              </p>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                Exclusions
              </h2>

              <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {guarantee.exclusions ||
                  "No exclusions have been recorded."}
              </p>
            </section>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Customer Message
              </h2>

              <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {guarantee.customer_message ||
                  "No customer message recorded."}
              </p>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Internal Notes
              </h2>

              <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {guarantee.internal_notes ||
                  "No internal notes recorded."}
              </p>
            </section>
          </div>

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Guarantee Activity
            </h2>

            <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <DetailRow
                label="Status"
                value={
                  displayStatus
                }
              />

              <DetailRow
                label="Sent To"
                value={
                  guarantee.sent_to ||
                  "Not sent"
                }
              />

              <DetailRow
                label="Sent"
                value={formatDateTime(
                  guarantee.sent_at
                )}
              />

              <DetailRow
                label="Viewed"
                value={formatDateTime(
                  guarantee.viewed_at
                )}
              />
            </div>
          </section>

          {guarantee.public_token && (
            <section className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Customer Guarantee
              </p>

              <h2 className="mt-2 text-lg font-semibold text-slate-900">
                Secure Customer View
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Preview the customer guarantee or send the secure guarantee link by email.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href={`/g/${guarantee.public_token}`}
                  target="_blank"
                  className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Preview Guarantee
                </Link>

                <EmailGuaranteeButton
                  guaranteeId={
                    guarantee.id
                  }
                  recipient={
                    client?.email ||
                    null
                  }
                  status={
                    guarantee.status
                  }
                />
              </div>
            </section>
          )}

          <section className="mt-8 rounded-2xl bg-slate-900 p-6 text-white shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Guarantee Summary
            </p>

            <div className="mt-5 grid gap-6 md:grid-cols-3">
              <div>
                <p className="text-sm text-slate-400">
                  Customer
                </p>

                <p className="mt-1 font-semibold">
                  {clientName}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-400">
                  Guarantee
                </p>

                <p className="mt-1 font-semibold">
                  {
                    guarantee.guarantee_number
                  }
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-400">
                  Valid Until
                </p>

                <p className="mt-1 font-semibold">
                  {formatDate(
                    guarantee.expiry_date
                  )}
                </p>
              </div>
            </div>
          </section>
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

function InfoCard({
  title,
  value,
  href,
}: {
  title: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </p>

      {href ? (
        <Link
          href={
            href
          }
          className="mt-2 block font-semibold text-slate-900 hover:underline"
        >
          {value}
        </Link>
      ) : (
        <p className="mt-2 font-semibold text-slate-900">
          {value}
        </p>
      )}
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
    status === "Issued"
      ? "bg-emerald-100 text-emerald-800"
      : status === "Viewed"
        ? "bg-blue-100 text-blue-800"
        : status === "Expired"
          ? "bg-amber-100 text-amber-800"
          : status === "Cancelled"
            ? "bg-red-100 text-red-700"
            : "bg-slate-200 text-slate-700";

  return (
    <span
      className={`rounded-full px-4 py-2 text-sm font-semibold ${classes}`}
    >
      {status}
    </span>
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