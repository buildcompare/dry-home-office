import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";

export default async function QuotesPage() {
  const supabase = await createClient();

  const { data: quotes, error } = await supabase
    .from("quotes")
    .select(`
      id,
      quote_number,
      title,
      status,
      quote_date,
      valid_until,
      amount,
      created_at,
      clients (
        display_name,
        first_name,
        last_name
      ),
      jobs (
        id,
        job_number,
        title
      )
    `)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    console.error(error);
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">
                DryHome Office
              </p>

              <h1 className="mt-1 text-3xl font-bold text-slate-900">
                Quotes
              </h1>

              <p className="mt-2 text-slate-500">
                {quotes?.length ?? 0} quote records
              </p>
            </div>

            <Link
              href="/quotes/new"
              className="rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-700"
            >
              + Create Quote
            </Link>
          </div>

          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            {!quotes || quotes.length === 0 ? (
              <div className="p-12 text-center">
                <h2 className="text-lg font-semibold text-slate-900">
                  No quotes yet
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  Create your first DryHome quotation.
                </p>

                <Link
                  href="/quotes/new"
                  className="mt-6 inline-flex rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white"
                >
                  Create First Quote
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      <Heading>Quote</Heading>
                      <Heading>Client</Heading>
                      <Heading>Job</Heading>
                      <Heading>Status</Heading>
                      <Heading>Date</Heading>
                      <Heading right>Amount</Heading>
                      <Heading right>View</Heading>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {quotes.map((quote) => {
                      const clientData =
                        Array.isArray(quote.clients)
                          ? quote.clients[0]
                          : quote.clients;

                      const jobData =
                        Array.isArray(quote.jobs)
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
                        <tr
                          key={quote.id}
                          className="hover:bg-slate-50"
                        >
                          <td className="px-6 py-5">
                            <Link
                              href={`/quotes/${quote.id}`}
                              className="font-semibold text-slate-900 hover:underline"
                            >
                              {quote.quote_number}
                            </Link>

                            <p className="mt-1 text-sm text-slate-500">
                              {quote.title || "Untitled quote"}
                            </p>
                          </td>

                          <td className="px-6 py-5 text-sm text-slate-700">
                            {clientName}
                          </td>

                          <td className="px-6 py-5 text-sm text-slate-600">
                            {jobData ? (
                              <Link
                                href={`/jobs/${jobData.id}`}
                                className="font-medium hover:underline"
                              >
                                {jobData.job_number}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </td>

                          <td className="px-6 py-5">
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                              {quote.status}
                            </span>
                          </td>

                          <td className="px-6 py-5 text-sm text-slate-600">
                            {formatDate(quote.quote_date)}
                          </td>

                          <td className="px-6 py-5 text-right font-semibold text-slate-900">
                            {formatCurrency(quote.amount)}
                          </td>

                          <td className="px-6 py-5 text-right">
                            <Link
                              href={`/quotes/${quote.id}`}
                              className="font-medium text-slate-900 hover:underline"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
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

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  const [year, month, day] =
    value.slice(0, 10).split("-").map(Number);

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