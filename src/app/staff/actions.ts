"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireEmployee } from "@/lib/staff-auth";
import {
  isDateKey,
  validateHolidayRequest,
  validateTimesheetEntry,
  weekIsEditable,
  weekStartOf,
  type TimesheetStatus,
} from "@/lib/staff";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function back(path: string, params: Record<string, string>): never {
  const query = new URLSearchParams(params).toString();
  redirect(query ? `${path}?${query}` : path);
}

async function employeeOrBack(path: string) {
  const session = await requireEmployee();
  if (session.status !== "ok") back(path, { error: "Your staff account isn't available." });
  return session;
}

async function weekStatus(
  supabase: Awaited<ReturnType<typeof requireEmployee>> extends infer S
    ? S extends { supabase: infer C } ? C : never
    : never,
  staffId: string,
  weekStart: string
) {
  const { data } = await supabase
    .from("timesheet_weeks")
    .select("status")
    .eq("staff_id", staffId)
    .eq("week_start", weekStart)
    .maybeSingle();
  return (data?.status ?? null) as TimesheetStatus | null;
}

/* Job dropdown: titles and numbers only, never values or client details. */
async function jobLabel(jobId: string) {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("jobs")
      .select("id, job_number, title")
      .eq("id", jobId)
      .maybeSingle();
    if (!data) return null;
    return [data.job_number, data.title].filter(Boolean).join(" – ") || "Job";
  } catch {
    return null;
  }
}

export async function saveTimesheetEntry(formData: FormData) {
  const weekStartRaw = text(formData, "week_start");
  const weekStart = isDateKey(weekStartRaw) ? weekStartOf(weekStartRaw) : weekStartOf(text(formData, "work_date"));
  const path = "/staff/timesheet";
  const keep: Record<string, string> = isDateKey(weekStart) ? { week: weekStart } : {};
  const session = await employeeOrBack(path);
  const { supabase, staff } = session;

  const checked = validateTimesheetEntry(
    {
      work_date: text(formData, "work_date"),
      start_time: text(formData, "start_time"),
      finish_time: text(formData, "finish_time"),
      break_minutes: text(formData, "break_minutes"),
      notes: text(formData, "notes"),
    },
    weekStart
  );
  if (!checked.ok) back(path, { ...keep, error: checked.error });

  const status = await weekStatus(supabase, staff.id, weekStart);
  if (!weekIsEditable(status)) back(path, { ...keep, error: "This week has been submitted and can't be changed." });

  if (!status) {
    const { error } = await supabase
      .from("timesheet_weeks")
      .insert({ staff_id: staff.id, week_start: weekStart, status: "draft" });
    if (error && error.code !== "23505") back(path, { ...keep, error: "The timesheet couldn't be saved." });
  }

  const jobId = text(formData, "job_id").trim();
  const label = jobId ? await jobLabel(jobId) : null;

  const row = {
    staff_id: staff.id,
    week_start: weekStart,
    ...checked.entry,
    job_id: label ? jobId : null,
    job_label: label,
  };

  const entryId = text(formData, "entry_id").trim();
  const { error } = entryId
    ? await supabase.from("timesheet_entries").update(row).eq("id", entryId).eq("staff_id", staff.id)
    : await supabase.from("timesheet_entries").insert(row);

  if (error) back(path, { ...keep, error: "The entry couldn't be saved." });

  revalidatePath(path);
  back(path, { ...keep, saved: "entry" });
}

export async function deleteTimesheetEntry(formData: FormData) {
  const weekStart = text(formData, "week_start");
  const path = "/staff/timesheet";
  const keep: Record<string, string> = isDateKey(weekStart) ? { week: weekStart } : {};
  const { supabase, staff } = await employeeOrBack(path);

  const status = isDateKey(weekStart) ? await weekStatus(supabase, staff.id, weekStart) : null;
  if (!weekIsEditable(status)) back(path, { ...keep, error: "This week has been submitted and can't be changed." });

  const { error } = await supabase
    .from("timesheet_entries")
    .delete()
    .eq("id", text(formData, "entry_id"))
    .eq("staff_id", staff.id);
  if (error) back(path, { ...keep, error: "The entry couldn't be removed." });

  revalidatePath(path);
  back(path, { ...keep, saved: "removed" });
}

export async function submitTimesheetWeek(formData: FormData) {
  const weekStart = text(formData, "week_start");
  const path = "/staff/timesheet";
  if (!isDateKey(weekStart) || weekStartOf(weekStart) !== weekStart) back(path, { error: "Unknown week." });
  const keep = { week: weekStart };
  const { supabase, staff } = await employeeOrBack(path);

  const { count } = await supabase
    .from("timesheet_entries")
    .select("id", { count: "exact", head: true })
    .eq("staff_id", staff.id)
    .eq("week_start", weekStart);
  if (!count) back(path, { ...keep, error: "Add at least one day before submitting the week." });

  const status = await weekStatus(supabase, staff.id, weekStart);
  if (!weekIsEditable(status)) back(path, { ...keep, error: "This week has already been submitted." });

  const now = new Date().toISOString();
  const { error } = status
    ? await supabase
        .from("timesheet_weeks")
        .update({ status: "submitted", submitted_at: now })
        .eq("staff_id", staff.id)
        .eq("week_start", weekStart)
    : await supabase
        .from("timesheet_weeks")
        .insert({ staff_id: staff.id, week_start: weekStart, status: "submitted", submitted_at: now });
  if (error) back(path, { ...keep, error: "The week couldn't be submitted." });

  revalidatePath(path);
  back(path, { ...keep, saved: "submitted" });
}

export async function requestHoliday(formData: FormData) {
  const path = "/staff/holiday";
  const { supabase, staff } = await employeeOrBack(path);

  const checked = validateHolidayRequest({
    start_date: text(formData, "start_date"),
    end_date: text(formData, "end_date"),
    half_day: text(formData, "half_day") === "on",
    half_day_part: text(formData, "half_day_part"),
    reason: text(formData, "reason"),
  });
  if (!checked.ok) back(path, { error: checked.error });

  const { error } = await supabase
    .from("holiday_requests")
    .insert({ staff_id: staff.id, status: "pending", ...checked.request });
  if (error) back(path, { error: "The request couldn't be sent." });

  revalidatePath(path);
  back(path, { saved: "requested" });
}

export async function cancelHolidayRequest(formData: FormData) {
  const path = "/staff/holiday";
  const { supabase, staff } = await employeeOrBack(path);

  const { data, error } = await supabase
    .from("holiday_requests")
    .update({ status: "cancelled" })
    .eq("id", text(formData, "request_id"))
    .eq("staff_id", staff.id)
    .eq("status", "pending")
    .select("id");
  if (error || !data?.length) {
    back(path, { error: "Only pending requests can be cancelled. Ask the office to cancel approved holiday." });
  }

  revalidatePath(path);
  back(path, { saved: "cancelled" });
}
