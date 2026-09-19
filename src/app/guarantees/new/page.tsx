import Link from "next/link";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { createGuarantee } from "../actions";

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
    query.invoice || "";

  if (!invoiceId) {
    redirect(
      "/invoices"
    );
  }

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
      invoice_type,
      status,
      title,
      description,
      amount,
      amount_paid,
      client_id,
      job_id,
      contract_id,
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
    error ||
    !invoice
  ) {
    redirect(
      "/invoices"
    );
  }

  if (
    invoice.invoice_type !==
      "Final" ||
    invoice.status !==
      "Paid"
  ) {
    redirect(
      `/invoices/${invoice.id}?error=Guarantees%20can%20only%20be%20created%20from%20a%20paid%20Final%20invoice`
    );
  }

  const {
    data: existingGuarantee,
  } = await supabase
    .from("guarantees")
    .select("id")
    .eq(
      "invoice_id",
      invoice.id
    )
    .neq(
      "status",
      "Cancelled"
    )
    .maybeSingle();

  if (
    existingGuarantee
  ) {
    redirect(
      `/guarantees/${existingGuarantee.id}`
    );
  }

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

  const today =
    new Date()
      .toISOString()
      .slice(0, 10);

  /*
   * Start with a 10-year
   * guarantee by default.
   */
  const defaultDuration = 10;

  const expiry =
    new Date();

  expiry.setFullYear(
    expiry.getFullYear() +
      defaultDuration
  );

  const defaultExpiryDate =
    expiry
      .toISOString()
      .slice(0, 10);

  const defaultTitle =
    job?.title ||
    contract?.title ||
    invoice.title ||
    "Works Guarantee";

  const defaultCoveredWorks =
    job?.description ||
    contract?.description ||
    invoice.description ||
    "";

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-5xl">
          <Link
            href={`/invoices/${invoice.id}`}
            className="text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            ← Back to Invoice
          </Link>

          <div className="mt-4">
            <p className="text-sm font-medium text-emerald-700">
              Paid Final Invoice
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

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Source Details
            </h2>

            <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              <Detail
                label="Client"
                value={
                  clientName
                }
              />

              <Detail
                label="Invoice"
                value={
                  invoice.invoice_number
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
                    For now this defaults to 10 years from today. Later we can make the expiry date update automatically when the guarantee period changes.
                  </p>
                </div>
              </div>
            </section>

            <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                Covered Works
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Describe exactly what work is covered by this guarantee.
              </p>

              <textarea
                name="covered_works"
                rows={7}
                defaultValue={
                  defaultCoveredWorks
                }
                className="mt-5 w-full rounded-lg border border-slate-300 px-3 py-3 text-slate-900 outline-none focus:border-slate-500"
              />
            </section>

            <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                Guarantee Terms
              </h2>

              <textarea
                name="terms"
                rows={7}
                defaultValue={
                  "This guarantee applies to the works described above and is subject to the property being adequately maintained. Any defects or concerns should be reported to Dry Home Damp Proofing Solutions LTD as soon as reasonably possible."
                }
                className="mt-5 w-full rounded-lg border border-slate-300 px-3 py-3 text-slate-900 outline-none focus:border-slate-500"
              />
            </section>

            <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                Exclusions
              </h2>

              <textarea
                name="exclusions"
                rows={6}
                defaultValue={
                  "This guarantee does not cover damage caused by building movement, structural defects, flooding, plumbing leaks, defective external maintenance, alterations by third parties, or circumstances outside the scope of the original works."
                }
                className="mt-5 w-full rounded-lg border border-slate-300 px-3 py-3 text-slate-900 outline-none focus:border-slate-500"
              />
            </section>

            <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                Customer Message
              </h2>

              <textarea
                name="customer_message"
                rows={4}
                defaultValue={
                  "Thank you for choosing Dry Home Damp Proofing Solutions LTD. Please retain this guarantee with your property records."
                }
                className="mt-5 w-full rounded-lg border border-slate-300 px-3 py-3 text-slate-900 outline-none focus:border-slate-500"
              />
            </section>

            <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                Internal Notes
              </h2>

              <textarea
                name="internal_notes"
                rows={4}
                placeholder="These notes are for DryHome Office only and will not be shown to the customer."
                className="mt-5 w-full rounded-lg border border-slate-300 px-3 py-3 text-slate-900 outline-none focus:border-slate-500"
              />
            </section>

            <div className="mt-8 flex flex-wrap justify-end gap-3">
              <Link
                href={`/invoices/${invoice.id}`}
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