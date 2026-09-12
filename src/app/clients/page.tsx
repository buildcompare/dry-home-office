import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";

export default async function ClientsPage() {
  const supabase = await createClient();

  const { data: clients, error } = await supabase
    .from("clients")
    .select(`
      id,
      display_name,
      friendly_name,
      first_name,
      last_name,
      company_name,
      email,
      phone,
      address_line_1,
      town,
      postcode,
      created_at
    `)
    .order("display_name", { ascending: true });

  if (error) {
    console.error(error);
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                DryHome Office
              </p>

              <h1 className="mt-1 text-3xl font-bold text-slate-900">
                Clients
              </h1>

              <p className="mt-2 text-slate-500">
                {clients?.length ?? 0} customer records
              </p>
            </div>

            <Link
              href="/clients/new"
              className="rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-700"
            >
              + Add Client
            </Link>
          </div>

          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            {!clients || clients.length === 0 ? (
              <div className="p-12 text-center">
                <h2 className="text-lg font-semibold text-slate-900">
                  No clients yet
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  Add your first DryHome customer to get started.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Client
                      </th>

                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Contact
                      </th>

                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Address
                      </th>

                      <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        View
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {clients.map((client) => {
                      const name =
                        client.display_name ||
                        [client.first_name, client.last_name]
                          .filter(Boolean)
                          .join(" ") ||
                        client.company_name ||
                        "Unnamed client";

                      return (
                        <tr
                          key={client.id}
                          className="transition hover:bg-slate-50"
                        >
                          <td className="px-6 py-5">
                            <p className="font-semibold text-slate-900">
                              {name}
                            </p>

                            {client.friendly_name && (
                              <p className="mt-1 text-sm text-slate-500">
                                Contact: {client.friendly_name}
                              </p>
                            )}
                          </td>

                          <td className="px-6 py-5 text-sm text-slate-600">
                            <p>{client.phone || "—"}</p>
                            <p className="mt-1">{client.email || "—"}</p>
                          </td>

                          <td className="px-6 py-5 text-sm text-slate-600">
                            <p>
                              {client.address_line_1 ||
                                client.town ||
                                "—"}
                            </p>

                            {client.postcode && (
                              <p className="mt-1">
                                {client.postcode}
                              </p>
                            )}
                          </td>

                          <td className="px-6 py-5 text-right">
                            <Link
                              href={`/clients/${client.id}`}
                              className="font-medium text-slate-900 hover:underline"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}