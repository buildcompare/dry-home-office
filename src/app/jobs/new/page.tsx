import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { addJob } from "../actions";

type NewJobPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function NewJobPage({
  searchParams,
}: NewJobPageProps) {
  const params = await searchParams;

  const supabase = await createClient();

  const { data: clients } = await supabase
    .from("clients")
    .select(`
      id,
      display_name,
      first_name,
      last_name
    `)
    .order("display_name");

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/jobs"
            className="text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            ← Back to Jobs
          </Link>

          <div className="mb-8 mt-4">
            <p className="text-sm font-medium text-slate-500">
              DryHome Office
            </p>

            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              Add Job
            </h1>

            <p className="mt-2 text-slate-500">
              Create a new job and link it to a client.
            </p>
          </div>

          {params.error && (
            <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {params.error}
            </div>
          )}

          <form
            action={addJob}
            className="rounded-2xl bg-white p-8 shadow-sm"
          >
            <div className="grid gap-6 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Client *
                </label>

                <select
                  name="client_id"
                  required
                  defaultValue=""
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-slate-900"
                >
                  <option value="" disabled>
                    Select client
                  </option>

                  {clients?.map((client) => {
                    const name =
                      client.display_name ||
                      [client.first_name, client.last_name]
                        .filter(Boolean)
                        .join(" ");

                    return (
                      <option
                        key={client.id}
                        value={client.id}
                      >
                        {name}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="md:col-span-2">
                <Field
                  label="Job title"
                  name="title"
                  placeholder="e.g. Damp Survey - Ground Floor"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Job type
                </label>

                <select
                  name="job_type"
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
                >
                  <option value="">Select job type</option>
                  <option>Damp Survey</option>
                  <option>Rising Damp</option>
                  <option>Penetrating Damp</option>
                  <option>Mould & Condensation</option>
                  <option>Woodworm</option>
                  <option>Wet Rot</option>
                  <option>Dry Rot</option>
                  <option>Internal Wall Insulation</option>
                  <option>External Wall Insulation</option>
                  <option>Plastering</option>
                  <option>Other</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Status
                </label>

                <select
                  name="status"
                  defaultValue="Enquiry"
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
                >
                  <option>Enquiry</option>
                  <option>Survey Booked</option>
                  <option>Quoted</option>
                  <option>Accepted</option>
                  <option>In Progress</option>
                  <option>Completed</option>
                  <option>Cancelled</option>
                </select>
              </div>

              <Field
                label="Survey date"
                name="survey_date"
                type="date"
              />

              <Field
                label="Start date"
                name="start_date"
                type="date"
              />

              <Field
                label="Estimated value"
                name="estimated_value"
                type="number"
                placeholder="0.00"
              />

              <div className="md:col-span-2 mt-4">
                <h2 className="text-lg font-semibold text-slate-900">
                  Job Address
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Leave this blank to use the client's address.
                </p>
              </div>

              <div className="md:col-span-2">
                <Field
                  label="Address line 1"
                  name="address_line_1"
                />
              </div>

              <div className="md:col-span-2">
                <Field
                  label="Address line 2"
                  name="address_line_2"
                />
              </div>

              <Field
                label="Town"
                name="town"
              />

              <Field
                label="County"
                name="county"
              />

              <Field
                label="Postcode"
                name="postcode"
              />

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Description
                </label>

                <textarea
                  name="description"
                  rows={5}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
                  placeholder="Describe the work required..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Internal notes
                </label>

                <textarea
                  name="notes"
                  rows={4}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
                />
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <Link
                href="/jobs"
                className="rounded-lg border border-slate-300 px-5 py-3 font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Link>

              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-slate-700"
              >
                Save Job
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
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label}
        {required && (
          <span className="text-red-500"> *</span>
        )}
      </label>

      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        step={type === "number" ? "0.01" : undefined}
        className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-slate-900"
      />
    </div>
  );
}