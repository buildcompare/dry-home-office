/*
 * England & Wales bank holidays and the holiday year.
 * Bundled list (2025–2028) from gov.uk; refreshed from
 * https://www.gov.uk/bank-holidays.json on the server when reachable
 * (see bank-holidays-server.ts).
 */

/** Holiday year starts on the 1st of this month (1 = January → calendar year). */
export const HOLIDAY_YEAR_START_MONTH = 1;

export const DEFAULT_HOLIDAY_ALLOWANCE_DAYS = 28;

export const BUNDLED_BANK_HOLIDAYS: readonly string[] = [
  // 2025
  "2025-01-01", "2025-04-18", "2025-04-21", "2025-05-05", "2025-05-26", "2025-08-25", "2025-12-25", "2025-12-26",
  // 2026
  "2026-01-01", "2026-04-03", "2026-04-06", "2026-05-04", "2026-05-25", "2026-08-31", "2026-12-25", "2026-12-28",
  // 2027
  "2027-01-01", "2027-03-26", "2027-03-29", "2027-05-03", "2027-05-31", "2027-08-30", "2027-12-27", "2027-12-28",
  // 2028
  "2028-01-03", "2028-04-14", "2028-04-17", "2028-05-01", "2028-05-29", "2028-08-28", "2028-12-25", "2028-12-26",
];

export const BUNDLED_BANK_HOLIDAY_SET: ReadonlySet<string> = new Set(BUNDLED_BANK_HOLIDAYS);

const pad = (n: number) => String(n).padStart(2, "0");

/** The holiday year a date falls in, identified by the year it starts. */
export function holidayYearOf(dateKey: string) {
  const year = Number(dateKey.slice(0, 4));
  const month = Number(dateKey.slice(5, 7));
  return month >= HOLIDAY_YEAR_START_MONTH ? year : year - 1;
}

/** Inclusive first and last day of a holiday year. */
export function holidayYearRange(startYear: number) {
  const start = `${startYear}-${pad(HOLIDAY_YEAR_START_MONTH)}-01`;
  const endMonth = HOLIDAY_YEAR_START_MONTH === 1 ? 12 : HOLIDAY_YEAR_START_MONTH - 1;
  const endYear = HOLIDAY_YEAR_START_MONTH === 1 ? startYear : startYear + 1;
  const lastDay = new Date(Date.UTC(endYear, endMonth, 0)).getUTCDate();
  return { start, end: `${endYear}-${pad(endMonth)}-${pad(lastDay)}` };
}

export function holidayYearLabel(startYear: number) {
  return HOLIDAY_YEAR_START_MONTH === 1 ? String(startYear) : `${startYear}/${String(startYear + 1).slice(2)}`;
}
