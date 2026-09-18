import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { addScheduleEvent } from "../actions";

type NewScheduleEventProps = {
  searchParams: Promise<{
    date?: string;
    job?: string;
    client?: string;
    contract?: string;
    type?: string;
    error?: string;
  }>;
};

export default async function NewScheduleEventPage({
  searchParams,
}: NewScheduleEventProps) {
  const params =
    await searchParams;

  const supabase =
    await createClient();

  const [
    clientsResult,
    jobsResult,
    contractResult,
  ] = await Promise.all([
    supabase
      .from("clients")
      .select(`
        id,
        display_name,
        first_name,
        last_name
      `)
      .order(
        "display_name"
      ),

    supabase
      .from("jobs")
      .select(`
        id,
        job_number,
        title,
        job_type,
        status,
        client_id,
        town,
        postcode,
        clients (
          display_name,
          first_name,
          last_name
        )
      `)
      .neq(
        "status",
        "Cancelled"
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      ),

    params.contract
      ? supabase
          .from(
            "contracts"
          )
          .select(`
            id,
            contract_number,
            title,
            client_id,
            job_id
          `)
          .eq(
            "id",
            params.contract
          )
          .maybeSingle()
      : Promise.resolve({
          data: null,
          error: null,
        }),
  ]);

  const clients =
    clientsResult.data ?? [];

  const jobs =
    jobsResult.data ?? [];

  const selectedContract =
    contractResult.data ??
    null;

  const defaultDate =
    params.date ||
    londonDateToday();

  const selectedJob =
    jobs.find(
      (job) =>
        job.id ===
        params.job
    );

  const selectedClientId =
    selectedJob?.client_id ||
    selectedContract?.client_id ||
    params.client ||
    "";

  const selectedClient =
    clients.find(
      (client) =>
        client.id ===
        selectedClientId
    );

  const selectedJobClientData =
    selectedJob &&
    (Array.isArray(
      selectedJob.clients
    )
      ? selectedJob.clients[0]
      : selectedJob.clients);

  const selectedClientName =
    selectedJobClientData?.display_name ||
    selectedClient?.display_name ||
    [
      selectedJobClientData?.first_name ||
        selectedClient?.first_name,
      selectedJobClientData?.last_name ||
        selectedClient?.last_name,
    ]
      .filter(Boolean)
      .join(" ");

  const defaultTitle =
    selectedJob
      ? `${selectedJob.job_number} - ${
          selectedJob.title ||
          selectedJob.job_type ||
          "Job"
        }`
      : selectedContract
        ? `${
            selectedContract.contract_number
          } - ${
            selectedContract.title ||
            "Contract Work"
          }`
        : "";

  const requestedType =
    params.type ===
    "Survey"
      ? "Survey"
      : params.type ===
          "Work"
        ? "Work"
        : params.type ===
            "Return Visit"
          ? "Return Visit"
          : params.type ===
              "Follow-up"
            ? "Follow-up"
            : selectedJob ||
                selectedContract
              ? "Work"
              : "Survey";

  const backHref =
    selectedContract
      ? `/contracts/${selectedContract.id}`
      : selectedJob
        ? `/jobs/${selectedJob.id}`
        : `/schedule?month=${defaultDate.slice(
            0,
            7
          )}`;

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-4xl">
          <Link
            href={
              backHref
            }
            className="text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            ← Back
          </Link>

          <div className="mb-8 mt-4">
            <p className="text-sm font-medium text-slate-500">
              DryHome Office
            </p>

            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              Add to Schedule
            </h1>

            <p className="mt-2 text-slate-500">
              Add work, surveys and appointments to the diary.
            </p>
          </div>

          {params.error && (
            <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {
                params.error
              }
            </div>
          )}

          {selectedContract && (
            <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Selected Contract
              </p>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-slate-900">
                    {
                      selectedContract.contract_number
                    }
                  </p>

                  <p className="mt-1 text-sm text-slate-600">
                    {
                      selectedContract.title ||
                      "Contract Work"
                    }
                  </p>

                  {selectedClientName && (
                    <p className="mt-1 text-sm text-slate-500">
                      {
                        selectedClientName
                      }
                    </p>
                  )}
                </div>

                <Link
                  href={`/contracts/${selectedContract.id}`}
                  className="text-sm font-semibold text-slate-700 hover:underline"
                >
                  View Contract →
                </Link>
              </div>
            </div>
          )}

          {selectedJob && (
            <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Selected Job
              </p>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-slate-900">
                    {
                      selectedJob.job_number
                    }
                  </p>

                  <p className="mt-1 text-sm text-slate-600">
                    {
                      selectedJob.title ||
                      "Untitled Job"
                    }
                  </p>

                  {selectedClientName && (
                    <p className="mt-1 text-sm text-slate-500">
                      {
                        selectedClientName
                      }
                    </p>
                  )}
                </div>

                <Link
                  href={`/jobs/${selectedJob.id}`}
                  className="text-sm font-semibold text-slate-700 hover:underline"
                >
                  View Job →
                </Link>
              </div>
            </div>
          )}

          <form
            action={
              addScheduleEvent
            }
            className="rounded-2xl bg-white p-8 shadow-sm"
          >
            <input
              type="hidden"
              name="contract_id"
              value={
                selectedContract?.id ||
                ""
              }
            />

            <div className="grid gap-6 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Existing Job
                </label>

                <select
                  name="job_id"
                  defaultValue={
                    params.job ||
                    selectedContract?.job_id ||
                    ""
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-slate-900"
                >
                  <option value="">
                    Standalone appointment — no job
                  </option>

                  {jobs.map(
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

                      return (
                        <option
                          key={
                            job.id
                          }
                          value={
                            job.id
                          }
                        >
                          {
                            job.job_number
                          }{" "}
                          —{" "}
                          {
                            clientName
                          }{" "}
                          —{" "}
                          {job.title ||
                            "Untitled Job"}
                        </option>
                      );
                    }
                  )}
                </select>
              </div>

              <div className="md:col-span-2">
                <Field
                  label="Appointment title"
                  name="title"
                  defaultValue={
                    defaultTitle
                  }
                  placeholder="e.g. Damp Proofing Works - Mrs Smith"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Event type
                </label>

                <select
                  name="event_type"
                  defaultValue={
                    requestedType
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
                >
                  <option>
                    Survey
                  </option>

                  <option>
                    Work
                  </option>

                  <option>
                    Return Visit
                  </option>

                  <option>
                    Follow-up
                  </option>

                  <option>
                    Other
                  </option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Status
                </label>

                <select
                  name="status"
                  defaultValue="Scheduled"
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
                >
                  <option>
                    Scheduled
                  </option>

                  <option>
                    Completed
                  </option>

                  <option>
                    Cancelled
                  </option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Client
                </label>

                <select
                  name="client_id"
                  defaultValue={
                    selectedClientId
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
                >
                  <option value="">
                    No client
                  </option>

                  {clients.map(
                    (client) => {
                      const name =
                        client.display_name ||
                        [
                          client.first_name,
                          client.last_name,
                        ]
                          .filter(
                            Boolean
                          )
                          .join(
                            " "
                          );

                      return (
                        <option
                          key={
                            client.id
                          }
                          value={
                            client.id
                          }
                        >
                          {name}
                        </option>
                      );
                    }
                  )}
                </select>
              </div>

              <Field
                label="Start date"
                name="start_date"
                type="date"
                defaultValue={
                  defaultDate
                }
                required
              />

              <Field
                label="End date"
                name="end_date"
                type="date"
                defaultValue={
                  defaultDate
                }
              />

              <Field
                label="Start time"
                name="start_time"
                type="time"
              />

              <Field
                label="End time"
                name="end_time"
                type="time"
              />

              <div className="md:col-span-2">
                <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    name="all_day"
                    className="h-4 w-4"
                  />

                  All day
                </label>
              </div>

              <div className="md:col-span-2">
                <Field
                  label="Location"
                  name="location"
                  placeholder="Enter the property address"
                />
              </div>

              <div className="md:col-span-2">
                <Field
                  label="Assigned to"
                  name="assigned_to"
                  placeholder="e.g. James"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Notes
                </label>

                <textarea
                  name="notes"
                  rows={4}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
                  placeholder="Any notes for this appointment..."
                />
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <Link
                href={
                  backHref
                }
                className="rounded-lg border border-slate-300 px-5 py-3 font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Link>

              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-slate-700"
              >
                Add to Schedule
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  placeholder,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label}

        {required && (
          <span className="text-red-500">
            {" "}
            *
          </span>
        )}
      </label>

      <input
        name={name}
        type={type}
        required={
          required
        }
        placeholder={
          placeholder
        }
        defaultValue={
          defaultValue
        }
        className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-slate-900"
      />
    </div>
  );
}

function londonDateToday() {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(
    new Date()
  );
}