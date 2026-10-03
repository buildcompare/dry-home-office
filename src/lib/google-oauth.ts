export const GOOGLE_REDIRECT_URI =
  "https://dry-home-office.vercel.app/api/google/callback";

export const GOOGLE_CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar.events";

export const DEFAULT_GOOGLE_CALENDAR_ID = "primary";

const LONDON = "Europe/London";

export type GoogleConnection = {
  refreshToken: string | null;
  calendarId: string | null;
  familyCalendarId: string | null;
};

export type CalendarToRead = {
  id: string;
  label: "Work" | "Family";
};

export type GoogleApiEvent = {
  id?: string;
  status?: string;
  summary?: string;
  location?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
};

export type MirroredEvent = {
  google_event_id: string;
  google_calendar_id: string;
  title: string;
  location: string | null;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  all_day: boolean;
  event_type: "Other";
  google_label: "Google" | "Google Family";
  cancelled: boolean;
};

export type OfficeAppointment = {
  title: string;
  location: string | null;
  notes: string | null;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  all_day: boolean;
};

export type StoredGoogleRow = {
  id: string;
  job_id: string | null;
  contract_id: string | null;
  event_type: string | null;
  google_calendar_id: string | null;
  google_event_id: string | null;
};

export type SyncPlan = {
  inserts: MirroredEvent[];
  updates: Array<{ id: string; patch: Record<string, string | boolean | null> }>;
  removals: Array<{ id: string; action: "delete" | "cancel" }>;
};

export function googleCredentialsConfigured(
  clientId = process.env.GOOGLE_CLIENT_ID,
  clientSecret = process.env.GOOGLE_CLIENT_SECRET
) {
  return Boolean(clientId?.trim() && clientSecret?.trim());
}

export function googleAuthUrl(clientId: string, state: string) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", GOOGLE_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_CALENDAR_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return url.toString();
}

export function writeCalendarId(stored: string | null | undefined) {
  const value = stored?.trim();
  return value || DEFAULT_GOOGLE_CALENDAR_ID;
}

export function calendarsToRead(connection: GoogleConnection): CalendarToRead[] {
  const calendars: CalendarToRead[] = [
    { id: writeCalendarId(connection.calendarId), label: "Work" },
  ];
  const family = connection.familyCalendarId?.trim();
  if (family && family !== calendars[0].id) {
    calendars.push({ id: family, label: "Family" });
  }
  return calendars;
}

export function refreshTokenFromTokenResponse(body: unknown) {
  return stringField(body, "refresh_token", 20, 2048);
}

export function accessTokenFromTokenResponse(body: unknown) {
  return stringField(body, "access_token", 20, 4096);
}

export function eventIdFromInsertResponse(body: unknown) {
  return stringField(body, "id", 1, 1024);
}

export function eventsFromListResponse(body: unknown): {
  events: GoogleApiEvent[];
  nextPageToken: string | null;
} {
  if (!body || typeof body !== "object") {
    return { events: [], nextPageToken: null };
  }
  const record = body as { items?: unknown; nextPageToken?: unknown };
  const events = Array.isArray(record.items)
    ? record.items.filter(isGoogleApiEvent)
    : [];
  const nextPageToken =
    typeof record.nextPageToken === "string" && record.nextPageToken.trim()
      ? record.nextPageToken.trim()
      : null;
  return { events, nextPageToken };
}

export function googleDeleteSucceeded(status: number) {
  return status === 200 || status === 204 || status === 404 || status === 410;
}

export function googleEventBody(appointment: OfficeAppointment) {
  const summary = appointment.title.trim() || "(No title)";
  const body: {
    summary: string;
    location?: string;
    description?: string;
    start: { date?: string; dateTime?: string; timeZone?: string };
    end: { date?: string; dateTime?: string; timeZone?: string };
  } = {
    summary,
    start: {},
    end: {},
  };
  const location = appointment.location?.trim();
  const notes = appointment.notes?.trim();
  if (location) body.location = location;
  if (notes) body.description = notes;

  const startDate = appointment.start_date;
  const endDate =
    appointment.end_date && appointment.end_date >= startDate
      ? appointment.end_date
      : startDate;

  if (appointment.all_day || !appointment.start_time) {
    body.start = { date: startDate };
    body.end = { date: addDays(endDate, 1) };
    return body;
  }

  const startTime = clock(appointment.start_time);
  let endClock = appointment.end_time ? clock(appointment.end_time) : null;
  let timedEndDate = endDate;
  if (!endClock) {
    const plus = plusOneHour(startDate, startTime);
    timedEndDate = plus.date;
    endClock = plus.time;
  } else if (timedEndDate === startDate && endClock <= startTime) {
    timedEndDate = addDays(startDate, 1);
  }

  body.start = {
    dateTime: `${startDate}T${startTime}`,
    timeZone: LONDON,
  };
  body.end = {
    dateTime: `${timedEndDate}T${endClock}`,
    timeZone: LONDON,
  };
  return body;
}

export function mapGoogleApiEvent(
  event: GoogleApiEvent,
  calendarId: string,
  label: "Work" | "Family"
): MirroredEvent | null {
  const id = event.id?.trim();
  if (!id || !calendarId.trim()) return null;
  const cancelled = (event.status ?? "").trim().toLowerCase() === "cancelled";
  const googleLabel = label === "Family" ? "Google Family" : "Google";
  const title = event.summary?.trim() || "(No title)";
  const location = event.location?.trim() || null;
  const placed = event.start ? placeEvent(event) : null;

  if (!placed) {
    if (!cancelled) return null;
    return {
      google_event_id: id,
      google_calendar_id: calendarId,
      title,
      location,
      start_date: "1970-01-01",
      end_date: "1970-01-01",
      start_time: null,
      end_time: null,
      all_day: true,
      event_type: "Other",
      google_label: googleLabel,
      cancelled: true,
    };
  }

  return {
    google_event_id: id,
    google_calendar_id: calendarId,
    title,
    location,
    event_type: "Other",
    google_label: googleLabel,
    cancelled,
    ...placed,
  };
}

export function planGoogleSync(
  incoming: MirroredEvent[],
  existing: StoredGoogleRow[]
): SyncPlan {
  const byKey = new Map<string, StoredGoogleRow>();
  for (const row of existing) {
    if (!row.google_calendar_id || !row.google_event_id) continue;
    byKey.set(syncKey(row.google_calendar_id, row.google_event_id), row);
  }

  const seen = new Set<string>();
  const inserts: MirroredEvent[] = [];
  const updates: SyncPlan["updates"] = [];
  const removals: SyncPlan["removals"] = [];

  for (const event of incoming) {
    const key = syncKey(event.google_calendar_id, event.google_event_id);
    if (seen.has(key)) continue;
    seen.add(key);
    const row = byKey.get(key);

    if (event.cancelled) {
      if (!row) continue;
      removals.push({
        id: row.id,
        action: row.job_id || row.contract_id ? "cancel" : "delete",
      });
      continue;
    }

    if (!row) {
      inserts.push(event);
      continue;
    }

    const patch: SyncPlan["updates"][number]["patch"] = {
      title: event.title,
      location: event.location,
      start_date: event.start_date,
      end_date: event.end_date,
      start_time: event.start_time,
      end_time: event.end_time,
      all_day: event.all_day,
    };
    if (row.event_type === "Google" || row.event_type === "Google Family") {
      patch.event_type = "Other";
    }
    updates.push({ id: row.id, patch });
  }

  return { inserts, updates, removals };
}

export function googleDisplayLabel(
  event: {
    source?: "office" | "google" | null;
    event_type?: string | null;
    google_label?: "Google" | "Google Family" | null;
    google_event_id?: string | null;
    google_calendar_id?: string | null;
    job_id?: string | null;
    client_id?: string | null;
    contract_id?: string | null;
  },
  familyCalendarId: string | null
): "Google" | "Google Family" | null {
  if (event.source === "google") {
    if (event.google_label === "Google" || event.google_label === "Google Family") {
      return event.google_label;
    }
    if (event.event_type === "Google" || event.event_type === "Google Family") {
      return event.event_type;
    }
    return null;
  }

  const googleEventId = event.google_event_id?.trim() ?? "";
  if (!googleEventId) return null;
  if (event.job_id || event.client_id || event.contract_id) return null;

  const type = event.event_type ?? "";
  if (type !== "Other" && type !== "Google" && type !== "Google Family") return null;

  const familyId = familyCalendarId?.trim() ?? "";
  const calendarId = event.google_calendar_id?.trim() ?? "";
  if (familyId && calendarId === familyId) return "Google Family";
  return "Google";
}

export function hideIcalDuplicate(
  event: {
    google_label?: "Google" | "Google Family" | null;
    event_type?: string | null;
  },
  sync: { workSynced: boolean; familySynced: boolean }
) {
  const label = googleDisplayLabel(
    {
      source: "google",
      event_type: event.event_type,
      google_label: event.google_label,
    },
    null
  );
  if (label === "Google") return sync.workSynced;
  if (label === "Google Family") return sync.familySynced;
  return false;
}

export function londonRangeBounds(monthStart: string, monthEnd: string) {
  const [startYear, startMonth, startDay] = monthStart.split("-").map(Number);
  const exclusive = addDays(monthEnd, 1);
  const [endYear, endMonth, endDay] = exclusive.split("-").map(Number);
  return {
    timeMin: zonedWallToUtc(startYear, startMonth, startDay, 0, 0, 0, LONDON).toISOString(),
    timeMax: zonedWallToUtc(endYear, endMonth, endDay, 0, 0, 0, LONDON).toISOString(),
  };
}

export function localGoogleEffect(row: {
  job_id: string | null;
  contract_id: string | null;
}): "cancel" | "delete" {
  return row.job_id || row.contract_id ? "cancel" : "delete";
}

function placeEvent(event: GoogleApiEvent): Omit<
  MirroredEvent,
  | "google_event_id"
  | "google_calendar_id"
  | "title"
  | "location"
  | "event_type"
  | "google_label"
  | "cancelled"
> | null {
  const startDate = dateOnly(event.start?.date);
  if (startDate) {
    const exclusiveEnd = dateOnly(event.end?.date);
    const endDate =
      exclusiveEnd && exclusiveEnd > startDate ? addDays(exclusiveEnd, -1) : startDate;
    return {
      start_date: startDate,
      end_date: endDate < startDate ? startDate : endDate,
      start_time: null,
      end_time: null,
      all_day: true,
    };
  }

  const startInstant = event.start?.dateTime
    ? parseGoogleDateTime(event.start.dateTime, event.start.timeZone)
    : null;
  if (!startInstant) return null;
  const endInstant = event.end?.dateTime
    ? parseGoogleDateTime(event.end.dateTime, event.end.timeZone)
    : startInstant;
  if (!endInstant || endInstant.getTime() < startInstant.getTime()) return null;

  const startParts = londonParts(startInstant);
  const endParts = londonParts(endInstant);
  let endDate = endParts.date;
  let endTime: string | null = endParts.time;
  if (endInstant.getTime() > startInstant.getTime() && endParts.time === "00:00:00") {
    const previous = addDays(endDate, -1);
    if (previous >= startParts.date) {
      endDate = previous;
      endTime = null;
    }
  }
  if (endDate < startParts.date) endDate = startParts.date;
  return {
    start_date: startParts.date,
    end_date: endDate,
    start_time: startParts.time,
    end_time: endTime,
    all_day: false,
  };
}

function parseGoogleDateTime(value: string, timeZone: string | undefined) {
  const raw = value.trim();
  if (!raw) return null;
  if (/[zZ]$/.test(raw) || /[+-]\d{2}:\d{2}$/.test(raw)) {
    const instant = new Date(raw);
    return Number.isNaN(instant.getTime()) ? null : instant;
  }
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  try {
    return zonedWallToUtc(
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6] || 0),
      timeZone || LONDON
    );
  } catch {
    return null;
  }
}

function isGoogleApiEvent(value: unknown): value is GoogleApiEvent {
  return Boolean(value) && typeof value === "object";
}

function stringField(body: unknown, key: string, min: number, max: number) {
  if (!body || typeof body !== "object") return null;
  const value = (body as Record<string, unknown>)[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) return null;
  return trimmed;
}

function syncKey(calendarId: string, eventId: string) {
  return `${calendarId}\n${eventId}`;
}

function dateOnly(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

function clock(value: string) {
  const match = value.trim().match(/^(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return "09:00:00";
  return `${match[1]}:${match[2]}:${match[3] || "00"}`;
}

function plusOneHour(date: string, time: string) {
  const [hour, minute, second] = time.split(":").map(Number);
  const total = hour * 60 + minute + 60;
  if (total < 24 * 60) {
    return {
      date,
      time: `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}:${String(second || 0).padStart(2, "0")}`,
    };
  }
  const overflow = total - 24 * 60;
  return {
    date: addDays(date, 1),
    time: `${String(Math.floor(overflow / 60)).padStart(2, "0")}:${String(overflow % 60).padStart(2, "0")}:${String(second || 0).padStart(2, "0")}`,
  };
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function londonParts(instant: Date) {
  const parts = partsInZone(instant, LONDON);
  return {
    date: iso(parts.year, parts.month, parts.day),
    time: `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}:${String(parts.second).padStart(2, "0")}`,
  };
}

function zonedWallToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const firstOffset = timeZoneOffsetMs(new Date(utcGuess), timeZone);
  let utc = utcGuess - firstOffset;
  const secondOffset = timeZoneOffsetMs(new Date(utc), timeZone);
  if (secondOffset !== firstOffset) utc = utcGuess - secondOffset;
  return new Date(utc);
}

function timeZoneOffsetMs(instant: Date, timeZone: string) {
  const parts = partsInZone(instant, timeZone);
  return (
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) -
    instant.getTime()
  );
}

function partsInZone(instant: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  let year = Number(map.year);
  let month = Number(map.month);
  let day = Number(map.day);
  let hour = Number(map.hour);
  if (hour === 24) {
    hour = 0;
    const next = addDays(iso(year, month, day), 1);
    year = Number(next.slice(0, 4));
    month = Number(next.slice(5, 7));
    day = Number(next.slice(8, 10));
  }
  return {
    year,
    month,
    day,
    hour,
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function iso(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
