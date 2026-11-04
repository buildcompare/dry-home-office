import { cache } from "react";
import { BUNDLED_BANK_HOLIDAYS } from "@/lib/bank-holidays";

// Speed: a warm server keeps the merged list in memory for 12 hours, and
// a slow gov.uk never holds a page up for more than 1.5 seconds.
const MEMO_MS = 12 * 60 * 60 * 1000;
let memo: { at: number; set: Set<string> } | null = null;

/**
 * Bundled list merged with gov.uk's England & Wales list (cached for a
 * day by Next). Any failure falls back to the bundled list.
 */
export const getBankHolidaySet = cache(async (): Promise<Set<string>> => {
  if (memo && Date.now() - memo.at < MEMO_MS) return memo.set;
  const set = new Set(BUNDLED_BANK_HOLIDAYS);
  try {
    const response = await fetch("https://www.gov.uk/bank-holidays.json", {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) return set;
    const body = (await response.json()) as { "england-and-wales"?: { events?: { date?: string }[] } };
    for (const event of body["england-and-wales"]?.events ?? []) {
      if (typeof event.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(event.date)) set.add(event.date);
    }
    memo = { at: Date.now(), set };
  } catch {
    // bundled list only
  }
  return set;
});
