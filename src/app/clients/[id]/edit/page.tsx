import Link from "next/link";
import { notFound } from "next/navigation";

import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import {
  deleteClient,
  updateClient,
} from "@/app/clients/actions";

type EditClientPageProps = {
  params: Promise<{
    id: string;
  }>;

  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function EditClientPage({
  params,
  searchParams,
}: EditClientPageProps) {
  const {
    id,
  } = await params;

  const query =
    await searchParams;

  const supabase =
    await createClient();

  const [
    clientResult,
    jobsResult,
    quotesResult,
    invoicesResult,
    contractsResult,
    guaranteesResult,
  ] = await Promise.all([
    supabase
      .from("clients")
      .select(`
        id,
        display_name,
        friendly_name,
        company_name,
        email,
        phone,
        address_line_1,
        address_line_2,
        town,
        county,
        postcode,
        notes
      `)
      .eq(
        "id",
        id
      )
      .single(),

    supabase
      .from("jobs")
      .select(
        "id",
        {
          count:
            "exact",

          head:
            true,
        }
      )
      .eq(
        "client_id",
        id
      ),

    supabase
      .from("quotes")
      .select(
        "id",
        {
          count:
            "exact",

          head:
            true,
        }
      )
      .eq(
        "client_id",
        id
      ),

    supabase
      .from("invoices")
      .select(
        "id",
        {
          count:
            "exact",

          head:
            true,
        }
      )
      .eq(
        "client_id",
        id
      ),

    supabase
      .from("contracts")
      .select(
        "id",
        {
          count:
            "exact",

          head:
            true,
        }
      )
      .eq(
        "client_id",
        id
      ),

    supabase
      .from("guarantees")
      .select(
        "id",
        {
          count:
            "exact",

          head:
            true,
        }
      )
      .eq(
        "client_id",
        id
      ),
  ]);

  const client =
    clientResult.data;

  if (
    clientResult.error ||
    !client
  ) {
    notFound();
  }

  const jobsCount =
    jobsResult.count ??
    0;

  const quotesCount =
    quotesResult.count ??
    0;

  const invoicesCount =
    invoicesResult.count ??
    0;

  const contractsCount =
    contractsResult.count ??
    0;

  const guaranteesCount =
    guaranteesResult.count ??
    0;

  const linkedRecords =
    jobsCount +
    quotesCount +
    invoicesCount +
    contractsCount +
    guaranteesCount;

  const canDelete =
    linkedRecords ===
    0;

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-4xl">

          {/* HEADER */}

          <div className="mb-8">
            <Link
              href={`/clients/${client.id}`}
              className="text-sm font-medium text-slate-500 hover:text-slate-900"
            >
              ← Back to Client
            </Link>

            <div className="mt-4">
              <p className="text-sm font-medium text-slate-500">
                Client Record
              </p>

              <h1 className="mt-1 text-3xl font-bold text-slate-900">
                Edit Client
              </h1>

              <p className="mt-2 text-slate-500">
                Update contact information, address and internal notes.
              </p>
            </div>
          </div>

          {/* ERROR */}

          {query.error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
              {
                query.error
              }
            </div>
          )}

          {/* EDIT FORM */}

          <form
            action={
              updateClient
            }
            className="space-y-8"
          >
            <input
              type="hidden"
              name="client_id"
              value={
                client.id
              }
            />

            {/* CLIENT DETAILS */}

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Client Details
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Main client and company information.
                </p>
              </div>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <Field
                  label="Client Name"
                  name="display_name"
                  defaultValue={
                    client.display_name
                  }
                  required
                />

                <Field
                  label="Contact / Friendly Name"
                  name="friendly_name"
                  defaultValue={
                    client.friendly_name
                  }
                />

                <Field
                  label="Company Name"
                  name="company_name"
                  defaultValue={
                    client.company_name
                  }
                />

                <div />
              </div>
            </section>

            {/* CONTACT */}

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Contact Details
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Email and telephone information used for customer communication.
                </p>
              </div>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <Field
                  label="Email"
                  name="email"
                  type="email"
                  defaultValue={
                    client.email
                  }
                />

                <Field
                  label="Phone"
                  name="phone"
                  type="tel"
                  defaultValue={
                    client.phone
                  }
                />
              </div>
            </section>

            {/* ADDRESS */}

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Address
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Default address for this client.
                </p>
              </div>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Field
                    label="Address Line 1"
                    name="address_line_1"
                    defaultValue={
                      client.address_line_1
                    }
                  />
                </div>

                <div className="md:col-span-2">
                  <Field
                    label="Address Line 2"
                    name="address_line_2"
                    defaultValue={
                      client.address_line_2
                    }
                  />
                </div>

                <Field
                  label="Town"
                  name="town"
                  defaultValue={
                    client.town
                  }
                />

                <Field
                  label="County"
                  name="county"
                  defaultValue={
                    client.county
                  }
                />

                <Field
                  label="Postcode"
                  name="postcode"
                  defaultValue={
                    client.postcode
                  }
                />
              </div>
            </section>

            {/* NOTES */}

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                Internal Notes
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Notes stored against the client record.
              </p>

              <textarea
                name="notes"
                defaultValue={
                  client.notes ??
                  ""
                }
                rows={6}
                className="mt-6 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-500"
                placeholder="Add any useful notes about this client..."
              />
            </section>

            {/* SAVE */}

            <div className="flex flex-wrap justify-end gap-3">
              <Link
                href={`/clients/${client.id}`}
                className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Link>

              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700"
              >
                Save Changes
              </button>
            </div>
          </form>

          {/* DANGER ZONE */}

          <section className="mt-10 rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
              Danger Zone
            </p>

            <h2 className="mt-2 text-xl font-bold text-slate-900">
              Delete Client
            </h2>

            {canDelete ? (
              <>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  This client has no linked jobs, quotes, contracts, invoices or guarantees, so they can be permanently deleted.
                </p>

                <form
                  action={
                    deleteClient
                  }
                  className="mt-6"
                >
                  <input
                    type="hidden"
                    name="client_id"
                    value={
                      client.id
                    }
                  />

                  <label className="flex max-w-xl items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                    <input
                      type="checkbox"
                      name="confirm_delete"
                      value="yes"
                      className="mt-1 h-4 w-4"
                    />

                    <span className="text-sm leading-6 text-red-800">
                      I understand that deleting this client is permanent and cannot be undone.
                    </span>
                  </label>

                  <button
                    type="submit"
                    className="mt-4 rounded-lg bg-red-700 px-5 py-3 text-sm font-semibold text-white hover:bg-red-800"
                  >
                    Delete Client Permanently
                  </button>
                </form>
              </>
            ) : (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-5">
                <p className="font-semibold text-amber-900">
                  This client cannot be deleted.
                </p>

                <p className="mt-2 text-sm leading-6 text-amber-800">
                  The client has business records linked to them. Keeping the client protects your job, quotation, contract, invoice and guarantee history.
                </p>

                <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                  {jobsCount >
                    0 && (
                    <RecordCount
                      label="Jobs"
                      value={
                        jobsCount
                      }
                    />
                  )}

                  {quotesCount >
                    0 && (
                    <RecordCount
                      label="Quotes"
                      value={
                        quotesCount
                      }
                    />
                  )}

                  {contractsCount >
                    0 && (
                    <RecordCount
                      label="Contracts"
                      value={
                        contractsCount
                      }
                    />
                  )}

                  {invoicesCount >
                    0 && (
                    <RecordCount
                      label="Invoices"
                      value={
                        invoicesCount
                      }
                    />
                  )}

                  {guaranteesCount >
                    0 && (
                    <RecordCount
                      label="Guarantees"
                      value={
                        guaranteesCount
                      }
                    />
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

/* =========================================================
   FIELD
   ========================================================= */

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;

  defaultValue?:
    | string
    | null;

  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">
        {label}
      </span>

      <input
        type={
          type
        }
        name={
          name
        }
        defaultValue={
          defaultValue ??
          ""
        }
        required={
          required
        }
        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-500"
      />
    </label>
  );
}

/* =========================================================
   RECORD COUNT
   ========================================================= */

function RecordCount({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <span className="rounded-full bg-white px-3 py-1 text-amber-800">
      {value}{" "}
      {label}
    </span>
  );
}