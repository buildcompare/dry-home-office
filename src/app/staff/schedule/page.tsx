import Link from "next/link";
import { getLondonDateKey } from "@/lib/dates";
import { requireEmployee } from "@/lib/staff-auth";
import { formatDayLabel, shiftDate } from "@/lib/staff";
import { StaffUnavailable } from "@/app/staff/StaffNotice";

type ScheduleRow = {
  id: string;
  title: string;
  event_type: string | null;
  status: string | null;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  all_day: boolean | null;
  location: string | null;
};

function monthStart(value: string | undefined, today: string) {
  return value && /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : `${today.slice(0, 7)}-01`;
}

function nextMonth(start: string, step: number) {
  const [year, month] = start.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + step, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/* Read-only: no forms, and RLS only lets employees select schedule_events. */
export default async function StaffSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const session = await requireEmployee();
  if (session.status !== "ok") return <StaffUnavailable status={session.status} />;

  const today = getLondonDateKey();
  const start = monthStart(params.month, today);
  const end = `${nextMonth(start, 1)}-01`;

  const { data, error } = await session.supabase
    .from("schedule_events")
    .select("id, title, event_type, status, start_date, end_date, start_time, end_time, all_day, location")
    .lt("start_date", end)
    .or(`end_date.gte.${start},and(end_date.is.null,start_date.gte.${start})`)
    .order("start_date")
    .order("start_time", { nullsFirst: true })
    .limit(500);

  const events = ((data ?? []) as ScheduleRow[]).filter((event) => event.status !== "Cancelled");
  const days: string[] = [];
  for (let day = start; day < end; day = shiftDate(day, 1)) days.push(day);
  const label = new Date(`${start}T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Schedule</h1>
          <p className="text-sm text-slate-600">{label} · view only</p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link className="rounded-lg bg-white px-3 py-2 font-medium shadow-sm" href={`/staff/schedule?month=${nextMonth(start, -1)}`}>← Previous</Link>
          <Link className="rounded-lg bg-white px-3 py-2 font-medium shadow-sm" href="/staff/schedule">This month</Link>
          <Link className="rounded-lg bg-white px-3 py-2 font-medium shadow-sm" href={`/staff/schedule?month=${nextMonth(start, 1)}`}>Next →</Link>
        </div>
      </div>

      {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">The schedule couldn&apos;t be loaded.</p>}

      <ul className="space-y-2">
        {days.map((day) => {
          const items = events.filter((event) => event.start_date <= day && (event.end_date ?? event.start_date) >= day);
          if (items.length === 0 && day !== today) return null;
          return (
            <li key={day} className={`rounded-xl bg-white p-4 shadow-sm ${day === today ? "ring-2 ring-blue-500" : ""}`}>
              <p className="mb-1 font-semibold text-slate-900">{formatDayLabel(day)}</p>
              {items.length === 0 ? (
                <p className="text-sm text-slate-500">Nothing booked.</p>
              ) : (
                items.map((event) => (
                  <div key={event.id} className="border-t border-slate-100 py-2 text-sm first:border-t-0">
                    <p className="font-medium text-slate-800">
                      {event.all_day || !event.start_time
                        ? "All day"
                        : `${event.start_time.slice(0, 5)}${event.end_time ? `–${event.end_time.slice(0, 5)}` : ""}`}{" "}
                      · {event.title}
                    </p>
                    <p className="text-slate-500">
                      {[event.event_type, event.location].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                ))
              )}
            </li>
          );
        })}
      </ul>
      {events.length === 0 && !error && <p className="mt-2 text-sm text-slate-600">Nothing booked this month.</p>}
    </div>
  );
}
