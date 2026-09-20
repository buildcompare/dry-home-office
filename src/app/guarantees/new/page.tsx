import Link from "next/link";
import {
  redirect,
} from "next/navigation";

import Sidebar from "@/components/Sidebar";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  createGuarantee,
} from "../actions";

type GuaranteeNewPageProps = {
  searchParams: Promise<{
    invoice?: string;
    error?: string;
  }>;
};

export default async function NewGuaranteePage({
  searchParams,
}: GuaranteeNewPageProps) {
  const query =
    await searchParams;

  const invoiceId =
    query.invoice ||
    "";

  if (
    !invoiceId
  ) {
    redirect(
      "/invoices"
    );
  }

  const supabase =
    await createClient();

  /* =========================================================
     SOURCE INVOICE
     ========================================================= */

  const {
    data: invoice,
    error:
      invoiceError,
  } =
    await supabase
      .from(
        "invoices"
      )
      .select(`
        id,
        invoice_number,
        invoice_type,
        status,
        title,
        description,
        amount,
        subtotal,
        vat_amount,
        amount_paid,
        client_id,
        job_id,
        contract_id,
        quote_id,

        clients (
          id,
          display_name,
          email
        ),

        jobs (
          id,
          job_number,
          title,
          description
        ),

        contracts (
          id,
          contract_number,
          title,
          description
        )
      `)
      .eq(
        "id",
        invoiceId
      )
      .single();

  if (
    invoiceError ||
    !invoice
  ) {
    redirect(
      "/invoices"
    );
  }

  if (
    !invoice.quote_id
  ) {
    redirect(
      `/invoices/${invoice.id}?error=This%20invoice%20is%20not%20linked%20to%20an%20accepted%20quote.%20Guarantees%20are%20created%20once%20the%20approved%20job%20is%20financially%20complete`
    );
  }

  /* =========================================================
     QUOTE
     ========================================================= */

  const {
    data: quote,
    error:
      quoteError,
  } =
    await supabase
      .from(
        "quotes"
      )
      .select(`
        id,
        quote_number,
        title,
        description,
        status,
        amount,
        job_id
      `)
      .eq(
        "id",
        invoice.quote_id
      )
      .single();

  if (
    quoteError ||
    !quote
  ) {
    redirect(
      `/invoices/${invoice.id}?error=The%20linked%20quote%20could%20not%20be%20found`
    );
  }

  const resolvedJobId =
    invoice.job_id ||
    quote.job_id ||
    null;

  /* =========================================================
     ACCEPTED VARIATIONS
     ========================================================= */

  let acceptedVariations:
    {
      id: string;
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
      quote_id:
        | string
        | null;
    }[] = [];

  if (
    resolvedJobId
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
          variation_number,
          title,
          amount,
          quote_id
        `)
        .eq(
          "job_id",
          resolvedJobId
        )
        .eq(
          "status",
          "Accepted"
        )
        .order(
          "created_at",
          {
            ascending:
              true,
          }
        );

    if (
      variationsError
    ) {
      redirect(
        `/invoices/${invoice.id}?error=Accepted%20variations%20could%20not%20be%20checked`
      );
    }

    acceptedVariations =
      (
        variationRows ??
        []
      ).filter(
        (
          variation
        ) =>
          !variation.quote_id ||
          variation.quote_id ===
            quote.id
      );
  }

  /* =========================================================
     APPROVED JOB VALUE
     ========================================================= */

  const quoteTotal =
    money(
      Number(
        quote.amount ??
          0
      )
    );

  const acceptedVariationValue =
    money(
      acceptedVariations.reduce(
        (
          total,
          variation
        ) =>
          total +
          Number(
            variation.amount ??
              0
          ),
        0
      )
    );

  const approvedJobValue =
    money(
      quoteTotal +
        acceptedVariationValue
    );

  /* =========================================================
     ACTIVE JOB INVOICES
     ========================================================= */

  let linkedInvoices:
    {
      id: string;
      invoice_number:
        | string
        | null;
      status: string;
      amount:
        | number
        | string
        | null;
      subtotal:
        | number
        | string
        | null;
      vat_amount:
        | number
        | string
        | null;
      amount_paid:
        | number
        | string
        | null;
      created_at:
        | string
        | null;
    }[] = [];

  if (
    resolvedJobId
  ) {
    const {
      data:
        invoiceRows,
      error:
        linkedInvoicesError,
    } =
      await supabase
        .from(
          "invoices"
        )
        .select(`
          id,
          invoice_number,
          status,
          amount,
          subtotal,
          vat_amount,
          amount_paid,
          created_at
        `)
        .eq(
          "job_id",
          resolvedJobId
        )
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

    if (
      linkedInvoicesError
    ) {
      redirect(
        `/invoices/${invoice.id}?error=The%20job%20invoices%20could%20not%20be%20checked`
      );
    }

    linkedInvoices =
      invoiceRows ??
      [];
  } else {
    const {
      data:
        invoiceRows,
      error:
        linkedInvoicesError,
    } =
      await supabase
        .from(
          "invoices"
        )
        .select(`
          id,
          invoice_number,
          status,
          amount,
          subtotal,
          vat_amount,
          amount_paid,
          created_at
        `)
        .eq(
          "quote_id",
          quote.id
        )
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

    if (
      linkedInvoicesError
    ) {
      redirect(
        `/invoices/${invoice.id}?error=The%20linked%20invoices%20could%20not%20be%20checked`
      );
    }

    linkedInvoices =
      invoiceRows ??
      [];
  }

  /* =========================================================
     FINANCIAL STATUS
     ========================================================= */

  const totalInvoiced =
    money(
      linkedInvoices.reduce(
        (
          total,
          linkedInvoice
        ) =>
          total +
          invoiceRowTotal(
            linkedInvoice
          ),
        0
      )
    );

  const totalPaid =
    money(
      linkedInvoices.reduce(
        (
          total,
          linkedInvoice
        ) =>
          total +
          Number(
            linkedInvoice.amount_paid ??
              0
          ),
        0
      )
    );

  const remainingToInvoice =
    money(
      Math.max(
        0,
        approvedJobValue -
          totalInvoiced
      )
    );

  const outstanding =
    money(
      linkedInvoices.reduce(
        (
          total,
          linkedInvoice
        ) => {
          const invoiceTotal =
            invoiceRowTotal(
              linkedInvoice
            );

          const amountPaid =
            Number(
              linkedInvoice.amount_paid ??
                0
            );

          return (
            total +
            Math.max(
              0,
              invoiceTotal -
                amountPaid
            )
          );
        },
        0
      )
    );

  const fullyInvoiced =
    approvedJobValue >
      0 &&
    totalInvoiced >=
      approvedJobValue -
        0.009;

  const everyInvoicePaid =
    linkedInvoices.length >
      0 &&
    linkedInvoices.every(
      (
        linkedInvoice
      ) => {
        const invoiceTotal =
          invoiceRowTotal(
            linkedInvoice
          );

        const amountPaid =
          Number(
            linkedInvoice.amount_paid ??
              0
          );

        return (
          invoiceTotal >
            0 &&
          amountPaid >=
            invoiceTotal -
              0.009
        );
      }
    );

  const financiallyComplete =
    fullyInvoiced &&
    everyInvoicePaid;

  if (
    !financiallyComplete
  ) {
    redirect(
      `/invoices/${invoice.id}?error=${encodeURIComponent(
        "The approved job must be fully invoiced and every active invoice must be paid in full before a guarantee can be created."
      )}`
    );
  }

  /* =========================================================
     DUPLICATE GUARANTEE CHECK
     ========================================================= */

  const linkedInvoiceIds =
    linkedInvoices.map(
      (
        linkedInvoice
      ) =>
        linkedInvoice.id
    );

  if (
    linkedInvoiceIds.length >
    0
  ) {
    const {
      data:
        existingGuarantees,
    } =
      await supabase
        .from(
          "guarantees"
        )
        .select(
          "id"
        )
        .in(
          "invoice_id",
          linkedInvoiceIds
        )
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
        )
        .limit(
          1
        );

    const existingGuarantee =
      existingGuarantees?.[0];

    if (
      existingGuarantee
    ) {
      redirect(
        `/guarantees/${existingGuarantee.id}`
      );
    }
  }

  /* =========================================================
     RELATED RECORDS
     ========================================================= */

  const client =
    Array.isArray(
      invoice.clients
    )
      ? invoice.clients[0]
      : invoice.clients;

  const job =
    Array.isArray(
      invoice.jobs
    )
      ? invoice.jobs[0]
      : invoice.jobs;

  const contract =
    Array.isArray(
      invoice.contracts
    )
      ? invoice.contracts[0]
      : invoice.contracts;

  const clientName =
    client?.display_name ||
    "Unknown client";

  /* =========================================================
     DEFAULT GUARANTEE DATES
     ========================================================= */

  const today =
    new Date()
      .toISOString()
      .slice(
        0,
        10
      );

  const defaultDuration =
    10;

  const expiry =
    new Date();

  expiry.setFullYear(
    expiry.getFullYear() +
      defaultDuration
  );

  const defaultExpiryDate =
    expiry
      .toISOString()
      .slice(
        0,
        10
      );

  const defaultTitle =
    job?.title ||
    contract?.title ||
    quote.title ||
    invoice.title ||
    "Works Guarantee";

  const defaultCoveredWorks =
    job?.description ||
    contract?.description ||
    quote.description ||
    invoice.description ||
    "";

  const backHref =
    resolvedJobId
      ? `/jobs/${resolvedJobId}`
      : `/quotes/${quote.id}`;

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-5xl">

          {/* =================================================
              BACK
              ================================================= */}

          <div className="flex flex-wrap items-center gap-4">
            <Link
              href={
                backHref
              }
              className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
            >
              ←{" "}
              {resolvedJobId
                ? "Back to Job Hub"
                : "Back to Quote"}
            </Link>

            <Link
              href={`/invoices/${invoice.id}`}
              className="text-sm font-medium text-slate-500 hover:text-slate-900"
            >
              View Source Invoice
            </Link>
          </div>

          {/* =================================================
              HEADER
              ================================================= */}

          <div className="mt-4">
            <p className="text-sm font-medium text-emerald-700">
              Financially Complete Job
            </p>

            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              Create Guarantee
            </h1>

            <p className="mt-2 text-slate-500">
              Create the customer guarantee for{" "}
              {clientName}.
            </p>
          </div>

          {query.error && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
              {query.error}
            </div>
          )}

          {/* =================================================
              FINANCIALLY COMPLETE
              ================================================= */}

          <section className="mt-8 overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50">
            <div className="p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Guarantee Available
              </p>

              <h2 className="mt-2 text-xl font-bold text-emerald-950">
                The approved job is financially complete
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-800">
                The original quotation and all accepted variations have
                been fully invoiced, and every active invoice for the job
                has been paid in full.
              </p>
            </div>

            <div className="grid gap-px bg-emerald-200 sm:grid-cols-2 lg:grid-cols-5">
              <FinancialDetail
                label="Original Quote"
                value={formatCurrency(
                  quoteTotal
                )}
              />

              <FinancialDetail
                label="Accepted Variations"
                value={formatCurrency(
                  acceptedVariationValue
                )}
              />

              <FinancialDetail
                label="Approved Job Value"
                value={formatCurrency(
                  approvedJobValue
                )}
              />

              <FinancialDetail
                label="Invoiced"
                value={formatCurrency(
                  totalInvoiced
                )}
              />

              <FinancialDetail
                label="Paid"
                value={formatCurrency(
                  totalPaid
                )}
              />
            </div>

            {(remainingToInvoice >
              0 ||
              outstanding >
                0) && (
              <div className="border-t border-emerald-200 p-5 text-sm text-emerald-800">
                Remaining to invoice:{" "}
                <strong>
                  {formatCurrency(
                    remainingToInvoice
                  )}
                </strong>
                {" · "}
                Outstanding:{" "}
                <strong>
                  {formatCurrency(
                    outstanding
                  )}
                </strong>
              </div>
            )}
          </section>

          {/* =================================================
              ACCEPTED VARIATIONS
              ================================================= */}

          {acceptedVariations.length >
            0 && (
            <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                    Approved Additional Works
                  </p>

                  <h2 className="mt-1 text-lg font-semibold text-slate-900">
                    Accepted Variations
                  </h2>
                </div>

                <p className="text-lg font-bold text-slate-900">
                  {formatCurrency(
                    acceptedVariationValue
                  )}
                </p>
              </div>

              <div className="mt-5 divide-y divide-slate-100">
                {acceptedVariations.map(
                  (
                    variation
                  ) => (
                    <div
                      key={
                        variation.id
                      }
                      className="flex flex-wrap items-center justify-between gap-4 py-4"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">
                          {variation.variation_number ||
                            "Variation"}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {variation.title ||
                            "Additional works"}
                        </p>
                      </div>

                      <p className="font-semibold text-slate-900">
                        {formatCurrency(
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
            </section>
          )}

          {/* =================================================
              SOURCE DETAILS
              ================================================= */}

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Source Details
            </h2>

            <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-5">
              <Detail
                label="Client"
                value={
                  clientName
                }
              />

              <Detail
                label="Quote"
                value={
                  quote.quote_number ||
                  "Accepted quote"
                }
              />

              <Detail
                label="Source Invoice"
                value={
                  invoice.invoice_number ||
                  "Invoice"
                }
              />

              <Detail
                label="Job"
                value={
                  job?.job_number ||
                  "No linked job"
                }
              />

              <Detail
                label="Contract"
                value={
                  contract?.contract_number ||
                  "No linked contract"
                }
              />
            </div>
          </section>

          {/* =================================================
              FORM
              ================================================= */}

          <form
            action={
              createGuarantee
            }
            className="mt-8"
          >
            <input
              type="hidden"
              name="invoice_id"
              value={
                invoice.id
              }
            />

            {/* ===============================================
                GUARANTEE DETAILS
                =============================================== */}

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                Guarantee Details
              </h2>

              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="guarantee_type"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Guarantee Type
                  </label>

                  <select
                    id="guarantee_type"
                    name="guarantee_type"
                    defaultValue="Damp Proofing"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
                  >
                    <option>
                      Damp Proofing
                    </option>

                    <option>
                      Rising Damp Treatment
                    </option>

                    <option>
                      Penetrating Damp Treatment
                    </option>

                    <option>
                      Timber Treatment
                    </option>

                    <option>
                      Woodworm Treatment
                    </option>

                    <option>
                      Dry Rot Treatment
                    </option>

                    <option>
                      Wet Rot Treatment
                    </option>

                    <option>
                      Mould Treatment
                    </option>

                    <option>
                      Internal Wall Insulation
                    </option>

                    <option>
                      External Wall Insulation
                    </option>

                    <option>
                      Other
                    </option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="title"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Guarantee Title
                  </label>

                  <input
                    id="title"
                    name="title"
                    type="text"
                    defaultValue={
                      defaultTitle
                    }
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="issue_date"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Issue Date
                  </label>

                  <input
                    id="issue_date"
                    name="issue_date"
                    type="date"
                    defaultValue={
                      today
                    }
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="duration_years"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Guarantee Period
                  </label>

                  <select
                    id="duration_years"
                    name="duration_years"
                    defaultValue="10"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
                  >
                    <option value="1">
                      1 year
                    </option>

                    <option value="2">
                      2 years
                    </option>

                    <option value="5">
                      5 years
                    </option>

                    <option value="10">
                      10 years
                    </option>

                    <option value="15">
                      15 years
                    </option>

                    <option value="20">
                      20 years
                    </option>

                    <option value="25">
                      25 years
                    </option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label
                    htmlFor="expiry_date"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Expiry Date
                  </label>

                  <input
                    id="expiry_date"
                    name="expiry_date"
                    type="date"
                    defaultValue={
                      defaultExpiryDate
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
                  />

                  <p className="mt-2 text-xs text-slate-500">
                    This defaults to 10 years from today.
                  </p>
                </div>
              </div>
            </section>

            {/* ===============================================
                COVERED WORKS
                =============================================== */}

            <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                Covered Works
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Describe exactly what work is covered by this guarantee.
              </p>

              <textarea
                name="covered_works"
                rows={
                  7
                }
                defaultValue={
                  defaultCoveredWorks
                }
                className="mt-5 w-full rounded-lg border border-slate-300 px-3 py-3 text-slate-900 outline-none focus:border-slate-500"
              />
            </section>

            {/* ===============================================
                TERMS
                =============================================== */}

            <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                Guarantee Terms
              </h2>

              <textarea
                name="terms"
                rows={
                  7
                }
                defaultValue={
                  "This guarantee applies to the works described above and is subject to the property being adequately maintained. Any defects or concerns should be reported to Dry Home Damp Proofing Solutions LTD as soon as reasonably possible."
                }
                className="mt-5 w-full rounded-lg border border-slate-300 px-3 py-3 text-slate-900 outline-none focus:border-slate-500"
              />
            </section>

            {/* ===============================================
                EXCLUSIONS
                =============================================== */}

            <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                Exclusions
              </h2>

              <textarea
                name="exclusions"
                rows={
                  6
                }
                defaultValue={
                  "This guarantee does not cover damage caused by building movement, structural defects, flooding, plumbing leaks, defective external maintenance, alterations by third parties, or circumstances outside the scope of the original works."
                }
                className="mt-5 w-full rounded-lg border border-slate-300 px-3 py-3 text-slate-900 outline-none focus:border-slate-500"
              />
            </section>

            {/* ===============================================
                CUSTOMER MESSAGE
                =============================================== */}

            <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                Customer Message
              </h2>

              <textarea
                name="customer_message"
                rows={
                  4
                }
                defaultValue={
                  "Thank you for choosing Dry Home Damp Proofing Solutions LTD. Please retain this guarantee with your property records."
                }
                className="mt-5 w-full rounded-lg border border-slate-300 px-3 py-3 text-slate-900 outline-none focus:border-slate-500"
              />
            </section>

            {/* ===============================================
                INTERNAL NOTES
                =============================================== */}

            <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                Internal Notes
              </h2>

              <textarea
                name="internal_notes"
                rows={
                  4
                }
                placeholder="These notes are for DryHome Office only and will not be shown to the customer."
                className="mt-5 w-full rounded-lg border border-slate-300 px-3 py-3 text-slate-900 outline-none focus:border-slate-500"
              />
            </section>

            {/* ===============================================
                ACTIONS
                =============================================== */}

            <div className="mt-8 flex flex-wrap justify-end gap-3">
              <Link
                href={
                  backHref
                }
                className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Link>

              <button
                type="submit"
                className="rounded-lg bg-emerald-700 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-800"
              >
                Create Guarantee
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

/* =========================================================
   DETAIL
   ========================================================= */

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold text-slate-800">
        {value}
      </p>
    </div>
  );
}

/* =========================================================
   FINANCIAL DETAIL
   ========================================================= */

function FinancialDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
        {label}
      </p>

      <p className="mt-1 text-lg font-bold text-emerald-950">
        {value}
      </p>
    </div>
  );
}

/* =========================================================
   INVOICE TOTAL
   ========================================================= */

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

/* =========================================================
   MONEY
   ========================================================= */

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

/* =========================================================
   CURRENCY
   ========================================================= */

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