import Link from "next/link";
import { notFound } from "next/navigation";

import Sidebar from "@/components/Sidebar";
import EmailVariationButton from "@/components/EmailVariationButton";

import { createClient } from "@/lib/supabase/server";

import {
  manuallyAcceptVariation,
} from "../actions";

type VariationPageProps = {
  params: Promise<{
    id: string;
  }>;

  searchParams: Promise<{
    sent?: string;
    accepted?: string;
    error?: string;
    warning?: string;
  }>;
};

export default async function VariationPage({
  params,
  searchParams,
}: VariationPageProps) {
  const { id } =
    await params;

  const query =
    await searchParams;

  const supabase =
    await createClient();

  /* =========================================================
     VARIATION
     ========================================================= */

  const {
    data: variation,
    error,
  } = await supabase
    .from("variations")
    .select(`
      id,
      variation_number,
      job_id,
      client_id,
      quote_id,
      title,
      description,
      status,
      variation_date,
      valid_until,
      subtotal,
      vat_enabled,
      vat_rate,
      vat_amount,
      amount,
      customer_message,
      internal_notes,
      public_token,
      sent_to,
      sent_at,
      viewed_at,
      accepted_at,
      declined_at,
      acceptance_method,
      accepted_by,
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
        quote_number,
        title,
        amount,
        status
      )
    `)
    .eq(
      "id",
      id
    )
    .single();

  if (
    error ||
    !variation
  ) {
    notFound();
  }

  /* =========================================================
     ITEMS
     ========================================================= */

  const {
    data: itemsData,
    error: itemsError,
  } = await supabase
    .from(
      "variation_items"
    )
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
      "variation_id",
      variation.id
    )
    .order(
      "sort_order",
      {
        ascending:
          true,
      }
    );

  if (
    itemsError
  ) {
    console.error(
      "Variation items load error:",
      itemsError
    );
  }

  const items =
    itemsData ?? [];

  /* =========================================================
     RELATED RECORDS
     ========================================================= */

  const client =
    Array.isArray(
      variation.clients
    )
      ? variation.clients[0]
      : variation.clients;

  const job =
    Array.isArray(
      variation.jobs
    )
      ? variation.jobs[0]
      : variation.jobs;

  const quote =
    Array.isArray(
      variation.quotes
    )
      ? variation.quotes[0]
      : variation.quotes;

  const clientName =
    client?.display_name ||
    [
      client?.first_name,
      client?.last_name,
    ]
      .filter(Boolean)
      .join(" ") ||
    "Unknown client";

  /* =========================================================
     STATUS
     ========================================================= */

  const canManuallyAccept =
    variation.status !==
      "Accepted" &&
    variation.status !==
      "Declined" &&
    variation.status !==
      "Cancelled";

  const variationAccepted =
    variation.status ===
    "Accepted";

  const variationDeclined =
    variation.status ===
    "Declined";

  const variationCancelled =
    variation.status ===
    "Cancelled";

  /* =========================================================
     ITEM GROUPS
     ========================================================= */

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

  /* =========================================================
     RETURN
     ========================================================= */

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-7xl">

          {/* =====================================================
              MESSAGES
              ===================================================== */}

          {query.sent ===
            "1" && (
            <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800">
              Variation emailed successfully to{" "}
              {variation.sent_to ||
                client?.email ||
                "the customer"}.
            </div>
          )}

          {query.accepted ===
            "manual" && (
            <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800">
              Variation manually accepted successfully.
              The additional works are now included in the
              approved value for this job.
            </div>
          )}

          {query.error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
              {decodeURIComponent(
                query.error
              )}
            </div>
          )}

          {query.warning && (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-800">
              {decodeURIComponent(
                query.warning
              )}
            </div>
          )}

          {/* =====================================================
              HEADER
              ===================================================== */}

          <div className="mb-8">
            <Link
              href={
                job?.id
                  ? `/jobs/${job.id}`
                  : "/jobs"
              }
              className="text-sm font-medium text-slate-500 hover:text-slate-900"
            >
              ← Back to Job Hub
            </Link>

            <div className="mt-4 flex flex-wrap items-start justify-between gap-5">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm font-medium text-slate-500">
                    {
                      variation.variation_number
                    }
                  </p>

                  <StatusBadge
                    status={
                      variation.status
                    }
                  />
                </div>

                <h1 className="mt-2 text-3xl font-bold text-slate-900">
                  {variation.title ||
                    "Additional Works"}
                </h1>

                <p className="mt-2 text-slate-500">
                  {clientName}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {variation.public_token && (
                  <Link
                    href={`/v/${variation.public_token}`}
                    target="_blank"
                    className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Preview Variation
                  </Link>
                )}

                {!variationCancelled && (
                  <EmailVariationButton
                    variationId={
                      variation.id
                    }
                    recipient={
                      client?.email ||
                      null
                    }
                    status={
                      variation.status
                    }
                  />
                )}

                {job?.id && (
                  <Link
                    href={`/jobs/${job.id}`}
                    className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Open Job Hub
                  </Link>
                )}
              </div>
            </div>

            {!client?.email &&
              !variationCancelled && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                This client does not have an email address
                saved. You can still open the email composer
                and enter a recipient manually without changing
                the client record.
              </div>
            )}
          </div>

          {/* =====================================================
              SUMMARY
              ===================================================== */}

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Variation Value"
              value={formatCurrency(
                variation.amount
              )}
            />

            <SummaryCard
              title="Status"
              value={
                variation.status
              }
            />

            <SummaryCard
              title="Variation Date"
              value={formatDate(
                variation.variation_date
              )}
            />

            <SummaryCard
              title="Valid Until"
              value={formatDate(
                variation.valid_until
              )}
            />
          </div>

          {/* =====================================================
              MANUAL ACCEPTANCE
              ===================================================== */}

          {canManuallyAccept && (
            <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                    External Approval
                  </p>

                  <h2 className="mt-2 text-xl font-bold text-amber-950">
                    Record Manual Acceptance
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-amber-800">
                    Use this if the additional works have been
                    approved outside DryHome Office — for example
                    by email, phone, council purchase order or
                    written instruction.
                  </p>
                </div>

                <form
                  action={
                    manuallyAcceptVariation
                  }
                  className="w-full max-w-md"
                >
                  <input
                    type="hidden"
                    name="variation_id"
                    value={
                      variation.id
                    }
                  />

                  <label
                    htmlFor="accepted_by"
                    className="block text-xs font-semibold uppercase tracking-wide text-amber-800"
                  >
                    Approved By / Reference
                  </label>

                  <input
                    id="accepted_by"
                    type="text"
                    name="accepted_by"
                    placeholder="e.g. Mrs Smith / PO 12345"
                    className="mt-2 w-full rounded-lg border border-amber-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-amber-500"
                  />

                  <button
                    type="submit"
                    className="mt-3 w-full rounded-lg px-5 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90"
                    style={{
                      backgroundColor:
                        "#b45309",
                    }}
                  >
                    Manual Accept
                  </button>
                </form>
              </div>
            </section>
          )}

          {/* =====================================================
              ACCEPTED
              ===================================================== */}

          {variationAccepted && (
            <section className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Approved Additional Works
              </p>

              <h2 className="mt-2 text-xl font-bold text-emerald-950">
                Variation Accepted
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-800">
                These additional works are approved and are now
                included in the overall approved value shown in
                the Job Hub.
              </p>

              <div className="mt-5 grid gap-5 md:grid-cols-3">
                <DetailRow
                  label="Accepted"
                  value={formatDateTime(
                    variation.accepted_at
                  )}
                />

                <DetailRow
                  label="Method"
                  value={
                    variation.acceptance_method ||
                    "Customer"
                  }
                />

                <DetailRow
                  label="Approved By"
                  value={
                    variation.accepted_by ||
                    "Not recorded"
                  }
                />
              </div>
            </section>
          )}

          {/* =====================================================
              DECLINED
              ===================================================== */}

          {variationDeclined && (
            <section className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                Customer Decision
              </p>

              <h2 className="mt-2 text-xl font-bold text-red-950">
                Variation Declined
              </h2>

              <p className="mt-2 text-sm leading-6 text-red-800">
                These additional works have not been approved and
                are not included in the approved job value.
              </p>

              <div className="mt-5">
                <DetailRow
                  label="Declined"
                  value={formatDateTime(
                    variation.declined_at
                  )}
                />
              </div>
            </section>
          )}

          {/* =====================================================
              LINKS
              ===================================================== */}

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <InfoCard
              title="Client"
              value={
                clientName
              }
              href={
                client?.id
                  ? `/clients/${client.id}`
                  : undefined
              }
            />

            <InfoCard
              title="Job"
              value={
                job?.job_number
                  ? `${job.job_number}${
                      job.title
                        ? ` — ${job.title}`
                        : ""
                    }`
                  : "No linked job"
              }
              href={
                job?.id
                  ? `/jobs/${job.id}`
                  : undefined
              }
            />

            <InfoCard
              title="Original Quote"
              value={
                quote?.quote_number
                  ? `${quote.quote_number}${
                      quote.title
                        ? ` — ${quote.title}`
                        : ""
                    }`
                  : "No linked quote"
              }
              href={
                quote?.id
                  ? `/quotes/${quote.id}`
                  : undefined
              }
            />
          </div>

          {/* =====================================================
              SCOPE
              ===================================================== */}

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Scope
            </p>

            <h2 className="mt-1 text-xl font-semibold text-slate-900">
              Additional Works
            </h2>

            <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {variation.description ||
                "No additional description recorded."}
            </p>
          </section>

          {/* =====================================================
              LABOUR
              ===================================================== */}

          <ItemSection
            title="Labour / Works"
            items={
              labourItems
            }
          />

          {/* =====================================================
              MATERIALS
              ===================================================== */}

          <ItemSection
            title="Materials"
            items={
              materialItems
            }
          />

          {/* =====================================================
              TOTALS
              ===================================================== */}

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Financial Summary
                </p>

                <h2 className="mt-1 text-xl font-semibold text-slate-900">
                  Variation Total
                </h2>
              </div>

              <StatusBadge
                status={
                  variation.status
                }
              />
            </div>

            <div className="ml-auto mt-6 max-w-md space-y-3">
              <MoneyRow
                label="Subtotal"
                value={
                  variation.subtotal
                }
              />

              {variation.vat_enabled && (
                <MoneyRow
                  label={`VAT ${formatVatRate(
                    variation.vat_rate
                  )}%`}
                  value={
                    variation.vat_amount
                  }
                />
              )}

              <div className="border-t border-slate-200 pt-4">
                <MoneyRow
                  label="Total"
                  value={
                    variation.amount
                  }
                  strong
                />
              </div>

              {!variation.vat_enabled && (
                <p className="text-right text-xs text-slate-400">
                  VAT not added
                </p>
              )}
            </div>
          </section>

          {/* =====================================================
              CUSTOMER MESSAGE
              ===================================================== */}

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">
              Customer Message
            </h2>

            <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {variation.customer_message ||
                "No customer message recorded."}
            </p>
          </section>

          {/* =====================================================
              INTERNAL NOTES
              ===================================================== */}

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">
              Internal Notes
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              DryHome only — these notes are not shown to the
              customer.
            </p>

            <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {variation.internal_notes ||
                "No internal notes recorded."}
            </p>
          </section>

          {/* =====================================================
              ACTIVITY
              ===================================================== */}

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Activity
              </p>

              <h2 className="mt-1 text-xl font-semibold text-slate-900">
                Variation Activity
              </h2>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
              <DetailRow
                label="Created"
                value={formatDateTime(
                  variation.created_at
                )}
              />

              <DetailRow
                label="Sent To"
                value={
                  variation.sent_to ||
                  "Not sent"
                }
              />

              <DetailRow
                label="Sent"
                value={formatDateTime(
                  variation.sent_at
                )}
              />

              <DetailRow
                label="Viewed"
                value={formatDateTime(
                  variation.viewed_at
                )}
              />

              <DetailRow
                label={
                  variationDeclined
                    ? "Declined"
                    : "Accepted"
                }
                value={formatDateTime(
                  variationDeclined
                    ? variation.declined_at
                    : variation.accepted_at
                )}
              />
            </div>
          </section>

          {/* =====================================================
              CUSTOMER VARIATION
              ===================================================== */}

          {variation.public_token && (
            <section className="mb-10 mt-8 overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
              <div className="border-b border-amber-200 bg-amber-50 p-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                  Customer Variation
                </p>

                <h2 className="mt-2 text-xl font-bold text-slate-900">
                  Customer Approval Link
                </h2>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  Send the variation to the customer using the
                  email composer. The secure customer page will
                  allow them to review the additional works and
                  approve or decline them.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 p-6">
                <Link
                  href={`/v/${variation.public_token}`}
                  target="_blank"
                  className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Preview Customer Variation
                </Link>

                {!variationCancelled && (
                  <EmailVariationButton
                    variationId={
                      variation.id
                    }
                    recipient={
                      client?.email ||
                      null
                    }
                    status={
                      variation.status
                    }
                  />
                )}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

/* =========================================================
   ITEMS
   ========================================================= */

function ItemSection({
  title,
  items,
}: {
  title: string;

  items: {
    id: string;
    description: string;
    quantity:
      | number
      | string;
    unit:
      | string
      | null;
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
      </div>

      {items.length ===
      0 ? (
        <div className="p-6 text-sm text-slate-500">
          No items recorded.
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
                (
                  item
                ) => {
                  const quantity =
                    Number(
                      item.quantity ??
                        0
                    );

                  const unitPrice =
                    Number(
                      item.unit_price ??
                        0
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
                      <TableCell>
                        {
                          item.description
                        }
                      </TableCell>

                      <TableCell
                        right
                      >
                        {
                          quantity
                        }
                      </TableCell>

                      <TableCell>
                        {item.unit ||
                          "item"}
                      </TableCell>

                      <TableCell
                        right
                      >
                        {formatCurrency(
                          unitPrice
                        )}
                      </TableCell>

                      <TableCell
                        right
                      >
                        <span className="font-semibold text-slate-900">
                          {formatCurrency(
                            total
                          )}
                        </span>
                      </TableCell>
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

/* =========================================================
   SUMMARY CARD
   ========================================================= */

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

/* =========================================================
   INFO CARD
   ========================================================= */

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
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </p>

      <p className="mt-2 text-lg font-semibold text-slate-900">
        {value}
      </p>

      {href && (
        <Link
          href={
            href
          }
          className="mt-3 inline-block text-sm font-semibold text-slate-700 hover:underline"
        >
          View →
        </Link>
      )}
    </section>
  );
}

/* =========================================================
   DETAIL ROW
   ========================================================= */

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold text-slate-900">
        {value ||
          "Not recorded"}
      </p>
    </div>
  );
}

/* =========================================================
   MONEY ROW
   ========================================================= */

function MoneyRow({
  label,
  value,
  strong = false,
}: {
  label: string;

  value:
    | number
    | string
    | null;

  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-5">
      <p
        className={
          strong
            ? "text-base font-bold text-slate-900"
            : "text-sm text-slate-500"
        }
      >
        {label}
      </p>

      <p
        className={
          strong
            ? "text-xl font-bold text-slate-900"
            : "text-sm font-semibold text-slate-900"
        }
      >
        {formatCurrency(
          value
        )}
      </p>
    </div>
  );
}

/* =========================================================
   STATUS BADGE
   ========================================================= */

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const classes =
    status === "Accepted"
      ? "bg-emerald-100 text-emerald-800"
      : status ===
            "Sent" ||
          status ===
            "Viewed"
        ? "bg-blue-100 text-blue-800"
        : status ===
              "Declined" ||
            status ===
              "Cancelled"
          ? "bg-red-100 text-red-700"
          : status ===
              "Draft"
            ? "bg-amber-100 text-amber-800"
            : "bg-slate-100 text-slate-700";

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${classes}`}
    >
      {status}
    </span>
  );
}

/* =========================================================
   TABLE
   ========================================================= */

function Heading({
  children,
  right = false,
}: {
  children:
    React.ReactNode;

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

function TableCell({
  children,
  right = false,
}: {
  children:
    React.ReactNode;

  right?: boolean;
}) {
  return (
    <td
      className={`px-6 py-5 text-sm text-slate-600 ${
        right
          ? "text-right"
          : ""
      }`}
    >
      {children}
    </td>
  );
}

/* =========================================================
   FORMATTERS
   ========================================================= */

function formatCurrency(
  value:
    | number
    | string
    | null
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
    Number(
      value ?? 0
    )
  );
}

function formatVatRate(
  value:
    | number
    | string
    | null
) {
  const number =
    Number(
      value ?? 0
    );

  if (
    Number.isInteger(
      number
    )
  ) {
    return String(
      number
    );
  }

  return number.toFixed(
    2
  );
}

function formatDate(
  value:
    | string
    | null
) {
  if (!value) {
    return "Not set";
  }

  const [
    year,
    month,
    day,
  ] = value
    .slice(
      0,
      10
    )
    .split("-")
    .map(Number);

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day:
        "2-digit",

      month:
        "short",

      year:
        "numeric",

      timeZone:
        "UTC",
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
  value:
    | string
    | null
) {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day:
        "2-digit",

      month:
        "short",

      year:
        "numeric",

      hour:
        "2-digit",

      minute:
        "2-digit",

      timeZone:
        "Europe/London",
    }
  ).format(
    new Date(
      value
    )
  );
}