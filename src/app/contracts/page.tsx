import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";

export default async function ContractsPage() {
  const supabase =
    await createClient();

  const [
    contractsResult,
    scheduleResult,
  ] = await Promise.all([
    supabase
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
        amount,
        sent_at,
        viewed_at,
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
        )
      `)
      .order(
        "created_at",
        {
          ascending: false,
        }
      ),

    supabase
      .from(
        "schedule_events"
      )
      .select(`
        id,
        contract_id,
        title,
        status,
        start_date,
        start_time,
        end_date,
        end_time
      `)
      .eq(
        "status",
        "Scheduled"
      )
      .not(
        "contract_id",
        "is",
        null
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
  ]);

  const rows =
    contractsResult.data ??
    [];

  const scheduleEvents =
    scheduleResult.data ??
    [];

  const scheduleByContract =
    new Map<
      string,
      (typeof scheduleEvents)[number]
    >();

  for (
    const event of
    scheduleEvents
  ) {
    if (
      event.contract_id &&
      !scheduleByContract.has(
        event.contract_id
      )
    ) {
      scheduleByContract.set(
        event.contract_id,
        event
      );
    }
  }

  const draftCount =
    rows.filter(
      (contract) =>
        contract.status ===
        "Draft"
    ).length;

  const awaitingCount =
    rows.filter(
      (contract) =>
        contract.status ===
          "Sent" ||
        contract.status ===
          "Viewed"
    ).length;

  const signedCount =
    rows.filter(
      (contract) =>
        contract.status ===
        "Signed"
    ).length;

  const scheduledCount =
    rows.filter(
      (contract) =>
        scheduleByContract.has(
          contract.id
        )
    ).length;

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
                Manage customer contracts and scheduled work.
              </p>
            </div>

            <Link
              href="/contracts/new"
              className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700"
            >
              + Create Contract
            </Link>
          </div>

          <div className="mb-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Draft"
              value={
                draftCount
              }
            />

            <SummaryCard
              title="Awaiting Signature"
              value={
                awaitingCount
              }
            />

            <SummaryCard
              title="Signed"
              value={
                signedCount
              }
            />

            <SummaryCard
              title="Scheduled"
              value={
                scheduledCount
              }
            />
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
                        Contract Status
                      </Heading>

                      <Heading>
                        Schedule
                      </Heading>

                      <Heading right>
                        Value
                      </Heading>

                      <Heading right>
                        Actions
                      </Heading>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {rows.map(
                      (
                        contract
                      ) => {
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

                        const scheduledEvent =
                          scheduleByContract.get(
                            contract.id
                          );

                        const clientName =
                          client?.display_name ||
                          [
                            client?.first_name,
                            client?.last_name,
                          ]
                            .filter(
                              Boolean
                            )
                            .join(
                              " "
                            ) ||
                          "Unknown client";

                        const scheduleHref =
                          contract.job_id
                            ? `/schedule/new?job=${contract.job_id}&contract=${contract.id}&type=Work`
                            : `/schedule/new?client=${contract.client_id}&contract=${contract.id}&type=Work`;

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
                              {job?.job_number ||
                                "—"}
                            </td>

                            <td className="px-6 py-5">
                              <StatusBadge
                                status={
                                  contract.status
                                }
                              />
                            </td>

                            <td className="px-6 py-5">
                              {scheduledEvent ? (
                                <div>
                                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                                    Scheduled
                                  </span>

                                  <p className="mt-2 text-sm font-medium text-slate-700">
                                    {formatScheduleDate(
                                      scheduledEvent.start_date,
                                      scheduledEvent.start_time
                                    )}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-sm text-slate-400">
                                  Not scheduled
                                </span>
                              )}
                            </td>

                            <td className="px-6 py-5 text-right text-sm font-semibold text-slate-900">
                              {formatCurrency(
                                contract.amount
                              )}
                            </td>

                            <td className="px-6 py-5">
                              <div className="flex flex-wrap justify-end gap-2">
                                <Link
                                  href={`/contracts/${contract.id}`}
                                  className="inline-flex min-w-[70px] items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  View
                                </Link>

                                <Link
                                  href={
                                    scheduleHref
                                  }
                                  className="inline-flex min-w-[90px] items-center justify-center rounded-lg border border-slate-900 bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                                >
                                  {scheduledEvent
                                    ? "Reschedule"
                                    : "Schedule"}
                                </Link>

                                {contract.status ===
                                  "Signed" && (
                                  <Link
                                    href={`/invoices/new?contract=${contract.id}`}
                                    className="inline-flex min-w-[120px] items-center justify-center rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                                  >
                                    Create Invoice
                                  </Link>
                                )}
                              </div>
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

function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: number;
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

function formatScheduleDate(
  date: string | null,
  time: string | null
) {
  if (!date) {
    return "Date not set";
  }

  const [
    year,
    month,
    day,
  ] = date
    .slice(0, 10)
    .split("-")
    .map(Number);

  const dateLabel =
    new Intl.DateTimeFormat(
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

  if (!time) {
    return dateLabel;
  }

  return `${dateLabel} at ${time.slice(
    0,
    5
  )}`;
}