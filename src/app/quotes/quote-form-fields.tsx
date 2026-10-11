/*
 * The quote form body shared by Create Quote and Edit Quote: customer
 * and job, details, labour/materials/VAT, message, additional terms and
 * internal notes. Field names are the same in both, so the shared
 * readQuoteFields / readQuoteItems parse them identically.
 */

import Link from "next/link";
import QuoteFormItems, {
  type QuoteFormInitialItem,
} from "@/components/QuoteForm";

type ClientOption = {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

type JobOption = {
  id: string;
  job_number: string | null;
  title: string | null;
  client_id: string | null;
  clients:
    | ClientOption
    | ClientOption[]
    | null;
};

export type QuoteFormDefaults = {
  jobId: string;
  clientId: string;
  title: string;
  description: string;
  quoteDate: string;
  validUntil: string;
  customerMessage: string;
  terms: string;
  internalNotes: string;
};

export default function QuoteFormFields({
  clients,
  jobs,
  defaults,
  selectedJob,
  initialItems,
  initialVatEnabled,
}: {
  clients: ClientOption[];
  jobs: JobOption[];
  defaults: QuoteFormDefaults;
  selectedJob: JobOption | null;
  initialItems?: QuoteFormInitialItem[];
  initialVatEnabled?: boolean;
}) {
  return (
    <>
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
                defaults.jobId
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
                defaults.clientId
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
            spellCheck
            id="title"
            name="title"
            type="text"
            required
            placeholder="e.g. Rising Damp Treatment"
            defaultValue={
              defaults.title
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
            spellCheck
            id="description"
            name="description"
            rows={6}
            defaultValue={
              defaults.description
            }
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
              spellCheck={false}
              id="quote_date"
              name="quote_date"
              type="date"
              defaultValue={
                defaults.quoteDate
              }
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
              spellCheck={false}
              id="valid_until"
              name="valid_until"
              type="date"
              defaultValue={
                defaults.validUntil
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
            />
          </div>
        </div>
      </section>

      {/* Labour/materials/VAT */}
      <div className="mt-8">
        <QuoteFormItems
          initialItems={
            initialItems
          }
          initialVatEnabled={
            initialVatEnabled
          }
        />
      </div>

      {/* Customer message */}
      <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">
          Customer Message
        </h2>

        <textarea
          spellCheck
          name="customer_message"
          rows={4}
          defaultValue={
            defaults.customerMessage
          }
          className="mt-5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
        />
      </section>

      {/* Terms */}
      <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">
          Additional terms and conditions
        </h2>

        <textarea
          spellCheck
          name="terms"
          rows={5}
          defaultValue={
            defaults.terms
          }
          placeholder="Optional. Leave blank to use only the standard terms."
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
          spellCheck
          name="internal_notes"
          rows={4}
          defaultValue={
            defaults.internalNotes
          }
          className="mt-5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
        />
      </section>
    </>
  );
}
