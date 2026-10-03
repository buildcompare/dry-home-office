import { dateDifferenceInDays } from "@/lib/dates";

export type GoogleScheduleEvent = {
  id: string;
  title: string;
  event_type: "Google" | "Google Family";
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  all_day: boolean;
  location: string | null;
  source: "google";
  clients: null;
  jobs: null;
};

type Range = {
  start: string;
  end: string;
};

type ContentLine = {
  name: string;
  params: Record<string, string>;
  value: string;
};

type Stamp =
  | { kind: "date"; date: string }
  | { kind: "instant"; instant: Date };

type StartPoint = {
  allDay: boolean;
  date: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  zone: string;
};

type DaySpec = {
  ord: number | null;
  weekday: number;
};

type RRule = {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  count?: number;
  until?: Stamp;
  byDay?: DaySpec[];
  byMonth?: number[];
  byMonthDay?: number[];
  wkst: number;
};

type ParsedEvent = {
  uid: string;
  summary: string;
  location: string | null;
  cancelled: boolean;
  start: StartPoint;
  spanDays: number;
  durationMs: number;
  rrule: RRule | null;
  unsupportedRule: boolean;
  exdates: Set<string>;
  rdates: string[];
  recurrenceId: string | null;
};

const LONDON = "Europe/London";
const WEEKDAYS: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

const MAX_STEPS = 20000;
const MAX_EVENTS = 500;

export function isAllowedCalendarUrl(value: string): boolean {
  if (value.length === 0 || value.length > 2000 || /\s/.test(value)) {
    return false;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  if (url.hostname !== "calendar.google.com") return false;
  if (!url.pathname.startsWith("/calendar/ical/")) return false;
  if (!url.pathname.endsWith(".ics")) return false;
  return true;
}

export function eventsFromIcs(
  ics: string,
  range: Range,
  label: "Work" | "Family"
): GoogleScheduleEvent[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(range.start) || !/^\d{4}-\d{2}-\d{2}$/.test(range.end)) {
    return [];
  }

  let parsed: ParsedEvent[];
  try {
    parsed = parseEvents(ics);
  } catch {
    return [];
  }

  const groups = new Map<string, { master?: ParsedEvent; overrides: ParsedEvent[] }>();
  parsed.forEach((event, index) => {
    const uid = event.uid || `event-${index}`;
    const group = groups.get(uid) ?? { overrides: [] };
    if (event.recurrenceId) {
      group.overrides.push(event);
    } else if (!group.master || event.rrule) {
      group.master = event;
    }
    groups.set(uid, group);
  });

  const results: GoogleScheduleEvent[] = [];

  for (const [uid, group] of groups) {
    try {
      const master = group.master;
      if (master?.cancelled) continue;

      const excluded = new Set(master?.exdates ?? []);
      for (const override of group.overrides) {
        if (override.recurrenceId) excluded.add(override.recurrenceId);
      }

      if (master && !master.unsupportedRule) {
        for (const occurrence of expandMaster(master, range, excluded)) {
          pushEvent(results, occurrence, uid, label, master.summary, master.location);
          if (results.length >= MAX_EVENTS) return results;
        }
      }

      for (const override of group.overrides) {
        if (override.cancelled || override.unsupportedRule) continue;
        const occurrence = singleOccurrence(override);
        if (!occurrence || !overlaps(occurrence.start_date, occurrence.end_date, range)) continue;
        pushEvent(results, occurrence, `${uid}-moved`, label, override.summary, override.location);
        if (results.length >= MAX_EVENTS) return results;
      }
    } catch {
      continue;
    }
  }

  results.sort((a, b) => {
    const date = a.start_date.localeCompare(b.start_date);
    if (date !== 0) return date;
    return (a.start_time ?? "").localeCompare(b.start_time ?? "");
  });

  return results;
}

function pushEvent(
  results: GoogleScheduleEvent[],
  occurrence: Occurrence,
  uid: string,
  label: "Work" | "Family",
  summary: string,
  location: string | null
) {
  const title = summary.trim() || "(No title)";
  results.push({
    id: safeId(`gcal-${label}-${uid}-${occurrence.key}`),
    title,
    event_type: label === "Family" ? "Google Family" : "Google",
    start_date: occurrence.start_date,
    end_date: occurrence.end_date,
    start_time: occurrence.start_time,
    end_time: occurrence.end_time,
    all_day: occurrence.all_day,
    location,
    source: "google",
    clients: null,
    jobs: null,
  });
}

type Occurrence = {
  key: string;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  all_day: boolean;
};

function expandMaster(
  event: ParsedEvent,
  range: Range,
  excluded: Set<string>
): Occurrence[] {
  if (!event.rrule && event.rdates.length === 0) {
    const only = singleOccurrence(event);
    if (!only || excluded.has(only.key)) return [];
    if (!overlaps(only.start_date, only.end_date, range)) return [];
    return [only];
  }

  const dates = event.rrule
    ? occurrenceDates(event, event.rrule, range)
    : [event.start.date];

  for (const extra of event.rdates) {
    if (!dates.includes(extra)) dates.push(extra);
  }
  dates.sort();

  const occurrences: Occurrence[] = [];
  for (const date of dates) {
    const key = occurrenceKey(event.start, date);
    if (excluded.has(key)) continue;
    const occurrence = occurrenceOn(event, date, key);
    if (!occurrence) continue;
    if (!overlaps(occurrence.start_date, occurrence.end_date, range)) continue;
    occurrences.push(occurrence);
    if (occurrences.length >= MAX_EVENTS) break;
  }
  return occurrences;
}

function singleOccurrence(event: ParsedEvent): Occurrence | null {
  const key = occurrenceKey(event.start, event.start.date);
  return occurrenceOn(event, event.start.date, key);
}

function occurrenceOn(event: ParsedEvent, date: string, key: string): Occurrence | null {
  if (event.start.allDay) {
    const end = addDays(date, Math.max(event.spanDays, 1) - 1);
    return {
      key,
      start_date: date,
      end_date: end < date ? date : end,
      start_time: null,
      end_time: null,
      all_day: true,
    };
  }

  const startInstant = instantOnDate(date, event.start);
  const endInstant = new Date(startInstant.getTime() + Math.max(event.durationMs, 0));
  const display = displayFromInstants(startInstant, endInstant);
  if (!display) return null;
  return { key, ...display };
}

function occurrenceDates(event: ParsedEvent, rule: RRule, range: Range): string[] {
  const dates: string[] = [];
  const earliest = addDays(range.start, -(Math.max(event.spanDays, 1) - 1));
  let produced = 0;
  const limit = rule.count ?? Number.POSITIVE_INFINITY;

  const accept = (date: string) => {
    if (date < event.start.date) return false;
    if (afterUntil(event.start, rule, date)) return "stop" as const;
    if (!matchesFilters(date, rule, event.start)) return false;
    produced += 1;
    if (produced > limit) return "stop" as const;
    dates.push(date);
    return date > range.end ? ("stop" as const) : false;
  };

  if (rule.freq === "DAILY") {
    const startN =
      rule.count === undefined && !hasFilters(rule)
        ? firstStep(event.start.date, rule.interval, earliest)
        : 0;
    produced = startN;
    if (produced >= limit) return dates;
    for (let step = startN; step < startN + MAX_STEPS; step += 1) {
      const date = addDays(event.start.date, step * rule.interval);
      if (date > range.end && dates.length > 0 && date > addDays(range.end, event.spanDays)) break;
      const result = accept(date);
      if (result === "stop") break;
    }
  } else if (rule.freq === "WEEKLY") {
    const weekdays = (rule.byDay ?? [{ ord: null, weekday: utcWeekday(event.start.date) }])
      .map((day) => day.weekday);
    const uniqueDays = [...new Set(weekdays)].sort(
      (a, b) => ((a - rule.wkst + 7) % 7) - ((b - rule.wkst + 7) % 7)
    );
    const firstWeek = weekStart(event.start.date, rule.wkst);
    for (let week = 0; week < MAX_STEPS; week += rule.interval) {
      const startOfWeek = addDays(firstWeek, week * 7);
      if (startOfWeek > addDays(range.end, 7)) break;
      let stop = false;
      for (const weekday of uniqueDays) {
        const date = addDays(startOfWeek, (weekday - rule.wkst + 7) % 7);
        const result = accept(date);
        if (result === "stop") {
          stop = true;
          break;
        }
      }
      if (stop) break;
    }
  } else if (rule.freq === "MONTHLY") {
    const startIndex = event.start.year * 12 + (event.start.month - 1);
    for (let step = 0; step < MAX_STEPS; step += 1) {
      const index = startIndex + step * rule.interval;
      const year = Math.floor(index / 12);
      const month = (index % 12) + 1;
      if (iso(year, month, 1) > addDays(range.end, 32)) break;
      let stop = false;
      for (const date of datesInMonth(year, month, rule, event.start)) {
        const result = accept(date);
        if (result === "stop") {
          stop = true;
          break;
        }
      }
      if (stop) break;
    }
  } else {
    for (let step = 0; step < MAX_STEPS; step += 1) {
      const year = event.start.year + step * rule.interval;
      if (year > Number(range.end.slice(0, 4)) + 1) break;
      const months = rule.byMonth ?? [event.start.month];
      let stop = false;
      for (const month of [...months].sort((a, b) => a - b)) {
        const monthDates = rule.byDay
          ? datesInMonth(year, month, rule, event.start)
          : monthDays(year, month, rule.byMonthDay ?? [event.start.day]);
        for (const date of monthDates) {
          const result = accept(date);
          if (result === "stop") {
            stop = true;
            break;
          }
        }
        if (stop) break;
      }
      if (stop) break;
    }
  }

  return dates;
}

function hasFilters(rule: RRule) {
  return Boolean(rule.byDay || rule.byMonth || rule.byMonthDay);
}

function matchesFilters(date: string, rule: RRule, start: StartPoint) {
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  if (rule.freq === "DAILY" || rule.freq === "WEEKLY") {
    if (rule.byMonth && !rule.byMonth.includes(month)) return false;
    if (rule.byMonthDay && !rule.byMonthDay.includes(day) && !rule.byMonthDay.includes(day - daysInMonth(Number(date.slice(0, 4)), month) - 1)) {
      return false;
    }
  }
  if (rule.freq === "DAILY" && rule.byDay) {
    return rule.byDay.some((spec) => spec.weekday === utcWeekday(date));
  }
  if (rule.freq !== "MONTHLY" && rule.freq !== "YEARLY") return true;
  return date >= start.date;
}

function datesInMonth(year: number, month: number, rule: RRule, start: StartPoint) {
  if (rule.byMonth && !rule.byMonth.includes(month)) return [];
  if (rule.byDay && rule.byDay.length > 0) {
    const dates: string[] = [];
    for (const spec of rule.byDay) {
      if (spec.ord === null) {
        const dim = daysInMonth(year, month);
        for (let day = 1; day <= dim; day += 1) {
          const date = iso(year, month, day);
          if (utcWeekday(date) === spec.weekday) dates.push(date);
        }
      } else {
        const date = nthWeekday(year, month, spec.ord, spec.weekday);
        if (date) dates.push(date);
      }
    }
    return [...new Set(dates)].sort();
  }
  return monthDays(year, month, rule.byMonthDay ?? [start.day]);
}

function monthDays(year: number, month: number, monthDaysList: number[]) {
  const dim = daysInMonth(year, month);
  const dates: string[] = [];
  for (const value of monthDaysList) {
    if (value > 0 && value <= dim) dates.push(iso(year, month, value));
    if (value < 0) {
      const day = dim + value + 1;
      if (day >= 1 && day <= dim) dates.push(iso(year, month, day));
    }
  }
  return [...new Set(dates)].sort();
}

function afterUntil(start: StartPoint, rule: RRule, date: string) {
  if (!rule.until) return false;
  if (start.allDay || rule.until.kind === "date") {
    const untilDate = rule.until.kind === "date" ? rule.until.date : utcDate(rule.until.instant);
    return date > untilDate;
  }
  return instantOnDate(date, start).getTime() > rule.until.instant.getTime();
}

function firstStep(startDate: string, interval: number, earliest: string) {
  if (earliest <= startDate) return 0;
  return Math.floor(dateDifferenceInDays(startDate, earliest) / interval);
}

function occurrenceKey(start: StartPoint, date: string) {
  if (start.allDay) return `d:${date}`;
  return `t:${instantOnDate(date, start).getTime()}`;
}

function instantOnDate(date: string, start: StartPoint) {
  const [year, month, day] = date.split("-").map(Number);
  if (start.zone === "UTC") {
    return new Date(Date.UTC(year, month - 1, day, start.hour, start.minute, start.second));
  }
  return zonedWallToUtc(year, month, day, start.hour, start.minute, start.second, start.zone);
}

function displayFromInstants(start: Date, end: Date): Omit<Occurrence, "key"> | null {
  if (end.getTime() < start.getTime()) return null;
  const startParts = londonParts(start);
  const endParts = londonParts(end);
  let endDate = endParts.date;
  let endTime: string | null = endParts.time;
  if (end.getTime() > start.getTime() && endParts.time === "00:00") {
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

function parseEvents(ics: string): ParsedEvent[] {
  const lines = unfold(ics).split("\n");
  const events: ParsedEvent[] = [];
  let depth = 0;
  let current: ContentLine[] | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const upper = line.toUpperCase();
    if (upper === "BEGIN:VEVENT") {
      depth += 1;
      if (depth === 1) current = [];
      continue;
    }
    if (upper.startsWith("BEGIN:")) {
      if (depth > 0) depth += 1;
      continue;
    }
    if (upper.startsWith("END:")) {
      if (depth > 0) {
        depth -= 1;
        if (depth === 0 && current) {
          const parsed = buildEvent(current);
          if (parsed) events.push(parsed);
          current = null;
        }
      }
      continue;
    }
    if (current && depth === 1) {
      const content = parseContentLine(line);
      if (content) current.push(content);
    }
  }

  return events;
}

function buildEvent(lines: ContentLine[]): ParsedEvent | null {
  const startLine = lines.find((line) => line.name === "DTSTART");
  if (!startLine) return null;
  const start = parseStart(startLine);
  if (!start) return null;

  const endLine = lines.find((line) => line.name === "DTEND");
  const durationLine = lines.find((line) => line.name === "DURATION");
  const endStamp = endLine ? parseStamp(endLine.value.trim(), endLine.params) : null;
  const duration = durationLine?.value.trim() || null;
  const span = resolveSpan(start, endStamp, duration);
  if (!span) return null;

  const ruleLine = lines.find((line) => line.name === "RRULE");
  let rrule: RRule | null = null;
  let unsupportedRule = false;
  if (ruleLine) {
    const parsedRule = parseRrule(ruleLine.value.trim());
    if (parsedRule === "unsupported") unsupportedRule = true;
    else rrule = parsedRule;
  }
  if (lines.filter((line) => line.name === "RRULE").length > 1) {
    unsupportedRule = true;
    rrule = null;
  }

  const summary = unescapeText(lines.find((line) => line.name === "SUMMARY")?.value ?? "");
  const locationValue = lines.find((line) => line.name === "LOCATION")?.value;
  const location = locationValue ? unescapeText(locationValue).trim() || null : null;
  const status = (lines.find((line) => line.name === "STATUS")?.value ?? "").trim().toUpperCase();
  const uid = (lines.find((line) => line.name === "UID")?.value ?? "").trim();
  const recurrenceLine = lines.find((line) => line.name === "RECURRENCE-ID");
  const recurrenceStamp = recurrenceLine
    ? parseStamp(recurrenceLine.value.trim(), recurrenceLine.params)
    : null;

  const exdates = new Set<string>();
  for (const line of lines.filter((item) => item.name === "EXDATE")) {
    for (const piece of splitList(line.value)) {
      const stamp = parseStamp(piece, line.params);
      const key = stamp ? exclusionKey(start, stamp) : null;
      if (key) exdates.add(key);
    }
  }

  const rdates: string[] = [];
  for (const line of lines.filter((item) => item.name === "RDATE")) {
    for (const piece of splitList(line.value)) {
      if (piece.includes("/")) continue;
      const stamp = parseStamp(piece, line.params);
      const date = stamp ? stampDate(start, stamp) : null;
      if (date) rdates.push(date);
    }
  }

  return {
    uid,
    summary,
    location,
    cancelled: status === "CANCELLED",
    start,
    spanDays: span.spanDays,
    durationMs: span.durationMs,
    rrule,
    unsupportedRule,
    exdates,
    rdates,
    recurrenceId: recurrenceStamp ? exclusionKey(start, recurrenceStamp) : null,
  };
}

function resolveSpan(
  start: StartPoint,
  endStamp: Stamp | null,
  duration: string | null
): { spanDays: number; durationMs: number } | null {
  if (start.allDay) {
    if (endStamp?.kind === "date") {
      const inclusive = addDays(endStamp.date, -1);
      const spanDays = Math.max(1, dateDifferenceInDays(start.date, inclusive) + 1);
      return { spanDays, durationMs: 0 };
    }
    if (endStamp?.kind === "instant") {
      const parts = londonParts(endStamp.instant);
      const inclusive = parts.time === "00:00" ? addDays(parts.date, -1) : parts.date;
      const spanDays = Math.max(1, dateDifferenceInDays(start.date, inclusive) + 1);
      return { spanDays, durationMs: 0 };
    }
    const days = duration ? wholeDays(duration) : 1;
    if (!days) return { spanDays: 1, durationMs: 0 };
    return { spanDays: days, durationMs: 0 };
  }

  const startInstant = instantOnDate(start.date, start);
  let endInstant: Date | null = null;
  if (endStamp?.kind === "instant") endInstant = endStamp.instant;
  else if (endStamp?.kind === "date") endInstant = londonMidnight(endStamp.date);
  else if (duration) {
    const ms = durationToMs(duration);
    if (ms === null) return null;
    endInstant = new Date(startInstant.getTime() + ms);
  } else {
    endInstant = startInstant;
  }

  if (endInstant.getTime() < startInstant.getTime()) return null;
  const display = displayFromInstants(startInstant, endInstant);
  if (!display) return null;
  return {
    spanDays: dateDifferenceInDays(display.start_date, display.end_date) + 1,
    durationMs: endInstant.getTime() - startInstant.getTime(),
  };
}

function parseRrule(value: string): RRule | "unsupported" | null {
  const parts = value.split(";").filter(Boolean);
  const map = new Map<string, string>();
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq < 0) return "unsupported";
    map.set(part.slice(0, eq).toUpperCase(), part.slice(eq + 1));
  }

  const known = new Set([
    "FREQ",
    "INTERVAL",
    "COUNT",
    "UNTIL",
    "BYDAY",
    "BYMONTH",
    "BYMONTHDAY",
    "WKST",
  ]);
  for (const key of map.keys()) {
    if (!known.has(key)) return "unsupported";
  }

  const freq = map.get("FREQ");
  if (freq !== "DAILY" && freq !== "WEEKLY" && freq !== "MONTHLY" && freq !== "YEARLY") {
    return "unsupported";
  }

  const interval = map.has("INTERVAL") ? Number(map.get("INTERVAL")) : 1;
  if (!Number.isInteger(interval) || interval < 1 || interval > 400) return "unsupported";

  let count: number | undefined;
  if (map.has("COUNT")) {
    count = Number(map.get("COUNT"));
    if (!Number.isInteger(count) || count < 1) return "unsupported";
  }

  let until: Stamp | undefined;
  if (map.has("UNTIL")) {
    const parsedUntil = parseUntil(map.get("UNTIL") ?? "");
    if (!parsedUntil) return "unsupported";
    until = parsedUntil;
  }

  let byDay: DaySpec[] | undefined;
  if (map.has("BYDAY")) {
    byDay = [];
    for (const piece of (map.get("BYDAY") ?? "").split(",")) {
      const match = piece.trim().toUpperCase().match(/^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/);
      if (!match) return "unsupported";
      const ord = match[1] ? Number(match[1]) : null;
      if (ord !== null && (ord === 0 || ord > 5 || ord < -5)) return "unsupported";
      byDay.push({ ord, weekday: WEEKDAYS[match[2]] });
    }
  }

  if (freq === "WEEKLY" && byDay?.some((day) => day.ord !== null)) return "unsupported";
  if (freq === "DAILY" && byDay && interval !== 1) return "unsupported";
  if ((freq === "MONTHLY" || freq === "YEARLY") && byDay && map.has("BYMONTHDAY")) {
    return "unsupported";
  }
  if (freq === "YEARLY" && byDay && !map.has("BYMONTH")) return "unsupported";

  let byMonth: number[] | undefined;
  if (map.has("BYMONTH")) {
    byMonth = (map.get("BYMONTH") ?? "").split(",").map(Number);
    if (byMonth.some((month) => !Number.isInteger(month) || month < 1 || month > 12)) {
      return "unsupported";
    }
  }

  let byMonthDay: number[] | undefined;
  if (map.has("BYMONTHDAY")) {
    byMonthDay = (map.get("BYMONTHDAY") ?? "").split(",").map(Number);
    if (byMonthDay.some((day) => !Number.isInteger(day) || day === 0 || day < -31 || day > 31)) {
      return "unsupported";
    }
  }

  const wkstToken = (map.get("WKST") ?? "MO").toUpperCase();
  if (!WEEKDAYS[wkstToken] && wkstToken !== "SU") return "unsupported";
  const wkst = WEEKDAYS[wkstToken];
  if (wkst === undefined) return "unsupported";

  return { freq, interval, count, until, byDay, byMonth, byMonthDay, wkst };
}

function parseUntil(value: string): Stamp | null {
  if (/^\d{8}$/.test(value)) {
    const date = isoFromBasic(value);
    return date ? { kind: "date", date } : null;
  }
  return parseStamp(value, {});
}

function parseStart(line: ContentLine): StartPoint | null {
  const stamp = parseStamp(line.value.trim(), line.params);
  if (!stamp) return null;
  if (stamp.kind === "date") {
    const [year, month, day] = stamp.date.split("-").map(Number);
    return {
      allDay: true,
      date: stamp.date,
      year,
      month,
      day,
      hour: 0,
      minute: 0,
      second: 0,
      zone: LONDON,
    };
  }

  const value = line.value.trim();
  const match = value.match(/^(\d{8})T(\d{4,6})(Z)?$/i);
  if (!match) return null;
  const date = isoFromBasic(match[1]);
  if (!date) return null;
  const time = match[2].padEnd(6, "0");
  const zone = match[3] || isUtcZone(line.params.TZID) ? "UTC" : line.params.TZID || LONDON;
  const [year, month, day] = date.split("-").map(Number);
  return {
    allDay: false,
    date,
    year,
    month,
    day,
    hour: Number(time.slice(0, 2)),
    minute: Number(time.slice(2, 4)),
    second: Number(time.slice(4, 6)),
    zone,
  };
}

function parseStamp(value: string, params: Record<string, string>): Stamp | null {
  const raw = value.trim();
  if (!raw) return null;
  const valueType = (params.VALUE || "").toUpperCase();
  if (valueType === "DATE" || /^\d{8}$/.test(raw)) {
    const date = isoFromBasic(raw.slice(0, 8));
    return date ? { kind: "date", date } : null;
  }

  const match = raw.match(/^(\d{8})T(\d{4,6})(Z)?$/i);
  if (!match) return null;
  const date = isoFromBasic(match[1]);
  if (!date) return null;
  const time = match[2].padEnd(6, "0");
  const hour = Number(time.slice(0, 2));
  const minute = Number(time.slice(2, 4));
  const second = Number(time.slice(4, 6));
  if (hour > 23 || minute > 59 || second > 59) return null;
  const [year, month, day] = date.split("-").map(Number);
  const zone = match[3] || isUtcZone(params.TZID) ? "UTC" : params.TZID || LONDON;
  try {
    const instant =
      zone === "UTC"
        ? new Date(Date.UTC(year, month - 1, day, hour, minute, second))
        : zonedWallToUtc(year, month, day, hour, minute, second, zone);
    return { kind: "instant", instant };
  } catch {
    return {
      kind: "instant",
      instant: zonedWallToUtc(year, month, day, hour, minute, second, LONDON),
    };
  }
}

function exclusionKey(start: StartPoint, stamp: Stamp) {
  if (start.allDay) {
    return `d:${stampDate(start, stamp)}`;
  }
  if (stamp.kind === "instant") return `t:${stamp.instant.getTime()}`;
  return `t:${instantOnDate(stamp.date, start).getTime()}`;
}

function stampDate(start: StartPoint, stamp: Stamp) {
  if (stamp.kind === "date") return stamp.date;
  if (start.allDay) return londonParts(stamp.instant).date;
  return londonParts(stamp.instant).date;
}

function unfold(ics: string) {
  return ics
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n[ \t]/g, "");
}

function parseContentLine(line: string): ContentLine | null {
  const colon = valueColon(line);
  if (colon < 0) return null;
  const left = splitSemicolons(line.slice(0, colon));
  const name = left[0]?.toUpperCase();
  if (!name) return null;
  const params: Record<string, string> = {};
  for (const part of left.slice(1)) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    let paramValue = part.slice(eq + 1);
    if (paramValue.startsWith('"') && paramValue.endsWith('"') && paramValue.length >= 2) {
      paramValue = paramValue.slice(1, -1);
    }
    params[part.slice(0, eq).toUpperCase()] = paramValue;
  }
  return { name, params, value: line.slice(colon + 1) };
}

function valueColon(line: string) {
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') quoted = !quoted;
    if (char === ":" && !quoted) return index;
  }
  return -1;
}

function splitSemicolons(value: string) {
  const parts: string[] = [];
  let quoted = false;
  let current = "";
  for (const char of value) {
    if (char === '"') quoted = !quoted;
    if (char === ";" && !quoted) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts;
}

function splitList(value: string) {
  return value
    .split(",")
    .map((piece) => piece.trim())
    .filter(Boolean);
}

function unescapeText(value: string) {
  let text = "";
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === "\\" && index + 1 < value.length) {
      const next = value[index + 1];
      if (next === "n" || next === "N") text += "\n";
      else if (next === "\\") text += "\\";
      else text += next;
      index += 1;
      continue;
    }
    text += value[index];
  }
  return text;
}

function wholeDays(duration: string) {
  const match = duration.trim().toUpperCase().match(/^P(?:(\d+)W)?(?:(\d+)D)?$/);
  if (!match) return null;
  const days = Number(match[1] || 0) * 7 + Number(match[2] || 0);
  return days > 0 ? days : null;
}

function durationToMs(duration: string) {
  const match = duration
    .trim()
    .toUpperCase()
    .match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!match) return null;
  const sign = match[1] === "-" ? -1 : 1;
  const seconds =
    (Number(match[2] || 0) * 7 + Number(match[3] || 0)) * 86400 +
    Number(match[4] || 0) * 3600 +
    Number(match[5] || 0) * 60 +
    Number(match[6] || 0);
  if (seconds === 0) return null;
  return sign * seconds * 1000;
}

function nthWeekday(year: number, month: number, nth: number, weekday: number) {
  const dim = daysInMonth(year, month);
  if (nth > 0) {
    const first = utcWeekday(iso(year, month, 1));
    const day = 1 + ((weekday - first + 7) % 7) + (nth - 1) * 7;
    if (day > dim) return null;
    return iso(year, month, day);
  }
  const lastDow = utcWeekday(iso(year, month, dim));
  const last = dim - ((lastDow - weekday + 7) % 7);
  const day = last + (nth + 1) * 7;
  if (day < 1) return null;
  return iso(year, month, day);
}

function weekStart(date: string, wkst: number) {
  return addDays(date, -((utcWeekday(date) - wkst + 7) % 7));
}

function utcWeekday(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function iso(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isoFromBasic(value: string) {
  if (!/^\d{8}$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return iso(year, month, day);
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function utcDate(instant: Date) {
  return instant.toISOString().slice(0, 10);
}

function overlaps(start: string, end: string, range: Range) {
  return start <= range.end && end >= range.start;
}

function safeId(value: string) {
  return value.replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 180);
}

function isUtcZone(tzid: string | undefined) {
  if (!tzid) return false;
  const zone = tzid.toUpperCase();
  return zone === "UTC" || zone === "GMT" || zone === "ETC/UTC" || zone === "ETC/GMT";
}

function londonMidnight(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return zonedWallToUtc(year, month, day, 0, 0, 0, LONDON);
}

function londonParts(instant: Date) {
  const parts = partsInZone(instant, LONDON);
  return {
    date: iso(parts.year, parts.month, parts.day),
    time: `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`,
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
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - instant.getTime();
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
