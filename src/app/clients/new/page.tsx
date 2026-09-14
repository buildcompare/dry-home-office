import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { addClient } from "../actions";

type NewClientPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function NewClientPage({
  searchParams,
}: NewClientPageProps) {
  const params = await searchParams;

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8">
            <Link
              href="/clients"
              className="text-sm font-medium text-slate-500 hover:text-slate-900"
            >
              ← Back to Clients
            </Link>

            <h1 className="mt-4 text-3xl font-bold text-slate-900">
              Add Client
            </h1>

            <p className="mt-2 text-slate-500">
              Add a new customer or business to
              DryHome Office.
            </p>
          </div>

          {params.error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
              {decodeURIComponent(
                params.error
              )}
            </div>
          )}

          <form action={addClient}>
            {/* Main client details */}
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                Client Details
              </h2>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label
                    htmlFor="display_name"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Client / Contact Name
                  </label>

                  <input
                    id="display_name"
                    name="display_name"
                    type="text"
                    required
                    placeholder="e.g. John Smith"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="friendly_name"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Friendly Name
                  </label>

                  <input
                    id="friendly_name"
                    name="friendly_name"
                    type="text"
                    placeholder="Optional"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="company_name"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Company Name
                  </label>

                  <input
                    id="company_name"
                    name="company_name"
                    type="text"
                    placeholder="Optional"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Email
                  </label>

                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="customer@example.com"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="phone"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Phone
                  </label>

                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="07..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>
              </div>
            </section>

            {/* Address */}
            <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                Address
              </h2>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label
                    htmlFor="address_line_1"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Address Line 1
                  </label>

                  <input
                    id="address_line_1"
                    name="address_line_1"
                    type="text"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label
                    htmlFor="address_line_2"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Address Line 2
                  </label>

                  <input
                    id="address_line_2"
                    name="address_line_2"
                    type="text"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="town"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Town / City
                  </label>

                  <input
                    id="town"
                    name="town"
                    type="text"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="county"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    County
                  </label>

                  <input
                    id="county"
                    name="county"
                    type="text"
                    placeholder="e.g. Berkshire"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="postcode"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Postcode
                  </label>

                  <input
                    id="postcode"
                    name="postcode"
                    type="text"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 uppercase text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>
              </div>
            </section>

            {/* Notes */}
            <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                Notes
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Internal notes about this client.
              </p>

              <textarea
                name="notes"
                rows={5}
                className="mt-5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
              />
            </section>

            <div className="mt-8 flex justify-end gap-3">
              <Link
                href="/clients"
                className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Link>

              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700"
              >
                Add Client
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}