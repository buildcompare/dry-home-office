import Sidebar from "@/components/Sidebar";
import { getLondonDateKey } from "@/lib/dates";
import { requireOwnerForTeam } from "@/lib/staff-auth";
import {
  decimalHours,
  entryMinutes,
  formatDayLabel,
  formatHolidayRange,
  formatMinutes,
  formatWeekRange,
  holidayDays,
  totalMinutes,
} from "@/lib/staff";
import {
  cancelApprovedHoliday,
  deleteHolidayRequest,
  inviteStaffMember,
  reviewHolidayRequest,
  reviewTimesheetWeek,
  setStaffActive,
} from "@/app/team/actions";
import { StatusPill } from "@/app/staff/StaffNotice";

type StaffRow = { id: string; name: string; email: string; role: string; active: boolean; user_id: string | null };
type WeekRow = { id: string; staff_id: string; week_start: string; status: string; submitted_at: string | null; review_note: string | null };
type EntryRow = {
  id: string;
  staff_id: string;
  week_start: string;
  work_date: string;
  start_time: string;
  finish_time: string;
  break_minutes: number;
  job_label: string | null;
  notes: string | null;
};
type HolidayRow = {
  id: string;
  staff_id: string;
  start_date: string;
  end_date: string;
  half_day: boolean;
  half_day_part: string | null;
  reason: string | null;
  status: string;
  review_note: string | null;
};

const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const card = "rounded-xl bg-white p-4 shadow-sm";

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const params = await searchParams;
  const { supabase, setUp } = await requireOwnerForTeam();

  const shell = (content: React.ReactNode) => (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 pb-8 pt-20 md:p-8">
        <div className="mx-auto max-w-5xl">
          <h1 className="mb-1 text-3xl font-bold text-slate-900">Staff</h1>
          <p className="mb-6 text-sm text-slate-600">Employees, timesheets and holiday.</p>
          {params.error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{params.error}</p>}
          {params.notice && <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{params.notice}</p>}
          {content}
        </div>
      </main>
    </div>
  );

  const { data: staffData, error: staffError } = await supabase
    .from("staff_members")
    .select("id, name, email, role, active, user_id")
    .order("active", { ascending: false })
    .order("name");

  if (!setUp || staffError) {
    return shell(
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        The staff portal isn&apos;t set up yet. Run <code>supabase/staff_portal.sql</code> in the Supabase SQL editor, then reload this page.
      </div>
    );
  }

  const staff = (staffData ?? []) as StaffRow[];
  const nameOf = (id: string) => staff.find((member) => member.id === id)?.name ?? "Unknown";
  const today = getLondonDateKey();

  const [{ data: weekData }, { data: holidayData }] = await Promise.all([
    supabase
      .from("timesheet_weeks")
      .select("id, staff_id, week_start, status, submitted_at, review_note")
      .neq("status", "draft")
      .order("week_start", { ascending: false })
      .limit(60),
    supabase
      .from("holiday_requests")
      .select("id, staff_id, start_date, end_date, half_day, half_day_part, reason, status, review_note")
      .order("start_date", { ascending: false })
      .limit(100),
  ]);
  const weeks = (weekData ?? []) as WeekRow[];
  const holidays = (holidayData ?? []) as HolidayRow[];

  const pendingWeeks = weeks.filter((week) => week.status === "submitted");
  const recentWeeks = weeks.filter((week) => week.status !== "submitted").slice(0, 20);
  const shownWeeks = [...pendingWeeks, ...recentWeeks];

  const { data: entryData } = shownWeeks.length
    ? await supabase
        .from("timesheet_entries")
        .select("id, staff_id, week_start, work_date, start_time, finish_time, break_minutes, job_label, notes")
        .in("staff_id", [...new Set(shownWeeks.map((week) => week.staff_id))])
        .in("week_start", [...new Set(shownWeeks.map((week) => week.week_start))])
        .order("work_date")
        .order("start_time")
    : { data: [] };
  const entries = ((entryData ?? []) as EntryRow[]).map((entry) => ({
    ...entry,
    start_time: entry.start_time.slice(0, 5),
    finish_time: entry.finish_time.slice(0, 5),
  }));
  const entriesFor = (week: WeekRow) =>
    entries.filter((entry) => entry.staff_id === week.staff_id && entry.week_start === week.week_start);

  const pendingHolidays = holidays.filter((request) => request.status === "pending");
  const otherHolidays = holidays.filter((request) => request.status !== "pending");

  return shell(
    <div className="space-y-8">
      {/* WAITING */}
      <section>
        <h2 className="mb-3 text-xl font-semibold text-slate-900">
          Waiting for approval ({pendingWeeks.length + pendingHolidays.length})
        </h2>
        {pendingWeeks.length + pendingHolidays.length === 0 && <p className="text-sm text-slate-600">Nothing waiting.</p>}
        <div className="space-y-3">
          {pendingHolidays.map((request) => (
            <div key={request.id} className={card}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">Holiday · {nameOf(request.staff_id)}</p>
                  <p>
                    {formatHolidayRange(request)} · {holidayDays(request)} {holidayDays(request) === 1 ? "day" : "days"}
                  </p>
                  {request.reason && <p className="text-slate-500">{request.reason}</p>}
                </div>
                <StatusPill status={request.status} />
              </div>
              <ReviewForm action={reviewHolidayRequest} hidden={{ request_id: request.id }} approveLabel="Approve & add to Schedule" />
            </div>
          ))}
          {pendingWeeks.map((week) => (
            <WeekCard key={week.id} week={week} name={nameOf(week.staff_id)} entries={entriesFor(week)} pending />
          ))}
        </div>
      </section>

      {/* STAFF */}
      <section>
        <h2 className="mb-3 text-xl font-semibold text-slate-900">Employees</h2>
        <div className={`${card} mb-3`}>
          <h3 className="mb-2 font-semibold text-slate-900">Invite an employee</h3>
          <form action={inviteStaffMember} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <input name="name" required placeholder="Name" className={input} autoComplete="off" />
            <input name="email" type="email" required placeholder="Email" className={input} autoComplete="off" spellCheck={false} />
            <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Invite</button>
          </form>
          <p className="mt-2 text-xs text-slate-500">
            They get an email to choose a password, then sign in at the normal login page and only see their timesheet, holiday and the Schedule (view only).
          </p>
        </div>
        {staff.filter((member) => member.role === "employee").length === 0 ? (
          <p className="text-sm text-slate-600">No employees yet.</p>
        ) : (
          <ul className="space-y-2">
            {staff
              .filter((member) => member.role === "employee")
              .map((member) => (
                <li key={member.id} className={`${card} flex flex-wrap items-center justify-between gap-2`}>
                  <div className="text-sm">
                    <p className="font-semibold text-slate-900">{member.name}</p>
                    <p className="text-slate-500">
                      {member.email} · {member.active ? (member.user_id ? "Active" : "Invited") : "Deactivated"}
                    </p>
                  </div>
                  <form action={setStaffActive}>
                    <input type="hidden" name="staff_id" value={member.id} />
                    <input type="hidden" name="active" value={member.active ? "false" : "true"} />
                    <button className={`rounded-lg px-3 py-2 text-sm font-medium ${member.active ? "text-red-700 hover:bg-red-50" : "text-emerald-700 hover:bg-emerald-50"}`}>
                      {member.active ? "Deactivate" : "Reactivate"}
                    </button>
                  </form>
                </li>
              ))}
          </ul>
        )}
      </section>

      {/* HOLIDAY HISTORY */}
      <section>
        <h2 className="mb-3 text-xl font-semibold text-slate-900">Holiday</h2>
        {otherHolidays.length === 0 ? (
          <p className="text-sm text-slate-600">No decided requests yet.</p>
        ) : (
          <ul className="space-y-2">
            {otherHolidays.map((request) => (
              <li key={request.id} className={`${card} flex flex-wrap items-start justify-between gap-2`}>
                <div className="text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">{nameOf(request.staff_id)}</p>
                  <p>
                    {formatHolidayRange(request)} · {holidayDays(request)} {holidayDays(request) === 1 ? "day" : "days"}
                  </p>
                  {request.review_note && <p className="text-slate-500">Note: {request.review_note}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={request.status} />
                  {request.status === "approved" && request.end_date >= today && (
                    <form action={cancelApprovedHoliday}>
                      <input type="hidden" name="request_id" value={request.id} />
                      <button className="rounded-lg px-3 py-1 text-sm font-medium text-amber-700 hover:bg-amber-50">Cancel holiday</button>
                    </form>
                  )}
                  <form action={deleteHolidayRequest}>
                    <input type="hidden" name="request_id" value={request.id} />
                    <button className="rounded-lg px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-50">Delete</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* TIMESHEET HISTORY */}
      <section>
        <h2 className="mb-3 text-xl font-semibold text-slate-900">Recent timesheets</h2>
        {recentWeeks.length === 0 ? (
          <p className="text-sm text-slate-600">No reviewed timesheets yet.</p>
        ) : (
          <div className="space-y-3">
            {recentWeeks.map((week) => (
              <WeekCard key={week.id} week={week} name={nameOf(week.staff_id)} entries={entriesFor(week)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ReviewForm({
  action,
  hidden,
  approveLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  hidden: Record<string, string>;
  approveLabel: string;
}) {
  return (
    <form action={action} className="mt-3 flex flex-col gap-2 sm:flex-row">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <input name="note" placeholder="Note (optional)" className={`${input} sm:flex-1`} />
      <div className="flex gap-2">
        <button name="decision" value="approved" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
          {approveLabel}
        </button>
        <button name="decision" value="rejected" className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-50">
          Reject
        </button>
      </div>
    </form>
  );
}

function WeekCard({
  week,
  name,
  entries,
  pending = false,
}: {
  week: WeekRow;
  name: string;
  entries: (EntryRow & { start_time: string; finish_time: string })[];
  pending?: boolean;
}) {
  const total = totalMinutes(entries);
  return (
    <div className={card}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Timesheet · {name}</p>
          <p>
            {formatWeekRange(week.week_start)} · {formatMinutes(total)} ({decimalHours(total)} h)
          </p>
          {week.review_note && <p className="text-slate-500">Note: {week.review_note}</p>}
        </div>
        <StatusPill status={week.status} />
      </div>
      <details className="mt-2 text-sm" open={pending}>
        <summary className="cursor-pointer text-slate-600">{entries.length} {entries.length === 1 ? "entry" : "entries"}</summary>
        <ul className="mt-2 divide-y divide-slate-100">
          {entries.map((entry) => (
            <li key={entry.id} className="py-1.5 text-slate-700">
              <span className="font-medium">{formatDayLabel(entry.work_date)}</span> · {entry.start_time}–{entry.finish_time}
              {entry.break_minutes ? ` (${entry.break_minutes} min break)` : ""} · {formatMinutes(entryMinutes(entry))}
              {entry.job_label ? ` · ${entry.job_label}` : ""}
              {entry.notes ? <span className="block text-slate-500">{entry.notes}</span> : null}
            </li>
          ))}
        </ul>
      </details>
      {pending && (
        <ReviewForm action={reviewTimesheetWeek} hidden={{ staff_id: week.staff_id, week_start: week.week_start }} approveLabel="Approve" />
      )}
    </div>
  );
}
