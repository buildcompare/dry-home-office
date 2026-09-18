import Image from "next/image";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

type CustomerInvoicePageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function CustomerInvoicePage({
  params,
}: CustomerInvoicePageProps) {
  const { token } =
    await params;

  const supabase =
    createAdminClient();

  const {
    data: invoice,
    error,
  } = await supabase
    .from("invoices")
    .select(`
      id,
      invoice_number,
      title,
      invoice_type,
      status,
      invoice_date,
      due_date,
      description,
      subtotal,
      vat_enabled,
      vat_rate,
      vat_amount,
      amount,
      amount_paid,
      customer_message,
      payment_terms,
      viewed_at,
      paid_at,
      payment_method,
      payment_reference,
      clients (
        display_name,
        first_name,
        last_name,
        email,
        address_line_1,
        address_line_2,
        town,
        county,
        postcode
      ),
      jobs (
        job_number,
        title
      ),
      contracts (
        contract_number
      )
    `)
    .eq(
      "public_token",
      token
    )
    .single();

  if (
    error ||
    !invoice
  ) {
    notFound();
  }

  const {
    data: items,
  } = await supabase
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
      invoice.id
    )
    .order(
      "sort_order",
      {
        ascending: true,
      }
    );

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
    [
      client?.first_name,
      client?.last_name,
    ]
      .filter(Boolean)
      .join(" ") ||
    "Customer";

  if (
    !invoice.viewed_at
  ) {
    await supabase
      .from("invoices")
      .update({
        viewed_at:
          new Date().toISOString(),

        status:
          invoice.status ===
          "Sent"
            ? "Viewed"
            : invoice.status,
      })
      .eq(
        "id",
        invoice.id
      );
  }

  const address = [
    client?.address_line_1,
    client?.address_line_2,
    client?.town,
    client?.county,
    client?.postcode,
  ].filter(Boolean);

  const labourItems =
    items?.filter(
      (item) =>
        item.item_type !==
        "Materials"
    ) ?? [];

  const materialItems =
    items?.filter(
      (item) =>
        item.item_type ===
        "Materials"
    ) ?? [];

  const balance =
    Number(
      invoice.amount ?? 0
    ) -
    Number(
      invoice.amount_paid ?? 0
    );

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="overflow-hidden rounded-2xl bg-white shadow-lg">
          <header className="bg-slate-950 px-6 py-8 text-white sm:px-10">
            <Image
              src="/dryhome-logo-light.png"
              alt="Dry Home Damp Proofing Solutions"
              width={230}
              height={90}
              className="h-auto w-52 object-contain"
              priority
            />

            <div className="mt-8 flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="text-sm font-medium uppercase tracking-wider text-slate-400">
                  Invoice
                </p>

                <h1 className="mt-2 text-2xl font-bold">
                  {
                    invoice.invoice_number
                  }
                </h1>

                <p className="mt-2 text-slate-300">
                  {invoice.title ||
                    invoice.invoice_type ||
                    "Customer Invoice"}
                </p>
              </div>

              <div className="text-left sm:text-right">
                <p className="text-sm text-slate-400">
                  Amount Due
                </p>

                <p className="mt-1 text-2xl font-bold">
                  {formatCurrency(
                    balance
                  )}
                </p>
              </div>
            </div>
          </header>

          <div className="p-6 sm:p-10">
            {invoice.status ===
              "Paid" && (
              <div className="mb-8 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="font-semibold text-emerald-900">
                  This invoice has been paid in full.
                </p>

                {invoice.paid_at && (
                  <p className="mt-1 text-sm text-emerald-700">
                    Paid{" "}
                    {formatDateTime(
                      invoice.paid_at
                    )}
                  </p>
                )}
              </div>
            )}

            <div className="grid gap-6 sm:grid-cols-2">
              <section>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Invoice To
                </p>

                <p className="mt-2 font-semibold text-slate-900">
                  {clientName}
                </p>

                {address.length >
                  0 && (
                  <div className="mt-2 text-sm leading-6 text-slate-600">
                    {address.map(
                      (line) => (
                        <div
                          key={line}
                        >
                          {line}
                        </div>
                      )
                    )}
                  </div>
                )}

                {client?.email && (
                  <p className="mt-2 text-sm text-slate-600">
                    {client.email}
                  </p>
                )}
              </section>

              <section>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Invoice Details
                </p>

                <div className="mt-2 space-y-2 text-sm text-slate-600">
                  <p>
                    <strong className="text-slate-900">
                      Type:
                    </strong>{" "}
                    {
                      invoice.invoice_type
                    }
                  </p>

                  <p>
                    <strong className="text-slate-900">
                      Invoice date:
                    </strong>{" "}
                    {formatDate(
                      invoice.invoice_date
                    )}
                  </p>

                  <p>
                    <strong className="text-slate-900">
                      Due date:
                    </strong>{" "}
                    {formatDate(
                      invoice.due_date
                    )}
                  </p>

                  {job && (
                    <p>
                      <strong className="text-slate-900">
                        Job:
                      </strong>{" "}
                      {
                        job.job_number
                      }
                    </p>
                  )}

                  {contract && (
                    <p>
                      <strong className="text-slate-900">
                        Contract:
                      </strong>{" "}
                      {
                        contract.contract_number
                      }
                    </p>
                  )}
                </div>
              </section>
            </div>

            {invoice.description && (
              <section className="mt-10 border-t border-slate-200 pt-8">
                <h2 className="text-xl font-bold text-slate-900">
                  Description
                </h2>

                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                  {
                    invoice.description
                  }
                </p>
              </section>
            )}

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

            <section className="mt-10 border-t border-slate-200 pt-8">
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

                {Number(
                  invoice.amount_paid ??
                    0
                ) > 0 && (
                  <TotalRow
                    label="Amount Paid"
                    value={formatCurrency(
                      invoice.amount_paid
                    )}
                  />
                )}

                <div className="mt-4 flex items-center justify-between border-t-2 border-slate-900 pt-5">
                  <span className="text-xl font-bold text-slate-900">
                    Balance Due
                  </span>

                  <span className="text-2xl font-bold text-slate-900">
                    {formatCurrency(
                      balance
                    )}
                  </span>
                </div>
              </div>
            </section>

            {invoice.customer_message && (
              <section className="mt-10 rounded-xl bg-slate-50 p-6">
                <h2 className="font-semibold text-slate-900">
                  Message from Dry Home
                </h2>

                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {
                    invoice.customer_message
                  }
                </p>
              </section>
            )}

            <section className="mt-10 border-t border-slate-200 pt-8">
              <h2 className="text-xl font-bold text-slate-900">
                Payment Terms
              </h2>

              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {invoice.payment_terms ||
                  "No payment terms recorded."}
              </p>
            </section>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Dry Home Damp Proofing Solutions LTD
        </p>
      </div>
    </main>
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
  if (
    items.length === 0
  ) {
    return null;
  }

  return (
    <section className="mt-10 border-t border-slate-200 pt-8">
      <h2 className="text-xl font-bold text-slate-900">
        {title}
      </h2>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                Description
              </th>

              <th className="py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">
                Qty
              </th>

              <th className="py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">
                Price
              </th>

              <th className="py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">
                Total
              </th>
            </tr>
          </thead>

          <tbody>
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
                    className="border-b border-slate-100"
                  >
                    <td className="py-4 text-sm text-slate-700">
                      {
                        item.description
                      }
                    </td>

                    <td className="py-4 text-right text-sm text-slate-600">
                      {
                        quantity
                      }
                    </td>

                    <td className="py-4 text-right text-sm text-slate-600">
                      {formatCurrency(
                        unitPrice
                      )}
                    </td>

                    <td className="py-4 text-right text-sm font-semibold text-slate-900">
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
      month: "long",
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
    return "Not recorded";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone:
        "Europe/London",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(
    new Date(value)
  );
}