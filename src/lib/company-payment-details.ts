/*
 * Bank / payment details printed in the "Payment details" section of
 * the invoice PDF.
 *
 * This is the single place to change them. Any field left as "" is
 * simply not shown, so placeholder/fake bank details are never
 * printed. If no bank fields are filled the whole section is hidden.
 *
 * `method` prints as "Pay by <method>" (e.g. "Pay by BACS").
 * `reference` is the payment reference the customer should quote;
 * "{invoice_number}" is replaced with the invoice's own number
 * (e.g. "INV-0042"), which is the default.
 * `paymentTerms` is only a fallback: an invoice's own "Payment Terms"
 * field (invoices.payment_terms) takes priority.
 */
export type CompanyPaymentDetails = {
  method: string;
  accountName: string;
  bankName: string;
  sortCode: string;
  accountNumber: string;
  reference: string;
  referenceNote: string;
  paymentTerms: string;
};

export const COMPANY_PAYMENT_DETAILS: CompanyPaymentDetails = {
  method: "BACS",
  accountName: "Dry Home Damp Proofing Solutions Ltd",
  bankName: "",
  sortCode: "04-06-05",
  accountNumber: "29090873",
  reference: "{invoice_number}",
  referenceNote: "",
  paymentTerms: "",
};

export type PaymentDetailRow = {
  label: string;
  value: string;
};

export type InvoicePaymentDetails = {
  heading: string | null;
  rows: PaymentDetailRow[];
  referenceNote: string | null;
};

/**
 * Payment details for one invoice, filled fields only.
 * Returns null when no bank details have been configured.
 */
export function invoicePaymentDetails(
  invoiceNumber: string
): InvoicePaymentDetails | null {
  const details = COMPANY_PAYMENT_DETAILS;

  const bankRows: PaymentDetailRow[] = [
    { label: "Account name", value: details.accountName },
    { label: "Bank", value: details.bankName },
    { label: "Sort code", value: details.sortCode },
    { label: "Account number", value: details.accountNumber },
  ]
    .map((row) => ({ ...row, value: row.value.trim() }))
    .filter((row) => row.value.length > 0);

  if (bankRows.length === 0) {
    return null;
  }

  const reference = (details.reference.trim() || "{invoice_number}")
    .replaceAll("{invoice_number}", invoiceNumber)
    .trim();

  const method = details.method.trim();

  return {
    heading: method ? `Pay by ${method}` : null,
    rows: [...bankRows, { label: "Reference", value: reference }],
    referenceNote: details.referenceNote.trim() || null,
  };
}

/**
 * Payment terms for one invoice: the invoice's own terms, falling
 * back to COMPANY_PAYMENT_DETAILS.paymentTerms. Null if neither is set.
 */
export function invoicePaymentTerms(
  invoicePaymentTermsValue: string | null | undefined
) {
  return (
    invoicePaymentTermsValue?.trim() ||
    COMPANY_PAYMENT_DETAILS.paymentTerms.trim() ||
    null
  );
}
