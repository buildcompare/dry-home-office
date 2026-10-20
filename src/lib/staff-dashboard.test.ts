import assert from "node:assert/strict";
import { computeStaffDashboard, formatSignedMinutes, parseHoursToMinutes } from "./staff-dashboard";

const e = (week_start: string, work_date: string, s: string, f: string, b = 0) => ({ week_start, work_date, start_time: s, finish_time: f, break_minutes: b });
const d = computeStaffDashboard({
  today: "2026-10-21",
  contractedHours: 40,
  weeks: [
    { week_start: "2026-10-19", status: "submitted" },
    { week_start: "2026-10-12", status: "approved" },
    { week_start: "2026-09-28", status: "approved" },
    { week_start: "2026-10-05", status: "draft" },
  ],
  entries: [
    e("2026-10-19", "2026-10-19", "08:00", "17:00", 60), // 8h pending this week
    ...["12", "13", "14", "15", "16"].map((day) => e("2026-10-12", `2026-10-${day}`, "08:00", "17:30", 30)), // 5×9h = 45h → 5h lieu
    ...["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01"].map((day) => e("2026-09-28", day, "08:00", "16:00")), // 32h → 0
    e("2026-10-05", "2026-10-05", "08:00", "18:00"), // draft ignored
  ],
  holidays: [
    { id: "a", start_date: "2026-12-21", end_date: "2026-12-25", half_day: false, half_day_part: null, reason: null, status: "approved" },
    { id: "b", start_date: "2026-11-06", end_date: "2026-11-06", half_day: true, half_day_part: "pm", reason: null, status: "pending" },
    { id: "c", start_date: "2026-10-24", end_date: "2026-10-26", half_day: false, half_day_part: null, reason: null, status: "rejected" }, // Sat–Mon → 1 day
    { id: "x", start_date: "2025-12-01", end_date: "2025-12-01", half_day: false, half_day_part: null, reason: null, status: "approved" },
  ],
  lieu: [{ id: "l", taken_date: "2026-10-20", minutes: 90, note: null }],
});
assert.deepEqual(d.hours.week, { approved: 0, pending: 480 });
assert.equal(d.hours.month.approved, 45 * 60 + 8 * 60); // Oct: 45h + 1 Oct 8h
assert.equal(d.hours.year.approved, 45 * 60 + 32 * 60);
assert.equal(d.lieu.accrued, 300);
assert.equal(d.lieu.balance, 210);
assert.deepEqual(d.holiday.approved, { count: 1, days: 5 });
assert.deepEqual(d.holiday.pending, { count: 1, days: 0.5 });
assert.deepEqual(d.holiday.rejected, { count: 1, days: 1 });
assert.equal(d.holiday.upcoming.length, 1);
assert.equal(formatSignedMinutes(-90), "−1h 30m");
assert.equal(parseHoursToMinutes("7.5"), 450);
assert.equal(parseHoursToMinutes("1:15"), 75);
assert.equal(parseHoursToMinutes("0"), null);
console.log("dashboard tests passed");
