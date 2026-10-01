/** Money helpers – single source of truth for currency handling */

export function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatCurrency(
  value: number | string | null | undefined
): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(money(Number(value ?? 0)));
}

export function invoiceRowTotal(invoice: {
  amount?: number | string | null;
  subtotal?: number | string | null;
  vat_amount?: number | string | null;
}): number {
  const amount = Number(invoice.amount ?? 0);

  if (Number.isFinite(amount) && amount > 0) {
    return money(amount);
  }

  const subtotal = Number(invoice.subtotal ?? 0);
  const vatAmount = Number(invoice.vat_amount ?? 0);

  return money(
    (Number.isFinite(subtotal) ? subtotal : 0) +
      (Number.isFinite(vatAmount) ? vatAmount : 0)
  );
}
