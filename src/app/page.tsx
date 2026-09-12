import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";

export default async function Dashboard() {
  const supabase = await createClient();

  const [
    clientsResult,
    jobsResult,
    surveysResult,
    activeJobsResult,
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("*", { count: "exact", head: true }),

    supabase
      .from("jobs")
      .select("*", { count: "exact", head: true }),

    supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "Survey Booked"),

    supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "In Progress"),
  ]);

  const clientCount = clientsResult.count ?? 0;
  const jobCount = jobsResult.count ?? 0;
  const surveyCount = surveysResult.count ?? 0;
  const activeJobCount = activeJobsResult.count ?? 0;

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
              Manage your clients, surveys and jobs.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <DashboardCard
              title="Clients"
              value={clientCount}
              description="Total clients"
            />

            <DashboardCard
              title="Jobs"
              value={jobCount}
              description="Total jobs"
            />

            <DashboardCard
              title="Surveys"
              value={surveyCount}
              description="Surveys booked"
            />

            <DashboardCard
              title="Active Jobs"
              value={activeJobCount}
              description="Currently in progress"
            />
          </div>

          <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Recent Jobs
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Your latest DryHome jobs will appear here.
                </p>
              </div>
            </div>

            <div className="mt-8 rounded-xl border border-dashed border-slate-300 p-10 text-center">
              <p className="font-medium text-slate-700">
                No jobs yet
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Add your first client and job to get started.
              </p>
            </div>
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
}: {
  title: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">
        {title}
      </p>

      <p className="mt-3 text-4xl font-bold text-slate-900">
        {value}
      </p>

      <p className="mt-2 text-sm text-slate-400">
        {description}
      </p>
    </div>
  );
}