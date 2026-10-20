import { cookies } from "next/headers";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { loadStaffDashboard } from "@/lib/staff-dashboard-data";
import { formatDays, formatSignedMinutes } from "@/lib/staff-dashboard";
import { INVITE_LINK_COOKIE } from "@/lib/staff";
import { getLondonDateKey } from "@/lib/dates";
import { requireOwnerForTeam } from "@/lib/staff-auth";
import { formatUkDate, formatUkDateTime, signupStatus, type SignupStatus } from "@/lib/staff-signup";
import { loadAuthUsers } from "@/lib/staff-signup-server";
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
  resendStaffInvite,
} from "@/app/team/actions";
import { StatusPill } from "@/app/staff/StaffNotice";

type StaffRow = { id: string; name: string; email: string; role: string; active: boolean; user_id: string | null; invited_at?: string | null };
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

  let inviteLink: { email: string; link: string } | null = null;
  try {
    const raw = (await cookies()).get(INVITE_LINK_COOKIE)?.value;
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed.link === "string" && typeof parsed.email === "string") inviteLink = parsed;
  } catch {
    inviteLink = null;
  }

  const shell = (content: React.ReactNode) => (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 pb-8 pt-20 md:p-8">
        <div className="mx-auto max-w-5xl">
          <h1 className="mb-1 text-3xl font-bold text-slate-900">Staff</h1>
          <p className="mb-6 text-sm text-slate-600">Employees, timesheets and holiday.</p>
          {params.error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{params.error}</p>}
          {params.notice && <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{params.notice}</p>}
          {inviteLink && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="mb-2 font-semibold">Invite link for {inviteLink.email} (copy and send it to them; it works once, for 24 hours):</p>
              <textarea readOnly rows={3} spellCheck={false} className="w-full rounded-lg border border-amber-300 bg-white p-2 font-mono text-xs text-slate-800" defaultValue={inviteLink.link} />
            </div>
          )}
          {content}
        </div>
      </main>
    </div>
  );

  const { data: staffData, error: staffError } = await supabase
    .from("staff_members")
    .select("id, name, email, role, active, user_id, invited_at")
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

  const employees = staff.filter((member) => member.role === "employee");
  const summaries = await Promise.all(
    employees.filter((member) => member.active).map(async (member) => ({ member, ...(await loadStaffDashboard(supabase, member.id)) }))
  );

  // Has each employee actually signed up? (needs the service role; falls
  // back to the simple Active / Invited label when it isn't available)
  const authUsers = await loadAuthUsers(employees.flatMap((member) => (member.user_id ? [member.user_id] : [])));
  const signup = new Map<string, SignupStatus>(
    employees.map((member) => [
      member.id,
      authUsers
        ? signupStatus(member.user_id ? authUsers.get(member.user_id) : null, member.invited_at ?? null)
        : member.user_id
          ? { state: "unknown" as const }
          : { state: "invited" as const, invitedAt: member.invited_at ?? null },
    ])
  );
  const invitesPending = employees.filter((member) => member.active && signup.get(member.id)?.state === "invited").length;

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
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold text-slate-900">Employees</h2>
          {invitesPending > 0 && (
            <span className="rounded-full bg-[#f29e23]/15 px-2.5 py-1 text-xs font-semibold text-[#8a5400] ring-1 ring-[#f29e23]/40">
              {invitesPending} invite{invitesPending === 1 ? "" : "s"} not yet accepted
            </span>
          )}
        </div>
        {summaries.length > 0 && (
          <div className="mb-3 overflow-x-auto rounded-xl bg-white shadow-sm">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[#252525] text-xs uppercase tracking-wider text-slate-200">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">This week</th>
                  <th className="px-4 py-3">This month</th>
                  <th className="px-4 py-3">Lieu balance</th>
                  <th className="px-4 py-3">Holiday taken / booked</th>
                  <th className="px-4 py-3">Pending</th>
                  <th className="px-4 py-3">Available</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summaries.map(({ member, dashboard }) => (
                  <tr key={member.id}>
                    <td className="px-4 py-3">
                      <Link href={`/team/${member.id}`} className="font-semibold text-[#be1e2d] hover:underline">{member.name}</Link>
                    </td>
                    <td className="px-4 py-3">
                      {formatMinutes(dashboard.hours.week.approved)}
                      {dashboard.hours.week.pending > 0 && <span className="block text-xs text-slate-500">+{formatMinutes(dashboard.hours.week.pending)} pending</span>}
                    </td>
                    <td className="px-4 py-3">
                      {formatMinutes(dashboard.hours.month.approved)}
                      {dashboard.hours.month.pending > 0 && <span className="block text-xs text-slate-500">+{formatMinutes(dashboard.hours.month.pending)} pending</span>}
                    </td>
                    <td className="px-4 py-3 font-semibold">{formatSignedMinutes(dashboard.lieu.balance)}</td>
                    <td className="px-4 py-3">
                      {formatDays(dashboard.holiday.taken)}
                      <span className="mt-1 block h-1.5 w-24 overflow-hidden rounded-full bg-slate-200">
                        <span
                          className="block h-full bg-[#252525]"
                          style={{ width: `${dashboard.holiday.allowance > 0 ? Math.min(100, (dashboard.holiday.taken / dashboard.holiday.allowance) * 100) : 0}%` }}
                        />
                      </span>
                    </td>
                    <td className="px-4 py-3">{formatDays(dashboard.holiday.pendingDays)}</td>
                    <td className={`px-4 py-3 font-semibold ${dashboard.holiday.available < 0 ? "text-[#be1e2d]" : "text-[#252525]"}`}>
                      {formatDays(dashboard.holiday.available)}
                      <span className="block text-xs font-normal text-slate-500">of {formatDays(dashboard.holiday.allowance)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
                    <Link href={`/team/${member.id}`} className="font-semibold text-slate-900 hover:text-[#be1e2d] hover:underline">{member.name}</Link>
                    <p className="text-slate-500">{member.email}</p>
                    <SignupLine status={signup.get(member.id)} active={member.active} />
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                  {member.active && signup.get(member.id)?.state === "invited" && (
                    <form action={resendStaffInvite}>
                      <input type="hidden" name="staff_id" value={member.id} />
                      <button className="rounded-lg border border-[#f29e23] px-3 py-2 text-sm font-medium text-[#8a5400] hover:bg-[#f29e23]/10">
                        Resend invite
                      </button>
                    </form>
                  )}
                  <form action={setStaffActive}>
                    <input type="hidden" name="staff_id" value={member.id} />
                    <input type="hidden" name="active" value={member.active ? "false" : "true"} />
                    <button className={`rounded-lg px-3 py-2 text-sm font-medium ${member.active ? "text-red-700 hover:bg-red-50" : "text-emerald-700 hover:bg-emerald-50"}`}>
                      {member.active ? "Deactivate" : "Reactivate"}
                    </button>
                  </form>
                  </div>
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

function SignupLine({ status, active }: { status: SignupStatus | undefined; active: boolean }) {
  if (!active) return <p className="mt-1 text-xs font-medium text-slate-500">Deactivated</p>;
  if (!status || status.state === "unknown") return <p className="mt-1 text-xs font-medium text-emerald-700">Active</p>;
  if (status.state === "invited") {
    return (
      <p className="mt-1">
        <span className="inline-flex rounded-full bg-[#f29e23]/15 px-2.5 py-0.5 text-xs font-semibold text-[#8a5400] ring-1 ring-[#f29e23]/40">
          Invite sent{status.invitedAt ? ` ${formatUkDate(status.invitedAt)}` : ""}
        </span>
      </p>
    );
  }
  return (
    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-800 ring-1 ring-emerald-200">
        Signed up{status.signedUpAt ? ` ${formatUkDate(status.signedUpAt)}` : ""}
      </span>
      <span className="self-center">
        Last signed in {status.lastSignInAt ? `${formatUkDateTime(status.lastSignInAt)} (UK time)` : "–"}
      </span>
    </p>
  );
}
