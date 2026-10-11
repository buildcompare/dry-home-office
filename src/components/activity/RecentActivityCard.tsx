import Link from "next/link";
import ActivityList from "./ActivityList";
import type { ActivityItem } from "@/lib/activity-shared";

export default function RecentActivityCard({
  items,
  logAvailable,
  now,
}: {
  items: ActivityItem[];
  logAvailable: boolean;
  now?: Date;
}) {
  return (
    <section className="mt-10 overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-4 py-5 sm:px-6">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-slate-900">Recent activity</h2>
          <p className="mt-1 text-sm text-slate-500">
            Emails sent, links opened, quotes accepted, payments and more.
          </p>
        </div>

        <Link
          href="/activity"
          className="text-sm font-semibold text-slate-700 hover:text-slate-900 hover:underline"
        >
          View all activity →
        </Link>
      </div>

      {!logAvailable && (
        <p className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-800 sm:px-6">
          Activity log not set up yet. Showing activity worked out from existing records. Run
          supabase/activity_events.sql to start logging every event.
        </p>
      )}

      <ActivityList items={items} now={now} />
    </section>
  );
}
