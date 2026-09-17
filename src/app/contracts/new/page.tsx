import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { addContract } from "../actions";

type NewContractPageProps = {
  searchParams: Promise<{
    quote?: string;
    error?: string;
  }>;
};

export default async function NewContractPage({
  searchParams,
}: NewContractPageProps) {
  const params =
    await searchParams;

  const selectedQuoteId =
    params.quote || "";

  const supabase =
    await createClient();

  const [
    clientsResult,
    jobsResult,
    quotesResult,
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
        "display_name",
        {
          ascending: true,
        }
      ),

    supabase
      .from("jobs")
      .select(`
        id,
        job_number,
        title,
        client_id,
        status
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

    supabase
      .from("quotes")
      .select(`
        id,
        quote_number,
        title,
        description,
        client_id,
        job_id,
        amount,
        status,
        terms,
        customer_message
      `)
      .eq(
        "status",
        "Accepted"
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      ),
  ]);

  const clients =
    clientsResult.data ?? [];

  const jobs =
    jobsResult.data ?? [];

  const quotes =
    quotesResult.data ?? [];

  const selectedQuote =
    quotes.find(
      (quote) =>
        quote.id ===
        selectedQuoteId
    ) || null;

  const selectedClientId =
    selectedQuote?.client_id ||
    "";

  const selectedJobId =
    selectedQuote?.job_id ||
    "";

  const today =
    new Date()
      .toISOString()
      .slice(0, 10);

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8">
            <Link
              href="/contracts"
              className="text-sm font-medium text-slate-500 hover:text-slate-900"
            >
              ← Back to Contracts
            </Link>

            <h1 className="mt-4 text-3xl font-bold text-slate-900">
              Create Contract
            </h1>

            <p className="mt-2 text-slate-500">
              Create a customer contract,
              ideally from an accepted quote.
            </p>
          </div>

          {params.error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
              {decodeURIComponent(
                params.error
              )}
            </div>
          )}

          <form
            action={addContract}
          >
            {/* Quote */}
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                Source Quote
              </h2>

              <div className="mt-6">
                <label
                  htmlFor="quote_id"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Accepted Quote
                </label>

                <select
                  id="quote_id"
                  name="quote_id"
                  defaultValue={
                    selectedQuoteId
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
                >
                  <option value="">
                    No linked quote
                  </option>

                  {quotes.map(
                    (quote) => (
                      <option
                        key={
                          quote.id
                        }
                        value={
                          quote.id
                        }
                      >
                        {
                          quote.quote_number
                        }{" "}
                        —{" "}
                        {
                          quote.title
                        }{" "}
                        —{" "}
                        {formatCurrency(
                          quote.amount
                        )}
                      </option>
                    )
                  )}
                </select>

                <p className="mt-2 text-xs text-slate-500">
                  When created from an
                  accepted quote, the client
                  and job are linked
                  automatically.
                </p>
              </div>

              {selectedQuote && (
                <div className="mt-6 rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Selected Quote
                  </p>

                  <p className="mt-1 font-semibold text-slate-900">
                    {
                      selectedQuote.quote_number
                    }{" "}
                    —{" "}
                    {
                      selectedQuote.title
                    }
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    {
                      formatCurrency(
                        selectedQuote.amount
                      )
                    }
                  </p>

                  <Link
                    href={`/quotes/${selectedQuote.id}`}
                    className="mt-2 inline-block text-sm font-semibold text-slate-700 hover:underline"
                  >
                    View Quote →
                  </Link>
                </div>
              )}
            </section>

            {/* Client / Job */}
            <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                Client & Job
              </h2>

              <div className="mt-6 grid gap-5 lg:grid-cols-2">
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

                <div>
                  <label
                    htmlFor="job_id"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Job
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

                    {jobs.map(
                      (job) => (
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
                            job.title
                          }
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>
            </section>

            {/* Contract details */}
            <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                Contract Details
              </h2>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
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
                    defaultValue={
                      selectedQuote?.title ||
                      ""
                    }
                    placeholder="e.g. Rising Damp Treatment"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="contract_date"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Contract Date
                  </label>

                  <input
                    id="contract_date"
                    name="contract_date"
                    type="date"
                    defaultValue={
                      today
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="amount"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Contract Value
                  </label>

                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-500">
                      £
                    </span>

                    <input
                      id="amount"
                      name="amount"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={
                        selectedQuote
                          ? Number(
                              selectedQuote.amount
                            ).toFixed(
                              2
                            )
                          : "0.00"
                      }
                      className="w-full rounded-lg border border-slate-300 py-2.5 pl-7 pr-3 text-slate-900 outline-none focus:border-slate-500"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <label
                  htmlFor="description"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Scope of Works
                </label>

                <textarea
                  id="description"
                  name="description"
                  rows={8}
                  defaultValue={
                    selectedQuote?.description ||
                    ""
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
                />
              </div>
            </section>

            {/* Terms */}
            <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                Terms & Conditions
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                These terms will later form
                part of the customer-facing
                contract.
              </p>

              <textarea
                name="terms"
                rows={10}
                defaultValue={
                  selectedQuote?.terms ||
                  "The works will be carried out in accordance with the agreed quotation and scope of works. Any additional works or variations must be agreed before proceeding. Access to the property must be provided as reasonably required to complete the works."
                }
                className="mt-5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
              />
            </section>

            {/* Customer message */}
            <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                Customer Message
              </h2>

              <textarea
                name="customer_message"
                rows={4}
                defaultValue={
                  selectedQuote?.customer_message ||
                  "Please review the contract details and terms carefully before confirming your agreement."
                }
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
                only.
              </p>

              <textarea
                name="internal_notes"
                rows={4}
                className="mt-5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
              />
            </section>

            <div className="mt-8 flex justify-end gap-3">
              <Link
                href="/contracts"
                className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Link>

              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700"
              >
                Save Draft Contract
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
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