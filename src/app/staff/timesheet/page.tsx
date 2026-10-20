import Link from "next/link";
import { getLondonDateKey } from "@/lib/dates";
import { requireEmployee } from "@/lib/staff-auth";
import {
  decimalHours,
  formatDayLabel,
  formatMinutes,
  formatWeekRange,
  isDateKey,
  shiftDate,
  totalMinutes,
  weekDays,
  weekIsEditable,
  weekStartOf,
  type TimesheetStatus,
} from "@/lib/staff";
import { clearTimesheetDay, saveTimesheetDay, submitTimesheetWeek } from "@/app/staff/actions";
import { Flash, StaffUnavailable, BrandStatusPill } from "@/app/staff/StaffNotice";
import { btnDanger, btnGhost, btnPrimary, eyebrow, h1, input } from "@/app/staff/brand";

type Entry = {
  id: string;
  work_date: string;
  start_time: string;
  finish_time: string;
  break_minutes: number;
  job_id: string | null;
  job_label: string | null;
  notes: string | null;
};



export default async function TimesheetPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; error?: string; saved?: string; day?: string }>;
}) {
  const params = await searchParams;
  const session = await requireEmployee();
  if (session.status !== "ok") return <StaffUnavailable status={session.status} />;
  const { supabase, staff } = session;

  const today = getLondonDateKey();
  const weekStart = isDateKey(params.week) ? weekStartOf(params.week) : weekStartOf(today);
  const days = weekDays(weekStart);

  const [{ data: week }, { data: entryData }] = await Promise.all([
    supabase
      .from("timesheet_weeks")
      .select("status, review_note")
      .eq("staff_id", staff.id)
      .eq("week_start", weekStart)
      .maybeSingle(),
    supabase
      .from("timesheet_entries")
      .select("id, work_date, start_time, finish_time, break_minutes, job_id, job_label, notes")
      .eq("staff_id", staff.id)
      .eq("week_start", weekStart)
      .order("work_date")
      .order("start_time"),
  ]);

  const entries = ((entryData ?? []) as Entry[]).map((entry) => ({
    ...entry,
    start_time: entry.start_time.slice(0, 5),
    finish_time: entry.finish_time.slice(0, 5),
  }));
  const status = (week?.status ?? null) as TimesheetStatus | null;
  const editable = weekIsEditable(status);
  const total = totalMinutes(entries);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={eyebrow}>Your hours</p>
          <h1 className={h1}>Timesheet</h1>
          <p className="text-sm text-slate-600">Week of {formatWeekRange(weekStart)}</p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link className={btnGhost} href={`/staff/timesheet?week=${shiftDate(weekStart, -7)}`}>
            ← Previous
          </Link>
          <Link className={btnGhost} href="/staff/timesheet">
            This week
          </Link>
          <Link className={btnGhost} href={`/staff/timesheet?week=${shiftDate(weekStart, 7)}`}>
            Next →
          </Link>
        </div>
      </div>

      <Flash error={params.error} saved={params.saved} />

      <section className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <BrandStatusPill status={status ?? "draft"} />
          <p className="text-sm text-slate-700">
            Total <strong>{formatMinutes(total)}</strong> ({decimalHours(total)} hours)
          </p>
        </div>
        {editable && entries.length > 0 && (
          <form action={submitTimesheetWeek}>
            <input type="hidden" name="week_start" value={weekStart} />
            <button className={btnPrimary}>
              Submit week
            </button>
          </form>
        )}
      </section>
      {status === "rejected" && week?.review_note && (
        <p className="mb-4 rounded-xl border-l-4 border-[#be1e2d] bg-white p-3 text-sm text-[#be1e2d] shadow-sm">
          Returned by the office: {week.review_note}
        </p>
      )}

      <section className="space-y-2">
        {days.map((day) => {
          const dayEntries = entries.filter((entry) => entry.work_date === day);
          const first = dayEntries[0];
          const last = dayEntries[dayEntries.length - 1];
          const breaks = dayEntries.reduce((sum, entry) => sum + (entry.break_minutes ?? 0), 0);
          const dayTotal = totalMinutes(dayEntries);
          const summary = first ? (
            <span className="text-sm text-slate-600">
              {first.start_time}–{last.finish_time}
              <span className="text-slate-400"> · </span>
              {breaks} min break
            </span>
          ) : (
            <span className="text-sm text-slate-400">{editable ? "Tap to add hours" : "No hours"}</span>
          );
          const heading = (
            <span className="flex flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <span className="flex flex-col sm:flex-row sm:items-center sm:gap-4">
                <span className={`font-semibold ${day === today ? "text-[#be1e2d]" : "text-[#252525]"}`}>{formatDayLabel(day)}</span>
                {summary}
              </span>
              <span className="text-base font-bold text-[#252525]">{formatMinutes(dayTotal)}</span>
            </span>
          );

          if (!editable) {
            return (
              <div key={day} className="flex items-center rounded-2xl bg-white p-5 shadow-sm">
                {heading}
              </div>
            );
          }

          return (
            <details
              key={day}
              open={params.day === day}
              className="group rounded-2xl bg-white shadow-sm open:ring-2 open:ring-[#f29e23]"
            >
              <summary className="flex cursor-pointer list-none items-center gap-3 p-5 [&::-webkit-details-marker]:hidden">
                {heading}
                <span aria-hidden className="text-lg text-slate-400 transition group-open:rotate-90">›</span>
              </summary>
              <div className="border-t border-slate-100 px-5 pb-5 pt-4">
                <form action={saveTimesheetDay} className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                  <input type="hidden" name="work_date" value={day} />
                  <label className="block text-sm font-medium text-slate-700">
                    Start time
                    <input type="time" name="start_time" required className={input} defaultValue={first?.start_time ?? "08:00"} />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Finish time
                    <input type="time" name="finish_time" required className={input} defaultValue={last?.finish_time ?? "16:30"} />
                  </label>
                  <label className="col-span-2 block text-sm font-medium text-slate-700 sm:col-span-1">
                    Breaks (minutes)
                    <input type="number" name="break_minutes" min={0} max={720} step={1} inputMode="numeric" className={input} defaultValue={first ? breaks : 30} />
                  </label>
                  <button className={`${btnPrimary} col-span-2 sm:col-span-1`}>Save</button>
                </form>
                {first && (
                  <form action={clearTimesheetDay} className="mt-2 text-right">
                    <input type="hidden" name="work_date" value={day} />
                    <button className={btnDanger}>Clear day</button>
                  </form>
                )}
                {dayEntries.length > 1 && (
                  <p className="mt-2 text-xs text-slate-500">This day has {dayEntries.length} separate times; saving combines them into one.</p>
                )}
              </div>
            </details>
          );
        })}
      </section>

      <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#252525] px-5 py-4 text-white shadow-sm">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">Week total</span>
        <span className="text-xl font-bold">
          {formatMinutes(total)} <span className="text-sm font-normal text-slate-300">({decimalHours(total)} h)</span>
        </span>
      </div>

      {!editable && (
        <p className="mt-4 text-sm text-slate-600">
          {status === "approved" ? "This week has been approved." : "This week has been submitted and is waiting for approval."}
        </p>
      )}
    </div>
  );
}
