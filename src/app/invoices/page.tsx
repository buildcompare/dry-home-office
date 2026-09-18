import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";

export default async function InvoicesPage() {
  const supabase =
    await createClient();

  const { data: invoices } =
    await supabase
      .from("invoices")
      .select(`
        id,
        invoice_number,
        title,
        invoice_type,
        status,
        invoice_date,
        due_date,
        amount,
        amount_paid,
        paid_at,
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
        contracts (
          id,
          contract_number
        )
      `)
      .order(
        "created_at",
        {
          ascending: false,
        }
      );

  const rows =
    invoices ?? [];

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Invoices
              </h1>

              <p className="mt-2 text-slate-500">
                Manage deposit, interim and final invoices.
              </p>
            </div>

            <Link
              href="/invoices/new"
              className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700"
            >
              + Create Invoice
            </Link>
          </div>

          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            {rows.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-slate-500">
                  No invoices created yet.
                </p>

                <Link
                  href="/invoices/new"
                  className="mt-4 inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Create First Invoice
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <Heading>
                        Invoice
                      </Heading>

                      <Heading>
                        Client
                      </Heading>

                      <Heading>
                        Type
                      </Heading>

                      <Heading>
                        Status
                      </Heading>

                      <Heading>
                        Due
                      </Heading>

                      <Heading right>
                        Total
                      </Heading>

                      <Heading right>
                        Paid
                      </Heading>

                      <Heading right>
                        View
                      </Heading>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {rows.map(
                      (invoice) => {
                        const client =
                          Array.isArray(
                            invoice.clients
                          )
                            ? invoice.clients[0]
                            : invoice.clients;

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
                              invoice.id
                            }
                            className="hover:bg-slate-50"
                          >
                            <td className="px-6 py-5">
                              <p className="font-semibold text-slate-900">
                                {
                                  invoice.invoice_number
                                }
                              </p>

                              <p className="mt-1 text-sm text-slate-500">
                                {
                                  invoice.title ||
                                  "Invoice"
                                }
                              </p>
                            </td>

                            <td className="px-6 py-5 text-sm text-slate-700">
                              {
                                clientName
                              }
                            </td>

                            <td className="px-6 py-5 text-sm text-slate-600">
                              {
                                invoice.invoice_type ||
                                "Final"
                              }
                            </td>

                            <td className="px-6 py-5">
                              <StatusBadge
                                status={
                                  invoice.status
                                }
                              />
                            </td>

                            <td className="px-6 py-5 text-sm text-slate-600">
                              {formatDate(
                                invoice.due_date
                              )}
                            </td>

                            <td className="px-6 py-5 text-right text-sm font-semibold text-slate-900">
                              {formatCurrency(
                                invoice.amount
                              )}
                            </td>

                            <td className="px-6 py-5 text-right text-sm text-slate-700">
                              {formatCurrency(
                                invoice.amount_paid
                              )}
                            </td>

                            <td className="px-6 py-5 text-right">
                              <Link
                                href={`/invoices/${invoice.id}`}
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
    status === "Paid"
      ? "bg-emerald-100 text-emerald-800"
      : status === "Part Paid"
        ? "bg-amber-100 text-amber-800"
        : status === "Sent"
          ? "bg-blue-100 text-blue-800"
          : status === "Viewed"
            ? "bg-violet-100 text-violet-800"
            : status === "Overdue"
              ? "bg-red-100 text-red-800"
              : status === "Cancelled"
                ? "bg-slate-200 text-slate-600"
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