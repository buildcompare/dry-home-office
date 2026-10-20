/* Loads one employee's dashboard with whichever client the caller is
   allowed to use (employee session or owner session; RLS applies). */
import type { createClient } from "@/lib/supabase/server";
import { getLondonDateKey } from "@/lib/dates";
import { DEFAULT_HOLIDAY_ALLOWANCE_DAYS } from "@/lib/bank-holidays";
import { getBankHolidaySet } from "@/lib/bank-holidays-server";
import {
  computeStaffDashboard,
  DEFAULT_CONTRACTED_HOURS,
  type DashEntry,
  type DashHoliday,
  type DashLieu,
  type DashWeek,
  type StaffDashboard,
} from "@/lib/staff-dashboard";

type Client = Awaited<ReturnType<typeof createClient>>;

export type LoadedDashboard = {
  dashboard: StaffDashboard;
  contractedHours: number;
  lieuRows: DashLieu[];
  /** false until supabase/staff_dashboards.sql has been run */
  dashboardsSetUp: boolean;
  allowanceDays: number;
  /** false until supabase/staff_holiday_allowance.sql has been run */
  allowanceSetUp: boolean;
  bankHolidays: Set<string>;
};

export async function loadContractedHours(supabase: Client, staffId: string) {
  const { data, error } = await supabase
    .from("staff_members")
    .select("contracted_weekly_hours")
    .eq("id", staffId)
    .maybeSingle();
  if (error) return { hours: DEFAULT_CONTRACTED_HOURS, setUp: false };
  const hours = Number(data?.contracted_weekly_hours);
  return { hours: Number.isFinite(hours) ? hours : DEFAULT_CONTRACTED_HOURS, setUp: true };
}

export async function loadHolidayAllowance(supabase: Client, staffId: string) {
  const { data, error } = await supabase
    .from("staff_members")
    .select("holiday_allowance_days")
    .eq("id", staffId)
    .maybeSingle();
  if (error) return { days: DEFAULT_HOLIDAY_ALLOWANCE_DAYS, setUp: false };
  const days = Number(data?.holiday_allowance_days);
  return { days: Number.isFinite(days) ? days : DEFAULT_HOLIDAY_ALLOWANCE_DAYS, setUp: true };
}

export async function loadStaffDashboard(supabase: Client, staffId: string): Promise<LoadedDashboard> {
  const [contracted, allowance, bankHolidays, weeks, entries, holidays, lieu] = await Promise.all([
    loadContractedHours(supabase, staffId),
    loadHolidayAllowance(supabase, staffId),
    getBankHolidaySet(),
    supabase.from("timesheet_weeks").select("week_start, status").eq("staff_id", staffId).in("status", ["approved", "submitted"]),
    supabase
      .from("timesheet_entries")
      .select("week_start, work_date, start_time, finish_time, break_minutes")
      .eq("staff_id", staffId)
      .limit(10000),
    supabase
      .from("holiday_requests")
      .select("id, start_date, end_date, half_day, half_day_part, reason, status, review_note, created_at")
      .eq("staff_id", staffId)
      .order("start_date", { ascending: false })
      .limit(500),
    supabase.from("lieu_taken").select("id, taken_date, minutes, note").eq("staff_id", staffId).order("taken_date", { ascending: false }),
  ]);

  const lieuRows = (lieu.error ? [] : (lieu.data ?? [])) as DashLieu[];
  const dashboard = computeStaffDashboard({
    today: getLondonDateKey(),
    contractedHours: contracted.hours,
    weeks: (weeks.data ?? []) as DashWeek[],
    entries: ((entries.data ?? []) as DashEntry[]).map((entry) => ({
      ...entry,
      start_time: entry.start_time.slice(0, 5),
      finish_time: entry.finish_time.slice(0, 5),
    })),
    holidays: (holidays.data ?? []) as DashHoliday[],
    lieu: lieuRows,
    allowanceDays: allowance.days,
    bankHolidays,
  });

  return { dashboard, contractedHours: contracted.hours, lieuRows, dashboardsSetUp: contracted.setUp && !lieu.error,
    allowanceDays: allowance.days,
    allowanceSetUp: allowance.setUp,
    bankHolidays,
  };
}
