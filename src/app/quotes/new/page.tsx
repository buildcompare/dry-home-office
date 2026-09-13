import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import QuoteFormItems from "@/components/QuoteForm";
import { createClient } from "@/lib/supabase/server";
import { addQuote } from "../actions";

type NewQuotePageProps = {
  searchParams: Promise<{
    job?: string;
    error?: string;
  }>;
};

export default async function NewQuotePage({
  searchParams,
}: NewQuotePageProps) {
  const params = await searchParams;

  const supabase = await createClient();

  const [{ data: clients }, { data: jobs }] =
    await Promise.all([
      supabase
        .from("clients")
        .select(`
          id,
          display_name,
          first_name,
          last_name,
          email
        `)
        .order("display_name"),

      supabase
        .from("jobs")
        .select(`
          id,
          job_number,
          title,
          job_type,
          client_id,
          clients (
            display_name,
            first_name,
            last_name
          )
        `)
        .neq("status", "Cancelled")
        .order("created_at", {
          ascending: false,
        }),
    ]);

  const selectedJob =
    jobs?.find(
      (job) => job.id === params.job
    ) ?? null;

  const selectedClientId =
    selectedJob?.client_id ?? "";

  const defaultTitle =
    selectedJob?.title ||
    selectedJob?.job_type ||
    "";

  const today = londonDateToday();

  const validUntil =
    addDays(today, 30);

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-5xl">
          <Link
            href={
              selectedJob
                ? `/jobs/${selectedJob.id}`
                : "/quotes"
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
              Create Quote
            </h1>

            <p className="mt-2 text-slate-500">
              Create a quote linked to a client and job.
            </p>
          </div>

          {params.error && (
            <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {params.error}
            </div>
          )}

          <form
            action={addQuote}
            className="space-y-8"
          >
            <section className="rounded-2xl bg-white p-8 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Quote Details
              </h2>

              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Existing Job
                  </label>

                  <select
                    name="job_id"
                    defaultValue={params.job || ""}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
                  >
                    <option value="">
                      No linked job
                    </option>

                    {jobs?.map((job) => {
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
                        <option
                          key={job.id}
                          value={job.id}
                        >
                          {job.job_number} — {clientName} —{" "}
                          {job.title || "Untitled Job"}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Client *
                  </label>

                  <select
                    name="client_id"
                    required
                    defaultValue={selectedClientId}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
                  >
                    <option
                      value=""
                      disabled
                    >
                      Select client
                    </option>

                    {clients?.map((client) => {
                      const name =
                        client.display_name ||
                        [
                          client.first_name,
                          client.last_name,
                        ]
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

                  {selectedJob && (
                    <p className="mt-2 text-xs text-slate-500">
                      Because this quote is linked to a job,
                      DryHome Office will automatically use
                      that job's client.
                    </p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <Field
                    label="Quote title"
                    name="title"
                    defaultValue={defaultTitle}
                    placeholder="e.g. Rising Damp Treatment"
                    required
                  />
                </div>

                <Field
                  label="Quote date"
                  name="quote_date"
                  type="date"
                  defaultValue={today}
                  required
                />

                <Field
                  label="Valid until"
                  name="valid_until"
                  type="date"
                  defaultValue={validUntil}
                />
              </div>
            </section>

            <section className="rounded-2xl bg-white p-8 shadow-sm">
              <QuoteFormItems />
            </section>

            <section className="rounded-2xl bg-white p-8 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Customer Message
              </h2>

              <textarea
                name="customer_message"
                rows={5}
                defaultValue="Thank you for the opportunity to provide a quotation for the proposed works. Please find our quotation detailed below."
                className="mt-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
              />

              <h2 className="mt-8 text-lg font-semibold text-slate-900">
                Terms
              </h2>

              <textarea
                name="terms"
                rows={5}
                defaultValue="This quotation is valid for 30 days from the quote date. Any additional works not included within this quotation will be agreed separately before proceeding."
                className="mt-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
              />

              <h2 className="mt-8 text-lg font-semibold text-slate-900">
                Internal Notes
              </h2>

              <textarea
                name="internal_notes"
                rows={4}
                placeholder="These notes are for DryHome only and will not appear on the customer quote."
                className="mt-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
              />
            </section>

            <div className="flex justify-end gap-3">
              <Link
                href={
                  selectedJob
                    ? `/jobs/${selectedJob.id}`
                    : "/quotes"
                }
                className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Link>

              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-slate-700"
              >
                Save Draft Quote
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
          <span className="text-red-500"> *</span>
        )}
      </label>

      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
      />
    </div>
  );
}

function londonDateToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDays(
  dateString: string,
  numberOfDays: number
) {
  const [year, month, day] =
    dateString.split("-").map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  date.setUTCDate(
    date.getUTCDate() + numberOfDays
  );

  return [
    date.getUTCFullYear(),
    String(
      date.getUTCMonth() + 1
    ).padStart(2, "0"),
    String(
      date.getUTCDate()
    ).padStart(2, "0"),
  ].join("-");
}