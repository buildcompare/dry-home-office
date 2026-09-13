import Link from "next/link";
import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";

type QuotePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function QuotePage({
  params,
}: QuotePageProps) {
  const { id } = await params;

  const supabase = await createClient();

  const { data: quote, error } = await supabase
    .from("quotes")
    .select(`
      id,
      quote_number,
      client_id,
      job_id,
      title,
      status,
      quote_date,
      valid_until,
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

  if (error || !quote) {
    notFound();
  }

  const { data: items, error: itemsError } =
    await supabase
      .from("quote_items")
      .select(`
        id,
        description,
        quantity,
        unit,
        unit_price,
        sort_order
      `)
      .eq("quote_id", id)
      .order("sort_order", {
        ascending: true,
      });

  if (itemsError) {
    console.error(itemsError);
  }

  const clientData = Array.isArray(quote.clients)
    ? quote.clients[0]
    : quote.clients;

  const jobData = Array.isArray(quote.jobs)
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

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
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
                  {quote.quote_number}
                </p>

                <h1 className="mt-1 text-3xl font-bold text-slate-900">
                  {quote.title || "Untitled Quote"}
                </h1>

                <p className="mt-2 text-slate-500">
                  {clientName}
                </p>
              </div>

              <StatusBadge status={quote.status} />
            </div>
          </div>

          {/* Summary cards */}
          <div className="mb-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Quote Total"
              value={formatCurrency(quote.amount)}
            />

            <SummaryCard
              title="Quote Date"
              value={formatDate(quote.quote_date)}
            />

            <SummaryCard
              title="Valid Until"
              value={formatDate(quote.valid_until)}
            />

            <SummaryCard
              title="Status"
              value={quote.status}
            />
          </div>

          {/* Client and job */}
          <div className="grid gap-6 lg:grid-cols-2">
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
                  value={clientName}
                />

                <DetailRow
                  label="Email"
                  value={clientData?.email}
                />

                <DetailRow
                  label="Phone"
                  value={clientData?.phone}
                />

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Address
                  </p>

                  <div className="mt-1 text-sm leading-6 text-slate-700">
                    {clientData?.address_line_1 ? (
                      <>
                        <p>
                          {clientData.address_line_1}
                        </p>

                        {clientData.address_line_2 && (
                          <p>
                            {clientData.address_line_2}
                          </p>
                        )}

                        {clientData.town && (
                          <p>{clientData.town}</p>
                        )}

                        {clientData.county && (
                          <p>{clientData.county}</p>
                        )}

                        {clientData.postcode && (
                          <p className="font-medium">
                            {clientData.postcode}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-slate-400">
                        No address recorded
                      </p>
                    )}
                  </div>
                </div>
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
                    value={jobData.job_number}
                  />

                  <DetailRow
                    label="Job Title"
                    value={jobData.title}
                  />

                  <DetailRow
                    label="Job Type"
                    value={jobData.job_type}
                  />

                  <DetailRow
                    label="Job Status"
                    value={jobData.status}
                  />
                </div>
              ) : (
                <p className="mt-5 text-sm text-slate-400">
                  This quote is not linked to a job.
                </p>
              )}
            </section>
          </div>

          {/* Quote items */}
          <section className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="text-xl font-semibold text-slate-900">
                Quote Items
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Work and materials included in this quotation.
              </p>
            </div>

            {!items || items.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                No quote items recorded.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <Heading>Description</Heading>
                      <Heading right>
                        Quantity
                      </Heading>
                      <Heading>Unit</Heading>
                      <Heading right>
                        Unit Price
                      </Heading>
                      <Heading right>
                        Total
                      </Heading>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {items.map((item) => {
                      const quantity =
                        Number(item.quantity) || 0;

                      const unitPrice =
                        Number(item.unit_price) || 0;

                      const lineTotal =
                        quantity * unitPrice;

                      return (
                        <tr key={item.id}>
                          <td className="px-6 py-5 text-sm text-slate-700">
                            {item.description}
                          </td>

                          <td className="px-6 py-5 text-right text-sm text-slate-600">
                            {formatQuantity(quantity)}
                          </td>

                          <td className="px-6 py-5 text-sm text-slate-600">
                            {item.unit || "—"}
                          </td>

                          <td className="px-6 py-5 text-right text-sm text-slate-600">
                            {formatCurrency(unitPrice)}
                          </td>

                          <td className="px-6 py-5 text-right text-sm font-semibold text-slate-900">
                            {formatCurrency(lineTotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-5 text-right font-semibold text-slate-700"
                      >
                        Quote Total
                      </td>

                      <td className="px-6 py-5 text-right text-xl font-bold text-slate-900">
                        {formatCurrency(
                          quote.amount
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>

          {/* Customer message and terms */}
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

          {/* Internal notes */}
          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Internal Notes
            </h2>

            <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {quote.internal_notes ||
                "No internal notes recorded."}
            </p>
          </section>

          {/* Email status */}
          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Quote Activity
            </h2>

            <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <ActivityItem
                label="Sent To"
                value={quote.sent_to || "Not sent"}
              />

              <ActivityItem
                label="Sent"
                value={formatDateTime(
                  quote.sent_at
                )}
              />

              <ActivityItem
                label="Viewed"
                value={formatDateTime(
                  quote.viewed_at
                )}
              />

              <ActivityItem
                label={
                  quote.status === "Declined"
                    ? "Declined"
                    : "Accepted"
                }
                value={formatDateTime(
                  quote.status === "Declined"
                    ? quote.declined_at
                    : quote.accepted_at
                )}
              />
            </div>

            <p className="mt-6 text-sm text-slate-500">
              PDF generation and direct email sending will be added here next.
            </p>
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
        {value || "Not recorded"}
      </p>
    </div>
  );
}

function ActivityItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-medium text-slate-700">
        {value}
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
      : status === "Declined"
        ? "bg-red-100 text-red-800"
        : status === "Sent"
          ? "bg-blue-100 text-blue-800"
          : status === "Expired"
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
        right ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function formatCurrency(
  value: number | string | null
) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value ?? 0));
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 2,
  }).format(value);
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

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(
    new Date(
      Date.UTC(year, month - 1, day)
    )
  );
}

function formatDateTime(
  value: string | null
) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}