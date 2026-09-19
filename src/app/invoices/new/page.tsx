import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import InvoiceForm from "@/components/InvoiceForm";
import { createClient } from "@/lib/supabase/server";
import { addInvoice } from "../actions";

type NewInvoicePageProps = {
  searchParams: Promise<{
    contract?: string;
    quote?: string;
    error?: string;
  }>;
};

export default async function NewInvoicePage({
  searchParams,
}: NewInvoicePageProps) {
  const params =
    await searchParams;

  const selectedContractId =
    params.contract || "";

  const selectedQuoteId =
    params.quote || "";

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
      .from("contracts")
      .select(`
        id,
        contract_number,
        client_id,
        job_id,
        quote_id,
        title,
        description,
        amount,
        status
      `)
      .eq(
        "status",
        "Signed"
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
        client_id,
        job_id,
        title,
        description,
        amount,
        status
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

  const contracts =
    contractsResult.data ?? [];

  const quotes =
    quotesResult.data ?? [];

  const selectedContract =
    contracts.find(
      (contract) =>
        contract.id ===
        selectedContractId
    ) || null;

  const selectedQuote =
    !selectedContract
      ? quotes.find(
          (quote) =>
            quote.id ===
            selectedQuoteId
        ) || null
      : null;

  const selectedClientId =
    selectedContract?.client_id ||
    selectedQuote?.client_id ||
    "";

  const selectedJobId =
    selectedContract?.job_id ||
    selectedQuote?.job_id ||
    "";

  const sourceQuoteId =
    selectedContract?.quote_id ||
    selectedQuote?.id ||
    "";

  const sourceTitle =
    selectedContract?.title ||
    selectedQuote?.title ||
    "";

  const sourceDescription =
    selectedContract?.description ||
    selectedQuote?.description ||
    "";

  const sourceAmount =
    Number(
      selectedContract?.amount ??
        selectedQuote?.amount ??
        0
    );

  const today =
    new Date()
      .toISOString()
      .slice(0, 10);

  const dueDate =
    new Date();

  dueDate.setDate(
    dueDate.getDate() + 14
  );

  const defaultDueDate =
    dueDate
      .toISOString()
      .slice(0, 10);

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8">
            <Link
              href="/invoices"
              className="text-sm font-medium text-slate-500 hover:text-slate-900"
            >
              ← Back to Invoices
            </Link>

            <h1 className="mt-4 text-3xl font-bold text-slate-900">
              Create Invoice
            </h1>

            <p className="mt-2 text-slate-500">
              Create an invoice from a signed contract,
              accepted quote or directly against a client
              and job.
            </p>
          </div>

          {params.error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
              {decodeURIComponent(
                params.error
              )}
            </div>
          )}

          {selectedQuote &&
            !selectedContract && (
              <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
                <p className="text-sm font-semibold text-emerald-900">
                  Creating invoice directly from accepted
                  quote
                </p>

                <p className="mt-1 text-sm text-emerald-800">
                  No contract is required for this invoice.
                  The invoice will remain linked to the
                  original quote and job.
                </p>
              </div>
            )}

          <form
            action={
              addInvoice
            }
          >
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                Invoice Source
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                A signed contract is optional. You can also
                invoice directly from an accepted quote.
              </p>

              <div className="mt-6">
                <label
                  htmlFor="contract_id"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Signed Contract
                </label>

                <select
                  id="contract_id"
                  name="contract_id"
                  defaultValue={
                    selectedContractId
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
                >
                  <option value="">
                    No linked contract
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
                        {
                          contract.contract_number
                        }{" "}
                        —{" "}
                        {
                          contract.title
                        }{" "}
                        —{" "}
                        {formatCurrency(
                          contract.amount
                        )}
                      </option>
                    )
                  )}
                </select>
              </div>

              {selectedContract && (
                <div className="mt-6 rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Selected Contract
                  </p>

                  <p className="mt-1 font-semibold text-slate-900">
                    {
                      selectedContract.contract_number
                    }{" "}
                    —{" "}
                    {
                      selectedContract.title
                    }
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    {formatCurrency(
                      selectedContract.amount
                    )}
                  </p>

                  <Link
                    href={`/contracts/${selectedContract.id}`}
                    className="mt-2 inline-block text-sm font-semibold text-slate-700 hover:underline"
                  >
                    View Contract →
                  </Link>
                </div>
              )}

              {selectedQuote &&
                !selectedContract && (
                  <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                      Accepted Quote
                    </p>

                    <p className="mt-1 font-semibold text-emerald-950">
                      {
                        selectedQuote.quote_number
                      }{" "}
                      —{" "}
                      {
                        selectedQuote.title
                      }
                    </p>

                    <p className="mt-1 text-sm text-emerald-800">
                      {formatCurrency(
                        selectedQuote.amount
                      )}
                    </p>

                    <Link
                      href={`/quotes/${selectedQuote.id}`}
                      className="mt-2 inline-block text-sm font-semibold text-emerald-800 hover:underline"
                    >
                      View Quote →
                    </Link>
                  </div>
                )}
            </section>

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

              <input
                type="hidden"
                name="quote_id"
                value={
                  sourceQuoteId
                }
              />
            </section>

            <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                Invoice Details
              </h2>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="invoice_type"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Invoice Type
                  </label>

                  <select
                    id="invoice_type"
                    name="invoice_type"
                    defaultValue="Final"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
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
                    className="mb-2 block text-sm font-medium text-slate-700"
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
                    placeholder="e.g. Final Invoice - Damp Proofing Works"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="invoice_date"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Invoice Date
                  </label>

                  <input
                    id="invoice_date"
                    name="invoice_date"
                    type="date"
                    defaultValue={
                      today
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="due_date"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Due Date
                  </label>

                  <input
                    id="due_date"
                    name="due_date"
                    type="date"
                    defaultValue={
                      defaultDueDate
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>
              </div>

              <div className="mt-5">
                <label
                  htmlFor="description"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Description
                </label>

                <textarea
                  id="description"
                  name="description"
                  rows={6}
                  defaultValue={
                    sourceDescription
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
                />
              </div>
            </section>

            <InvoiceForm
              defaultAmount={
                sourceAmount
              }
              defaultDescription={
                sourceTitle
              }
            />

            <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                Customer Message
              </h2>

              <textarea
                name="customer_message"
                rows={4}
                defaultValue="Thank you for your business. Please see the invoice details above."
                className="mt-5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
              />
            </section>

            <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                Payment Terms
              </h2>

              <textarea
                name="payment_terms"
                rows={4}
                defaultValue="Payment is due within 14 days of the invoice date unless otherwise agreed."
                className="mt-5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
              />
            </section>

            <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                Internal Notes
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                These notes are for DryHome only.
              </p>

              <textarea
                name="internal_notes"
                rows={4}
                className="mt-5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
              />
            </section>

            <div className="mt-8 flex justify-end gap-3">
              <Link
                href="/invoices"
                className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Link>

              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700"
              >
                Save Draft Invoice
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
    Number(
      value ?? 0
    )
  );
}