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

  const selectedJobId =
    params.job || "";

  const supabase = await createClient();

  const [
    clientsResult,
    jobsResult,
  ] = await Promise.all([
    supabase
      .from("clients")
      .select(`
        id,
        display_name,
        first_name,
        last_name
      `)
      .order("display_name", {
        ascending: true,
      }),

    supabase
      .from("jobs")
      .select(`
        id,
        job_number,
        title,
        client_id,
        status,
        clients (
          id,
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

  const clients =
    clientsResult.data ?? [];

  const jobs =
    jobsResult.data ?? [];

  const selectedJob =
    jobs.find(
      (job) =>
        job.id === selectedJobId
    ) || null;

  const selectedClientId =
    selectedJob?.client_id || "";

  const today =
    new Date()
      .toISOString()
      .slice(0, 10);

  const validDate = new Date();

  validDate.setDate(
    validDate.getDate() + 30
  );

  const validUntil =
    validDate
      .toISOString()
      .slice(0, 10);

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <Link
              href="/quotes"
              className="text-sm font-medium text-slate-500 hover:text-slate-900"
            >
              ← Back to Quotes
            </Link>

            <h1 className="mt-4 text-3xl font-bold text-slate-900">
              Create Quote
            </h1>

            <p className="mt-2 text-slate-500">
              Create a detailed quotation with
              labour, materials and optional VAT.
            </p>
          </div>

          {params.error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
              {decodeURIComponent(
                params.error
              )}
            </div>
          )}

          <form action={addQuote}>
            {/* Job and client */}
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                Customer & Job
              </h2>

              <div className="mt-6 grid gap-5 lg:grid-cols-2">
                <div>
                  <label
                    htmlFor="job_id"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Existing Job
                  </label>

                  <select
                    id="job_id"
                    name="job_id"
                    defaultValue={
                      selectedJobId
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
                  >
                    <option value="">
                      No linked job
                    </option>

                    {jobs.map((job) => {
                      const client =
                        Array.isArray(
                          job.clients
                        )
                          ? job.clients[0]
                          : job.clients;

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
                        <option
                          key={job.id}
                          value={job.id}
                        >
                          {job.job_number} —{" "}
                          {clientName} —{" "}
                          {job.title}
                        </option>
                      );
                    })}
                  </select>

                  <p className="mt-2 text-xs text-slate-500">
                    If a job is selected, the
                    quote will automatically use
                    that job&apos;s client.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="client_id"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Client
                  </label>

                  <select
                    id="client_id"
                    name="client_id"
                    defaultValue={
                      selectedClientId
                    }
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
                  >
                    <option value="">
                      Select client
                    </option>

                    {clients.map(
                      (client) => {
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
                      }
                    )}
                  </select>
                </div>
              </div>

              {selectedJob && (
                <div className="mt-6 rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Selected Job
                  </p>

                  <p className="mt-1 font-semibold text-slate-900">
                    {
                      selectedJob.job_number
                    }{" "}
                    — {selectedJob.title}
                  </p>

                  <Link
                    href={`/jobs/${selectedJob.id}`}
                    className="mt-2 inline-block text-sm font-semibold text-slate-700 hover:underline"
                  >
                    View Job →
                  </Link>
                </div>
              )}
            </section>

            {/* Quote details */}
            <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                Quote Details
              </h2>

              <div className="mt-6">
                <label
                  htmlFor="title"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Title
                </label>

                <input
                  id="title"
                  name="title"
                  type="text"
                  required
                  placeholder="e.g. Rising Damp Treatment"
                  defaultValue={
                    selectedJob?.title || ""
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div className="mt-5">
                <label
                  htmlFor="description"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Description / Scope of
                  Works
                </label>

                <textarea
                  id="description"
                  name="description"
                  rows={6}
                  placeholder="Describe the proposed works, areas affected and treatment required..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="quote_date"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Quote Date
                  </label>

                  <input
                    id="quote_date"
                    name="quote_date"
                    type="date"
                    defaultValue={today}
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="valid_until"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Valid Until
                  </label>

                  <input
                    id="valid_until"
                    name="valid_until"
                    type="date"
                    defaultValue={
                      validUntil
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>
              </div>
            </section>

            {/* Labour/materials/VAT */}
            <div className="mt-8">
              <QuoteFormItems />
            </div>

            {/* Customer message */}
            <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                Customer Message
              </h2>

              <textarea
                name="customer_message"
                rows={4}
                defaultValue="Thank you for the opportunity to provide a quotation for the proposed works. Please find our quotation detailed below."
                className="mt-5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
              />
            </section>

            {/* Terms */}
            <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                Terms
              </h2>

              <textarea
                name="terms"
                rows={5}
                defaultValue="This quotation is valid for 30 days from the date shown. Any additional works not included within this quotation will be discussed and agreed before proceeding."
                className="mt-5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
              />
            </section>

            {/* Internal notes */}
            <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                Internal Notes
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                These notes are for DryHome
                only and will not appear on the
                customer quote.
              </p>

              <textarea
                name="internal_notes"
                rows={4}
                className="mt-5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
              />
            </section>

            <div className="mt-8 flex items-center justify-end gap-3">
              <Link
                href="/quotes"
                className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Link>

              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700"
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