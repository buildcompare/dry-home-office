import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";

export default async function ContractsPage() {
  const supabase =
    await createClient();

  const { data: contracts } =
    await supabase
      .from("contracts")
      .select(`
        id,
        contract_number,
        title,
        status,
        contract_date,
        amount,
        signed_at,
        created_at,
        clients (
          id,
          display_name,
          first_name,
          last_name
        ),
        jobs (
          id,
          job_number,
          title
        ),
        quotes (
          id,
          quote_number
        )
      `)
      .order(
        "created_at",
        {
          ascending: false,
        }
      );

  const rows =
    contracts ?? [];

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Contracts
              </h1>

              <p className="mt-2 text-slate-500">
                Manage customer contracts
                linked to accepted quotes and
                jobs.
              </p>
            </div>

            <Link
              href="/contracts/new"
              className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700"
            >
              + Create Contract
            </Link>
          </div>

          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            {rows.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-slate-500">
                  No contracts created yet.
                </p>

                <Link
                  href="/contracts/new"
                  className="mt-4 inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Create First Contract
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <Heading>
                        Contract
                      </Heading>

                      <Heading>
                        Client
                      </Heading>

                      <Heading>
                        Job
                      </Heading>

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
                        Value
                      </Heading>

                      <Heading right>
                        View
                      </Heading>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {rows.map(
                      (contract) => {
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
                          <tr
                            key={
                              contract.id
                            }
                            className="hover:bg-slate-50"
                          >
                            <td className="px-6 py-5">
                              <p className="font-semibold text-slate-900">
                                {
                                  contract.contract_number
                                }
                              </p>

                              <p className="mt-1 text-sm text-slate-500">
                                {
                                  contract.title ||
                                  "Contract"
                                }
                              </p>
                            </td>

                            <td className="px-6 py-5 text-sm text-slate-700">
                              {
                                clientName
                              }
                            </td>

                            <td className="px-6 py-5 text-sm text-slate-600">
                              {job
                                ? job.job_number
                                : "—"}
                            </td>

                            <td className="px-6 py-5 text-sm text-slate-600">
                              {quote
                                ? quote.quote_number
                                : "—"}
                            </td>

                            <td className="px-6 py-5">
                              <StatusBadge
                                status={
                                  contract.status
                                }
                              />
                            </td>

                            <td className="px-6 py-5 text-sm text-slate-600">
                              {formatDate(
                                contract.contract_date
                              )}
                            </td>

                            <td className="px-6 py-5 text-right text-sm font-semibold text-slate-900">
                              {formatCurrency(
                                contract.amount
                              )}
                            </td>

                            <td className="px-6 py-5 text-right">
                              <Link
                                href={`/contracts/${contract.id}`}
                                className="text-sm font-semibold text-slate-900 hover:underline"
                              >
                                View
                              </Link>
                            </td>
                          </tr>
                        );
                      }
                    )}
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
        right
          ? "text-right"
          : "text-left"
      }`}
    >
      {children}
    </th>
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
      className={`rounded-full px-3 py-1 text-xs font-semibold ${classes}`}
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