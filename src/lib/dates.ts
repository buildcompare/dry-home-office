/** Date helpers – London timezone aware */

export function getLondonDateKey(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

export function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return getLondonDateKey(date);
}

export function getMonthRange(dateKey: string) {
  const [year, month] = dateKey.split("-").map(Number);
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonthStart = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

  return { monthStart, nextMonthStart };
}

export function formatShortDate(value: string | null | undefined): string {
  if (!value) return "Not set";

  const [year, month, day] = value.slice(0, 10).split("-").map(Number);

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatLongDate(value: string | null | undefined): string {
  if (!value) return "Not set";

  const [year, month, day] = value.slice(0, 10).split("-").map(Number);

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatMonthLabel(monthStart: string): string {
  const [year, month] = monthStart.split("-").map(Number);

  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function formatEventTime(
  start: string | null,
  end: string | null
): string {
  if (!start) return "Time not set";

  const startTime = start.slice(0, 5);
  if (!end) return startTime;

  return `${startTime} – ${end.slice(0, 5)}`;
}

export function dateDifferenceInDays(
  from: string,
  to: string
): number {
  const [y1, m1, d1] = from.slice(0, 10).split("-").map(Number);
  const [y2, m2, d2] = to.slice(0, 10).split("-").map(Number);

  const date1 = Date.UTC(y1, m1 - 1, d1);
  const date2 = Date.UTC(y2, m2 - 1, d2);

  return Math.floor((date2 - date1) / (1000 * 60 * 60 * 24));
}

export function formatDate(value: string | null | undefined): string {
  return formatShortDate(value);
}
