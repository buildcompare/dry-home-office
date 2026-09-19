import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";

export default async function GuaranteesPage() {
  const supabase = await createClient();

  const {
    data: guarantees,
    error,
  } = await supabase
    .from("guarantees")
    .select(`
      id,
      guarantee_number,
      guarantee_type,
      title,
      status,
      issue_date,
      expiry_date,
      sent_at,
      viewed_at,
      clients (
        id,
        display_name
      )
    `)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    console.error(
      "Guarantees load error:",
      error
    );
  }

  const rows = guarantees ?? [];

  const draftCount =
    rows.filter(
      (item) =>
        item.status === "Draft"
    ).length;

  const issuedCount =
    rows.filter(
      (item) =>
        item.status === "Issued"
    ).length;

  const viewedCount =
    rows.filter(
      (item) =>
        item.status === "Viewed"
    ).length;

  const activeCount =
    rows.filter((item) => {
      if (
        item.status ===
        "Cancelled"
      ) {
        return false;
      }

      if (!item.expiry_date) {
        return true;
      }

      return (
        new Date(
          `${item.expiry_date}T23:59:59`
        ) >= new Date()
      );
    }).length;

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Guarantees
              </h1>

              <p className="mt-2 text-slate-500">
                View and manage customer guarantees.
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Draft"
              value={String(
                draftCount
              )}
            />

            <SummaryCard
              title="Issued"
              value={String(
                issuedCount
              )}
            />

            <SummaryCard
              title="Viewed"
              value={String(
                viewedCount
              )}
            />

            <SummaryCard
              title="Active"
              value={String(
                activeCount
              )}
            />
          </div>

          <section className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="text-xl font-semibold text-slate-900">
                All Guarantees
              </h2>
            </div>

            {rows.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                No guarantees have been created yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <Heading>
                        Guarantee
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
                    {rows.map(
                      (guarantee) => {
                        const client =
                          Array.isArray(
                            guarantee.clients
                          )
                            ? guarantee.clients[0]
                            : guarantee.clients;

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
                            className="hover:bg-slate-50"
                          >
                            <td className="px-6 py-5">
                              <p className="text-sm font-semibold text-slate-900">
                                {
                                  guarantee.guarantee_number
                                }
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                {guarantee.title ||
                                  "Works Guarantee"}
                              </p>
                            </td>

                            <td className="px-6 py-5 text-sm text-slate-700">
                              {client?.display_name ||
                                "Unknown client"}
                            </td>

                            <td className="px-6 py-5 text-sm text-slate-700">
                              {guarantee.guarantee_type ||
                                "Not specified"}
                            </td>

                            <td className="px-6 py-5">
                              <StatusBadge
                                status={
                                  displayStatus
                                }
                              />
                            </td>

                            <td className="px-6 py-5 text-sm text-slate-600">
                              {formatDate(
                                guarantee.issue_date
                              )}
                            </td>

                            <td className="px-6 py-5 text-sm text-slate-600">
                              {formatDate(
                                guarantee.expiry_date
                              )}
                            </td>

                            <td className="px-6 py-5 text-right">
                              <Link
                                href={`/guarantees/${guarantee.id}`}
                                className="inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
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

      <p className="mt-2 text-3xl font-bold text-slate-900">
        {value}
      </p>
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
      className={`px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 ${
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
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${classes}`}
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