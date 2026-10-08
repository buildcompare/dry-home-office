/*
 * Shared Schedule appointment creation.
 *
 * Used by the Schedule "Add appointment" form (addScheduleEvent) and by
 * the Book Survey flow. Inserts the schedule_events row, then copies it
 * to the connected Google Calendar and stores the Google event id, the
 * same way for both, so the two-way Google sync treats them alike.
 */

import type { createClient } from "@/lib/supabase/server";
import {
  copyAppointmentToGoogle,
  deleteGoogleCalendarEvent,
  updateGoogleCalendarEvent,
} from "@/lib/google-calendar-sync";
import { localGoogleEffect } from "@/lib/google-oauth";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type NewScheduleEvent = {
  job_id: string | null;
  contract_id: string | null;
  client_id: string | null;
  title: string;
  event_type: string;
  status: string;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  all_day: boolean;
  location: string | null;
  assigned_to: string | null;
  notes: string | null;
};

export type CreateScheduleEventResult =
  | {
      ok: true;
      eventId: string;
      /* True when Google Calendar is connected but the copy failed. */
      googleNotice: boolean;
    }
  | {
      ok: false;
      error: unknown;
    };

export async function createScheduleEventWithGoogle(
  supabase: SupabaseServerClient,
  row: NewScheduleEvent
): Promise<CreateScheduleEventResult> {
  const { data: newEvent, error } = await supabase
    .from("schedule_events")
    .insert(row)
    .select(`
      id,
      job_id,
      client_id,
      contract_id
    `)
    .single();

  if (error || !newEvent) {
    console.error("Schedule save error:", error);

    return {
      ok: false,
      error,
    };
  }

  const copied = await copyAppointmentToGoogle({
    title: row.title,
    location: row.location,
    notes: row.notes,
    start_date: row.start_date,
    end_date: row.end_date,
    start_time: row.start_time,
    end_time: row.end_time,
    all_day: row.all_day,
  });

  let googleNotice = false;

  if (copied.status === "failed") {
    googleNotice = true;
  }

  if (copied.status === "copied") {
    const { error: linkError } = await supabase
      .from("schedule_events")
      .update({
        google_calendar_id: copied.calendarId,
        google_event_id: copied.eventId,
      })
      .eq("id", newEvent.id);

    if (linkError) {
      console.error("Could not store the Google Calendar event id");
      await deleteGoogleCalendarEvent(copied.calendarId, copied.eventId);
      googleNotice = true;
    }
  }

  return {
    ok: true,
    eventId: newEvent.id as string,
    googleNotice,
  };
}

/* =========================================================
   UPDATE
   Pushes the change to Google Calendar first (when the appointment is
   on Google), then saves it locally. If Google cannot be updated the
   local row is left alone, otherwise the next two-way sync would pull
   the old time back from Google.
   ========================================================= */

export type ScheduleEventChanges = {
  title: string;
  location: string | null;
  notes: string | null;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  all_day: boolean;
};

export async function updateScheduleEventWithGoogle(
  supabase: SupabaseServerClient,
  row: {
    id: string;
    google_calendar_id?: string | null;
    google_event_id?: string | null;
  },
  changes: ScheduleEventChanges
): Promise<{ ok: true } | { ok: false; reason: "google" | "db" }> {
  if (row.google_event_id) {
    const pushed = await updateGoogleCalendarEvent(
      row.google_calendar_id ?? null,
      row.google_event_id,
      changes
    );

    if (pushed.status === "failed") {
      return { ok: false, reason: "google" };
    }
  }

  const { error } = await supabase
    .from("schedule_events")
    .update(changes)
    .eq("id", row.id);

  if (error) {
    console.error("Schedule update error:", error);
    return { ok: false, reason: "db" };
  }

  return { ok: true };
}

/* =========================================================
   REMOVE
   The Schedule page's delete path: delete on Google first, then
   cancel (linked to a job/contract) or delete the local row.
   ========================================================= */

export async function removeScheduleEvent(
  supabase: SupabaseServerClient,
  row: {
    id: string;
    job_id: string | null;
    contract_id: string | null;
    google_calendar_id: string | null;
    google_event_id: string | null;
  }
): Promise<{ ok: true } | { ok: false; reason: "google" | "db" }> {
  if (row.google_event_id) {
    const removed = await deleteGoogleCalendarEvent(
      row.google_calendar_id,
      row.google_event_id
    );

    if (removed.status !== "deleted") {
      return { ok: false, reason: "google" };
    }

    const effect = localGoogleEffect({
      job_id: row.job_id,
      contract_id: row.contract_id,
    });

    const result =
      effect === "cancel"
        ? await supabase
            .from("schedule_events")
            .update({ status: "Cancelled" })
            .eq("id", row.id)
        : await supabase
            .from("schedule_events")
            .delete()
            .eq("id", row.id);

    if (result.error) {
      console.error("Schedule delete could not update the appointment");
      return { ok: false, reason: "db" };
    }

    return { ok: true };
  }

  const { error } = await supabase
    .from("schedule_events")
    .delete()
    .eq("id", row.id);

  if (error) {
    console.error("Schedule delete could not remove the appointment");
    return { ok: false, reason: "db" };
  }

  return { ok: true };
}
