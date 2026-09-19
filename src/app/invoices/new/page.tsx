import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import InvoiceForm from "@/components/InvoiceForm";

import { addInvoice } from "../actions";

type SearchParams = Promise<{
  contract?: string;
  quote?: string;
}>;

function clientName(client: any) {
  if (!client) {
    return "Unknown client";
  }

  if (client.display_name) {
    return client.display_name;
  }

  const personalName = [
    client.first_name,
    client.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (personalName) {
    return personalName;
  }

  if (client.company_name) {
    return client.company_name;
  }

  return "Unnamed client";
}

function jobName(job: any) {
  if (!job) {
    return "Unknown job";
  }

  const number =
    job.job_number || "Job";

  const title =
    job.title || "";

  return title
    ? `${number} — ${title}`
    : number;
}

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}

function todayDate() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

function defaultDueDate() {
  const date = new Date();

  date.setDate(date.getDate() + 7);

  return date
    .toISOString()
    .slice(0, 10);
}

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  const selectedContractId =
    params.contract ?? "";

  const selectedQuoteId =
    params.quote ?? "";

  const supabase =
    await createClient();

  const [
    clientsResult,
    jobsResult,
    contractsResult,
    quotesResult,
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("*")
      .order("created_at", {
        ascending: false,
      }),

    supabase
      .from("jobs")
      .select("*")
      .order("created_at", {
        ascending: false,
      }),

    supabase
      .from("contracts")
      .select("*")
      .eq("status", "Signed")
      .order("created_at", {
        ascending: false,
      }),

    supabase
      .from("quotes")
      .select("*")
      .order("created_at", {
        ascending: false,
      }),
  ]);

  if (clientsResult.error) {
    throw new Error(
      clientsResult.error.message
    );
  }

  if (jobsResult.error) {
    throw new Error(
      jobsResult.error.message
    );
  }

  if (contractsResult.error) {
    throw new Error(
      contractsResult.error.message
    );
  }

  if (quotesResult.error) {
    throw new Error(
      quotesResult.error.message
    );
  }

  const clients =
    clientsResult.data ?? [];

  const jobs =
    jobsResult.data ?? [];

  const contracts =
    contractsResult.data ?? [];

  const quotes =
    quotesResult.data ?? [];

  const acceptedQuotes =
    quotes.filter(
      (quote) =>
        quote.status === "Accepted"
    );

  const selectedContract =
    contracts.find(
      (contract) =>
        contract.id ===
        selectedContractId
    ) ?? null;

  /*
   * If the selected contract already belongs to a quote,
   * that quote becomes the invoice source automatically.
   */
  const sourceQuoteId =
    selectedQuoteId ||
    selectedContract?.quote_id ||
    "";

  const selectedQuote =
    quotes.find(
      (quote) =>
        quote.id === sourceQuoteId
    ) ?? null;

  const sourceClientId =
    selectedQuote?.client_id ||
    selectedContract?.client_id ||
    "";

  const sourceJobId =
    selectedQuote?.job_id ||
    selectedContract?.job_id ||
    "";

  const sourceTitle =
    selectedQuote?.title ||
    selectedContract?.title ||
    "Invoice";

  const sourceDescription =
    selectedQuote?.description ||
    selectedContract?.description ||
    "";

  /*
   * Quote value is always preferred when a quote exists.
   *
   * If a contract exists without a quote, its amount becomes
   * the source value instead.
   */
  const sourceTotal = money(
    Number(
      selectedQuote?.amount ??
        selectedContract?.amount ??
        0
    )
  );

  /*
   * Work out how much has already been invoiced.
   */
  let alreadyInvoiced = 0;

  if (sourceQuoteId) {
    const {
      data: existingInvoices,
      error: existingInvoicesError,
    } = await supabase
      .from("invoices")
      .select("amount, status")
      .eq("quote_id", sourceQuoteId)
      .neq("status", "Cancelled");

    if (existingInvoicesError) {
      throw new Error(
        existingInvoicesError.message
      );
    }

    alreadyInvoiced = money(
      (existingInvoices ?? []).reduce(
        (sum, invoice) =>
          sum +
          Number(invoice.amount ?? 0),
        0
      )
    );
  } else if (selectedContractId) {
    const {
      data: existingInvoices,
      error: existingInvoicesError,
    } = await supabase
      .from("invoices")
      .select("amount, status")
      .eq(
        "contract_id",
        selectedContractId
      )
      .neq("status", "Cancelled");

    if (existingInvoicesError) {
      throw new Error(
        existingInvoicesError.message
      );
    }

    alreadyInvoiced = money(
      (existingInvoices ?? []).reduce(
        (sum, invoice) =>
          sum +
          Number(invoice.amount ?? 0),
        0
      )
    );
  }

  const remainingBalance =
    sourceTotal > 0
      ? money(
          Math.max(
            0,
            sourceTotal -
              alreadyInvoiced
          )
        )
      : 0;

  const hasSource =
    Boolean(
      sourceQuoteId ||
        selectedContractId
    );

  const fullyInvoiced =
    hasSource &&
    sourceTotal > 0 &&
    remainingBalance <= 0;

  const partInvoiced =
    alreadyInvoiced > 0 &&
    remainingBalance > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">
            DryHome Office
          </p>

          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            New Invoice
          </h1>

          <p className="mt-1 text-sm text-slate-600">
            Create a deposit,
            interim or final invoice.
          </p>
        </div>

        <Link
          href="/invoices"
          className="inline-flex w-fit items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Back to Invoices
        </Link>
      </div>

      {hasSource &&
        sourceTotal > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Invoice Balance
                </h2>

                <p className="text-sm text-slate-500">
                  Based on the
                  accepted quote /
                  signed contract.
                </p>
              </div>

              {fullyInvoiced ? (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">
                  Fully Invoiced
                </span>
              ) : partInvoiced ? (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
                  Part Invoiced
                </span>
              ) : (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                  Not Yet Invoiced
                </span>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Quote Value
                </p>

                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {formatMoney(
                    sourceTotal
                  )}
                </p>
              </div>

              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Already Invoiced
                </p>

                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {formatMoney(
                    alreadyInvoiced
                  )}
                </p>
              </div>

              <div className="rounded-lg bg-slate-900 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-300">
                  Remaining to
                  Invoice
                </p>

                <p className="mt-1 text-xl font-semibold text-white">
                  {formatMoney(
                    remainingBalance
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

      {fullyInvoiced ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
          <h2 className="text-lg font-semibold text-emerald-900">
            This quote is fully
            invoiced
          </h2>

          <p className="mt-2 text-sm text-emerald-800">
            The full value of{" "}
            {formatMoney(sourceTotal)}{" "}
            has already been
            invoiced. No further
            invoice can be raised
            against this quote
            unless an existing
            invoice is cancelled.
          </p>

          {sourceQuoteId && (
            <Link
              href={`/quotes/${sourceQuoteId}`}
              className="mt-4 inline-flex rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
            >
              Return to Quote
            </Link>
          )}
        </div>
      ) : (
        <form
          action={addInvoice}
          className="space-y-6"
        >
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              Invoice Source
            </h2>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="contract_id"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Contract
                </label>

                <select
                  id="contract_id"
                  name="contract_id"
                  defaultValue={
                    selectedContractId
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">
                    No contract
                  </option>

                  {contracts.map(
                    (contract) => (
                      <option
                        key={
                          contract.id
                        }
                        value={
                          contract.id
                        }
                      >
                        {contract.contract_number ||
                          contract.title ||
                          "Signed contract"}
                      </option>
                    )
                  )}
                </select>

                <p className="mt-1 text-xs text-slate-500">
                  Contracts are
                  optional.
                </p>
              </div>

              <div>
                <label
                  htmlFor="quote_id"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Accepted Quote
                </label>

                <select
                  id="quote_id"
                  name="quote_id"
                  defaultValue={
                    sourceQuoteId
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">
                    No linked quote
                  </option>

                  {acceptedQuotes.map(
                    (quote) => (
                      <option
                        key={quote.id}
                        value={quote.id}
                      >
                        {quote.quote_number ||
                          quote.title ||
                          "Accepted quote"}
                      </option>
                    )
                  )}

                  {selectedQuote &&
                    !acceptedQuotes.some(
                      (quote) =>
                        quote.id ===
                        selectedQuote.id
                    ) && (
                      <option
                        value={
                          selectedQuote.id
                        }
                      >
                        {selectedQuote.quote_number ||
                          selectedQuote.title ||
                          "Linked quote"}
                      </option>
                    )}
                </select>
              </div>

              <div>
                <label
                  htmlFor="client_id"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Client
                </label>

                <select
                  id="client_id"
                  name="client_id"
                  required
                  defaultValue={
                    sourceClientId
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">
                    Select client
                  </option>

                  {clients.map(
                    (client) => (
                      <option
                        key={client.id}
                        value={client.id}
                      >
                        {clientName(
                          client
                        )}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label
                  htmlFor="job_id"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Job
                </label>

                <select
                  id="job_id"
                  name="job_id"
                  defaultValue={
                    sourceJobId
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">
                    No linked job
                  </option>

                  {jobs.map(
                    (job) => (
                      <option
                        key={job.id}
                        value={job.id}
                      >
                        {jobName(job)}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              Invoice Details
            </h2>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="invoice_type"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Invoice Type
                </label>

                <select
                  id="invoice_type"
                  name="invoice_type"
                  defaultValue={
                    alreadyInvoiced > 0
                      ? "Interim"
                      : "Deposit"
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="Deposit">
                    Deposit
                  </option>

                  <option value="Interim">
                    Interim
                  </option>

                  <option value="Final">
                    Final
                  </option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="title"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Invoice Title
                </label>

                <input
                  id="title"
                  name="title"
                  type="text"
                  defaultValue={
                    sourceTitle
                  }
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="invoice_date"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Invoice Date
                </label>

                <input
                  id="invoice_date"
                  name="invoice_date"
                  type="date"
                  defaultValue={
                    todayDate()
                  }
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="due_date"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Due Date
                </label>

                <input
                  id="due_date"
                  name="due_date"
                  type="date"
                  defaultValue={
                    defaultDueDate()
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="description"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Description
                </label>

                <textarea
                  id="description"
                  name="description"
                  rows={4}
                  defaultValue={
                    sourceDescription
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          <InvoiceForm
            defaultAmount={
              hasSource
                ? remainingBalance
                : 0
            }
            defaultDescription={
              sourceTitle
            }
            maxAmount={
              hasSource &&
              sourceTotal > 0
                ? remainingBalance
                : undefined
            }
          />

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              Customer & Payment
            </h2>

            <div className="space-y-5">
              <div>
                <label
                  htmlFor="customer_message"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Customer Message
                </label>

                <textarea
                  id="customer_message"
                  name="customer_message"
                  rows={3}
                  placeholder="Optional message shown to the customer."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="payment_terms"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Payment Terms
                </label>

                <textarea
                  id="payment_terms"
                  name="payment_terms"
                  rows={3}
                  defaultValue="Payment due within 7 days of invoice date."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="internal_notes"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Internal Notes
                </label>

                <textarea
                  id="internal_notes"
                  name="internal_notes"
                  rows={3}
                  placeholder="These notes are for DryHome Office only."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Link
              href="/invoices"
              className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Link>

            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Create Invoice
            </button>
          </div>
        </form>
      )}
    </div>
  );
}