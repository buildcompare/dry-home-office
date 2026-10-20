import { BUNDLED_BANK_HOLIDAYS } from "@/lib/bank-holidays";

/**
 * Bundled list merged with gov.uk's England & Wales list (cached for a
 * day by Next). Any failure falls back to the bundled list.
 */
export async function getBankHolidaySet(): Promise<Set<string>> {
  const set = new Set(BUNDLED_BANK_HOLIDAYS);
  try {
    const response = await fetch("https://www.gov.uk/bank-holidays.json", {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return set;
    const body = (await response.json()) as { "england-and-wales"?: { events?: { date?: string }[] } };
    for (const event of body["england-and-wales"]?.events ?? []) {
      if (typeof event.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(event.date)) set.add(event.date);
    }
  } catch {
    // bundled list only
  }
  return set;
}
