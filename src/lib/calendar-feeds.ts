import { createAdminClient } from "@/lib/supabase/admin";
import {
  eventsFromIcs,
  isAllowedCalendarUrl,
  type GoogleScheduleEvent,
} from "@/lib/google-calendar";

const MAX_BYTES = 2_000_000;

type FeedLabel = "Work" | "Family";

export async function loadGoogleScheduleEvents(
  monthStart: string,
  monthEnd: string
): Promise<{ events: GoogleScheduleEvent[]; warning: boolean }> {
  try {
    const urls = await readFeedUrls();
    const tasks: Array<Promise<{ events: GoogleScheduleEvent[]; failed: boolean }>> = [];

    if (urls.work) tasks.push(readFeed(urls.work, "Work", monthStart, monthEnd));
    if (urls.family) tasks.push(readFeed(urls.family, "Family", monthStart, monthEnd));
    if (tasks.length === 0) return { events: [], warning: false };

    const results = await Promise.all(tasks);
    const events = results
      .flatMap((result) => result.events)
      .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));

    return {
      events,
      warning: results.some((result) => result.failed),
    };
  } catch {
    console.error("Google calendar feed could not be read");
    return { events: [], warning: false };
  }
}

async function readFeedUrls(): Promise<{ work: string | null; family: string | null }> {
  const envWork = cleanUrl(process.env.GOOGLE_CALENDAR_ICS_URL);
  const envFamily = cleanUrl(process.env.GOOGLE_FAMILY_CALENDAR_ICS_URL);

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("office_calendar_feeds")
      .select("work_ics_url, family_ics_url")
      .eq("id", 1)
      .maybeSingle();

    if (error || !data) {
      return { work: envWork, family: envFamily };
    }

    return {
      work: cleanUrl(data.work_ics_url) || envWork,
      family: cleanUrl(data.family_ics_url) || envFamily,
    };
  } catch {
    return { work: envWork, family: envFamily };
  }
}

function cleanUrl(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || !isAllowedCalendarUrl(trimmed)) return null;
  return trimmed;
}

async function readFeed(
  url: string,
  label: FeedLabel,
  monthStart: string,
  monthEnd: string
) {
  try {
    const ics = await fetchIcs(url);
    if (!ics.includes("BEGIN:VCALENDAR")) {
      return { events: [], failed: true };
    }
    return {
      events: eventsFromIcs(ics, { start: monthStart, end: monthEnd }, label),
      failed: false,
    };
  } catch {
    console.error("Google calendar feed could not be read");
    return { events: [], failed: true };
  }
}

async function fetchIcs(url: string) {
  const first = await fetch(url, {
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(8000),
    headers: {
      Accept: "text/calendar, text/plain;q=0.9,*/*;q=0.1",
    },
  });

  let response = first;
  if (first.status >= 300 && first.status < 400) {
    const location = first.headers.get("location");
    if (!location) throw new Error("redirect");
    const nextUrl = new URL(location, url).toString();
    if (!isAllowedCalendarUrl(nextUrl)) throw new Error("redirect");
    response = await fetch(nextUrl, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8000),
      headers: {
        Accept: "text/calendar, text/plain;q=0.9,*/*;q=0.1",
      },
    });
  }

  if (!response.ok) throw new Error("status");
  return readLimitedText(response);
}

async function readLimitedText(response: Response) {
  if (!response.body) {
    const text = await response.text();
    if (text.length > MAX_BYTES) throw new Error("large");
    return text;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new Error("large");
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}
