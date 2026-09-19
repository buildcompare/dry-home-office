import { notFound } from "next/navigation";
import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";

type CustomerGuaranteePageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function CustomerGuaranteePage({
  params,
}: CustomerGuaranteePageProps) {
  const { token } = await params;

  const supabase =
    createAdminClient();

  const {
    data: guarantee,
    error,
  } = await supabase
    .from("guarantees")
    .select(`
      id,
      guarantee_number,
      guarantee_type,
      title,
      status,
      issue_date,
      duration_years,
      expiry_date,
      covered_works,
      terms,
      exclusions,
      customer_message,
      viewed_at,
      sent_at,
      clients (
        display_name,
        email
      ),
      jobs (
        job_number,
        title
      ),
      invoices (
        invoice_number
      )
    `)
    .eq(
      "public_token",
      token
    )
    .single();

  if (
    error ||
    !guarantee
  ) {
    notFound();
  }

  const client =
    Array.isArray(
      guarantee.clients
    )
      ? guarantee.clients[0]
      : guarantee.clients;

  const job =
    Array.isArray(
      guarantee.jobs
    )
      ? guarantee.jobs[0]
      : guarantee.jobs;

  const invoice =
    Array.isArray(
      guarantee.invoices
    )
      ? guarantee.invoices[0]
      : guarantee.invoices;

  /*
   * Record first customer view.
   */
  if (!guarantee.viewed_at) {
    await supabase
      .from("guarantees")
      .update({
        viewed_at:
          new Date().toISOString(),

        status:
          guarantee.status ===
          "Issued"
            ? "Viewed"
            : guarantee.status,
      })
      .eq(
        "id",
        guarantee.id
      );
  }

  const clientName =
    client?.display_name ||
    "Customer";

  const expired =
    guarantee.expiry_date
      ? new Date(
          `${guarantee.expiry_date}T23:59:59`
        ) <
        new Date()
      : false;

  const displayStatus =
    guarantee.status ===
      "Cancelled"
      ? "Cancelled"
      : expired
        ? "Expired"
        : guarantee.status;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <header className="bg-slate-950 px-6 py-8 sm:px-10">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <Image
                  src="/dryhome-logo-light.png"
                  alt="Dry Home Damp Proofing Solutions"
                  width={220}
                  height={70}
                  priority
                  className="h-auto w-auto max-w-[220px]"
                />

                <p className="mt-5 text-sm font-semibold uppercase tracking-wider text-emerald-400">
                  Customer Guarantee
                </p>
              </div>

              <div className="text-left sm:text-right">
                <p className="text-sm text-slate-400">
                  Guarantee Number
                </p>

                <p className="mt-1 text-lg font-bold text-white">
                  {
                    guarantee.guarantee_number
                  }
                </p>

                <StatusBadge
                  status={
                    displayStatus
                  }
                />
              </div>
            </div>
          </header>

          <div className="p-6 sm:p-10">
            <div className="border-b border-slate-200 pb-8">
              <p className="text-sm font-semibold text-emerald-700">
                Issued to
              </p>

              <h1 className="mt-2 text-3xl font-bold text-slate-900">
                {clientName}
              </h1>

              <p className="mt-4 text-lg font-semibold text-slate-700">
                {guarantee.title ||
                  "Works Guarantee"}
              </p>

              {guarantee.customer_message && (
                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                  {
                    guarantee.customer_message
                  }
                </p>
              )}
            </div>

            <div className="grid gap-5 border-b border-slate-200 py-8 sm:grid-cols-2 lg:grid-cols-4">
              <Detail
                label="Guarantee Type"
                value={
                  guarantee.guarantee_type ||
                  "Not specified"
                }
              />

              <Detail
                label="Issue Date"
                value={formatDate(
                  guarantee.issue_date
                )}
              />

              <Detail
                label="Guarantee Period"
                value={
                  guarantee.duration_years
                    ? `${guarantee.duration_years} ${
                        guarantee.duration_years ===
                        1
                          ? "year"
                          : "years"
                      }`
                    : "Not specified"
                }
              />

              <Detail
                label="Valid Until"
                value={formatDate(
                  guarantee.expiry_date
                )}
              />
            </div>

            {(job ||
              invoice) && (
              <div className="grid gap-5 border-b border-slate-200 py-8 sm:grid-cols-2">
                {job && (
                  <Detail
                    label="Job Reference"
                    value={
                      job.job_number ||
                      job.title ||
                      "Not recorded"
                    }
                  />
                )}

                {invoice && (
                  <Detail
                    label="Invoice Reference"
                    value={
                      invoice.invoice_number
                    }
                  />
                )}
              </div>
            )}

            <section className="py-8">
              <h2 className="text-xl font-bold text-slate-900">
                Covered Works
              </h2>

              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {guarantee.covered_works ||
                  "No covered works have been recorded."}
              </p>
            </section>

            <section className="border-t border-slate-200 py-8">
              <h2 className="text-xl font-bold text-slate-900">
                Guarantee Terms
              </h2>

              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {guarantee.terms ||
                  "No guarantee terms have been recorded."}
              </p>
            </section>

            <section className="border-t border-slate-200 py-8">
              <h2 className="text-xl font-bold text-slate-900">
                Exclusions
              </h2>

              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {guarantee.exclusions ||
                  "No exclusions have been recorded."}
              </p>
            </section>

            <section className="mt-2 rounded-xl bg-slate-50 p-6">
              <h2 className="font-semibold text-slate-900">
                Please keep this guarantee
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Please retain this guarantee with your property records. If you need to contact Dry Home Damp Proofing Solutions LTD regarding the covered works, please quote the guarantee number shown above.
              </p>
            </section>
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-slate-500">
          Dry Home Damp Proofing Solutions LTD
        </p>
      </div>
    </main>
  );
}

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

      <p className="mt-2 text-sm font-semibold text-slate-800">
        {value}
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
    status === "Issued" ||
    status === "Viewed"
      ? "bg-emerald-100 text-emerald-800"
      : status === "Expired"
        ? "bg-amber-100 text-amber-800"
        : status === "Cancelled"
          ? "bg-red-100 text-red-700"
          : "bg-slate-200 text-slate-700";

  return (
    <span
      className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${classes}`}
    >
      {status}
    </span>
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