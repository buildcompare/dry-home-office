/*
 * Staff portal: pure helpers (timesheets, holiday, roles). Safe for
 * client and server.
 */

export type StaffRole = "owner" | "employee" | "inactive";

export type TimesheetStatus = "draft" | "submitted" | "approved" | "rejected";
export type HolidayStatus = "pending" | "approved" | "rejected" | "cancelled";

export const STAFF_HOME = "/staff";
export const TEAM_HOME = "/team";

export function normaliseRole(value: unknown): StaffRole {
  return value === "employee" || value === "inactive" ? value : "owner";
}

/* ---------- dates ---------- */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function isTime(value: unknown): value is string {
  return typeof value === "string" && TIME_RE.test(value);
}

function toUtc(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function shiftDate(key: string, days: number) {
  const date = toUtc(key);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUtc(date);
}

/** Monday of the week containing the date. */
export function weekStartOf(key: string) {
  const date = toUtc(key);
  const day = date.getUTCDay(); // 0 Sun … 6 Sat
  const back = day === 0 ? 6 : day - 1;
  return shiftDate(key, -back);
}

export function weekDays(weekStart: string) {
  return Array.from({ length: 7 }, (_, index) => shiftDate(weekStart, index));
}

export function formatDayLabel(key: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(toUtc(key));
}

export function formatLongDay(key: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(toUtc(key));
}

export function formatWeekRange(weekStart: string) {
  const end = shiftDate(weekStart, 6);
  const fmt = (key: string) =>
    new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
      toUtc(key)
    );
  return `${fmt(weekStart)} – ${fmt(end)}`;
}

/* ---------- timesheets ---------- */

function minutesOf(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Worked minutes for one entry (finish − start − break), never below 0. */
export function entryMinutes(entry: { start_time: string; finish_time: string; break_minutes: number | null }) {
  if (!isTime(entry.start_time) || !isTime(entry.finish_time)) return 0;
  const span = minutesOf(entry.finish_time) - minutesOf(entry.start_time);
  return Math.max(0, span - Math.max(0, Number(entry.break_minutes ?? 0)));
}

export function totalMinutes(entries: { start_time: string; finish_time: string; break_minutes: number | null }[]) {
  return entries.reduce((sum, entry) => sum + entryMinutes(entry), 0);
}

/** 450 → "7h 30m" */
export function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** 450 → "7.50" decimal hours */
export function decimalHours(minutes: number) {
  return (minutes / 60).toFixed(2);
}

export type TimesheetEntryInput = {
  work_date: string;
  start_time: string;
  finish_time: string;
  break_minutes: number;
  notes: string | null;
};

export function validateTimesheetEntry(
  input: { work_date: string; start_time: string; finish_time: string; break_minutes: string; notes: string },
  weekStart: string
): { ok: true; entry: TimesheetEntryInput } | { ok: false; error: string } {
  if (!isDateKey(input.work_date)) return { ok: false, error: "Please choose the date." };
  if (weekStartOf(input.work_date) !== weekStart) return { ok: false, error: "The date must be in this week." };
  if (!isTime(input.start_time) || !isTime(input.finish_time)) {
    return { ok: false, error: "Please enter a start and finish time." };
  }
  if (minutesOf(input.finish_time) <= minutesOf(input.start_time)) {
    return { ok: false, error: "The finish time must be after the start time." };
  }
  const breakText = input.break_minutes.trim();
  const breakMinutes = breakText === "" ? 0 : Number(breakText);
  if (!Number.isInteger(breakMinutes) || breakMinutes < 0 || breakMinutes > 720) {
    return { ok: false, error: "Break must be a whole number of minutes." };
  }
  const span = minutesOf(input.finish_time) - minutesOf(input.start_time);
  if (breakMinutes >= span) return { ok: false, error: "The break is longer than the time worked." };

  return {
    ok: true,
    entry: {
      work_date: input.work_date,
      start_time: input.start_time.slice(0, 5),
      finish_time: input.finish_time.slice(0, 5),
      break_minutes: breakMinutes,
      notes: input.notes.trim().slice(0, 1000) || null,
    },
  };
}

export function weekIsEditable(status: TimesheetStatus | null | undefined) {
  return !status || status === "draft" || status === "rejected";
}

/* ---------- holiday ---------- */

/** Weekdays in the range (Mon–Fri), or 0.5 for a single half day. */
export function holidayDays(request: { start_date: string; end_date: string; half_day: boolean }) {
  if (!isDateKey(request.start_date) || !isDateKey(request.end_date)) return 0;
  if (request.end_date < request.start_date) return 0;
  if (request.half_day) return 0.5;
  let days = 0;
  for (let key = request.start_date; key <= request.end_date; key = shiftDate(key, 1)) {
    const day = toUtc(key).getUTCDay();
    if (day !== 0 && day !== 6) days += 1;
    if (days > 400) break;
  }
  return days;
}

export function validateHolidayRequest(input: {
  start_date: string;
  end_date: string;
  half_day: boolean;
  half_day_part: string;
  reason: string;
}):
  | { ok: true; request: { start_date: string; end_date: string; half_day: boolean; half_day_part: "am" | "pm" | null; reason: string | null } }
  | { ok: false; error: string } {
  if (!isDateKey(input.start_date)) return { ok: false, error: "Please choose the first day." };
  const end = input.half_day ? input.start_date : input.end_date || input.start_date;
  if (!isDateKey(end)) return { ok: false, error: "Please choose the last day." };
  if (end < input.start_date) return { ok: false, error: "The last day must be on or after the first day." };
  if (shiftDate(input.start_date, 366) < end) return { ok: false, error: "Please request no more than a year at a time." };
  const part = input.half_day_part === "pm" ? "pm" : input.half_day_part === "am" ? "am" : null;
  if (input.half_day && !part) return { ok: false, error: "Please choose morning or afternoon for a half day." };

  return {
    ok: true,
    request: {
      start_date: input.start_date,
      end_date: end,
      half_day: input.half_day,
      half_day_part: input.half_day ? part : null,
      reason: input.reason.trim().slice(0, 1000) || null,
    },
  };
}

export function holidayTitle(name: string, request: { half_day: boolean; half_day_part: string | null }) {
  const who = name.trim() || "Staff";
  if (!request.half_day) return `Holiday – ${who}`;
  return `Holiday – ${who} (half day ${request.half_day_part === "pm" ? "PM" : "AM"})`;
}

export function formatHolidayRange(request: { start_date: string; end_date: string; half_day: boolean; half_day_part: string | null }) {
  if (request.half_day) {
    return `${formatLongDay(request.start_date)} (${request.half_day_part === "pm" ? "afternoon" : "morning"})`;
  }
  if (request.start_date === request.end_date) return formatLongDay(request.start_date);
  return `${formatDayLabel(request.start_date)} – ${formatLongDay(request.end_date)}`;
}

/* ---------- invites ---------- */

export function normaliseEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isPlausibleEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

/* ---------- routing ---------- */

/** Paths an employee may use. Everything else sends them to /staff. */
export function isEmployeePath(pathname: string) {
  return (
    pathname === STAFF_HOME ||
    pathname.startsWith(`${STAFF_HOME}/`) ||
    pathname === "/auth" ||
    pathname.startsWith("/auth/") ||
    pathname === "/login" ||
    pathname.startsWith("/login/")
  );
}

export const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  submitted: "bg-blue-100 text-blue-800",
  pending: "bg-blue-100 text-blue-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-slate-100 text-slate-500",
};

export function statusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/** Short-lived cookie holding an invite link when the invite email fails. */
export const INVITE_LINK_COOKIE = "staff_invite_link";
