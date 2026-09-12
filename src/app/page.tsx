import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    clientsResult,
    jobsResult,
    surveysResult,
    activeJobsResult,
    recentJobsResult,
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("*", {
        count: "exact",
        head: true,
      }),

    supabase
      .from("jobs")
      .select("*", {
        count: "exact",
        head: true,
      }),

    supabase
      .from("jobs")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("status", "Survey Booked"),

    supabase
      .from("jobs")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("status", "In Progress"),

    supabase
      .from("jobs")
      .select(`
        id,
        job_number,
        title,
        status,
        town,
        postcode,
        created_at,
        clients (
          display_name,
          first_name,
          last_name
        )
      `)
      .order("created_at", {
        ascending: false,
      })
      .limit(5),
  ]);

  const clientCount = clientsResult.count ?? 0;
  const jobCount = jobsResult.count ?? 0;
  const surveyCount = surveysResult.count ?? 0;
  const activeJobCount = activeJobsResult.count ?? 0;

  const recentJobs = recentJobsResult.data ?? [];

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <p className="text-sm font-medium text-slate-500">
              DryHome Damp Proofing Solutions
            </p>

            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              Dashboard
            </h1>

            <p className="mt-2 text-slate-500">
              Manage your clients, jobs and schedule.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <DashboardCard
              title="Clients"
              value={clientCount}
              description="Total clients"
              href="/clients"
            />

            <DashboardCard
              title="Jobs"
              value={jobCount}
              description="Total jobs"
              href="/jobs"
            />

            <DashboardCard
              title="Surveys"
              value={surveyCount}
              description="Surveys booked"
              href="/schedule"
            />

            <DashboardCard
              title="Active Jobs"
              value={activeJobCount}
              description="Currently in progress"
              href="/jobs"
            />
          </div>

          <div className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Recent Jobs
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Your latest DryHome jobs.
                </p>
              </div>

              <Link
                href="/jobs"
                className="text-sm font-semibold text-slate-700 hover:underline"
              >
                View all jobs →
              </Link>
            </div>

            {recentJobs.length === 0 ? (
              <div className="p-12 text-center">
                <p className="font-medium text-slate-700">
                  No jobs yet
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  Add your first job to get started.
                </p>

                <Link
                  href="/jobs/new"
                  className="mt-5 inline-flex rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700"
                >
                  + Add Job
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentJobs.map((job) => {
                  const clientData = Array.isArray(job.clients)
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
                    <Link
                      key={job.id}
                      href={`/jobs/${job.id}`}
                      className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 transition hover:bg-slate-50"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">
                          {job.job_number}
                        </p>

                        <p className="mt-1 text-sm text-slate-600">
                          {job.title || "Untitled job"}
                        </p>

                        <p className="mt-1 text-sm text-slate-400">
                          {clientName}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                          {job.status}
                        </span>

                        <p className="mt-2 text-sm text-slate-500">
                          {job.town || job.postcode || "No location"}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function DashboardCard({
  title,
  value,
  description,
  href,
}: {
  title: string;
  value: number;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl bg-white p-6 shadow-sm transition hover:shadow-md"
    >
      <p className="text-sm font-medium text-slate-500">
        {title}
      </p>

      <p className="mt-3 text-4xl font-bold text-slate-900">
        {value}
      </p>

      <p className="mt-2 text-sm text-slate-400">
        {description}
      </p>
    </Link>
  );
}