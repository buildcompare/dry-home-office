import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";

export default async function JobsPage() {
  const supabase = await createClient();

  const { data: jobs, error } = await supabase
    .from("jobs")
    .select(`
      id,
      job_number,
      title,
      job_type,
      status,
      town,
      postcode,
      survey_date,
      estimated_value,
      created_at,
      clients (
        display_name,
        first_name,
        last_name
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
          <div className="mb-8 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                DryHome Office
              </p>

              <h1 className="mt-1 text-3xl font-bold text-slate-900">
                Jobs
              </h1>

              <p className="mt-2 text-slate-500">
                {jobs?.length ?? 0} job records
              </p>
            </div>

            <Link
              href="/jobs/new"
              className="rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-700"
            >
              + Add Job
            </Link>
          </div>

          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            {!jobs || jobs.length === 0 ? (
              <div className="p-12 text-center">
                <h2 className="text-lg font-semibold text-slate-900">
                  No jobs yet
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  Create your first DryHome job.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      <Heading>
                        Job
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
                        Location
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
                    {jobs.map((job) => {
                      const clientData =
                        Array.isArray(job.clients)
                          ? job.clients[0]
                          : job.clients;

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
                          key={job.id}
                          className="hover:bg-slate-50"
                        >
                          <td className="px-6 py-5">
                            <Link
                              href={`/jobs/${job.id}`}
                              className="font-semibold text-slate-900 hover:underline"
                            >
                              {job.job_number}
                            </Link>

                            <p className="mt-1 text-sm text-slate-500">
                              {job.title ||
                                "Untitled job"}
                            </p>
                          </td>

                          <td className="px-6 py-5 text-sm font-medium text-slate-700">
                            {clientName}
                          </td>

                          <td className="px-6 py-5 text-sm text-slate-600">
                            {job.job_type ||
                              "—"}
                          </td>

                          <td className="px-6 py-5">
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                              {job.status}
                            </span>
                          </td>

                          <td className="px-6 py-5 text-sm text-slate-600">
                            {job.town ||
                              job.postcode ||
                              "—"}
                          </td>

                          <td className="px-6 py-5 text-right text-sm font-medium text-slate-900">
                            {job.estimated_value !== null
                              ? new Intl.NumberFormat(
                                  "en-GB",
                                  {
                                    style: "currency",
                                    currency: "GBP",
                                  }
                                ).format(
                                  Number(
                                    job.estimated_value
                                  )
                                )
                              : "—"}
                          </td>

                          <td className="px-6 py-5">
                            <div className="flex justify-end gap-2">
                              <Link
                                href={`/jobs/${job.id}`}
                                className="inline-flex rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                              >
                                View
                              </Link>

                              <Link
                                href={`/schedule/new?job=${job.id}`}
                                className="inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                              >
                                Schedule
                              </Link>
                            </div>
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
        right
          ? "text-right"
          : "text-left"
      }`}
    >
      {children}
    </th>
  );
}