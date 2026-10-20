"use server";

import { cookies, headers } from "next/headers";
import { sendStaffInviteEmail, staffInviteLink } from "@/lib/staff-invite-email";
import { INVITE_LINK_COOKIE } from "@/lib/staff";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwnerForTeam } from "@/lib/staff-auth";
import {
  createScheduleEventWithGoogle,
  deleteScheduleEventPermanently,
} from "@/lib/schedule-create";
import { holidayTitle, isDateKey, isPlausibleEmail, normaliseEmail } from "@/lib/staff";

const PATH = "/team";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function back(params: Record<string, string>): never {
  redirect(`${PATH}?${new URLSearchParams(params).toString()}`);
}

function done(message: string): never {
  revalidatePath(PATH);
  revalidatePath("/schedule");
  back({ notice: message });
}

async function siteOrigin() {
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host");
  const proto = list.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "https://dry-home-office.vercel.app";
}

/* ---------------- staff ---------------- */

export async function inviteStaffMember(formData: FormData) {
  const { supabase, email: ownerEmail, setUp } = await requireOwnerForTeam();
  if (!setUp) back({ error: "Run supabase/staff_portal.sql first." });

  const name = text(formData, "name").slice(0, 120);
  const email = normaliseEmail(text(formData, "email"));
  if (!name) back({ error: "Please enter the employee's name." });
  if (!isPlausibleEmail(email)) back({ error: "Please enter a valid email address." });
  if (ownerEmail && normaliseEmail(ownerEmail) === email) {
    back({ error: "That's your own login – an owner can't also be an employee." });
  }

  const { data: existing } = await supabase
    .from("staff_members")
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  if (existing) back({ error: "Someone with that email is already on the staff list." });

  const { data: created, error } = await supabase
    .from("staff_members")
    .insert({ name, email, role: "employee", active: true, invited_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error || !created) back({ error: "The staff member couldn't be added." });

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    done(`${name} added. No invite email was sent – create their login in Supabase (Authentication → Users → Add user) with ${email}.`);
  }

  // Generate the invite link ourselves and email it through Resend, so it
  // comes from DryHome rather than "Supabase Auth". (redirect() must not
  // run inside try/catch, so the outcome is worked out first.)
  const origin = await siteOrigin();
  let link: string | null = null;
  let outcome: "sent" | "exists" | "link-failed" | "email-failed" = "link-failed";

  try {
    const admin = createAdminClient();
    const { data: generated, error: linkError } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo: `${origin}/auth/set-password`, data: { name } },
    });

    if (linkError) {
      outcome = /already|registered|exists/i.test(linkError.message ?? "") ? "exists" : "link-failed";
    } else {
      if (generated?.user?.id) {
        await admin.from("staff_members").update({ user_id: generated.user.id }).eq("id", created.id).is("user_id", null);
      }
      link = staffInviteLink(origin, generated?.properties);
      if (link) {
        const sent = await sendStaffInviteEmail({ to: email, name, link, origin });
        outcome = sent.ok ? "sent" : "email-failed";
      }
    }
  } catch {
    outcome = link ? "email-failed" : "link-failed";
  }

  if (outcome === "exists") {
    done(`${name} added. They already have a login, so no invite was sent – they can sign in with their existing password and will see the staff portal.`);
  }
  if (outcome === "link-failed") {
    done(`${name} added, but an invite link couldn't be created. Create their login in Supabase (Authentication → Users) with ${email}.`);
  }
  if (outcome === "email-failed" && link) {
    // Shown once on the Staff page so the owner can copy it to the employee.
    const jar = await cookies();
    jar.set(INVITE_LINK_COOKIE, JSON.stringify({ email, link }), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: PATH,
      maxAge: 600,
    });
    done(`${name} added, but the invite email couldn't be sent. Copy the invite link below and send it to them yourself.`);
  }

  done(`Invite sent to ${email}. They'll choose a password from the email link.`);
}

export async function setStaffActive(formData: FormData) {
  const { supabase } = await requireOwnerForTeam();
  const active = text(formData, "active") === "true";
  const { data, error } = await supabase
    .from("staff_members")
    .update({ active })
    .eq("id", text(formData, "staff_id"))
    .eq("role", "employee")
    .select("name");
  if (error || !data?.length) back({ error: "The staff member couldn't be updated." });
  done(`${data[0].name} ${active ? "reactivated" : "deactivated"}.`);
}

/* ---------------- timesheets ---------------- */

export async function reviewTimesheetWeek(formData: FormData) {
  const { supabase, userId } = await requireOwnerForTeam();
  const decision = text(formData, "decision");
  const weekStart = text(formData, "week_start");
  if (!["approved", "rejected"].includes(decision) || !isDateKey(weekStart)) back({ error: "Unknown request." });

  const { data, error } = await supabase
    .from("timesheet_weeks")
    .update({
      status: decision,
      reviewed_at: new Date().toISOString(),
      reviewed_by: userId,
      review_note: text(formData, "note").slice(0, 500) || null,
    })
    .eq("staff_id", text(formData, "staff_id"))
    .eq("week_start", weekStart)
    .eq("status", "submitted")
    .select("id");
  if (error || !data?.length) back({ error: "That timesheet is no longer waiting for approval." });
  done(decision === "approved" ? "Timesheet approved." : "Timesheet returned to the employee.");
}

/* ---------------- holiday ---------------- */

type Supabase = Awaited<ReturnType<typeof requireOwnerForTeam>>["supabase"];

/** Removes the holiday's schedule entry (and its Google event). */
async function removeHolidayEvent(supabase: Supabase, eventId: string | null) {
  if (!eventId) return { ok: true as const };
  const { data: event } = await supabase
    .from("schedule_events")
    .select("id, google_calendar_id, google_event_id")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return { ok: true as const };
  if (event.google_calendar_id && !event.google_event_id) {
    return { ok: false as const, message: "It's being copied to Google Calendar right now – please try again in a minute." };
  }
  const removed = await deleteScheduleEventPermanently(supabase, event);
  if (!removed.ok) {
    return {
      ok: false as const,
      message:
        removed.reason === "google"
          ? "The Google Calendar event couldn't be removed, so nothing was changed. Check the Google connection and try again."
          : "The schedule entry couldn't be removed, so nothing was changed.",
    };
  }
  return { ok: true as const };
}

export async function reviewHolidayRequest(formData: FormData) {
  const { supabase, userId } = await requireOwnerForTeam();
  const decision = text(formData, "decision");
  const requestId = text(formData, "request_id");
  const note = text(formData, "note").slice(0, 500) || null;
  if (!["approved", "rejected"].includes(decision)) back({ error: "Unknown request." });

  const { data: request } = await supabase
    .from("holiday_requests")
    .select("id, staff_id, start_date, end_date, half_day, half_day_part, reason, status, schedule_event_id")
    .eq("id", requestId)
    .maybeSingle();
  if (!request) back({ error: "That holiday request no longer exists." });

  const review = { reviewed_at: new Date().toISOString(), reviewed_by: userId, review_note: note };

  if (decision === "rejected") {
    if (!["pending", "approved"].includes(request.status)) back({ error: "That request can't be rejected now." });
    if (request.status === "approved") {
      const removed = await removeHolidayEvent(supabase, request.schedule_event_id);
      if (!removed.ok) back({ error: removed.message });
    }
    const { error } = await supabase
      .from("holiday_requests")
      .update({ status: "rejected", schedule_event_id: null, ...review })
      .eq("id", request.id)
      .eq("status", request.status);
    if (error) back({ error: "The request couldn't be updated." });
    done("Holiday request rejected.");
  }

  if (request.status !== "pending") back({ error: "That request is no longer pending." });

  const { data: staff } = await supabase.from("staff_members").select("name").eq("id", request.staff_id).maybeSingle();

  // Same path as any other appointment: saved, then copied to Google (or
  // queued for the next sync if Google is disconnected).
  const created = await createScheduleEventWithGoogle(supabase, {
    job_id: null,
    contract_id: null,
    client_id: null,
    title: holidayTitle(staff?.name ?? "", request),
    event_type: "Other",
    status: "Scheduled",
    start_date: request.start_date,
    end_date: request.end_date,
    start_time: null,
    end_time: null,
    all_day: true,
    location: null,
    assigned_to: null,
    notes: request.reason ?? null,
  });
  if (!created.ok) back({ error: "The holiday couldn't be added to the Schedule, so it wasn't approved." });

  const { data: updated, error } = await supabase
    .from("holiday_requests")
    .update({ status: "approved", schedule_event_id: created.eventId, ...review })
    .eq("id", request.id)
    .eq("status", "pending")
    .select("id");

  if (error || !updated?.length) {
    await removeHolidayEvent(supabase, created.eventId);
    back({ error: "The request changed while approving (perhaps it was cancelled). Nothing was approved." });
  }

  done(
    created.googleNotice
      ? "Holiday approved and added to the Schedule. Google Calendar couldn't be updated just now."
      : "Holiday approved and added to the Schedule."
  );
}

export async function cancelApprovedHoliday(formData: FormData) {
  const { supabase, userId } = await requireOwnerForTeam();
  const { data: request } = await supabase
    .from("holiday_requests")
    .select("id, status, schedule_event_id")
    .eq("id", text(formData, "request_id"))
    .maybeSingle();
  if (!request || !["pending", "approved"].includes(request.status)) back({ error: "That request can't be cancelled." });

  const removed = await removeHolidayEvent(supabase, request.schedule_event_id);
  if (!removed.ok) back({ error: removed.message });

  const { error } = await supabase
    .from("holiday_requests")
    .update({ status: "cancelled", schedule_event_id: null, reviewed_at: new Date().toISOString(), reviewed_by: userId })
    .eq("id", request.id);
  if (error) back({ error: "The request couldn't be cancelled." });
  done("Holiday cancelled and removed from the Schedule.");
}

export async function deleteHolidayRequest(formData: FormData) {
  const { supabase } = await requireOwnerForTeam();
  const { data: request } = await supabase
    .from("holiday_requests")
    .select("id, schedule_event_id")
    .eq("id", text(formData, "request_id"))
    .maybeSingle();
  if (!request) back({ error: "That request no longer exists." });

  const removed = await removeHolidayEvent(supabase, request.schedule_event_id);
  if (!removed.ok) back({ error: removed.message });

  const { error } = await supabase.from("holiday_requests").delete().eq("id", request.id);
  if (error) back({ error: "The request couldn't be deleted." });
  done("Holiday request deleted.");
}
