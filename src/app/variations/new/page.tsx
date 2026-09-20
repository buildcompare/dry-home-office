import Link from "next/link";

import Sidebar from "@/components/Sidebar";
import QuoteFormItems from "@/components/QuoteForm";

import { createClient } from "@/lib/supabase/server";

import { addVariation } from "../actions";

type NewVariationPageProps = {
  searchParams: Promise<{
    job?: string;
    quote?: string;
    error?: string;
  }>;
};

export default async function NewVariationPage({
  searchParams,
}: NewVariationPageProps) {
  const params =
    await searchParams;

  const selectedJobId =
    params.job || "";

  const requestedQuoteId =
    params.quote || "";

  const supabase =
    await createClient();

  const {
    data: jobsData,
  } = await supabase
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
    .neq(
      "status",
      "Cancelled"
    )
    .order(
      "created_at",
      {
        ascending:
          false,
      }
    );

  const jobs =
    jobsData ?? [];

  const selectedJob =
    jobs.find(
      (job) =>
        job.id ===
        selectedJobId
    ) || null;

  const selectedClient =
    selectedJob
      ? Array.isArray(
          selectedJob.clients
        )
        ? selectedJob.clients[0]
        : selectedJob.clients
      : null;

  const selectedClientName =
    selectedClient?.display_name ||
    [
      selectedClient?.first_name,
      selectedClient?.last_name,
    ]
      .filter(Boolean)
      .join(" ") ||
    "Unknown client";

  let acceptedQuotes: {
    id: string;
    quote_number: string;
    title: string | null;
    amount: number | string | null;
    status: string;
  }[] = [];

  if (
    selectedJobId
  ) {
    const {
      data: quotesData,
      error: quotesError,
    } = await supabase
      .from("quotes")
      .select(`
        id,
        quote_number,
        title,
        amount,
        status
      `)
      .eq(
        "job_id",
        selectedJobId
      )
      .eq(
        "status",
        "Accepted"
      )
      .order(
        "created_at",
        {
          ascending:
            false,
        }
      );

    if (
      quotesError
    ) {
      console.error(
        "Unable to load accepted quotes:",
        quotesError
      );
    }

    acceptedQuotes =
      quotesData ?? [];
  }

  const defaultQuoteId =
    acceptedQuotes.some(
      (quote) =>
        quote.id ===
        requestedQuoteId
    )
      ? requestedQuoteId
      : acceptedQuotes[0]?.id ||
        "";

  const today =
    new Date()
      .toISOString()
      .slice(
        0,
        10
      );

  const validDate =
    new Date();

  validDate.setDate(
    validDate.getDate() +
      30
  );

  const validUntil =
    validDate
      .toISOString()
      .slice(
        0,
        10
      );

  const backHref =
    selectedJob
      ? `/jobs/${selectedJob.id}`
      : "/jobs";

  const backLabel =
    selectedJob
      ? "Back to Job Hub"
      : "Back to Jobs";

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-7xl">

          <div className="mb-8">
            <Link
              href={
                backHref
              }
              className="text-sm font-medium text-slate-500 hover:text-slate-900"
            >
              ← {backLabel}
            </Link>

            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                  Additional Works
                </p>

                <h1 className="mt-1 text-3xl font-bold text-slate-900">
                  Create Variation
                </h1>

                <p className="mt-2 max-w-2xl text-slate-500">
                  Record additional works that fall outside the
                  original accepted quotation and send them to
                  the customer for approval.
                </p>
              </div>

              <span
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-white"
                style={{
                  backgroundColor:
                    "#d97706",
                }}
              >
                Draft
              </span>
            </div>
          </div>

          {params.error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
              {decodeURIComponent(
                params.error
              )}
            </div>
          )}

          <form
            action={
              addVariation
            }
          >
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Job
                </p>

                <h2 className="mt-1 text-xl font-semibold text-slate-900">
                  Customer & Job
                </h2>
              </div>

              {selectedJob ? (
                <>
                  <input
                    type="hidden"
                    name="job_id"
                    value={
                      selectedJob.id
                    }
                  />

                  <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {
                            selectedJob.job_number
                          }{" "}
                          —{" "}
                          {
                            selectedJob.title
                          }
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {
                            selectedClientName
                          }
                        </p>

                        <p className="mt-2 text-xs font-medium text-slate-400">
                          Job status:{" "}
                          {
                            selectedJob.status
                          }
                        </p>
                      </div>

                      <Link
                        href={`/jobs/${selectedJob.id}`}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        View Job Hub
                      </Link>
                    </div>
                  </div>
                </>
              ) : (
                <div className="mt-6">
                  <label
                    htmlFor="job_id"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Select Job
                  </label>

                  <select
                    id="job_id"
                    name="job_id"
                    required
                    defaultValue=""
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900"
                  >
                    <option value="">
                      Select a job
                    </option>

                    {jobs.map(
                      (job) => {
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
                            {
                              job.title
                            }
                          </option>
                        );
                      }
                    )}
                  </select>
                </div>
              )}
            </section>

            {selectedJob && (
              <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Original Works
                </p>

                <h2 className="mt-1 text-xl font-semibold text-slate-900">
                  Linked Accepted Quote
                </h2>

                {acceptedQuotes.length >
                0 ? (
                  <div className="mt-6">
                    <select
                      id="quote_id"
                      name="quote_id"
                      defaultValue={
                        defaultQuoteId
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900"
                    >
                      <option value="">
                        Do not link to a quote
                      </option>

                      {acceptedQuotes.map(
                        (
                          quote
                        ) => (
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
                              quote.title ||
                              "Quotation"
                            }{" "}
                            —{" "}
                            {formatCurrency(
                              Number(
                                quote.amount ??
                                  0
                              )
                            )}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                ) : (
                  <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
                    <p className="text-sm font-semibold text-amber-900">
                      No accepted quote found
                    </p>
                  </div>
                )}
              </section>
            )}

            <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Variation Details
              </p>

              <h2 className="mt-1 text-xl font-semibold text-slate-900">
                Additional Works
              </h2>

              <div className="mt-6">
                <label
                  htmlFor="title"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Variation Title
                </label>

                <input
                  id="title"
                  name="title"
                  type="text"
                  required
                  placeholder="e.g. Additional Timber Treatment"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900"
                />
              </div>

              <div className="mt-5">
                <label
                  htmlFor="description"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Description / Scope of Additional Works
                </label>

                <textarea
                  id="description"
                  name="description"
                  rows={7}
                  placeholder="Describe the additional works identified..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900"
                />
              </div>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="variation_date"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Variation Date
                  </label>

                  <input
                    id="variation_date"
                    name="variation_date"
                    type="date"
                    defaultValue={
                      today
                    }
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900"
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
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900"
                  />
                </div>
              </div>
            </section>

            <div className="mt-8">
              <QuoteFormItems />
            </div>

            <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                Customer Message
              </h2>

              <textarea
                name="customer_message"
                rows={5}
                defaultValue={`During the course of the works, additional works have been identified which fall outside the scope of the original quotation.

Please review the additional works and costs detailed below. We will not proceed with these additional works until approval has been received.`}
                className="mt-5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900"
              />
            </section>

            <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                Internal Notes
              </h2>

              <textarea
                name="internal_notes"
                rows={4}
                className="mt-5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900"
              />
            </section>

            <div className="mt-8 flex flex-wrap items-center justify-end gap-3 pb-10">
              <Link
                href={
                  backHref
                }
                className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
              >
                Cancel
              </Link>

              <button
                type="submit"
                className="rounded-lg px-6 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90"
                style={{
                  backgroundColor:
                    "#d97706",
                }}
              >
                Save Draft Variation
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

function formatCurrency(
  value: number
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
    value
  );
}