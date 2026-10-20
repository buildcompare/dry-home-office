/* Pure dashboard maths for one employee (no I/O). */
import { entryMinutes, holidayDays, weekStartOf } from "@/lib/staff";

export const DEFAULT_CONTRACTED_HOURS = 40;

export type DashWeek = { week_start: string; status: string };
export type DashEntry = { week_start: string; work_date: string; start_time: string; finish_time: string; break_minutes: number | null };
export type DashHoliday = {
  id: string;
  start_date: string;
  end_date: string;
  half_day: boolean;
  half_day_part: string | null;
  reason: string | null;
  status: string;
  review_note?: string | null;
  created_at?: string | null;
};
export type DashLieu = { id: string; taken_date: string; minutes: number; note: string | null };

type Period = { approved: number; pending: number };

export type StaffDashboard = {
  hours: { week: Period; month: Period; year: Period };
  lieu: { accrued: number; taken: number; balance: number; contractedMinutes: number };
  holiday: {
    year: string;
    pending: { count: number; days: number };
    approved: { count: number; days: number };
    rejected: { count: number; days: number };
    upcoming: DashHoliday[];
    recent: DashHoliday[];
  };
};

export function computeStaffDashboard(input: {
  today: string;
  contractedHours: number | null | undefined;
  weeks: DashWeek[];
  entries: DashEntry[];
  holidays: DashHoliday[];
  lieu: DashLieu[];
}): StaffDashboard {
  const { today } = input;
  const thisWeek = weekStartOf(today);
  const month = today.slice(0, 7);
  const year = today.slice(0, 4);

  const statusOf = new Map(input.weeks.map((week) => [week.week_start, week.status]));
  const hours = { week: { approved: 0, pending: 0 }, month: { approved: 0, pending: 0 }, year: { approved: 0, pending: 0 } };
  const approvedWeekTotals = new Map<string, number>();

  for (const entry of input.entries) {
    const status = statusOf.get(entry.week_start);
    if (status !== "approved" && status !== "submitted") continue;
    const minutes = entryMinutes(entry);
    const key = status === "approved" ? "approved" : "pending";
    if (entry.week_start === thisWeek) hours.week[key] += minutes;
    if (entry.work_date.startsWith(month)) hours.month[key] += minutes;
    if (entry.work_date.startsWith(year)) hours.year[key] += minutes;
    if (status === "approved") approvedWeekTotals.set(entry.week_start, (approvedWeekTotals.get(entry.week_start) ?? 0) + minutes);
  }

  const contracted = Number(input.contractedHours);
  const contractedMinutes = Math.round((Number.isFinite(contracted) && contracted >= 0 ? contracted : DEFAULT_CONTRACTED_HOURS) * 60);
  let accrued = 0;
  for (const total of approvedWeekTotals.values()) accrued += Math.max(0, total - contractedMinutes);
  const taken = input.lieu.reduce((sum, row) => sum + (row.minutes > 0 ? row.minutes : 0), 0);

  const tally = (status: string) => {
    const rows = input.holidays.filter((h) => h.status === status && h.start_date.startsWith(year));
    return { count: rows.length, days: rows.reduce((sum, h) => sum + holidayDays(h), 0) };
  };

  const upcoming = input.holidays
    .filter((h) => h.status === "approved" && h.end_date >= today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 10);
  const recent = [...input.holidays]
    .sort((a, b) => (b.created_at ?? b.start_date).localeCompare(a.created_at ?? a.start_date))
    .slice(0, 8);

  return {
    hours,
    lieu: { accrued, taken, balance: accrued - taken, contractedMinutes },
    holiday: { year, pending: tally("pending"), approved: tally("approved"), rejected: tally("rejected"), upcoming, recent },
  };
}

/** Signed "h m" (e.g. -1h 30m). */
export function formatSignedMinutes(minutes: number) {
  const sign = minutes < 0 ? "−" : "";
  const abs = Math.abs(Math.round(minutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${m === 0 ? `${h}h` : `${h}h ${m}m`}`;
}

export function formatDays(days: number) {
  return `${Number.isInteger(days) ? days : days.toFixed(1)} ${days === 1 ? "day" : "days"}`;
}

/** "7.5" → 450; accepts "7:30" too. Null if invalid. */
export function parseHoursToMinutes(value: string) {
  const text = value.trim();
  const colon = /^(\d{1,3}):([0-5]\d)$/.exec(text);
  const minutes = colon ? Number(colon[1]) * 60 + Number(colon[2]) : Math.round(Number(text) * 60);
  if (!text || !Number.isFinite(minutes) || minutes <= 0 || minutes > 10080) return null;
  return minutes;
}
