import Link from "next/link";

import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";

type JobsPageProps = {
  searchParams: Promise<{
    view?: string;
  }>;
};

type JobView =
  | "upcoming"
  | "active"
  | "completed"
  | "archive";

export default async function JobsPage({
  searchParams,
}: JobsPageProps) {
  const query =
    await searchParams;

  const requestedView =
    query.view;

  const currentView: JobView =
    requestedView === "active" ||
    requestedView === "completed" ||
    requestedView === "archive"
      ? requestedView
      : "upcoming";

  const supabase =
    await createClient();

  const {
    data: jobs,
    error,
  } = await supabase
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
      start_date,
      completion_date,
      estimated_value,
      created_at,

      clients (
        display_name,
        first_name,
        last_name
      )
    `)
    .order(
      "created_at",
      {
        ascending: false,
      }
    );

  if (error) {
    console.error(
      "Jobs load error:",
      error
    );
  }

  const allJobs =
    jobs ?? [];

  /*
   * -------------------------------------------------------
   * JOB PIPELINE
   * -------------------------------------------------------
   *
   * Upcoming:
   * Anything that is not yet active,
   * completed or cancelled.
   *
   * This automatically includes statuses such as:
   * Enquiry
   * Survey Booked
   * Quoted
   * Accepted
   * Scheduled
   */

  const upcomingJobs =
    allJobs.filter(
      (job) =>
        !isActive(
          job.status
        ) &&
        !isCompleted(
          job.status
        ) &&
        !isArchived(
          job.status
        )
    );

  const activeJobs =
    allJobs.filter(
      (job) =>
        isActive(
          job.status
        )
    );

  const completedJobs =
    allJobs.filter(
      (job) =>
        isCompleted(
          job.status
        )
    );

  const archivedJobs =
    allJobs.filter(
      (job) =>
        isArchived(
          job.status
        )
    );

  const displayedJobs =
    currentView ===
    "active"
      ? activeJobs

      : currentView ===
          "completed"
        ? completedJobs

        : currentView ===
            "archive"
          ? archivedJobs

          : upcomingJobs;

  const viewTitle =
    currentView ===
    "active"
      ? "Active Jobs"

      : currentView ===
          "completed"
        ? "Completed Jobs"

        : currentView ===
            "archive"
          ? "Archived Jobs"

          : "Upcoming Jobs";

  const viewDescription =
    currentView ===
    "active"
      ? "Jobs where work is currently in progress."

      : currentView ===
          "completed"
        ? "Finished DryHome jobs."

        : currentView ===
            "archive"
          ? "Cancelled jobs kept for your records."

          : "Enquiries, surveys, quotes and accepted work waiting to start.";

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-7xl">

          {/* HEADER */}

          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">
                DryHome Office
              </p>

              <h1 className="mt-1 text-3xl font-bold text-slate-900">
                Jobs
              </h1>

              <p className="mt-2 text-slate-500">
                Manage work from enquiry through to completion.
              </p>
            </div>

            <Link
              href="/jobs/new"
              className="rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-700"
            >
              + Add Job
            </Link>
          </div>

          {/* PIPELINE SUMMARY */}

          <div className="grid gap-5 md:grid-cols-3">
            <PipelineCard
              title="Upcoming"
              value={
                upcomingJobs.length
              }
              description="Waiting to start"
              href="/jobs?view=upcoming"
              active={
                currentView ===
                "upcoming"
              }
              tone="upcoming"
            />

            <PipelineCard
              title="Active"
              value={
                activeJobs.length
              }
              description="Currently in progress"
              href="/jobs?view=active"
              active={
                currentView ===
                "active"
              }
              tone="active"
            />

            <PipelineCard
              title="Completed"
              value={
                completedJobs.length
              }
              description="Finished jobs"
              href="/jobs?view=completed"
              active={
                currentView ===
                "completed"
              }
              tone="completed"
            />
          </div>

          {/* SECTION HEADER */}

          <section className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-semibold text-slate-900">
                    {viewTitle}
                  </h2>

                  <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {
                      displayedJobs.length
                    }
                  </span>
                </div>

                <p className="mt-1 text-sm text-slate-500">
                  {viewDescription}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <ViewTab
                  href="/jobs?view=upcoming"
                  label="Upcoming"
                  active={
                    currentView ===
                    "upcoming"
                  }
                />

                <ViewTab
                  href="/jobs?view=active"
                  label="Active"
                  active={
                    currentView ===
                    "active"
                  }
                />

                <ViewTab
                  href="/jobs?view=completed"
                  label="Completed"
                  active={
                    currentView ===
                    "completed"
                  }
                />

                {archivedJobs.length >
                  0 && (
                  <ViewTab
                    href="/jobs?view=archive"
                    label={`Archive (${archivedJobs.length})`}
                    active={
                      currentView ===
                      "archive"
                    }
                  />
                )}
              </div>
            </div>

            {/* EMPTY STATE */}

            {displayedJobs.length ===
            0 ? (
              <div className="p-12 text-center">
                <h3 className="text-lg font-semibold text-slate-900">
                  {currentView ===
                  "upcoming"
                    ? "No upcoming jobs"
                    : currentView ===
                        "active"
                      ? "No active jobs"
                      : currentView ===
                          "completed"
                        ? "No completed jobs"
                        : "No archived jobs"}
                </h3>

                <p className="mt-2 text-sm text-slate-500">
                  {currentView ===
                  "upcoming"
                    ? "New enquiries and accepted work will appear here."
                    : currentView ===
                        "active"
                      ? "Jobs will appear here when work starts."
                      : currentView ===
                          "completed"
                        ? "Finished jobs will appear here."
                        : "Cancelled jobs will appear here."}
                </p>

                {currentView ===
                  "upcoming" && (
                  <Link
                    href="/jobs/new"
                    className="mt-5 inline-flex rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700"
                  >
                    + Add Job
                  </Link>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
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

                      <Heading>
                        {currentView ===
                        "completed"
                          ? "Completed"
                          : currentView ===
                              "active"
                            ? "Started"
                            : "Next Date"}
                      </Heading>

                      <Heading right>
                        Value
                      </Heading>

                      <Heading right>
                        Action
                      </Heading>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {displayedJobs.map(
                      (job) => {
                        const clientData =
                          Array.isArray(
                            job.clients
                          )
                            ? job.clients[0]
                            : job.clients;

                        const clientName =
                          clientData?.display_name ||
                          [
                            clientData?.first_name,
                            clientData?.last_name,
                          ]
                            .filter(
                              Boolean
                            )
                            .join(
                              " "
                            ) ||
                          "Unknown client";

                        const location =
                          [
                            job.town,
                            job.postcode,
                          ]
                            .filter(
                              Boolean
                            )
                            .join(
                              ", "
                            ) ||
                          "—";

                        const relevantDate =
                          currentView ===
                          "completed"
                            ? job.completion_date

                            : currentView ===
                                "active"
                              ? job.start_date

                              : job.start_date ||
                                job.survey_date;

                        return (
                          <tr
                            key={
                              job.id
                            }
                            className="transition hover:bg-slate-50"
                          >
                            <TableCell>
                              <Link
                                href={`/jobs/${job.id}`}
                                className="font-semibold text-slate-900 hover:underline"
                              >
                                {
                                  job.job_number
                                }
                              </Link>

                              <p className="mt-1 text-sm text-slate-500">
                                {job.title ||
                                  "Untitled job"}
                              </p>
                            </TableCell>

                            <TableCell>
                              <span className="font-medium text-slate-700">
                                {
                                  clientName
                                }
                              </span>
                            </TableCell>

                            <TableCell>
                              {job.job_type ||
                                "—"}
                            </TableCell>

                            <TableCell>
                              <StatusBadge
                                status={
                                  job.status
                                }
                              />
                            </TableCell>

                            <TableCell>
                              {
                                location
                              }
                            </TableCell>

                            <TableCell>
                              {relevantDate
                                ? formatDate(
                                    relevantDate
                                  )
                                : "Not set"}
                            </TableCell>

                            <TableCell right>
                              {job.estimated_value !==
                              null
                                ? formatCurrency(
                                    job.estimated_value
                                  )
                                : "—"}
                            </TableCell>

                            <TableCell right>
                              <Link
                                href={`/jobs/${job.id}`}
                                className={
                                  currentView ===
                                  "active"
                                    ? "inline-flex rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"

                                    : "inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                                }
                              >
                                Open Job Hub
                              </Link>
                            </TableCell>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ARCHIVE LINK */}

          {archivedJobs.length >
            0 &&
            currentView !==
              "archive" && (
              <div className="mt-5 flex justify-end">
                <Link
                  href="/jobs?view=archive"
                  className="text-sm font-medium text-slate-400 hover:text-slate-700"
                >
                  View {archivedJobs.length} cancelled{" "}
                  {archivedJobs.length ===
                  1
                    ? "job"
                    : "jobs"}{" "}
                  →
                </Link>
              </div>
            )}
        </div>
      </main>
    </div>
  );
}

/* =========================================================
   PIPELINE CARD
   ========================================================= */

function PipelineCard({
  title,
  value,
  description,
  href,
  active,
  tone,
}: {
  title: string;
  value: number;
  description: string;
  href: string;
  active: boolean;

  tone:
    | "upcoming"
    | "active"
    | "completed";
}) {
  const activeClasses =
    tone ===
    "active"
      ? "border-emerald-300 bg-emerald-50"

      : tone ===
          "completed"
        ? "border-slate-300 bg-slate-50"

        : "border-blue-300 bg-blue-50";

  return (
    <Link
      href={href}
      className={`rounded-2xl border p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        active
          ? activeClasses
          : "border-transparent bg-white"
      }`}
    >
      <p className="text-sm font-semibold text-slate-500">
        {title}
      </p>

      <p className="mt-3 text-4xl font-bold text-slate-900">
        {value}
      </p>

      <p className="mt-2 text-sm text-slate-500">
        {description}
      </p>
    </Link>
  );
}

/* =========================================================
   VIEW TAB
   ========================================================= */

function ViewTab({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
        active
          ? "bg-slate-900 text-white"
          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {label}
    </Link>
  );
}

/* =========================================================
   STATUS BADGE
   ========================================================= */

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const classes =
    status ===
      "Complete" ||
    status ===
      "Completed"
      ? "bg-emerald-100 text-emerald-800"

      : status ===
          "In Progress"
        ? "bg-blue-100 text-blue-800"

        : status ===
            "Scheduled"
          ? "bg-indigo-100 text-indigo-800"

          : status ===
              "Accepted"
            ? "bg-emerald-100 text-emerald-800"

            : status ===
                "Quoted" ||
              status ===
                "Quote Sent"
              ? "bg-violet-100 text-violet-800"

              : status ===
                  "Survey Booked" ||
                status ===
                  "Survey"
                ? "bg-sky-100 text-sky-800"

                : status ===
                    "Cancelled"
                  ? "bg-red-100 text-red-700"

                  : "bg-slate-100 text-slate-700";

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${classes}`}
    >
      {status}
    </span>
  );
}

/* =========================================================
   TABLE
   ========================================================= */

function Heading({
  children,
  right = false,
}: {
  children:
    React.ReactNode;

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

function TableCell({
  children,
  right = false,
}: {
  children:
    React.ReactNode;

  right?: boolean;
}) {
  return (
    <td
      className={`px-6 py-5 text-sm text-slate-600 ${
        right
          ? "text-right"
          : ""
      }`}
    >
      {children}
    </td>
  );
}

/* =========================================================
   JOB GROUPS
   ========================================================= */

function isActive(
  status: string
) {
  return (
    status ===
    "In Progress"
  );
}

function isCompleted(
  status: string
) {
  return (
    status ===
      "Complete" ||
    status ===
      "Completed"
  );
}

function isArchived(
  status: string
) {
  return (
    status ===
    "Cancelled"
  );
}

/* =========================================================
   FORMATTERS
   ========================================================= */

function formatCurrency(
  value:
    | number
    | string
    | null
) {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style:
        "currency",

      currency:
        "GBP",
    }
  ).format(
    Number(
      value ??
        0
    )
  );
}

function formatDate(
  value:
    | string
    | null
) {
  if (!value) {
    return "Not set";
  }

  const [
    year,
    month,
    day,
  ] = value
    .slice(
      0,
      10
    )
    .split(
      "-"
    )
    .map(
      Number
    );

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day:
        "2-digit",

      month:
        "short",

      year:
        "numeric",

      timeZone:
        "UTC",
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