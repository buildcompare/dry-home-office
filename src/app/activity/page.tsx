import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import ActivityList from "@/components/activity/ActivityList";
import { createClient } from "@/lib/supabase/server";
import { clientDisplayName, loadActivityFeed } from "@/lib/activity";
import { ACTIVITY_CATEGORIES, categoryTypes } from "@/lib/activity-shared";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type ActivityPageProps = {
  searchParams: Promise<{ type?: string; client?: string; page?: string }>;
};

function pageHref(params: { type?: string; client?: string }, page: number) {
  const query = new URLSearchParams();
  if (params.type) query.set("type", params.type);
  if (params.client) query.set("client", params.client);
  if (page > 1) query.set("page", String(page));
  const text = query.toString();
  return text ? `/activity?${text}` : "/activity";
}

export default async function ActivityPage({ searchParams }: ActivityPageProps) {
  const params = await searchParams;
  const type = categoryTypes(params.type) ? params.type : undefined;
  const clientId = params.client?.trim() || undefined;
  const requestedPage = Math.max(1, Math.floor(Number(params.page) || 1));

  const supabase = await createClient();

  const [feed, clientsResult] = await Promise.all([
    loadActivityFeed(supabase, {
      limit: PAGE_SIZE,
      offset: (requestedPage - 1) * PAGE_SIZE,
      category: type,
      clientId,
    }),
    supabase
      .from("clients")
      .select("id, display_name, first_name, last_name")
      .order("display_name", { ascending: true }),
  ]);

  const clients = (clientsResult.data ?? []).map((client) => ({
    id: String(client.id),
    name: clientDisplayName(client) || "Unnamed client",
  }));

  const totalPages = Math.max(1, Math.ceil(feed.total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const filters = { type, client: clientId };
  const filtered = Boolean(type || clientId);

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="min-w-0 flex-1 p-4 sm:p-8">
        <div className="mx-auto max-w-5xl">
          <Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-900">
            ← Back to Dashboard
          </Link>

          <h1 className="mt-4 text-3xl font-bold text-slate-900">Activity</h1>
          <p className="mt-2 text-slate-500">
            Everything that has happened across quotes, contracts, invoices, guarantees, variations, surveys and
            clients.
          </p>

          {!feed.logAvailable && (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
              Activity log not set up yet. This page is showing activity worked out from existing records (sent,
              viewed, accepted, signed and paid dates). Run <code>supabase/activity_events.sql</code> in the
              Supabase SQL Editor to log every event, including email delivered and opened.
            </div>
          )}

          <form method="get" action="/activity" className="mt-6 grid gap-3 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-[1fr_1fr_auto] sm:items-end sm:p-6">
            <div className="min-w-0">
              <label htmlFor="type" className="mb-1 block text-sm font-medium text-slate-700">
                Type
              </label>
              <select
                id="type"
                name="type"
                defaultValue={type ?? ""}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
              >
                <option value="">All activity</option>
                {ACTIVITY_CATEGORIES.map((category) => (
                  <option key={category.key} value={category.key}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0">
              <label htmlFor="client" className="mb-1 block text-sm font-medium text-slate-700">
                Client
              </label>
              <select
                id="client"
                name="client"
                defaultValue={clientId ?? ""}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
              >
                <option value="">All clients</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 sm:flex-none"
              >
                Filter
              </button>
              {filtered && (
                <Link
                  href="/activity"
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:flex-none"
                >
                  Clear
                </Link>
              )}
            </div>
          </form>

          <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-4 text-sm text-slate-500 sm:px-6">
              {feed.total === 0
                ? "Nothing to show"
                : `${feed.total} ${feed.total === 1 ? "event" : "events"}${totalPages > 1 ? ` · page ${page} of ${totalPages}` : ""}`}
            </div>

            <ActivityList
              items={feed.items}
              emptyText={filtered ? "No activity matches these filters." : "No activity yet."}
            />

            {totalPages > 1 && (
              <nav className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-4 sm:px-6">
                {page > 1 ? (
                  <Link
                    href={pageHref(filters, page - 1)}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    ← Newer
                  </Link>
                ) : (
                  <span />
                )}

                <span className="text-xs text-slate-400">
                  Page {page} of {totalPages}
                </span>

                {page < totalPages ? (
                  <Link
                    href={pageHref(filters, page + 1)}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Older →
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
