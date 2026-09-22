import Image from "next/image";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

type CustomerContractPageProps = {
  params: Promise<{
    token: string;
  }>;

  searchParams: Promise<{
    signed?: string;
    error?: string;
  }>;
};

export default async function CustomerContractPage({
  params,
  searchParams,
}: CustomerContractPageProps) {
  const { token } =
    await params;

  const query =
    await searchParams;

  const supabase =
    createAdminClient();

  const {
    data: contract,
    error,
  } = await supabase
    .from("contracts")
    .select(`
      id,
      contract_number,
      title,
      status,
      contract_date,
      description,
      terms,
      customer_message,
      amount,
      sent_to,
      viewed_at,
      signed_at,
      signed_name,
      signed_email,
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
        quote_number
      )
    `)
    .eq(
      "public_token",
      token
    )
    .single();

  if (error || !contract) {
    notFound();
  }

  const client =
    Array.isArray(
      contract.clients
    )
      ? contract.clients[0]
      : contract.clients;

  const job =
    Array.isArray(
      contract.jobs
    )
      ? contract.jobs[0]
      : contract.jobs;

  const quote =
    Array.isArray(
      contract.quotes
    )
      ? contract.quotes[0]
      : contract.quotes;

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
    !contract.viewed_at
  ) {
    await supabase
      .from("contracts")
      .update({
        viewed_at:
          new Date().toISOString(),

        status:
          contract.status ===
          "Sent"
            ? "Viewed"
            : contract.status,
      })
      .eq(
        "id",
        contract.id
      );
  }

  const address = [
    client?.address_line_1,
    client?.address_line_2,
    client?.town,
    client?.county,
    client?.postcode,
  ].filter(Boolean);

  const isSigned =
    contract.status ===
    "Signed";

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="overflow-hidden rounded-2xl bg-white shadow-lg">
          <header className="bg-slate-950 px-6 py-8 text-white sm:px-10">
            <Image
              src="/dryhome-logo.png"
              alt="Dry Home Damp Proofing Solutions"
              width={230}
              height={90}
              className="h-auto w-52 object-contain"
              priority
            />

            <div className="mt-8 flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="text-sm font-medium uppercase tracking-wider text-slate-400">
                  Contract
                </p>

                <h1 className="mt-2 text-2xl font-bold">
                  {
                    contract.contract_number
                  }
                </h1>

                <p className="mt-2 text-slate-300">
                  {contract.title ||
                    "Customer Contract"}
                </p>
              </div>

              <div className="text-left sm:text-right">
                <p className="text-sm text-slate-400">
                  Contract Value
                </p>

                <p className="mt-1 text-2xl font-bold">
                  {formatCurrency(
                    contract.amount
                  )}
                </p>
              </div>
            </div>
          </header>

          <div className="p-6 sm:p-10">
            {query.signed ===
              "1" && (
              <div className="mb-8 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
                <p className="font-semibold">
                  Thank you. Your agreement has been recorded.
                </p>

                <p className="mt-1 text-sm text-emerald-700">
                  A signed record is now stored against this contract.
                </p>
              </div>
            )}

            {query.error && (
              <div className="mb-8 rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">
                {query.error}
              </div>
            )}

            {isSigned && (
              <div className="mb-8 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
                  Contract Signed
                </p>

                <p className="mt-2 text-lg font-bold text-emerald-950">
                  {
                    contract.signed_name
                  }
                </p>

                <p className="mt-1 text-sm text-emerald-700">
                  {formatDateTime(
                    contract.signed_at
                  )}
                </p>
              </div>
            )}

            <div className="grid gap-6 sm:grid-cols-2">
              <section>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Prepared For
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
                  Contract Details
                </p>

                <div className="mt-2 space-y-2 text-sm text-slate-600">
                  <p>
                    <strong className="text-slate-900">
                      Date:
                    </strong>{" "}
                    {formatDate(
                      contract.contract_date
                    )}
                  </p>

                  {job && (
                    <p>
                      <strong className="text-slate-900">
                        Job:
                      </strong>{" "}
                      {job.job_number}
                    </p>
                  )}

                  {quote && (
                    <p>
                      <strong className="text-slate-900">
                        Quote:
                      </strong>{" "}
                      {
                        quote.quote_number
                      }
                    </p>
                  )}
                </div>
              </section>
            </div>

            <section className="mt-10 border-t border-slate-200 pt-8">
              <h2 className="text-xl font-bold text-slate-900">
                Scope of Works
              </h2>

              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {contract.description ||
                  "No scope of works has been recorded."}
              </p>
            </section>

            <section className="mt-10 border-t border-slate-200 pt-8">
              <h2 className="text-xl font-bold text-slate-900">
                Terms & Conditions
              </h2>

              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {contract.terms ||
                  "No terms have been recorded."}
              </p>
            </section>

            {contract.customer_message && (
              <section className="mt-10 rounded-xl bg-slate-50 p-6">
                <h2 className="font-semibold text-slate-900">
                  Message from Dry Home
                </h2>

                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {
                    contract.customer_message
                  }
                </p>
              </section>
            )}

            <section className="mt-10 rounded-xl bg-slate-950 p-6 text-white sm:p-8">
              {isSigned ? (
                <>
                  <h2 className="text-xl font-bold">
                    Agreement Confirmed
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    This contract has already been signed and no further action is required.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-bold">
                    Confirm Your Agreement
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    Please enter your full name and confirm that you have read and agree to the contract and terms above.
                  </p>

                  <form
                    action={`/c/${token}/sign`}
                    method="post"
                    className="mt-6"
                  >
                    <label
                      htmlFor="signed_name"
                      className="block text-sm font-semibold"
                    >
                      Full Name
                    </label>

                    <input
                      id="signed_name"
                      name="signed_name"
                      type="text"
                      required
                      autoComplete="name"
                      className="mt-2 w-full rounded-lg border border-slate-600 bg-white px-4 py-3 text-slate-950 outline-none"
                    />

                    <label className="mt-5 flex items-start gap-3">
                      <input
                        name="agreement"
                        type="checkbox"
                        value="yes"
                        required
                        className="mt-1 h-4 w-4"
                      />

                      <span className="text-sm leading-6 text-slate-300">
                        I confirm that I have read the scope of works and terms and conditions above and agree to proceed on this basis.
                      </span>
                    </label>

                    <button
                      type="submit"
                      className="mt-6 w-full rounded-lg bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-500 sm:w-auto"
                    >
                      Sign & Accept Contract
                    </button>
                  </form>
                </>
              )}
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

  const [year, month, day] =
    value
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