import Link from "next/link";
import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import EmailInvoiceButton from "@/components/EmailInvoiceButton";
import { createClient } from "@/lib/supabase/server";
import { recordInvoicePayment } from "../actions";

type InvoicePageProps = {
  params: Promise<{
    id: string;
  }>;

  searchParams: Promise<{
    sent?: string;
    error?: string;
    warning?: string;
    payment?: string;
  }>;
};

export default async function InvoicePage({
  params,
  searchParams,
}: InvoicePageProps) {
  const { id } = await params;
  const query = await searchParams;

  const supabase =
    await createClient();

  const {
    data: invoice,
    error,
  } = await supabase
    .from("invoices")
    .select(`
      id,
      invoice_number,
      client_id,
      job_id,
      quote_id,
      contract_id,
      title,
      description,
      invoice_type,
      status,
      invoice_date,
      due_date,
      subtotal,
      vat_enabled,
      vat_rate,
      vat_amount,
      amount,
      amount_paid,
      customer_message,
      payment_terms,
      internal_notes,
      sent_to,
      sent_at,
      viewed_at,
      paid_at,
      payment_method,
      payment_reference,
      public_token,
      created_at,
      clients (
        id,
        display_name,
        first_name,
        last_name,
        email,
        phone
      ),
      jobs (
        id,
        job_number,
        title,
        status
      ),
      quotes (
        id,
        quote_number
      ),
      contracts (
        id,
        contract_number,
        status
      )
    `)
    .eq("id", id)
    .single();

  if (
    error ||
    !invoice
  ) {
    notFound();
  }

  const [
    itemsResult,
    paymentsResult,
  ] = await Promise.all([
    supabase
      .from("invoice_items")
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
        "invoice_id",
        id
      )
      .order(
        "sort_order",
        {
          ascending: true,
        }
      ),

    supabase
      .from("invoice_payments")
      .select(`
        id,
        amount,
        payment_date,
        payment_method,
        payment_reference,
        notes,
        created_at
      `)
      .eq(
        "invoice_id",
        id
      )
      .order(
        "payment_date",
        {
          ascending: false,
        }
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

  const payments =
    paymentsResult.data ?? [];

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

  const quote =
    Array.isArray(
      invoice.quotes
    )
      ? invoice.quotes[0]
      : invoice.quotes;

  const contract =
    Array.isArray(
      invoice.contracts
    )
      ? invoice.contracts[0]
      : invoice.contracts;

  const clientName =
    client?.display_name ||
    [
      client?.first_name,
      client?.last_name,
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

  const invoiceTotal =
    Number(
      invoice.amount ?? 0
    );

  const amountPaid =
    Number(
      invoice.amount_paid ?? 0
    );

  const balance =
    Math.max(
      invoiceTotal -
        amountPaid,
      0
    );

  const fullyPaid =
    invoice.status ===
      "Paid" ||
    balance <= 0.009;

  const today =
    new Date()
      .toISOString()
      .slice(0, 10);

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-7xl">
          {query.sent ===
            "1" && (
            <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800">
              Invoice emailed successfully to{" "}
              {invoice.sent_to ||
                client?.email}.
            </div>
          )}

          {query.payment ===
            "success" && (
            <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800">
              Payment recorded successfully.
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
              href="/invoices"
              className="text-sm font-medium text-slate-500 hover:text-slate-900"
            >
              ← Back to Invoices
            </Link>

            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  {
                    invoice.invoice_number
                  }
                </p>

                <h1 className="mt-1 text-3xl font-bold text-slate-900">
                  {invoice.title ||
                    "Invoice"}
                </h1>

                <p className="mt-2 text-slate-500">
                  {clientName}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <EmailInvoiceButton
                  invoiceId={
                    invoice.id
                  }
                  recipient={
                    client?.email ||
                    null
                  }
                  status={
                    invoice.status
                  }
                />

                <StatusBadge
                  status={
                    invoice.status
                  }
                />
              </div>
            </div>

            {!client?.email && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                This client does not have an email address saved.
              </div>
            )}
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Invoice Total"
              value={formatCurrency(
                invoiceTotal
              )}
            />

            <SummaryCard
              title="Amount Paid"
              value={formatCurrency(
                amountPaid
              )}
            />

            <SummaryCard
              title="Balance"
              value={formatCurrency(
                balance
              )}
            />

            <SummaryCard
              title="Due Date"
              value={formatDate(
                invoice.due_date
              )}
            />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-4">
            <InfoCard
              title="Client"
              value={clientName}
              href={
                client?.id
                  ? `/clients/${client.id}`
                  : undefined
              }
            />

            <InfoCard
              title="Job"
              value={
                job?.job_number ||
                "No linked job"
              }
              href={
                job?.id
                  ? `/jobs/${job.id}`
                  : undefined
              }
            />

            <InfoCard
              title="Contract"
              value={
                contract?.contract_number ||
                "No linked contract"
              }
              href={
                contract?.id
                  ? `/contracts/${contract.id}`
                  : undefined
              }
            />

            <InfoCard
              title="Quote"
              value={
                quote?.quote_number ||
                "No linked quote"
              }
              href={
                quote?.id
                  ? `/quotes/${quote.id}`
                  : undefined
              }
            />
          </div>

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <div className="grid gap-5 md:grid-cols-3">
              <DetailRow
                label="Invoice Type"
                value={
                  invoice.invoice_type
                }
              />

              <DetailRow
                label="Invoice Date"
                value={formatDate(
                  invoice.invoice_date
                )}
              />

              <DetailRow
                label="Status"
                value={
                  invoice.status
                }
              />
            </div>

            <div className="mt-6 border-t border-slate-200 pt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Description
              </p>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {invoice.description ||
                  "No description recorded."}
              </p>
            </div>
          </section>

          <InvoiceItemsSection
            title="Labour"
            items={
              labourItems
            }
          />

          <InvoiceItemsSection
            title="Materials"
            items={
              materialItems
            }
          />

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <div className="ml-auto max-w-md">
              <TotalRow
                label="Subtotal"
                value={formatCurrency(
                  invoice.subtotal
                )}
              />

              {invoice.vat_enabled && (
                <TotalRow
                  label={`VAT (${Number(
                    invoice.vat_rate ??
                      20
                  )}%)`}
                  value={formatCurrency(
                    invoice.vat_amount
                  )}
                />
              )}

              <TotalRow
                label="Invoice Total"
                value={formatCurrency(
                  invoice.amount
                )}
              />

              {amountPaid >
                0 && (
                <TotalRow
                  label="Amount Paid"
                  value={formatCurrency(
                    amountPaid
                  )}
                />
              )}

              <div className="mt-4 flex items-center justify-between border-t-2 border-slate-900 pt-5">
                <span className="text-xl font-bold text-slate-900">
                  Balance
                </span>

                <span className="text-2xl font-bold text-slate-900">
                  {formatCurrency(
                    balance
                  )}
                </span>
              </div>
            </div>
          </section>

          {/* Payment section */}
          <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_1.4fr]">
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                Record Payment
              </h2>

              {fullyPaid ? (
                <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                  <p className="font-semibold text-emerald-900">
                    Invoice paid in full
                  </p>

                  <p className="mt-1 text-sm text-emerald-700">
                    No further payment is required.
                  </p>

                  {invoice.paid_at && (
                    <p className="mt-3 text-sm text-emerald-800">
                      Paid{" "}
                      {formatDateTime(
                        invoice.paid_at
                      )}
                    </p>
                  )}
                </div>
              ) : (
                <form
                  action={
                    recordInvoicePayment
                  }
                  className="mt-6"
                >
                  <input
                    type="hidden"
                    name="invoice_id"
                    value={
                      invoice.id
                    }
                  />

                  <div>
                    <label
                      htmlFor="payment_amount"
                      className="mb-2 block text-sm font-medium text-slate-700"
                    >
                      Amount Received
                    </label>

                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-slate-500">
                        £
                      </span>

                      <input
                        id="payment_amount"
                        name="payment_amount"
                        type="number"
                        min="0.01"
                        max={
                          balance
                        }
                        step="0.01"
                        defaultValue={
                          balance.toFixed(
                            2
                          )
                        }
                        required
                        className="w-full rounded-lg border border-slate-300 py-2.5 pl-7 pr-3 text-slate-900 outline-none focus:border-slate-500"
                      />
                    </div>

                    <p className="mt-2 text-xs text-slate-500">
                      Outstanding balance:{" "}
                      {formatCurrency(
                        balance
                      )}
                    </p>
                  </div>

                  <div className="mt-5">
                    <label
                      htmlFor="payment_date"
                      className="mb-2 block text-sm font-medium text-slate-700"
                    >
                      Payment Date
                    </label>

                    <input
                      id="payment_date"
                      name="payment_date"
                      type="date"
                      defaultValue={
                        today
                      }
                      required
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
                    />
                  </div>

                  <div className="mt-5">
                    <label
                      htmlFor="payment_method"
                      className="mb-2 block text-sm font-medium text-slate-700"
                    >
                      Payment Method
                    </label>

                    <select
                      id="payment_method"
                      name="payment_method"
                      defaultValue="Bank Transfer"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
                    >
                      <option>
                        Bank Transfer
                      </option>

                      <option>
                        Card
                      </option>

                      <option>
                        Cash
                      </option>

                      <option>
                        Cheque
                      </option>

                      <option>
                        Other
                      </option>
                    </select>
                  </div>

                  <div className="mt-5">
                    <label
                      htmlFor="payment_reference"
                      className="mb-2 block text-sm font-medium text-slate-700"
                    >
                      Payment Reference
                    </label>

                    <input
                      id="payment_reference"
                      name="payment_reference"
                      type="text"
                      placeholder="e.g. bank reference"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
                    />
                  </div>

                  <div className="mt-5">
                    <label
                      htmlFor="payment_notes"
                      className="mb-2 block text-sm font-medium text-slate-700"
                    >
                      Notes
                    </label>

                    <textarea
                      id="payment_notes"
                      name="payment_notes"
                      rows={3}
                      placeholder="Optional payment notes..."
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="mt-6 w-full rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800"
                  >
                    Record Payment
                  </button>
                </form>
              )}
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    Payment History
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    All payments recorded against this invoice.
                  </p>
                </div>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {
                    payments.length
                  }{" "}
                  {payments.length ===
                  1
                    ? "payment"
                    : "payments"}
                </span>
              </div>

              {payments.length ===
              0 ? (
                <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                  No payments recorded yet.
                </div>
              ) : (
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <Heading>
                          Date
                        </Heading>

                        <Heading>
                          Method
                        </Heading>

                        <Heading>
                          Reference
                        </Heading>

                        <Heading right>
                          Amount
                        </Heading>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {payments.map(
                        (
                          payment
                        ) => (
                          <tr
                            key={
                              payment.id
                            }
                          >
                            <td className="px-4 py-4 text-sm text-slate-700">
                              {formatDate(
                                payment.payment_date
                              )}
                            </td>

                            <td className="px-4 py-4 text-sm text-slate-700">
                              {payment.payment_method ||
                                "Not recorded"}
                            </td>

                            <td className="px-4 py-4 text-sm text-slate-600">
                              {payment.payment_reference ||
                                "—"}

                              {payment.notes && (
                                <p className="mt-1 text-xs text-slate-400">
                                  {
                                    payment.notes
                                  }
                                </p>
                              )}
                            </td>

                            <td className="px-4 py-4 text-right text-sm font-semibold text-emerald-700">
                              {formatCurrency(
                                payment.amount
                              )}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Customer Message
              </h2>

              <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {invoice.customer_message ||
                  "No customer message recorded."}
              </p>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Payment Terms
              </h2>

              <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {invoice.payment_terms ||
                  "No payment terms recorded."}
              </p>
            </section>
          </div>

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Internal Notes
            </h2>

            <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {invoice.internal_notes ||
                "No internal notes recorded."}
            </p>
          </section>

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Invoice Activity
            </h2>

            <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <DetailRow
                label="Sent To"
                value={
                  invoice.sent_to ||
                  "Not sent"
                }
              />

              <DetailRow
                label="Sent"
                value={formatDateTime(
                  invoice.sent_at
                )}
              />

              <DetailRow
                label="Viewed"
                value={formatDateTime(
                  invoice.viewed_at
                )}
              />

              <DetailRow
                label="Paid"
                value={formatDateTime(
                  invoice.paid_at
                )}
              />
            </div>
          </section>

          {invoice.public_token && (
            <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Customer Invoice Link
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                This is the secure customer-facing invoice page.
              </p>

              <Link
                href={`/i/${invoice.public_token}`}
                target="_blank"
                className="mt-5 inline-flex rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Preview Customer Invoice →
              </Link>
            </section>
          )}

          {fullyPaid &&
            invoice.invoice_type ===
              "Final" && (
              <section className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Final Payment Received
                </p>

                <h2 className="mt-2 text-xl font-bold text-emerald-950">
                  Guarantee Available
                </h2>

                <p className="mt-2 text-sm leading-6 text-emerald-800">
                  This final invoice has been paid in full, so a customer guarantee can now be generated.
                </p>

                <button
                  type="button"
                  disabled
                  className="mt-5 rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white opacity-60"
                >
                  Generate Guarantee
                </button>

                <p className="mt-2 text-xs text-emerald-700">
                  We’ll activate this button when we build the Guarantee section next.
                </p>
              </section>
            )}
        </div>
      </main>
    </div>
  );
}

function InvoiceItemsSection({
  title,
  items,
}: {
  title: string;
  items: {
    id: string;
    description: string;
    quantity: number | string;
    unit: string | null;
    unit_price: number | string;
  }[];
}) {
  return (
    <section className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-5">
        <h2 className="text-xl font-semibold text-slate-900">
          {title}
        </h2>
      </div>

      {items.length === 0 ? (
        <div className="p-8 text-sm text-slate-500">
          No {title.toLowerCase()} items recorded.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <Heading>
                  Description
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
                        {
                          quantity
                        }
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
                          quantity *
                            unitPrice
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

function Heading({
  children,
  right = false,
}: {
  children: React.ReactNode;
  right?: boolean;
}) {
  return (
    <th
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 ${
        right
          ? "text-right"
          : "text-left"
      }`}
    >
      {children}
    </th>
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

function InfoCard({
  title,
  value,
  href,
}: {
  title: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </p>

      {href ? (
        <Link
          href={href}
          className="mt-2 block font-semibold text-slate-900 hover:underline"
        >
          {value}
        </Link>
      ) : (
        <p className="mt-2 font-semibold text-slate-900">
          {value}
        </p>
      )}
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

function StatusBadge({
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
              : status === "Cancelled"
                ? "bg-slate-200 text-slate-600"
                : "bg-slate-100 text-slate-700";

  return (
    <span
      className={`rounded-full px-4 py-2 text-sm font-semibold ${classes}`}
    >
      {status}
    </span>
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