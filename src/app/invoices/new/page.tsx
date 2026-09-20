import Link from "next/link";

import {
  createClient,
} from "@/lib/supabase/server";

import InvoiceForm, {
  type InvoiceDefaultItem,
} from "@/components/InvoiceForm";

import {
  addInvoice,
} from "../actions";

type SearchParams =
  Promise<{
    contract?: string;
    quote?: string;
  }>;

function clientName(
  client: any
) {
  if (
    !client
  ) {
    return "Unknown client";
  }

  if (
    client.display_name
  ) {
    return client.display_name;
  }

  const personalName =
    [
      client.first_name,
      client.last_name,
    ]
      .filter(
        Boolean
      )
      .join(" ")
      .trim();

  if (
    personalName
  ) {
    return personalName;
  }

  if (
    client.company_name
  ) {
    return client.company_name;
  }

  return "Unnamed client";
}

function jobName(
  job: any
) {
  if (
    !job
  ) {
    return "Unknown job";
  }

  const number =
    job.job_number ||
    "Job";

  const title =
    job.title ||
    "";

  return title
    ? `${number} — ${title}`
    : number;
}

function money(
  value: number
) {
  return Math.round(
    (
      value +
      Number.EPSILON
    ) *
      100
  ) / 100;
}

function formatMoney(
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

function invoiceRowTotal(
  invoice: {
    amount?:
      | number
      | string
      | null;

    subtotal?:
      | number
      | string
      | null;

    vat_amount?:
      | number
      | string
      | null;
  }
) {
  const amount =
    Number(
      invoice.amount ??
        0
    );

  if (
    Number.isFinite(
      amount
    ) &&
    amount >
      0
  ) {
    return money(
      amount
    );
  }

  const subtotal =
    Number(
      invoice.subtotal ??
        0
    );

  const vatAmount =
    Number(
      invoice.vat_amount ??
        0
    );

  return money(
    (
      Number.isFinite(
        subtotal
      )
        ? subtotal
        : 0
    ) +
      (
        Number.isFinite(
          vatAmount
        )
          ? vatAmount
          : 0
      )
  );
}

function todayDate() {
  return new Date()
    .toISOString()
    .slice(
      0,
      10
    );
}

function defaultDueDate() {
  const date =
    new Date();

  date.setDate(
    date.getDate() +
      7
  );

  return date
    .toISOString()
    .slice(
      0,
      10
    );
}

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams:
    SearchParams;
}) {
  const params =
    await searchParams;

  const selectedContractId =
    params.contract ??
    "";

  const selectedQuoteId =
    params.quote ??
    "";

  const supabase =
    await createClient();

  /* =========================================================
     CORE RECORDS
     ========================================================= */

  const [
    clientsResult,
    jobsResult,
    contractsResult,
    quotesResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "clients"
        )
        .select("*")
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        ),

      supabase
        .from(
          "jobs"
        )
        .select("*")
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        ),

      supabase
        .from(
          "contracts"
        )
        .select("*")
        .eq(
          "status",
          "Signed"
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        ),

      supabase
        .from(
          "quotes"
        )
        .select("*")
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        ),
    ]);

  if (
    clientsResult.error
  ) {
    throw new Error(
      clientsResult.error.message
    );
  }

  if (
    jobsResult.error
  ) {
    throw new Error(
      jobsResult.error.message
    );
  }

  if (
    contractsResult.error
  ) {
    throw new Error(
      contractsResult.error.message
    );
  }

  if (
    quotesResult.error
  ) {
    throw new Error(
      quotesResult.error.message
    );
  }

  const clients =
    clientsResult.data ??
    [];

  const jobs =
    jobsResult.data ??
    [];

  const contracts =
    contractsResult.data ??
    [];

  const quotes =
    quotesResult.data ??
    [];

  const acceptedQuotes =
    quotes.filter(
      (
        quote
      ) =>
        quote.status ===
        "Accepted"
    );

  const selectedContract =
    contracts.find(
      (
        contract
      ) =>
        contract.id ===
        selectedContractId
    ) ??
    null;

  /*
   * If the selected contract belongs to a quote,
   * use that quote automatically.
   */

  const sourceQuoteId =
    selectedQuoteId ||
    selectedContract?.quote_id ||
    "";

  const selectedQuote =
    quotes.find(
      (
        quote
      ) =>
        quote.id ===
        sourceQuoteId
    ) ??
    null;

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

  /* =========================================================
     ORIGINAL QUOTE
     ========================================================= */

  const quoteTotal =
    selectedQuote
      ? money(
          Number(
            selectedQuote.amount ??
              0
          )
        )
      : 0;

  /* =========================================================
     ACCEPTED VARIATIONS
     ========================================================= */

  let acceptedVariations:
    {
      id: string;
      quote_id:
        | string
        | null;
      variation_number:
        | string
        | null;
      title:
        | string
        | null;
      amount:
        | number
        | string
        | null;
      accepted_at:
        | string
        | null;
      created_at:
        | string
        | null;
    }[] = [];

  if (
    sourceQuoteId &&
    sourceJobId
  ) {
    const {
      data:
        variationRows,
      error:
        variationsError,
    } =
      await supabase
        .from(
          "variations"
        )
        .select(`
          id,
          quote_id,
          variation_number,
          title,
          amount,
          accepted_at,
          created_at
        `)
        .eq(
          "job_id",
          sourceJobId
        )
        .eq(
          "status",
          "Accepted"
        );

    if (
      variationsError
    ) {
      throw new Error(
        variationsError.message
      );
    }

    acceptedVariations =
      (
        variationRows ??
        []
      )
        .filter(
          (
            variation
          ) =>
            !variation.quote_id ||
            variation.quote_id ===
              sourceQuoteId
        )
        .sort(
          (
            a,
            b
          ) => {
            const first =
              a.accepted_at ||
              a.created_at ||
              "";

            const second =
              b.accepted_at ||
              b.created_at ||
              "";

            return first.localeCompare(
              second
            );
          }
        );
  }

  const acceptedVariationValue =
    money(
      acceptedVariations.reduce(
        (
          sum,
          variation
        ) =>
          sum +
          Number(
            variation.amount ??
              0
          ),
        0
      )
    );

  /* =========================================================
     APPROVED JOB VALUE
     ========================================================= */

  const approvedJobValue =
    sourceQuoteId
      ? money(
          quoteTotal +
            acceptedVariationValue
        )
      : money(
          Number(
            selectedContract?.amount ??
              0
          )
        );

  /* =========================================================
     ALREADY INVOICED
     ========================================================= */

  let alreadyInvoiced =
    0;

  if (
    sourceQuoteId
  ) {
    let invoiceQuery =
      supabase
        .from(
          "invoices"
        )
        .select(`
          amount,
          subtotal,
          vat_amount,
          status
        `)
        .neq(
          "status",
          "Cancelled"
        );

    if (
      sourceJobId
    ) {
      invoiceQuery =
        invoiceQuery.eq(
          "job_id",
          sourceJobId
        );
    } else {
      invoiceQuery =
        invoiceQuery.eq(
          "quote_id",
          sourceQuoteId
        );
    }

    const {
      data:
        existingInvoices,
      error:
        existingInvoicesError,
    } =
      await invoiceQuery;

    if (
      existingInvoicesError
    ) {
      throw new Error(
        existingInvoicesError.message
      );
    }

    alreadyInvoiced =
      money(
        (
          existingInvoices ??
          []
        ).reduce(
          (
            sum,
            invoice
          ) =>
            sum +
            invoiceRowTotal(
              invoice
            ),
          0
        )
      );
  } else if (
    selectedContractId
  ) {
    const {
      data:
        existingInvoices,
      error:
        existingInvoicesError,
    } =
      await supabase
        .from(
          "invoices"
        )
        .select(`
          amount,
          subtotal,
          vat_amount,
          status
        `)
        .eq(
          "contract_id",
          selectedContractId
        )
        .neq(
          "status",
          "Cancelled"
        );

    if (
      existingInvoicesError
    ) {
      throw new Error(
        existingInvoicesError.message
      );
    }

    alreadyInvoiced =
      money(
        (
          existingInvoices ??
          []
        ).reduce(
          (
            sum,
            invoice
          ) =>
            sum +
            invoiceRowTotal(
              invoice
            ),
          0
        )
      );
  }

  const remainingBalance =
    approvedJobValue >
    0
      ? money(
          Math.max(
            0,
            approvedJobValue -
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
    approvedJobValue >
      0 &&
    remainingBalance <=
      0;

  const partInvoiced =
    alreadyInvoiced >
      0 &&
    remainingBalance >
      0;

  /* =========================================================
     SUGGESTED INVOICE LINES

     We use a simple accounting order:
     original quote first, then accepted variations.

     This only creates suggested editable invoice lines.
     The authoritative limit remains Approved Job Value.
     ========================================================= */

  const defaultItems:
    InvoiceDefaultItem[] =
      [];

  if (
    selectedQuote &&
    remainingBalance >
      0
  ) {
    let valueAlreadyAllocated =
      alreadyInvoiced;

    const invoicedAgainstOriginal =
      Math.min(
        quoteTotal,
        Math.max(
          0,
          valueAlreadyAllocated
        )
      );

    const originalRemaining =
      money(
        Math.max(
          0,
          quoteTotal -
            invoicedAgainstOriginal
        )
      );

    valueAlreadyAllocated =
      money(
        Math.max(
          0,
          valueAlreadyAllocated -
            invoicedAgainstOriginal
        )
      );

    if (
      originalRemaining >
      0
    ) {
      const quoteReference =
        selectedQuote.quote_number
          ? ` ${selectedQuote.quote_number}`
          : "";

      const quoteTitle =
        selectedQuote.title
          ? ` – ${selectedQuote.title}`
          : "";

      defaultItems.push({
        description:
          `Original quotation${quoteReference}${quoteTitle}`,
        quantity:
          1,
        unit:
          "item",
        unit_price:
          originalRemaining,
        item_type:
          "Labour",
      });
    }

    for (
      const variation of
      acceptedVariations
    ) {
      const variationValue =
        money(
          Number(
            variation.amount ??
              0
          )
        );

      const allocatedToVariation =
        Math.min(
          variationValue,
          valueAlreadyAllocated
        );

      const variationRemaining =
        money(
          Math.max(
            0,
            variationValue -
              allocatedToVariation
          )
        );

      valueAlreadyAllocated =
        money(
          Math.max(
            0,
            valueAlreadyAllocated -
              allocatedToVariation
          )
        );

      if (
        variationRemaining <=
        0
      ) {
        continue;
      }

      const reference =
        variation.variation_number ||
        "Variation";

      const title =
        variation.title
          ? ` – ${variation.title}`
          : "";

      defaultItems.push({
        description:
          `${reference}${title}`,
        quantity:
          1,
        unit:
          "item",
        unit_price:
          variationRemaining,
        item_type:
          "Labour",
      });
    }
  }

  /* =========================================================
     RETURN
     ========================================================= */

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
            Create a deposit, interim or final invoice from the approved job value.
          </p>
        </div>

        <Link
          href="/invoices"
          className="inline-flex w-fit items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Back to Invoices
        </Link>
      </div>

      {/* =====================================================
          APPROVED JOB VALUE
          ===================================================== */}

      {hasSource &&
        approvedJobValue >
          0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Approved Job Value
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Original quotation plus all customer-approved variations.
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

          {sourceQuoteId && (
            <div className="grid gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-5">
              <ValueCard
                label="Original Quote"
                value={
                  quoteTotal
                }
              />

              <ValueCard
                label="Accepted Variations"
                value={
                  acceptedVariationValue
                }
                highlight={
                  acceptedVariationValue >
                  0
                }
              />

              <ValueCard
                label="Approved Job Value"
                value={
                  approvedJobValue
                }
                strong
              />

              <ValueCard
                label="Already Invoiced"
                value={
                  alreadyInvoiced
                }
              />

              <ValueCard
                label="Remaining"
                value={
                  remainingBalance
                }
                dark
              />
            </div>
          )}

          {!sourceQuoteId && (
            <div className="grid gap-px bg-slate-200 sm:grid-cols-3">
              <ValueCard
                label="Contract Value"
                value={
                  approvedJobValue
                }
              />

              <ValueCard
                label="Already Invoiced"
                value={
                  alreadyInvoiced
                }
              />

              <ValueCard
                label="Remaining"
                value={
                  remainingBalance
                }
                dark
              />
            </div>
          )}

          {acceptedVariations.length >
            0 && (
            <div className="border-t border-slate-200 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Accepted Additional Works
              </p>

              <div className="mt-3 divide-y divide-slate-100">
                {acceptedVariations.map(
                  (
                    variation
                  ) => (
                    <div
                      key={
                        variation.id
                      }
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {variation.variation_number ||
                            "Variation"}
                          {variation.title
                            ? ` – ${variation.title}`
                            : ""}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Approved additional works
                        </p>
                      </div>

                      <p className="font-semibold text-slate-900">
                        {formatMoney(
                          money(
                            Number(
                              variation.amount ??
                                0
                            )
                          )
                        )}
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================
          FULLY INVOICED
          ===================================================== */}

      {fullyInvoiced ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
          <h2 className="text-lg font-semibold text-emerald-900">
            This job is fully invoiced
          </h2>

          <p className="mt-2 text-sm leading-6 text-emerald-800">
            The full approved job value of{" "}
            {formatMoney(
              approvedJobValue
            )}{" "}
            has already been invoiced. A further invoice can only be raised if
            an existing invoice is cancelled or another variation is approved.
          </p>

          {sourceJobId && (
            <Link
              href={`/jobs/${sourceJobId}`}
              className="mt-4 inline-flex rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
            >
              Return to Job Hub
            </Link>
          )}
        </div>
      ) : (
        <form
          action={
            addInvoice
          }
          className="space-y-6"
        >
          {/* =================================================
              SOURCE
              ================================================= */}

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
                    (
                      contract
                    ) => (
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
                  Contracts are optional.
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
                        {quote.quote_number ||
                          quote.title ||
                          "Accepted quote"}
                      </option>
                    )
                  )}

                  {selectedQuote &&
                    !acceptedQuotes.some(
                      (
                        quote
                      ) =>
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
                    (
                      client
                    ) => (
                      <option
                        key={
                          client.id
                        }
                        value={
                          client.id
                        }
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
                    (
                      job
                    ) => (
                      <option
                        key={
                          job.id
                        }
                        value={
                          job.id
                        }
                      >
                        {jobName(
                          job
                        )}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* =================================================
              DETAILS
              ================================================= */}

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
                    alreadyInvoiced >
                    0
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
                  rows={
                    4
                  }
                  defaultValue={
                    sourceDescription
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          {/* =================================================
              LINE ITEMS
              ================================================= */}

          <InvoiceForm
            defaultAmount={
              hasSource
                ? remainingBalance
                : 0
            }
            defaultDescription={
              sourceTitle
            }
            defaultItems={
              defaultItems
            }
            maxAmount={
              hasSource &&
              approvedJobValue >
                0
                ? remainingBalance
                : undefined
            }
          />

          {/* =================================================
              CUSTOMER & PAYMENT
              ================================================= */}

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
                  rows={
                    3
                  }
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
                  rows={
                    3
                  }
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
                  rows={
                    3
                  }
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

function ValueCard({
  label,
  value,
  strong = false,
  dark = false,
  highlight = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
  dark?: boolean;
  highlight?: boolean;
}) {
  if (
    dark
  ) {
    return (
      <div className="bg-slate-900 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-300">
          {label}
        </p>

        <p className="mt-1 text-xl font-semibold text-white">
          {formatMoney(
            value
          )}
        </p>
      </div>
    );
  }

  return (
    <div
      className={
        highlight
          ? "bg-amber-50 p-4"
          : "bg-white p-4"
      }
    >
      <p
        className={
          highlight
            ? "text-xs font-medium uppercase tracking-wide text-amber-700"
            : "text-xs font-medium uppercase tracking-wide text-slate-500"
        }
      >
        {label}
      </p>

      <p
        className={`mt-1 text-xl ${
          strong
            ? "font-bold"
            : "font-semibold"
        } ${
          highlight
            ? "text-amber-950"
            : "text-slate-900"
        }`}
      >
        {formatMoney(
          value
        )}
      </p>
    </div>
  );
}