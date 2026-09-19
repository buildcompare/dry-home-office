import Link from "next/link";
import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import EmailQuoteButton from "@/components/EmailQuoteButton";
import { createClient } from "@/lib/supabase/server";

type QuotePageProps = {
  params: Promise<{
    id: string;
  }>;

  searchParams: Promise<{
    sent?: string;
    error?: string;
    warning?: string;
  }>;
};

export default async function QuotePage({
  params,
  searchParams,
}: QuotePageProps) {
  const { id } = await params;
  const query = await searchParams;

  const supabase =
    await createClient();

  const {
    data: quote,
    error,
  } = await supabase
    .from("quotes")
    .select(`
      id,
      quote_number,
      client_id,
      job_id,
      title,
      description,
      status,
      quote_date,
      valid_until,
      subtotal,
      vat_enabled,
      vat_rate,
      vat_amount,
      amount,
      customer_message,
      terms,
      internal_notes,
      sent_to,
      sent_at,
      viewed_at,
      accepted_at,
      declined_at,
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
      )
    `)
    .eq("id", id)
    .single();

  if (
    error ||
    !quote
  ) {
    notFound();
  }

  const [
    itemsResult,
    contractResult,
  ] = await Promise.all([
    supabase
      .from("quote_items")
      .select(`
        id,
        description,
        quantity,
        unit,
        unit_price,
        item_type,
        sort_order
      `)
      .eq("quote_id", id)
      .order("sort_order", {
        ascending: true,
      }),

    supabase
      .from("contracts")
      .select(`
        id,
        contract_number,
        title,
        status,
        signed_at,
        created_at
      `)
      .eq("quote_id", id)
      .neq(
        "status",
        "Cancelled"
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(1),
  ]);

  const items =
    itemsResult.data ?? [];

  const linkedContract =
    contractResult.data &&
    contractResult.data.length >
      0
      ? contractResult.data[0]
      : null;

  const clientData =
    Array.isArray(
      quote.clients
    )
      ? quote.clients[0]
      : quote.clients;

  const jobData =
    Array.isArray(
      quote.jobs
    )
      ? quote.jobs[0]
      : quote.jobs;

  const clientName =
    clientData?.display_name ||
    [
      clientData?.first_name,
      clientData?.last_name,
    ]
      .filter(Boolean)
      .join(" ") ||
    "Unknown client";

  const labourItems =
    items.filter(
      (item) =>
        item.item_type !==
        "Materials"
    );

  const materialItems =
    items.filter(
      (item) =>
        item.item_type ===
        "Materials"
    );

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-7xl">
          {query.sent ===
            "1" && (
            <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800">
              Quote emailed successfully to{" "}
              {quote.sent_to ||
                clientData?.email}.
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
              href="/quotes"
              className="text-sm font-medium text-slate-500 hover:text-slate-900"
            >
              ← Back to Quotes
            </Link>

            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  {
                    quote.quote_number
                  }
                </p>

                <h1 className="mt-1 text-3xl font-bold text-slate-900">
                  {quote.title}
                </h1>

                <p className="mt-2 text-slate-500">
                  {clientName}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={`/quotes/${quote.id}/pdf`}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Download PDF
                </a>

                <EmailQuoteButton
                  quoteId={
                    quote.id
                  }
                  recipient={
                    clientData?.email ||
                    null
                  }
                  status={
                    quote.status
                  }
                />

                {quote.status ===
                  "Accepted" &&
                  !linkedContract && (
                    <Link
                      href={`/contracts/new?quote=${quote.id}`}
                      className="rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800"
                    >
                      Create Contract
                    </Link>
                  )}

                {linkedContract && (
                  <Link
                    href={`/contracts/${linkedContract.id}`}
                    className="rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800"
                  >
                    View Contract
                  </Link>
                )}

                <StatusBadge
                  status={
                    quote.status
                  }
                />
              </div>
            </div>

            {!clientData?.email && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                This client does not have an email address saved. Add an email to the client record before emailing the quote.
              </div>
            )}
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Total"
              value={formatCurrency(
                quote.amount
              )}
            />

            <SummaryCard
              title="Quote Date"
              value={formatDate(
                quote.quote_date
              )}
            />

            <SummaryCard
              title="Valid Until"
              value={formatDate(
                quote.valid_until
              )}
            />

            <SummaryCard
              title="Status"
              value={
                quote.status
              }
            />
          </div>

          {linkedContract && (
            <section className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Contract Created
                  </p>

                  <h2 className="mt-2 text-lg font-bold text-emerald-950">
                    {
                      linkedContract.contract_number
                    }
                  </h2>

                  <p className="mt-1 text-sm text-emerald-800">
                    {linkedContract.title ||
                      "Contract"}{" "}
                    ·{" "}
                    {
                      linkedContract.status
                    }
                  </p>
                </div>

                <Link
                  href={`/contracts/${linkedContract.id}`}
                  className="rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800"
                >
                  View Contract
                </Link>
              </div>
            </section>
          )}

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Title
            </p>

            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              {quote.title}
            </h2>

            <div className="mt-6 border-t border-slate-200 pt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Description / Scope of Works
              </p>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {quote.description ||
                  "No description recorded."}
              </p>
            </div>
          </section>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
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
                  label="Email"
                  value={
                    clientData?.email
                  }
                />

                <DetailRow
                  label="Phone"
                  value={
                    clientData?.phone
                  }
                />
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">
                  Linked Job
                </h2>

                {jobData?.id && (
                  <Link
                    href={`/jobs/${jobData.id}`}
                    className="text-sm font-semibold text-slate-700 hover:underline"
                  >
                    View Job →
                  </Link>
                )}
              </div>

              {jobData ? (
                <div className="mt-5 space-y-4">
                  <DetailRow
                    label="Job Number"
                    value={
                      jobData.job_number
                    }
                  />

                  <DetailRow
                    label="Job Title"
                    value={
                      jobData.title
                    }
                  />

                  <DetailRow
                    label="Job Type"
                    value={
                      jobData.job_type
                    }
                  />

                  <DetailRow
                    label="Job Status"
                    value={
                      jobData.status
                    }
                  />
                </div>
              ) : (
                <p className="mt-5 text-sm text-slate-500">
                  This quote is not linked to a job.
                </p>
              )}
            </section>
          </div>

          <QuoteSection
            title="Labour"
            description="Labour included within this quotation."
            items={
              labourItems
            }
          />

          <QuoteSection
            title="Materials"
            description="Materials included within this quotation."
            items={
              materialItems
            }
          />

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <div className="ml-auto max-w-md">
              <TotalRow
                label="Subtotal"
                value={formatCurrency(
                  quote.subtotal
                )}
              />

              {quote.vat_enabled && (
                <TotalRow
                  label={`VAT (${formatVatRate(
                    quote.vat_rate
                  )}%)`}
                  value={formatCurrency(
                    quote.vat_amount
                  )}
                />
              )}

              <div className="mt-4 flex items-center justify-between border-t-2 border-slate-900 pt-5">
                <span className="text-xl font-bold text-slate-900">
                  Total
                </span>

                <span className="text-2xl font-bold text-slate-900">
                  {formatCurrency(
                    quote.amount
                  )}
                </span>
              </div>

              {!quote.vat_enabled && (
                <p className="mt-3 text-right text-xs text-slate-500">
                  VAT not added
                </p>
              )}
            </div>
          </section>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Customer Message
              </h2>

              <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {quote.customer_message ||
                  "No customer message recorded."}
              </p>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Terms
              </h2>

              <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {quote.terms ||
                  "No terms recorded."}
              </p>
            </section>
          </div>

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Internal Notes
            </h2>

            <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {quote.internal_notes ||
                "No internal notes recorded."}
            </p>

            <p className="mt-4 text-xs text-slate-400">
              Internal notes are not included on the customer PDF or email.
            </p>
          </section>

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Quote Activity
            </h2>

            <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <DetailRow
                label="Sent To"
                value={
                  quote.sent_to ||
                  "Not sent"
                }
              />

              <DetailRow
                label="Sent"
                value={formatDateTime(
                  quote.sent_at
                )}
              />

              <DetailRow
                label="Viewed"
                value={formatDateTime(
                  quote.viewed_at
                )}
              />

              <DetailRow
                label={
                  quote.status ===
                  "Declined"
                    ? "Declined"
                    : "Accepted"
                }
                value={formatDateTime(
                  quote.status ===
                    "Declined"
                    ? quote.declined_at
                    : quote.accepted_at
                )}
              />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function QuoteSection({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: {
    id: string;
    description: string;
    quantity:
      | number
      | string;
    unit: string | null;
    unit_price:
      | number
      | string;
  }[];
}) {
  return (
    <section className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-5">
        <h2 className="text-xl font-semibold text-slate-900">
          {title}
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          {description}
        </p>
      </div>

      {items.length ===
      0 ? (
        <div className="p-8 text-sm text-slate-500">
          No{" "}
          {title.toLowerCase()}{" "}
          items recorded.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <Heading>
                  Item
                </Heading>

                <Heading right>
                  Qty
                </Heading>

                <Heading>
                  Unit
                </Heading>

                <Heading right>
                  Unit Price
                </Heading>

                <Heading right>
                  Total
                </Heading>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {items.map(
                (item) => {
                  const quantity =
                    Number(
                      item.quantity
                    );

                  const unitPrice =
                    Number(
                      item.unit_price
                    );

                  const total =
                    quantity *
                    unitPrice;

                  return (
                    <tr
                      key={
                        item.id
                      }
                    >
                      <td className="px-6 py-5 text-sm font-medium text-slate-800">
                        {
                          item.description
                        }
                      </td>

                      <td className="px-6 py-5 text-right text-sm text-slate-600">
                        {formatQuantity(
                          quantity
                        )}
                      </td>

                      <td className="px-6 py-5 text-sm text-slate-600">
                        {item.unit ||
                          "—"}
                      </td>

                      <td className="px-6 py-5 text-right text-sm text-slate-600">
                        {formatCurrency(
                          unitPrice
                        )}
                      </td>

                      <td className="px-6 py-5 text-right text-sm font-semibold text-slate-900">
                        {formatCurrency(
                          total
                        )}
                      </td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function TotalRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 py-4">
      <span className="font-medium text-slate-600">
        {label}
      </span>

      <span className="font-semibold text-slate-900">
        {value}
      </span>
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
    status === "Accepted"
      ? "bg-emerald-100 text-emerald-800"
      : status ===
          "Declined"
        ? "bg-red-100 text-red-800"
        : status ===
            "Sent"
          ? "bg-blue-100 text-blue-800"
          : status ===
              "Viewed"
            ? "bg-violet-100 text-violet-800"
            : status ===
                "Expired"
              ? "bg-amber-100 text-amber-800"
              : "bg-slate-100 text-slate-700";

  return (
    <span
      className={`rounded-full px-4 py-2 text-sm font-semibold ${classes}`}
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

function formatQuantity(
  value: number
) {
  return new Intl.NumberFormat(
    "en-GB",
    {
      maximumFractionDigits: 2,
    }
  ).format(
    value
  );
}

function formatVatRate(
  value:
    | number
    | string
    | null
) {
  return Number(
    value ?? 20
  ).toLocaleString(
    "en-GB",
    {
      maximumFractionDigits: 2,
    }
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