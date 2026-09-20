import Image from "next/image";
import { notFound } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";

type CustomerVariationPageProps = {
  params: Promise<{
    token: string;
  }>;

  searchParams: Promise<{
    accepted?: string;
    declined?: string;
  }>;
};

export const dynamic =
  "force-dynamic";

export default async function CustomerVariationPage({
  params,
  searchParams,
}: CustomerVariationPageProps) {
  const { token } =
    await params;

  const query =
    await searchParams;

  const supabase =
    createAdminClient();

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
      public_token,
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
      viewed_at,
      accepted_at,
      declined_at,
      acceptance_method,
      accepted_by,

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

      quotes (
        quote_number,
        title
      )
    `)
    .eq(
      "public_token",
      token
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
    data: items,
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
      "Unable to load variation items:",
      itemsError
    );
  }

  /* =========================================================
     RECORD VIEW
     ========================================================= */

  if (
    !variation.viewed_at
  ) {
    const now =
      new Date()
        .toISOString();

    await supabase
      .from(
        "variations"
      )
      .update({
        viewed_at:
          now,
      })
      .eq(
        "id",
        variation.id
      )
      .is(
        "viewed_at",
        null
      );
  }

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
    "Customer";

  const addressLines = [
    client?.address_line_1,
    client?.address_line_2,
    client?.town,
    client?.county,
    client?.postcode,
  ].filter(
    (
      value
    ): value is string =>
      Boolean(
        value
      )
  );

  /* =========================================================
     ITEMS
     ========================================================= */

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

  /* =========================================================
     STATUS
     ========================================================= */

  const accepted =
    variation.status ===
    "Accepted";

  const declined =
    variation.status ===
    "Declined";

  const cancelled =
    variation.status ===
    "Cancelled";

  const hasResponded =
    accepted ||
    declined ||
    cancelled;

  return (
    <main className="min-h-screen bg-slate-100 py-8 sm:py-12">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">

        {/* LOGO */}

        <div className="mb-8 flex justify-center">
          <Image
            src="/dryhome-logo-light.png"
            alt="Dry Home Damp Proofing Solutions"
            width={250}
            height={100}
            priority
            className="h-auto max-h-24 w-auto"
          />
        </div>

        {/* =====================================================
            SUCCESS
            ===================================================== */}

        {query.accepted ===
          "1" && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
            <p className="font-semibold text-emerald-900">
              Thank you. These additional works have been approved.
            </p>

            <p className="mt-1 text-sm text-emerald-700">
              Dry Home Damp Proofing Solutions has been notified.
            </p>
          </div>
        )}

        {query.declined ===
          "1" && (
          <div className="mb-6 rounded-2xl border border-slate-300 bg-white p-5 text-center">
            <p className="font-semibold text-slate-900">
              Your response has been recorded.
            </p>

            <p className="mt-1 text-sm text-slate-500">
              These additional works have been declined.
            </p>
          </div>
        )}

        {/* =====================================================
            MAIN DOCUMENT
            ===================================================== */}

        <div className="overflow-hidden rounded-3xl bg-white shadow-sm">

          {/* HEADER */}

          <div
            className="px-6 py-8 text-white sm:px-10"
            style={{
              backgroundColor:
                "#d97706",
            }}
          >
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-amber-100">
                  Variation / Additional Works
                </p>

                <h1 className="mt-2 text-3xl font-bold">
                  {variation.title ||
                    "Additional Works"}
                </h1>

                <p className="mt-2 text-amber-100">
                  {
                    variation.variation_number
                  }
                </p>
              </div>

              <StatusBadge
                status={
                  variation.status
                }
              />
            </div>
          </div>

          {/* =====================================================
              CUSTOMER / DOCUMENT INFORMATION
              ===================================================== */}

          <div className="grid gap-8 border-b border-slate-200 p-6 sm:grid-cols-2 sm:p-10">

            <div>
              <SmallLabel>
                Prepared For
              </SmallLabel>

              <p className="mt-2 text-lg font-bold text-slate-900">
                {clientName}
              </p>

              {addressLines.length >
                0 && (
                <div className="mt-2 text-sm leading-6 text-slate-600">
                  {addressLines.map(
                    (
                      line
                    ) => (
                      <p
                        key={
                          line
                        }
                      >
                        {
                          line
                        }
                      </p>
                    )
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-5">

              <div>
                <SmallLabel>
                  Variation Date
                </SmallLabel>

                <p className="mt-2 font-semibold text-slate-900">
                  {formatDate(
                    variation.variation_date
                  )}
                </p>
              </div>

              <div>
                <SmallLabel>
                  Valid Until
                </SmallLabel>

                <p className="mt-2 font-semibold text-slate-900">
                  {formatDate(
                    variation.valid_until
                  )}
                </p>
              </div>

              {job?.job_number && (
                <div className="col-span-2">
                  <SmallLabel>
                    Job Reference
                  </SmallLabel>

                  <p className="mt-2 font-semibold text-slate-900">
                    {
                      job.job_number
                    }
                  </p>

                  {job.title && (
                    <p className="mt-1 text-sm text-slate-500">
                      {
                        job.title
                      }
                    </p>
                  )}
                </div>
              )}

              {quote?.quote_number && (
                <div className="col-span-2">
                  <SmallLabel>
                    Original Quotation
                  </SmallLabel>

                  <p className="mt-2 font-semibold text-slate-900">
                    {
                      quote.quote_number
                    }
                  </p>

                  {quote.title && (
                    <p className="mt-1 text-sm text-slate-500">
                      {
                        quote.title
                      }
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* =====================================================
              INTRO
              ===================================================== */}

          <section className="border-b border-amber-200 bg-amber-50 p-6 sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">
              Important
            </p>

            <h2 className="mt-3 text-xl font-bold text-amber-950">
              Additional works outside the original quotation
            </h2>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-amber-900">
              The works shown below have been identified in addition
              to the original agreed quotation. Please review the
              additional scope and cost before confirming whether
              you would like us to proceed.
            </p>
          </section>

          {/* =====================================================
              SCOPE
              ===================================================== */}

          <section className="border-b border-slate-200 p-6 sm:p-10">
            <SmallLabel>
              Scope of Additional Works
            </SmallLabel>

            <h2 className="mt-3 text-2xl font-bold text-slate-900">
              {variation.title ||
                "Additional Works"}
            </h2>

            <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-700 sm:text-base">
              {variation.description ||
                "Please refer to the additional work items below."}
            </p>
          </section>

          {/* =====================================================
              LABOUR
              ===================================================== */}

          {labourItems.length >
            0 && (
            <VariationItemsSection
              title="Labour / Works"
              items={
                labourItems
              }
            />
          )}

          {/* =====================================================
              MATERIALS
              ===================================================== */}

          {materialItems.length >
            0 && (
            <VariationItemsSection
              title="Materials"
              items={
                materialItems
              }
            />
          )}

          {/* =====================================================
              TOTALS
              ===================================================== */}

          <section className="border-t border-slate-200 bg-slate-50 p-6 sm:p-10">
            <div className="ml-auto max-w-md">
              <TotalRow
                label="Subtotal"
                value={formatCurrency(
                  variation.subtotal
                )}
              />

              {variation.vat_enabled && (
                <TotalRow
                  label={`VAT (${formatVatRate(
                    variation.vat_rate
                  )}%)`}
                  value={formatCurrency(
                    variation.vat_amount
                  )}
                />
              )}

              <div className="mt-5 flex items-center justify-between border-t-2 border-slate-900 pt-5">
                <span className="text-xl font-bold text-slate-900">
                  Variation Total
                </span>

                <span className="text-2xl font-bold text-slate-900">
                  {formatCurrency(
                    variation.amount
                  )}
                </span>
              </div>

              {!variation.vat_enabled && (
                <p className="mt-3 text-right text-xs text-slate-500">
                  VAT not added
                </p>
              )}
            </div>
          </section>

          {/* =====================================================
              CUSTOMER MESSAGE
              ===================================================== */}

          {variation.customer_message && (
            <section className="border-t border-slate-200 p-6 sm:p-10">
              <h2 className="text-lg font-bold text-slate-900">
                Message
              </h2>

              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {
                  variation.customer_message
                }
              </p>
            </section>
          )}

          {/* =====================================================
              ACCEPT / DECLINE
              ===================================================== */}

          <section className="border-t border-slate-200 bg-slate-50 p-6 sm:p-10">
            {hasResponded ? (
              <ResponseAlreadyRecorded
                status={
                  variation.status
                }
                acceptedAt={
                  variation.accepted_at
                }
                declinedAt={
                  variation.declined_at
                }
              />
            ) : (
              <>
                <div className="text-center">
                  <h2 className="text-xl font-bold text-slate-900">
                    Would you like us to proceed with these additional works?
                  </h2>

                  <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
                    Please accept or decline this variation below.
                    Approval confirms that you agree to the additional
                    works and the variation total shown above.
                  </p>
                </div>

                <div className="mx-auto mt-6 flex max-w-lg flex-col gap-3 sm:flex-row">

                  <form
                    method="post"
                    action={`/v/${token}/accept`}
                    className="flex-1"
                  >
                    <button
                      type="submit"
                      className="w-full rounded-xl bg-emerald-700 px-6 py-4 font-semibold text-white hover:bg-emerald-800"
                    >
                      Accept Variation
                    </button>
                  </form>

                  <form
                    method="post"
                    action={`/v/${token}/decline`}
                    className="flex-1"
                  >
                    <button
                      type="submit"
                      className="w-full rounded-xl border border-slate-300 bg-white px-6 py-4 font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Decline
                    </button>
                  </form>
                </div>
              </>
            )}
          </section>
        </div>

        {/* =====================================================
            FOOTER
            ===================================================== */}

        <footer className="py-8 text-center text-sm text-slate-500">
          <p className="font-semibold text-slate-700">
            Dry Home Damp Proofing Solutions LTD
          </p>

          <p className="mt-1">
            dryhomedampproofing.co.uk
          </p>

          <p className="mt-4 text-xs text-slate-400">
            This variation link is unique to you.
          </p>
        </footer>
      </div>
    </main>
  );
}

/* =========================================================
   ITEM SECTION
   ========================================================= */

function VariationItemsSection({
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
    <section className="border-b border-slate-200 p-6 sm:p-10">
      <h2 className="text-xl font-bold text-slate-900">
        {title}
      </h2>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                Item
              </th>

              <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">
                Qty
              </th>

              <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                Unit
              </th>

              <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">
                Price
              </th>

              <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">
                Total
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {items.map(
              (
                item
              ) => {
                const quantity =
                  Number(
                    item.quantity
                  );

                const unitPrice =
                  Number(
                    item.unit_price
                  );

                const lineTotal =
                  quantity *
                  unitPrice;

                return (
                  <tr
                    key={
                      item.id
                    }
                  >
                    <td className="py-4 pr-4 text-sm font-medium text-slate-800">
                      {
                        item.description
                      }
                    </td>

                    <td className="py-4 text-right text-sm text-slate-600">
                      {formatQuantity(
                        quantity
                      )}
                    </td>

                    <td className="py-4 pl-5 text-sm text-slate-600">
                      {item.unit ||
                        "—"}
                    </td>

                    <td className="py-4 text-right text-sm text-slate-600">
                      {formatCurrency(
                        unitPrice
                      )}
                    </td>

                    <td className="py-4 text-right text-sm font-semibold text-slate-900">
                      {formatCurrency(
                        lineTotal
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

/* =========================================================
   RESPONSE
   ========================================================= */

function ResponseAlreadyRecorded({
  status,
  acceptedAt,
  declinedAt,
}: {
  status: string;

  acceptedAt:
    | string
    | null;

  declinedAt:
    | string
    | null;
}) {
  if (
    status ===
    "Cancelled"
  ) {
    return (
      <div className="text-center">
        <div className="mx-auto inline-flex rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
          Variation Cancelled
        </div>

        <p className="mt-3 text-sm text-slate-500">
          This variation is no longer awaiting approval.
        </p>
      </div>
    );
  }

  const accepted =
    status ===
    "Accepted";

  return (
    <div className="text-center">
      <div
        className={`mx-auto inline-flex rounded-full px-4 py-2 text-sm font-semibold ${
          accepted
            ? "bg-emerald-100 text-emerald-800"
            : "bg-red-100 text-red-800"
        }`}
      >
        {accepted
          ? "Variation Accepted"
          : "Variation Declined"}
      </div>

      <p className="mt-3 text-sm text-slate-500">
        Response recorded{" "}
        {formatDateTime(
          accepted
            ? acceptedAt
            : declinedAt
        )}
      </p>
    </div>
  );
}

/* =========================================================
   SMALL LABEL
   ========================================================= */

function SmallLabel({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
      {children}
    </p>
  );
}

/* =========================================================
   TOTAL ROW
   ========================================================= */

function TotalRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 py-3">
      <span className="text-sm font-medium text-slate-600">
        {label}
      </span>

      <span className="font-semibold text-slate-900">
        {value}
      </span>
    </div>
  );
}

/* =========================================================
   STATUS
   ========================================================= */

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const classes =
    status ===
    "Accepted"
      ? "bg-emerald-100 text-emerald-900"
      : status ===
          "Declined"
        ? "bg-red-100 text-red-900"
        : status ===
            "Cancelled"
          ? "bg-slate-200 text-slate-800"
          : "bg-white/15 text-white";

  return (
    <span
      className={`self-start rounded-full px-4 py-2 text-sm font-semibold ${classes}`}
    >
      {status}
    </span>
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

function formatQuantity(
  value: number
) {
  return new Intl.NumberFormat(
    "en-GB",
    {
      maximumFractionDigits:
        2,
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
      maximumFractionDigits:
        2,
    }
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
    .map(
      Number
    );

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day:
        "2-digit",
      month:
        "long",
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
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone:
        "Europe/London",
      day:
        "2-digit",
      month:
        "long",
      year:
        "numeric",
      hour:
        "2-digit",
      minute:
        "2-digit",
    }
  ).format(
    new Date(
      value
    )
  );
}