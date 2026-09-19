import Link from "next/link";
import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import EmailQuoteButton from "@/components/EmailQuoteButton";
import { createClient } from "@/lib/supabase/server";
import { manuallyAcceptQuote } from "../actions";

type QuotePageProps = {
  params: Promise<{
    id: string;
  }>;

  searchParams: Promise<{
    sent?: string;
    error?: string;
    warning?: string;
    accepted?: string;
  }>;
};

export default async function QuotePage({
  params,
  searchParams,
}: QuotePageProps) {
  const { id } = await params;
  const query = await searchParams;

  const supabase =
    await createClient();

  const {
    data: quote,
    error,
  } = await supabase
    .from("quotes")
    .select(`
      id,
      quote_number,
      client_id,
      job_id,
      title,
      description,
      status,
      quote_date,
      valid_until,
      subtotal,
      vat_enabled,
      vat_rate,
      vat_amount,
      amount,
      customer_message,
      terms,
      internal_notes,
      sent_to,
      sent_at,
      viewed_at,
      accepted_at,
      declined_at,
      created_at,
      clients (
        id,
        display_name,
        first_name,
        last_name,
        email,
        phone,
        address_line_1,
        address_line_2,
        town,
        county,
        postcode
      ),
      jobs (
        id,
        job_number,
        title,
        job_type,
        status
      )
    `)
    .eq("id", id)
    .single();

  if (
    error ||
    !quote
  ) {
    notFound();
  }

  const [
    itemsResult,
    contractResult,
    invoicesResult,
  ] = await Promise.all([
    supabase
      .from("quote_items")
      .select(`
        id,
        description,
        quantity,
        unit,
        unit_price,
        item_type,
        sort_order
      `)
      .eq(
        "quote_id",
        id
      )
      .order(
        "sort_order",
        {
          ascending: true,
        }
      ),

    supabase
      .from("contracts")
      .select(`
        id,
        contract_number,
        title,
        status,
        signed_at,
        created_at
      `)
      .eq(
        "quote_id",
        id
      )
      .neq(
        "status",
        "Cancelled"
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .limit(1),

    supabase
      .from("invoices")
      .select(`
        id,
        invoice_number,
        title,
        invoice_type,
        status,
        invoice_date,
        due_date,
        subtotal,
        vat_amount,
        amount,
        amount_paid,
        created_at
      `)
      .eq(
        "quote_id",
        id
      )
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
  ]);

  const items =
    itemsResult.data ?? [];

  const linkedInvoices =
    invoicesResult.data ?? [];

  const linkedContract =
    contractResult.data &&
    contractResult.data.length > 0
      ? contractResult.data[0]
      : null;

  const clientData =
    Array.isArray(
      quote.clients
    )
      ? quote.clients[0]
      : quote.clients;

  const jobData =
    Array.isArray(
      quote.jobs
    )
      ? quote.jobs[0]
      : quote.jobs;

  const clientName =
    clientData?.display_name ||
    [
      clientData?.first_name,
      clientData?.last_name,
    ]
      .filter(Boolean)
      .join(" ") ||
    "Unknown client";

  const labourItems =
    items.filter(
      (item) =>
        item.item_type !==
        "Materials"
    );

  const materialItems =
    items.filter(
      (item) =>
        item.item_type ===
        "Materials"
    );

  const canManuallyAccept =
    quote.status !==
      "Accepted" &&
    quote.status !==
      "Declined";

  const quoteAccepted =
    quote.status ===
    "Accepted";

  const quoteTotal =
    Number(
      quote.amount ?? 0
    );

  const invoicedTotal =
    linkedInvoices.reduce(
      (
        total,
        invoice
      ) =>
        total +
        getInvoiceValue(
          invoice
        ),
      0
    );

  const paidTotal =
    linkedInvoices.reduce(
      (
        total,
        invoice
      ) =>
        total +
        Number(
          invoice.amount_paid ??
            0
        ),
      0
    );

  const remainingToInvoice =
    Math.max(
      quoteTotal -
        invoicedTotal,
      0
    );

  const fullyInvoiced =
    quoteTotal > 0 &&
    remainingToInvoice <=
      0.009;

  const fullyPaidQuote =
    fullyInvoiced &&
    paidTotal >=
      quoteTotal - 0.009;

  /*
   * Guarantees now belong to the completed quote/job workflow
   * rather than depending on an invoice having been manually
   * marked as "Final".
   *
   * linkedInvoices are ordered newest first, so once the full
   * quote has been invoiced and paid we can use the latest
   * invoice as the source for the existing guarantee creator.
   */
  const guaranteeSourceInvoice =
    fullyPaidQuote &&
    linkedInvoices.length > 0
      ? linkedInvoices[0]
      : null;

  const scheduleWorkHref =
    jobData?.id
      ? `/schedule/new?job=${jobData.id}&type=Work`
      : `/schedule/new?client=${quote.client_id}&type=Work`;

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-7xl">
          {query.sent ===
            "1" && (
            <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800">
              Quote emailed successfully to{" "}
              {quote.sent_to ||
                clientData?.email}.
            </div>
          )}

          {query.accepted ===
            "manual" && (
            <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800">
              Quote manually accepted successfully.
              The quote and linked job have been
              updated to Accepted.
            </div>
          )}

          {query.error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
              {query.error}
            </div>
          )}

          {query.warning && (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-800">
              {query.warning}
            </div>
          )}

          <div className="mb-8">
            <Link
              href="/quotes"
              className="text-sm font-medium text-slate-500 hover:text-slate-900"
            >
              ← Back to Quotes
            </Link>

            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  {
                    quote.quote_number
                  }
                </p>

                <h1 className="mt-1 text-3xl font-bold text-slate-900">
                  {quote.title}
                </h1>

                <p className="mt-2 text-slate-500">
                  {clientName}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={`/quotes/${quote.id}/pdf`}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Download PDF
                </a>

                <EmailQuoteButton
                  quoteId={
                    quote.id
                  }
                  recipient={
                    clientData?.email ||
                    null
                  }
                  status={
                    quote.status
                  }
                />

                <StatusBadge
                  status={
                    quote.status
                  }
                />
              </div>
            </div>

            {!clientData?.email && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                This client does not have an email address
                saved. Add an email to the client record
                before emailing the quote.
              </div>
            )}
          </div>

          {canManuallyAccept && (
            <section className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-6">
              <div className="flex flex-wrap items-center justify-between gap-5">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                    Awaiting Acceptance
                  </p>

                  <h2 className="mt-2 text-xl font-bold text-amber-950">
                    Has the customer approved this quote?
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-amber-800">
                    If approval came by email, phone or purchase
                    order — for example from a council — record it
                    here. Once accepted, all of the job actions will
                    be available from this quote.
                  </p>
                </div>

                <form
                  action={
                    manuallyAcceptQuote
                  }
                >
                  <input
                    type="hidden"
                    name="quote_id"
                    value={
                      quote.id
                    }
                  />

                  <button
                    type="submit"
                    className="rounded-lg bg-amber-700 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-800"
                  >
                    Manual Accept
                  </button>
                </form>
              </div>
            </section>
          )}

          {quoteAccepted && (
            <section className="mb-8 overflow-hidden rounded-2xl bg-white shadow-sm">
              <div className="border-b border-slate-200 p-6">
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                      Quote Accepted
                    </p>

                    <h2 className="mt-2 text-2xl font-bold text-slate-900">
                      What would you like to do next?
                    </h2>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                      Everything for this accepted quote starts here.
                      A contract is optional, so you can invoice,
                      schedule the work or create a contract in
                      whichever order suits the job.
                    </p>
                  </div>

                  <StatusBadge
                    status={
                      quote.status
                    }
                  />
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  {!fullyInvoiced ? (
                    <Link
                      href={`/invoices/new?quote=${quote.id}`}
                      className="rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800"
                    >
                      Create Invoice
                    </Link>
                  ) : (
                    <span className="rounded-lg bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-800">
                      Fully Invoiced
                    </span>
                  )}

                  {linkedContract ? (
                    <Link
                      href={`/contracts/${linkedContract.id}`}
                      className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      View Contract
                    </Link>
                  ) : (
                    <Link
                      href={`/contracts/new?quote=${quote.id}`}
                      className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Create Contract
                    </Link>
                  )}

                  <Link
                    href={
                      scheduleWorkHref
                    }
                    className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Schedule Work
                  </Link>

                  {guaranteeSourceInvoice && (
                    <Link
                      href={`/guarantees/new?invoice=${guaranteeSourceInvoice.id}`}
                      className="rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800"
                    >
                      Generate Guarantee
                    </Link>
                  )}

                  {jobData?.id && (
                    <Link
                      href={`/jobs/${jobData.id}`}
                      className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      View Job
                    </Link>
                  )}
                </div>
              </div>

              <div className="grid gap-px bg-slate-200 md:grid-cols-4">
                <WorkflowStat
                  title="Quote Value"
                  value={formatCurrency(
                    quoteTotal
                  )}
                />

                <WorkflowStat
                  title="Invoiced"
                  value={formatCurrency(
                    invoicedTotal
                  )}
                />

                <WorkflowStat
                  title="Paid"
                  value={formatCurrency(
                    paidTotal
                  )}
                />

                <WorkflowStat
                  title="Remaining to Invoice"
                  value={formatCurrency(
                    remainingToInvoice
                  )}
                  strong
                />
              </div>

              <div className="border-t border-slate-200 p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      Invoices
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      All invoices raised from this quote.
                    </p>
                  </div>

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {linkedInvoices.length}{" "}
                    {linkedInvoices.length ===
                    1
                      ? "invoice"
                      : "invoices"}
                  </span>
                </div>

                {linkedInvoices.length ===
                0 ? (
                  <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                    No invoices have been created from this quote yet.
                  </div>
                ) : (
                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50">
                        <tr>
                          <Heading>
                            Invoice
                          </Heading>

                          <Heading>
                            Type
                          </Heading>

                          <Heading>
                            Date
                          </Heading>

                          <Heading right>
                            Total
                          </Heading>

                          <Heading right>
                            Paid
                          </Heading>

                          <Heading>
                            Status
                          </Heading>

                          <Heading right>
                            Action
                          </Heading>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {linkedInvoices.map(
                          (
                            invoice
                          ) => (
                            <tr
                              key={
                                invoice.id
                              }
                            >
                              <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                                {invoice.invoice_number}
                              </td>

                              <td className="px-6 py-4 text-sm text-slate-600">
                                {invoice.invoice_type ||
                                  "Invoice"}
                              </td>

                              <td className="px-6 py-4 text-sm text-slate-600">
                                {formatDate(
                                  invoice.invoice_date
                                )}
                              </td>

                              <td className="px-6 py-4 text-right text-sm font-semibold text-slate-900">
                                {formatCurrency(
                                  getInvoiceValue(
                                    invoice
                                  )
                                )}
                              </td>

                              <td className="px-6 py-4 text-right text-sm text-slate-600">
                                {formatCurrency(
                                  invoice.amount_paid
                                )}
                              </td>

                              <td className="px-6 py-4">
                                <InvoiceStatusBadge
                                  status={
                                    invoice.status
                                  }
                                />
                              </td>

                              <td className="px-6 py-4 text-right">
                                <Link
                                  href={`/invoices/${invoice.id}`}
                                  className="text-sm font-semibold text-slate-700 hover:underline"
                                >
                                  View →
                                </Link>
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {guaranteeSourceInvoice && (
                <div className="border-t border-emerald-200 bg-emerald-50 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                        Job Financially Complete
                      </p>

                      <h3 className="mt-1 text-lg font-bold text-emerald-950">
                        Guarantee Available
                      </h3>

                      <p className="mt-1 max-w-2xl text-sm leading-6 text-emerald-800">
                        The full quote has been invoiced and all invoice balances have been paid.
                        You can now generate the customer guarantee.
                      </p>
                    </div>

                    <Link
                      href={`/guarantees/new?invoice=${guaranteeSourceInvoice.id}`}
                      className="rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800"
                    >
                      Generate Guarantee
                    </Link>
                  </div>
                </div>
              )}

              <div className="border-t border-slate-200 bg-slate-50 p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Contract
                    </p>

                    {linkedContract ? (
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {linkedContract.contract_number} ·{" "}
                        {linkedContract.status}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-slate-600">
                        No contract created — this is optional.
                      </p>
                    )}
                  </div>

                  {linkedContract ? (
                    <Link
                      href={`/contracts/${linkedContract.id}`}
                      className="text-sm font-semibold text-slate-700 hover:underline"
                    >
                      View Contract →
                    </Link>
                  ) : (
                    <Link
                      href={`/contracts/new?quote=${quote.id}`}
                      className="text-sm font-semibold text-slate-700 hover:underline"
                    >
                      Create Contract →
                    </Link>
                  )}
                </div>
              </div>
            </section>
          )}

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Total"
              value={formatCurrency(
                quote.amount
              )}
            />

            <SummaryCard
              title="Quote Date"
              value={formatDate(
                quote.quote_date
              )}
            />

            <SummaryCard
              title="Valid Until"
              value={formatDate(
                quote.valid_until
              )}
            />

            <SummaryCard
              title="Status"
              value={
                quote.status
              }
            />
          </div>

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Title
            </p>

            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              {quote.title}
            </h2>

            <div className="mt-6 border-t border-slate-200 pt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Description / Scope of Works
              </p>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {quote.description ||
                  "No description recorded."}
              </p>
            </div>
          </section>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">
                  Client
                </h2>

                {clientData?.id && (
                  <Link
                    href={`/clients/${clientData.id}`}
                    className="text-sm font-semibold text-slate-700 hover:underline"
                  >
                    View Client →
                  </Link>
                )}
              </div>

              <div className="mt-5 space-y-4">
                <DetailRow
                  label="Name"
                  value={
                    clientName
                  }
                />

                <DetailRow
                  label="Email"
                  value={
                    clientData?.email
                  }
                />

                <DetailRow
                  label="Phone"
                  value={
                    clientData?.phone
                  }
                />
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">
                  Linked Job
                </h2>

                {jobData?.id && (
                  <Link
                    href={`/jobs/${jobData.id}`}
                    className="text-sm font-semibold text-slate-700 hover:underline"
                  >
                    View Job →
                  </Link>
                )}
              </div>

              {jobData ? (
                <div className="mt-5 space-y-4">
                  <DetailRow
                    label="Job Number"
                    value={
                      jobData.job_number
                    }
                  />

                  <DetailRow
                    label="Job Title"
                    value={
                      jobData.title
                    }
                  />

                  <DetailRow
                    label="Job Type"
                    value={
                      jobData.job_type
                    }
                  />

                  <DetailRow
                    label="Job Status"
                    value={
                      jobData.status
                    }
                  />
                </div>
              ) : (
                <p className="mt-5 text-sm text-slate-500">
                  This quote is not linked to a job.
                </p>
              )}
            </section>
          </div>

          <QuoteSection
            title="Labour"
            description="Labour included within this quotation."
            items={
              labourItems
            }
          />

          <QuoteSection
            title="Materials"
            description="Materials included within this quotation."
            items={
              materialItems
            }
          />

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <div className="ml-auto max-w-md">
              <TotalRow
                label="Subtotal"
                value={formatCurrency(
                  quote.subtotal
                )}
              />

              {quote.vat_enabled && (
                <TotalRow
                  label={`VAT (${formatVatRate(
                    quote.vat_rate
                  )}%)`}
                  value={formatCurrency(
                    quote.vat_amount
                  )}
                />
              )}

              <div className="mt-4 flex items-center justify-between border-t-2 border-slate-900 pt-5">
                <span className="text-xl font-bold text-slate-900">
                  Total
                </span>

                <span className="text-2xl font-bold text-slate-900">
                  {formatCurrency(
                    quote.amount
                  )}
                </span>
              </div>

              {!quote.vat_enabled && (
                <p className="mt-3 text-right text-xs text-slate-500">
                  VAT not added
                </p>
              )}
            </div>
          </section>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Customer Message
              </h2>

              <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {quote.customer_message ||
                  "No customer message recorded."}
              </p>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Terms
              </h2>

              <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {quote.terms ||
                  "No terms recorded."}
              </p>
            </section>
          </div>

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Internal Notes
            </h2>

            <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {quote.internal_notes ||
                "No internal notes recorded."}
            </p>

            <p className="mt-4 text-xs text-slate-400">
              Internal notes are not included on the
              customer PDF or email.
            </p>
          </section>

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Quote Activity
            </h2>

            <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <DetailRow
                label="Sent To"
                value={
                  quote.sent_to ||
                  "Not sent"
                }
              />

              <DetailRow
                label="Sent"
                value={formatDateTime(
                  quote.sent_at
                )}
              />

              <DetailRow
                label="Viewed"
                value={formatDateTime(
                  quote.viewed_at
                )}
              />

              <DetailRow
                label={
                  quote.status ===
                  "Declined"
                    ? "Declined"
                    : "Accepted"
                }
                value={formatDateTime(
                  quote.status ===
                    "Declined"
                    ? quote.declined_at
                    : quote.accepted_at
                )}
              />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function QuoteSection({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: {
    id: string;
    description: string;
    quantity:
      | number
      | string;
    unit: string | null;
    unit_price:
      | number
      | string;
  }[];
}) {
  return (
    <section className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-5">
        <h2 className="text-xl font-semibold text-slate-900">
          {title}
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          {description}
        </p>
      </div>

      {items.length ===
      0 ? (
        <div className="p-8 text-sm text-slate-500">
          No{" "}
          {title.toLowerCase()}{" "}
          items recorded.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <Heading>
                  Item
                </Heading>

                <Heading right>
                  Qty
                </Heading>

                <Heading>
                  Unit
                </Heading>

                <Heading right>
                  Unit Price
                </Heading>

                <Heading right>
                  Total
                </Heading>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {items.map(
                (item) => {
                  const quantity =
                    Number(
                      item.quantity
                    );

                  const unitPrice =
                    Number(
                      item.unit_price
                    );

                  const total =
                    quantity *
                    unitPrice;

                  return (
                    <tr
                      key={
                        item.id
                      }
                    >
                      <td className="px-6 py-5 text-sm font-medium text-slate-800">
                        {
                          item.description
                        }
                      </td>

                      <td className="px-6 py-5 text-right text-sm text-slate-600">
                        {formatQuantity(
                          quantity
                        )}
                      </td>

                      <td className="px-6 py-5 text-sm text-slate-600">
                        {item.unit ||
                          "—"}
                      </td>

                      <td className="px-6 py-5 text-right text-sm text-slate-600">
                        {formatCurrency(
                          unitPrice
                        )}
                      </td>

                      <td className="px-6 py-5 text-right text-sm font-semibold text-slate-900">
                        {formatCurrency(
                          total
                        )}
                      </td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function TotalRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 py-4">
      <span className="font-medium text-slate-600">
        {label}
      </span>

      <span className="font-semibold text-slate-900">
        {value}
      </span>
    </div>
  );
}

function WorkflowStat({
  title,
  value,
  strong = false,
}: {
  title: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={
        strong
          ? "bg-slate-900 p-5"
          : "bg-white p-5"
      }
    >
      <p
        className={
          strong
            ? "text-xs font-semibold uppercase tracking-wide text-slate-300"
            : "text-xs font-semibold uppercase tracking-wide text-slate-400"
        }
      >
        {title}
      </p>

      <p
        className={
          strong
            ? "mt-2 text-xl font-bold text-white"
            : "mt-2 text-xl font-bold text-slate-900"
        }
      >
        {value}
      </p>
    </div>
  );
}

function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">
        {title}
      </p>

      <p className="mt-2 text-xl font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-sm text-slate-700">
        {value ||
          "Not recorded"}
      </p>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const classes =
    status === "Accepted"
      ? "bg-emerald-100 text-emerald-800"
      : status ===
          "Declined"
        ? "bg-red-100 text-red-800"
        : status ===
            "Sent"
          ? "bg-blue-100 text-blue-800"
          : status ===
              "Viewed"
            ? "bg-violet-100 text-violet-800"
            : status ===
                "Expired"
              ? "bg-amber-100 text-amber-800"
              : "bg-slate-100 text-slate-700";

  return (
    <span
      className={`rounded-full px-4 py-2 text-sm font-semibold ${classes}`}
    >
      {status}
    </span>
  );
}

function InvoiceStatusBadge({
  status,
}: {
  status: string;
}) {
  const classes =
    status === "Paid"
      ? "bg-emerald-100 text-emerald-800"
      : status === "Part Paid"
        ? "bg-amber-100 text-amber-800"
        : status === "Sent"
          ? "bg-blue-100 text-blue-800"
          : status === "Viewed"
            ? "bg-violet-100 text-violet-800"
            : status === "Overdue"
              ? "bg-red-100 text-red-800"
              : "bg-slate-100 text-slate-700";

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${classes}`}
    >
      {status}
    </span>
  );
}

function Heading({
  children,
  right = false,
}: {
  children: React.ReactNode;
  right?: boolean;
}) {
  return (
    <th
      className={`px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500 ${
        right
          ? "text-right"
          : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function getInvoiceValue(invoice: {
  amount?: number | string | null;
  subtotal?: number | string | null;
  vat_amount?: number | string | null;
}) {
  const amount =
    Number(
      invoice.amount ?? 0
    );

  if (
    Number.isFinite(amount) &&
    amount > 0
  ) {
    return amount;
  }

  const subtotal =
    Number(
      invoice.subtotal ?? 0
    );

  const vatAmount =
    Number(
      invoice.vat_amount ?? 0
    );

  return (
    (Number.isFinite(subtotal)
      ? subtotal
      : 0) +
    (Number.isFinite(vatAmount)
      ? vatAmount
      : 0)
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

function formatQuantity(
  value: number
) {
  return new Intl.NumberFormat(
    "en-GB",
    {
      maximumFractionDigits: 2,
    }
  ).format(
    value
  );
}

function formatVatRate(
  value:
    | number
    | string
    | null
) {
  return Number(
    value ?? 20
  ).toLocaleString(
    "en-GB",
    {
      maximumFractionDigits: 2,
    }
  );
}

function formatDate(
  value: string | null
) {
  if (!value) {
    return "Not set";
  }

  const [
    year,
    month,
    day,
  ] = value
    .slice(0, 10)
    .split("-")
    .map(Number);

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  ).format(
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    )
  );
}

function formatDateTime(
  value: string | null
) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone:
        "Europe/London",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(
    new Date(value)
  );
}