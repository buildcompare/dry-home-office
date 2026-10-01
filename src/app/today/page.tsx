import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import StatusBadge from "@/components/StatusBadge";
import { createClient } from "@/lib/supabase/server";
import {
  addDays,
  formatEventTime,
  formatLongDate,
  getLondonDateKey,
} from "@/lib/dates";

export default async function TodayPage() {
  const supabase = await createClient();
  const today = getLondonDateKey(new Date());
  const tomorrow = addDays(today, 1);

  const { data } = await supabase
    .from("schedule_events")
    .select(`
      id,
      title,
      event_type,
      status,
      start_date,
      start_time,
      end_time,
      all_day,
      location,
      assigned_to,
      jobs (
        id,
        job_number,
        title,
        town,
        postcode,
        clients (
          display_name,
          first_name,
          last_name
        )
      )
    `)
    .in("start_date", [today, tomorrow])
    .neq("status", "Cancelled")
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true });

  const events = data ?? [];
  const groups = [
    { label: "Today", date: today, items: events.filter((event) => event.start_date === today) },
    { label: "Tomorrow", date: tomorrow, items: events.filter((event) => event.start_date === tomorrow) },
  ];

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-medium text-slate-500">On the road</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Today</h1>
          <p className="mt-2 text-slate-500">Today and tomorrow, built for a phone.</p>

          <div className="mt-6 space-y-6">
            {groups.map((group) => (
              <section key={group.label} className="overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="border-b border-slate-200 px-5 py-4">
                  <h2 className="text-xl font-semibold text-slate-900">{group.label}</h2>
                  <p className="mt-1 text-sm text-slate-500">{formatLongDate(group.date)}</p>
                </div>
                {group.items.length === 0 ? (
                  <p className="p-6 text-sm text-slate-500">Nothing booked.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {group.items.map((event) => {
                      const job = Array.isArray(event.jobs) ? event.jobs[0] : event.jobs;
                      const client = Array.isArray(job?.clients) ? job.clients[0] : job?.clients;
                      const clientName =
                        client?.display_name ||
                        [client?.first_name, client?.last_name].filter(Boolean).join(" ") ||
                        "No client";
                      const place =
                        event.location ||
                        [job?.town, job?.postcode].filter(Boolean).join(", ") ||
                        "No location";
                      const body = (
                        <div className="px-5 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-lg font-semibold text-slate-900">
                              {event.title || job?.title || "Appointment"}
                            </p>
                            <p className="shrink-0 text-sm font-bold text-slate-900">
                              {event.all_day ? "All day" : formatEventTime(event.start_time, event.end_time)}
                            </p>
                          </div>
                          <p className="mt-1 text-sm text-slate-600">{clientName}</p>
                          <p className="mt-1 text-sm text-slate-500">{place}</p>
                          <div className="mt-3">
                            <StatusBadge status={event.event_type || event.status || "Appointment"} />
                          </div>
                        </div>
                      );
                      return job?.id ? (
                        <Link key={event.id} href={`/jobs/${job.id}`} className="block hover:bg-slate-50">
                          {body}
                        </Link>
                      ) : (
                        <div key={event.id}>{body}</div>
                      );
                    })}
                  </div>
                )}
              </section>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
