export const OLD_DEFAULT_QUOTE_TERMS =
  "This quotation is valid for 30 days from the date shown. Any additional works not included within this quotation will be discussed and agreed before proceeding.";

export function additionalQuoteTerms(
  value: string | null | undefined
) {
  const text = (value ?? "").trim();

  if (!text || text === OLD_DEFAULT_QUOTE_TERMS) {
    return null;
  }

  return text;
}
