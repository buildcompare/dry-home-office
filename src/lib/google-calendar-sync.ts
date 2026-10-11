import { createAdminClient } from "@/lib/supabase/admin";
import {
  accessTokenFromTokenResponse,
  calendarsToRead,
  eventIdFromInsertResponse,
  eventsFromListResponse,
  GOOGLE_REDIRECT_URI,
  googleCredentialsConfigured,
  googleDeleteSucceeded,
  googleEventBody,
  londonRangeBounds,
  mapGoogleApiEvent,
  planGoogleSync,
  refreshTokenFromTokenResponse,
  tokenErrorDetail,
  tokenErrorNeedsReconnect,
  writeCalendarId,
  type GoogleApiEvent,
  type GoogleConnection,
  type MirroredEvent,
  type OfficeAppointment,
  type StoredGoogleRow,
} from "@/lib/google-oauth";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const MAX_PAGES = 10;
const MAX_EVENTS = 500;

export type GoogleSyncResult = {
  workSynced: boolean;
  familySynced: boolean;
  warning: boolean;
  status: number | null;
  reason: string | null;
  familyCalendarId: string | null;
  /** Google refused the stored sign-in (expired/revoked): reconnect needed. */
  needsReconnect: boolean;
  /** Office appointments copied to Google on this sync (saved while disconnected). */
  pushed: number;
};

export type GoogleOAuthRead =
  | { ready: false }
  | { ready: true; connection: GoogleConnection | null };

export async function readGoogleOAuth(): Promise<GoogleOAuthRead> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("office_google_oauth")
      .select("refresh_token, calendar_id, family_calendar_id")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      console.error("Google Calendar connection could not be read");
      return { ready: false };
    }

    if (!data) return { ready: true, connection: null };

    const refreshToken =
      typeof data.refresh_token === "string" ? data.refresh_token.trim() : "";

    return {
      ready: true,
      connection: {
        refreshToken: refreshToken || null,
        calendarId: textOrNull(data.calendar_id),
        familyCalendarId: textOrNull(data.family_calendar_id),
      },
    };
  } catch {
    console.error("Google Calendar connection could not be read");
    return { ready: false };
  }
}

export async function scheduleColumnsReady() {
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("schedule_events")
      .select("id, google_calendar_id, google_event_id")
      .limit(1);
    return !error;
  } catch {
    return false;
  }
}

export async function saveGoogleRefreshToken(refreshToken: string) {
  const admin = createAdminClient();
  const { data, error: readError } = await admin
    .from("office_google_oauth")
    .select("calendar_id, family_calendar_id")
    .eq("id", 1)
    .maybeSingle();

  if (readError) {
    console.error("Google Calendar connection could not be saved");
    return false;
  }

  const { error } = await admin.from("office_google_oauth").upsert({
    id: 1,
    refresh_token: refreshToken,
    calendar_id: data?.calendar_id ?? null,
    family_calendar_id: data?.family_calendar_id ?? null,
  });

  if (error) {
    console.error("Google Calendar connection could not be saved");
    return false;
  }

  return true;
}

export async function exchangeGoogleCode(code: string) {
  if (!googleCredentialsConfigured()) return null;
  try {
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
        client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.error("Google Calendar connection failed", response.status);
      return null;
    }

    const body: unknown = await response.json();
    return refreshTokenFromTokenResponse(body);
  } catch {
    console.error("Google Calendar connection failed");
    return null;
  }
}

export async function syncGoogleCalendarMonth(
  monthStart: string,
  monthEnd: string
): Promise<GoogleSyncResult> {
  const idle = {
    workSynced: false,
    familySynced: false,
    warning: false,
    status: null,
    reason: null,
    familyCalendarId: null as string | null,
    needsReconnect: false,
    pushed: 0,
  };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(monthStart) || !/^\d{4}-\d{2}-\d{2}$/.test(monthEnd)) {
    return idle;
  }

  const stored = await readGoogleOAuth();
  const familyRaw = stored.ready
    ? stored.connection?.familyCalendarId?.trim() || ""
    : "";
  const workCalendarId = stored.ready
    ? writeCalendarId(stored.connection?.calendarId)
    : "";
  const familyCalendarId =
    familyRaw && familyRaw !== workCalendarId ? familyRaw : null;
  const unread = { ...idle, familyCalendarId };
  if (!googleCredentialsConfigured()) return unread;
  if (!stored.ready || !stored.connection?.refreshToken) return unread;

  const access = await accessTokenFor(stored.connection.refreshToken);
  if (!access.token) {
    return {
      workSynced: false,
      familySynced: false,
      warning: true,
      status: access.status,
      reason: access.detail,
      familyCalendarId,
      needsReconnect: access.needsReconnect,
      pushed: 0,
    };
  }
  const accessToken = access.token;

  const bounds = londonRangeBounds(monthStart, monthEnd);
  let workSynced = false;
  let familySynced = false;
  let warning = false;
  let status: number | null = null;
  let reason: string | null = null;
  let needsReconnect = false;

  for (const calendar of calendarsToRead(stored.connection)) {
    try {
      const listed = await listCalendarEvents(
        accessToken,
        calendar.id,
        bounds.timeMin,
        bounds.timeMax
      );
      const mirrored = listed
        .map((event) => mapGoogleApiEvent(event, calendar.id, calendar.label))
        .filter((event): event is MirroredEvent => event !== null);
      const applied = await applyMirror(calendar.id, mirrored);
      if (!applied.ok) {
        warning = true;
        if (reason === null) reason = applied.reason;
        continue;
      }
      if (calendar.label === "Work") workSynced = true;
      else familySynced = true;
    } catch (error) {
      console.error("Google Calendar sync failed");
      warning = true;
      if (status === null && error instanceof GoogleListError) {
        status = error.status;
      }
      // 401 on the API: the sign-in was revoked after the token refreshed.
      if (error instanceof GoogleListError && error.status === 401) {
        needsReconnect = true;
      }
      if (reason === null) {
        reason =
          error instanceof GoogleListError && error.status !== null
            ? `list failed (${error.status})`
            : "list failed";
      }
    }
  }

  // Appointments saved while Google was disconnected (or whose copy
  // failed) have no Google ids yet: copy them now that sync works.
  let pushed = 0;
  if (workSynced) {
    pushed = await pushPendingAppointments(
      accessToken,
      writeCalendarId(stored.connection.calendarId)
    );
  }

  return {
    workSynced,
    familySynced,
    warning,
    status,
    reason,
    familyCalendarId,
    needsReconnect,
    pushed,
  };
}

/**
 * Lightweight check for the Settings page: can the stored refresh token
 * still get an access token?
 */
export async function googleConnectionHealth(): Promise<
  "not-connected" | "ok" | "reconnect" | "error"
> {
  if (!googleCredentialsConfigured()) return "not-connected";
  const stored = await readGoogleOAuth();
  if (!stored.ready || !stored.connection?.refreshToken) return "not-connected";
  const access = await accessTokenFor(stored.connection.refreshToken);
  if (access.token) return "ok";
  return access.needsReconnect ? "reconnect" : "error";
}

/* =========================================================
   PUSH PENDING
   Only upcoming, not-cancelled office appointments created in the last
   PENDING_LOOKBACK_DAYS with no Google ids are copied, at most
   PENDING_LIMIT per sync. Each row is claimed first (google_calendar_id
   set while google_event_id is still null) so two page loads cannot
   both copy it. If the copy fails, the claim is released for next time.
   ========================================================= */

const PENDING_LOOKBACK_DAYS = 14;
const PENDING_LIMIT = 20;

async function pushPendingAppointments(accessToken: string, calendarId: string) {
  let pushed = 0;

  try {
    const admin = createAdminClient();
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const since = new Date(Date.now() - PENDING_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await admin
      .from("schedule_events")
      .select("id, title, location, notes, start_date, end_date, start_time, end_time, all_day, status")
      .is("google_event_id", null)
      .is("google_calendar_id", null)
      .neq("status", "Cancelled")
      .gte("end_date", today)
      .gte("created_at", since)
      .order("start_date", { ascending: true })
      .limit(PENDING_LIMIT);

    if (error) {
      console.error("Google Calendar pending appointments could not be read");
      return 0;
    }

    for (const row of data ?? []) {
      if (typeof row.id !== "string" || typeof row.start_date !== "string") continue;

      const { data: claimed, error: claimError } = await admin
        .from("schedule_events")
        .update({ google_calendar_id: calendarId })
        .eq("id", row.id)
        .is("google_calendar_id", null)
        .is("google_event_id", null)
        .select("id");

      if (claimError || !claimed || claimed.length === 0) continue;

      const eventId = await insertGoogleEvent(accessToken, calendarId, {
        title: textOrNull(row.title) ?? "Appointment",
        location: textOrNull(row.location),
        notes: textOrNull(row.notes),
        start_date: row.start_date,
        end_date: textOrNull(row.end_date) ?? row.start_date,
        start_time: textOrNull(row.start_time),
        end_time: textOrNull(row.end_time),
        all_day: Boolean(row.all_day),
      });

      if (!eventId) {
        await admin
          .from("schedule_events")
          .update({ google_calendar_id: null })
          .eq("id", row.id)
          .is("google_event_id", null);
        continue;
      }

      const { error: linkError } = await admin
        .from("schedule_events")
        .update({ google_event_id: eventId })
        .eq("id", row.id);

      if (linkError) {
        console.error("Could not store the Google Calendar event id");
        await deleteEventWithToken(accessToken, calendarId, eventId);
        await admin
          .from("schedule_events")
          .update({ google_calendar_id: null })
          .eq("id", row.id)
          .is("google_event_id", null);
        continue;
      }

      pushed += 1;
    }
  } catch {
    console.error("Google Calendar pending appointments could not be copied");
  }

  return pushed;
}

async function insertGoogleEvent(
  accessToken: string,
  calendarId: string,
  appointment: OfficeAppointment
) {
  try {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(googleEventBody(appointment)),
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!response.ok) {
      console.error("Google Calendar create failed", response.status);
      return null;
    }
    return eventIdFromInsertResponse(await response.json());
  } catch {
    console.error("Google Calendar create failed");
    return null;
  }
}

async function deleteEventWithToken(accessToken: string, calendarId: string, eventId: string) {
  try {
    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      }
    );
  } catch {
    console.error("Google Calendar delete failed");
  }
}

export async function copyAppointmentToGoogle(
  appointment: OfficeAppointment
): Promise<
  | { status: "skipped" }
  | { status: "failed" }
  | { status: "copied"; calendarId: string; eventId: string }
> {
  if (!googleCredentialsConfigured()) return { status: "skipped" };
  const stored = await readGoogleOAuth();
  if (!stored.ready || !stored.connection?.refreshToken) return { status: "skipped" };

  const access = await accessTokenFor(stored.connection.refreshToken);
  if (!access.token) return { status: "failed" };
  const accessToken = access.token;

  const calendarId = writeCalendarId(stored.connection.calendarId);

  try {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(googleEventBody(appointment)),
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!response.ok) {
      console.error("Google Calendar create failed", response.status);
      return { status: "failed" };
    }

    const body: unknown = await response.json();
    const eventId = eventIdFromInsertResponse(body);
    if (!eventId) {
      console.error("Google Calendar create failed");
      return { status: "failed" };
    }

    return { status: "copied", calendarId, eventId };
  } catch {
    console.error("Google Calendar create failed");
    return { status: "failed" };
  }
}

/**
 * Push an office change to an appointment that is already on Google
 * Calendar, so the next two-way sync does not pull the old time back.
 */
export async function updateGoogleCalendarEvent(
  calendarId: string | null,
  eventId: string,
  appointment: OfficeAppointment
): Promise<{ status: "skipped" } | { status: "failed" } | { status: "updated" }> {
  if (!googleCredentialsConfigured()) return { status: "skipped" };
  const stored = await readGoogleOAuth();
  if (!stored.ready || !stored.connection?.refreshToken) return { status: "skipped" };

  const access = await accessTokenFor(stored.connection.refreshToken);
  if (!access.token) return { status: "failed" };
  const accessToken = access.token;

  const calendar = calendarId?.trim() || writeCalendarId(stored.connection.calendarId);

  try {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar)}/events/${encodeURIComponent(eventId)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        // Send location/description even when blank so old values clear.
        body: JSON.stringify({
          ...googleEventBody(appointment),
          location: appointment.location?.trim() ?? "",
          description: appointment.notes?.trim() ?? "",
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      }
    );

    if (response.ok) return { status: "updated" };
    console.error("Google Calendar update failed", response.status);
    return { status: "failed" };
  } catch {
    console.error("Google Calendar update failed");
    return { status: "failed" };
  }
}

export async function deleteGoogleCalendarEvent(
  calendarId: string | null,
  eventId: string
): Promise<{ status: "skipped" } | { status: "failed" } | { status: "deleted" }> {
  if (!googleCredentialsConfigured()) return { status: "skipped" };
  const stored = await readGoogleOAuth();
  if (!stored.ready || !stored.connection?.refreshToken) return { status: "skipped" };

  const access = await accessTokenFor(stored.connection.refreshToken);
  if (!access.token) return { status: "failed" };
  const accessToken = access.token;

  const calendar = calendarId?.trim() || writeCalendarId(stored.connection.calendarId);

  try {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar)}/events/${encodeURIComponent(eventId)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      }
    );

    if (googleDeleteSucceeded(response.status)) return { status: "deleted" };
    console.error("Google Calendar delete failed", response.status);
    return { status: "failed" };
  } catch {
    console.error("Google Calendar delete failed");
    return { status: "failed" };
  }
}

class GoogleListError extends Error {
  status: number | null;

  constructor(status: number | null) {
    super("Google Calendar list failed");
    this.name = "GoogleListError";
    this.status = status;
  }
}

async function accessTokenFor(refreshToken: string): Promise<{
  token: string | null;
  status: number | null;
  needsReconnect: boolean;
  detail: string;
}> {
  try {
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
        client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      let errorBody: unknown = null;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = null;
      }
      const needsReconnect = tokenErrorNeedsReconnect(response.status, errorBody);
      console.error(
        "Google Calendar token refresh failed",
        response.status,
        needsReconnect ? "(reconnect needed)" : ""
      );
      return {
        token: null,
        status: response.status,
        needsReconnect,
        detail: tokenErrorDetail(response.status, errorBody),
      };
    }

    const body: unknown = await response.json();
    const token = accessTokenFromTokenResponse(body);
    return {
      token,
      status: null,
      needsReconnect: false,
      detail: token ? "" : "token refresh returned no access token",
    };
  } catch {
    console.error("Google Calendar token refresh failed");
    return { token: null, status: null, needsReconnect: false, detail: "token refresh failed (network)" };
  }
}

async function listCalendarEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
) {
  const events: GoogleApiEvent[] = [];
  let pageToken: string | null = null;

  for (let page = 0; page < MAX_PAGES && events.length < MAX_EVENTS; page += 1) {
    const url = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
    );
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("showDeleted", "true");
    url.searchParams.set("maxResults", "250");
    url.searchParams.set("timeMin", timeMin);
    url.searchParams.set("timeMax", timeMax);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.error("Google Calendar list failed", response.status);
      throw new GoogleListError(response.status);
    }

    const body: unknown = await response.json();
    const parsed = eventsFromListResponse(body);
    events.push(...parsed.events);
    pageToken = parsed.nextPageToken;
    if (!pageToken) break;
  }

  return events.slice(0, MAX_EVENTS);
}

async function applyMirror(
  calendarId: string,
  incoming: MirroredEvent[]
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const admin = createAdminClient();
  const ids = [...new Set(incoming.map((event) => event.google_event_id))];
  const existing: StoredGoogleRow[] = [];

  for (let index = 0; index < ids.length; index += 100) {
    const chunk = ids.slice(index, index + 100);
    const { data, error } = await admin
      .from("schedule_events")
      .select("id, job_id, contract_id, event_type, google_calendar_id, google_event_id")
      .eq("google_calendar_id", calendarId)
      .in("google_event_id", chunk);

    if (error) {
      console.error("Google Calendar sync could not read appointments");
      return { ok: false, reason: supabaseReason(error) };
    }

    for (const row of data ?? []) {
      if (typeof row.id !== "string") continue;
      existing.push({
        id: row.id,
        job_id: textOrNull(row.job_id),
        contract_id: textOrNull(row.contract_id),
        event_type: textOrNull(row.event_type),
        google_calendar_id: textOrNull(row.google_calendar_id),
        google_event_id: textOrNull(row.google_event_id),
      });
    }
  }

  const plan = planGoogleSync(incoming, existing);

  for (const removal of plan.removals) {
    const result =
      removal.action === "cancel"
        ? await admin
            .from("schedule_events")
            .update({ status: "Cancelled" })
            .eq("id", removal.id)
        : await admin.from("schedule_events").delete().eq("id", removal.id);

    if (result.error) {
      console.error("Google Calendar sync could not update an appointment");
      return { ok: false, reason: supabaseReason(result.error) };
    }
  }

  for (const update of plan.updates) {
    const { error } = await admin
      .from("schedule_events")
      .update(update.patch)
      .eq("id", update.id);
    if (error) {
      console.error("Google Calendar sync could not update an appointment");
      return { ok: false, reason: supabaseReason(error) };
    }
  }

  if (plan.inserts.length > 0) {
    const { error } = await admin.from("schedule_events").insert(
      plan.inserts.map((event) => ({
        title: event.title,
        event_type: "Other",
        status: "Scheduled",
        start_date: event.start_date,
        end_date: event.end_date,
        start_time: event.start_time,
        end_time: event.end_time,
        all_day: event.all_day,
        location: event.location,
        google_calendar_id: event.google_calendar_id,
        google_event_id: event.google_event_id,
        job_id: null,
        contract_id: null,
        client_id: null,
      }))
    );

    if (error) {
      console.error("Google Calendar sync could not save appointments");
      return { ok: false, reason: supabaseReason(error) };
    }
  }

  return { ok: true };
}

function supabaseReason(error: { message?: unknown }) {
  const message = typeof error.message === "string" ? error.message : "";
  return clipPublicReason(message);
}

function clipPublicReason(value: string) {
  const cleaned = value
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\bBearer\s+\S+/gi, "")
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const text = cleaned || "sync failed";
  if (text.length <= 180) return text;
  return `${text.slice(0, 179).trimEnd()}…`;
}

function textOrNull(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}
