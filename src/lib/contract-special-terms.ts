import { OLD_DEFAULT_QUOTE_TERMS } from "@/lib/quote-additional-terms";

/*
 * The generic sentence the Create Contract form used to prefill.
 * Contracts saved with it unchanged have no real special terms.
 */
export const OLD_DEFAULT_CONTRACT_TERMS =
  "The works will be carried out in accordance with the agreed quotation and scope of works. Any additional works or variations must be agreed before proceeding. Access to the property must be provided as reasonably required to complete the works.";

/*
 * A contract's own `terms` column holds the job-specific special
 * terms. Returns null when there are none (blank, or one of the old
 * generic defaults), so callers can omit the section.
 */
export function contractSpecialTerms(
  value: string | null | undefined
) {
  const text = (value ?? "").trim();

  if (
    !text ||
    text === OLD_DEFAULT_CONTRACT_TERMS ||
    text === OLD_DEFAULT_QUOTE_TERMS
  ) {
    return null;
  }

  return text;
}
