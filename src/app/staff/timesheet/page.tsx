import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLondonDateKey } from "@/lib/dates";
import { requireEmployee } from "@/lib/staff-auth";
import {
  decimalHours,
  entryMinutes,
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
import { deleteTimesheetEntry, saveTimesheetEntry, submitTimesheetWeek } from "@/app/staff/actions";
import { Flash, StaffUnavailable, BrandStatusPill } from "@/app/staff/StaffNotice";
import { btnDanger, btnDark, btnGhost, btnLink, btnPrimary, eyebrow, h1, input } from "@/app/staff/brand";

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

async function jobOptions() {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("jobs")
      .select("id, job_number, title, status")
      .neq("status", "Cancelled")
      .order("created_at", { ascending: false })
      .limit(200);
    return (data ?? []).map((job) => ({
      id: job.id as string,
      label: [job.job_number, job.title].filter(Boolean).join(" – ") || "Job",
    }));
  } catch {
    return [];
  }
}


export default async function TimesheetPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; error?: string; saved?: string; edit?: string }>;
}) {
  const params = await searchParams;
  const session = await requireEmployee();
  if (session.status !== "ok") return <StaffUnavailable status={session.status} />;
  const { supabase, staff } = session;

  const today = getLondonDateKey();
  const weekStart = isDateKey(params.week) ? weekStartOf(params.week) : weekStartOf(today);
  const days = weekDays(weekStart);

  const [{ data: week }, { data: entryData }, jobs] = await Promise.all([
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
    jobOptions(),
  ]);

  const entries = ((entryData ?? []) as Entry[]).map((entry) => ({
    ...entry,
    start_time: entry.start_time.slice(0, 5),
    finish_time: entry.finish_time.slice(0, 5),
  }));
  const status = (week?.status ?? null) as TimesheetStatus | null;
  const editable = weekIsEditable(status);
  const editing = entries.find((entry) => entry.id === params.edit);
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

      <section className="mb-6 space-y-2">
        {days.map((day) => {
          const dayEntries = entries.filter((entry) => entry.work_date === day);
          return (
            <div key={day} className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className={`font-semibold ${day === today ? "text-[#be1e2d]" : "text-slate-900"}`}>{formatDayLabel(day)}</p>
                <p className="text-sm text-slate-600">{formatMinutes(totalMinutes(dayEntries))}</p>
              </div>
              {dayEntries.map((entry) => (
                <div key={entry.id} className="mt-2 flex flex-wrap items-start justify-between gap-2 border-t border-slate-100 pt-2 text-sm">
                  <div className="text-slate-700">
                    <p>
                      {entry.start_time}–{entry.finish_time}
                      {entry.break_minutes ? ` · ${entry.break_minutes} min break` : ""} · {formatMinutes(entryMinutes(entry))}
                    </p>
                    {entry.job_label && <p className="text-slate-500">{entry.job_label}</p>}
                    {entry.notes && <p className="whitespace-pre-wrap text-slate-500">{entry.notes}</p>}
                  </div>
                  {editable && (
                    <div className="flex gap-2">
                      <Link className={btnLink} href={`/staff/timesheet?week=${weekStart}&edit=${entry.id}#entry-form`}>
                        Edit
                      </Link>
                      <form action={deleteTimesheetEntry}>
                        <input type="hidden" name="week_start" value={weekStart} />
                        <input type="hidden" name="entry_id" value={entry.id} />
                        <button className={btnDanger}>Remove</button>
                      </form>
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </section>

      {editable ? (
        <section id="entry-form" className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-[#252525]">{editing ? "Edit entry" : "Add a day"}</h2>
          <form action={saveTimesheetEntry} className="grid gap-3 sm:grid-cols-2" key={editing?.id ?? "new"}>
            <input type="hidden" name="week_start" value={weekStart} />
            {editing && <input type="hidden" name="entry_id" value={editing.id} />}
            <label className="block text-sm font-medium text-slate-700">
              Date
              <select name="work_date" className={input} defaultValue={editing?.work_date ?? (days.includes(today) ? today : days[0])}>
                {days.map((day) => (
                  <option key={day} value={day}>{formatDayLabel(day)}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Job (optional)
              <select name="job_id" className={input} defaultValue={editing?.job_id ?? ""}>
                <option value="">No job</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>{job.label}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Start
              <input type="time" name="start_time" required className={input} defaultValue={editing?.start_time ?? "08:00"} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Finish
              <input type="time" name="finish_time" required className={input} defaultValue={editing?.finish_time ?? "16:30"} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Break (minutes)
              <input type="number" name="break_minutes" min={0} max={720} step={1} inputMode="numeric" className={input} defaultValue={editing?.break_minutes ?? 30} />
            </label>
            <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
              Notes
              <textarea name="notes" rows={2} className={input} defaultValue={editing?.notes ?? ""} />
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <button className={btnDark}>
                {editing ? "Save changes" : "Add entry"}
              </button>
              {editing && (
                <Link className={btnLink} href={`/staff/timesheet?week=${weekStart}`}>
                  Cancel
                </Link>
              )}
            </div>
          </form>
        </section>
      ) : (
        <p className="text-sm text-slate-600">
          {status === "approved" ? "This week has been approved." : "This week has been submitted and is waiting for approval."}
        </p>
      )}
    </div>
  );
}
