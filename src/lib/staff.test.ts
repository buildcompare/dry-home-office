/* Run: npx tsx src/lib/staff.test.ts */
import assert from "node:assert/strict";
import {
  entryMinutes,
  formatMinutes,
  holidayDays,
  holidayTitle,
  isEmployeePath,
  normaliseRole,
  totalMinutes,
  validateHolidayRequest,
  validateTimesheetEntry,
  weekDays,
  weekIsEditable,
  weekStartOf,
} from "./staff";

assert.equal(weekStartOf("2026-10-20"), "2026-10-19"); // Tue → Mon
assert.equal(weekStartOf("2026-10-25"), "2026-10-19"); // Sun → Mon
assert.equal(weekStartOf("2026-10-19"), "2026-10-19");
assert.equal(weekDays("2026-10-19").length, 7);
assert.equal(weekDays("2026-10-19")[6], "2026-10-25");

assert.equal(entryMinutes({ start_time: "08:00", finish_time: "16:30", break_minutes: 30 }), 480);
assert.equal(totalMinutes([
  { start_time: "08:00", finish_time: "16:30", break_minutes: 30 },
  { start_time: "08:00:00", finish_time: "12:15:00", break_minutes: 0 },
]), 735);
assert.equal(formatMinutes(735), "12h 15m");
assert.equal(formatMinutes(480), "8h");

const ok = validateTimesheetEntry({ work_date: "2026-10-21", start_time: "08:00", finish_time: "16:00", break_minutes: "30", notes: " " }, "2026-10-19");
assert.equal(ok.ok, true);
assert.equal(validateTimesheetEntry({ work_date: "2026-10-27", start_time: "08:00", finish_time: "16:00", break_minutes: "", notes: "" }, "2026-10-19").ok, false);
assert.equal(validateTimesheetEntry({ work_date: "2026-10-21", start_time: "16:00", finish_time: "08:00", break_minutes: "", notes: "" }, "2026-10-19").ok, false);
assert.equal(validateTimesheetEntry({ work_date: "2026-10-21", start_time: "08:00", finish_time: "09:00", break_minutes: "60", notes: "" }, "2026-10-19").ok, false);
assert.equal(validateTimesheetEntry({ work_date: "2026-02-30", start_time: "08:00", finish_time: "09:00", break_minutes: "", notes: "" }, "2026-02-23").ok, false);

assert.equal(weekIsEditable(null), true);
assert.equal(weekIsEditable("rejected"), true);
assert.equal(weekIsEditable("submitted"), false);
assert.equal(weekIsEditable("approved"), false);

assert.equal(holidayDays({ start_date: "2026-10-19", end_date: "2026-10-25", half_day: false }), 5);
assert.equal(holidayDays({ start_date: "2026-10-23", end_date: "2026-10-26", half_day: false }), 2);
assert.equal(holidayDays({ start_date: "2026-10-23", end_date: "2026-10-23", half_day: true }), 0.5);

const half = validateHolidayRequest({ start_date: "2026-11-02", end_date: "2026-11-05", half_day: true, half_day_part: "pm", reason: "" });
assert.equal(half.ok && half.request.end_date, "2026-11-02");
assert.equal(validateHolidayRequest({ start_date: "2026-11-02", end_date: "2026-11-01", half_day: false, half_day_part: "", reason: "" }).ok, false);
assert.equal(validateHolidayRequest({ start_date: "2026-11-02", end_date: "", half_day: true, half_day_part: "", reason: "" }).ok, false);

assert.equal(holidayTitle("Sam Jones", { half_day: false, half_day_part: null }), "Holiday – Sam Jones");
assert.equal(holidayTitle("Sam", { half_day: true, half_day_part: "pm" }), "Holiday – Sam (half day PM)");

assert.equal(normaliseRole(null), "owner");
assert.equal(normaliseRole("employee"), "employee");
assert.equal(normaliseRole("inactive"), "inactive");

assert.equal(isEmployeePath("/staff"), true);
assert.equal(isEmployeePath("/staff/timesheet"), true);
assert.equal(isEmployeePath("/staffing"), false);
assert.equal(isEmployeePath("/schedule"), false);
assert.equal(isEmployeePath("/api/survey-reports"), false);
console.log("staff tests passed");
