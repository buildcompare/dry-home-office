/*
 * Shared invoice payment recording: inserts the invoice_payments row,
 * then updates amount_paid / status / paid_at on the invoice, rolling
 * the payment back if the invoice update fails. Used by the invoice
 * page's Record Payment form and the Surveys "Mark paid" action.
 *
 * Throws an Error with a readable message on failure.
 */

import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

function money(value: number) {
  return Math.round(
    (value + Number.EPSILON) * 100
  ) / 100;
}

function toPence(value: number) {
  return Math.round(
    money(value) * 100
  );
}

function invoiceRowTotal(invoice: {
  amount?: number | string | null;
  subtotal?: number | string | null;
  vat_amount?: number | string | null;
}) {
  const amount =
    Number(
      invoice.amount ?? 0
    );

  if (
    Number.isFinite(amount) &&
    amount > 0
  ) {
    return money(amount);
  }

  const subtotal =
    Number(
      invoice.subtotal ?? 0
    );

  const vatAmount =
    Number(
      invoice.vat_amount ?? 0
    );

  return money(
    (
      Number.isFinite(subtotal)
        ? subtotal
        : 0
    ) +
      (
        Number.isFinite(vatAmount)
          ? vatAmount
          : 0
      )
  );
}

export async function applyInvoicePayment(
  supabase: SupabaseServerClient,
  {
    invoiceId,
    paymentAmount,
    paymentDate,
    paymentMethod,
    paymentReference,
    paymentNotes,
  }: {
    invoiceId: string;
    paymentAmount: number;
    paymentDate: string;
    paymentMethod: string | null;
    paymentReference: string | null;
    paymentNotes: string | null;
  }
) {
  /* =======================================================
     LOAD INVOICE
     ======================================================= */

  const {
    data: invoice,
    error:
      invoiceError,
  } =
    await supabase
      .from(
        "invoices"
      )
      .select(`
        id,
        invoice_number,
        amount,
        subtotal,
        vat_amount,
        amount_paid,
        status,
        client_id,
        job_id,
        quote_id,
        contract_id
      `)
      .eq(
        "id",
        invoiceId
      )
      .single();

  if (
    invoiceError ||
    !invoice
  ) {
    throw new Error(
      "The invoice could not be found."
    );
  }

  /*
   * Some older invoices may have amount = 0 / null.
   * Rebuild the genuine invoice total where necessary.
   */

  const invoiceTotal =
    invoiceRowTotal(
      invoice
    );

  if (
    invoiceTotal <=
    0
  ) {
    throw new Error(
      "This invoice does not have a valid total."
    );
  }

  const currentAmountPaid =
    money(
      Number(
        invoice.amount_paid ??
          0
      )
    );

  const outstandingBalance =
    money(
      Math.max(
        0,
        invoiceTotal -
          currentAmountPaid
      )
    );

  if (
    outstandingBalance <=
    0
  ) {
    throw new Error(
      "This invoice has already been paid in full."
    );
  }

  if (
    toPence(
      paymentAmount
    ) >
    toPence(
      outstandingBalance
    )
  ) {
    throw new Error(
      `Payment cannot exceed the outstanding balance of £${outstandingBalance.toFixed(
        2
      )}.`
    );
  }

  /* =======================================================
     RECORD PAYMENT
     ======================================================= */

  const {
    data: payment,
    error:
      paymentError,
  } =
    await supabase
      .from(
        "invoice_payments"
      )
      .insert({
        invoice_id:
          invoiceId,

        amount:
          paymentAmount,

        payment_date:
          paymentDate ||
          null,

        payment_method:
          paymentMethod,

        payment_reference:
          paymentReference,

        notes:
          paymentNotes,
      })
      .select(
        "id"
      )
      .single();

  if (
    paymentError ||
    !payment
  ) {
    console.error(
      paymentError
    );

    throw new Error(
      paymentError?.message ||
        "The payment could not be recorded."
    );
  }

  /* =======================================================
     CALCULATE NEW BALANCE
     ======================================================= */

  const newAmountPaid =
    money(
      currentAmountPaid +
        paymentAmount
    );

  const remainingAfterPayment =
    money(
      Math.max(
        0,
        invoiceTotal -
          newAmountPaid
      )
    );

  /*
   * Paid only when the balance really is zero.
   */

  const isPaid =
    toPence(
      remainingAfterPayment
    ) === 0;

  const newStatus =
    isPaid
      ? "Paid"
      : "Part Paid";

  /* =======================================================
     UPDATE INVOICE
     ======================================================= */

  const {
    error:
      updateError,
  } =
    await supabase
      .from(
        "invoices"
      )
      .update({
        /*
         * Also repairs older invoices where amount was absent.
         */
        amount:
          invoiceTotal,

        amount_paid:
          newAmountPaid,

        status:
          newStatus,

        paid_at:
          isPaid
            ? new Date()
                .toISOString()
            : null,
      })
      .eq(
        "id",
        invoiceId
      );

  if (
    updateError
  ) {
    /*
     * Roll the payment back if updating the invoice fails.
     */

    await supabase
      .from(
        "invoice_payments"
      )
      .delete()
      .eq(
        "id",
        payment.id
      );

    console.error(
      updateError
    );

    throw new Error(
      updateError.message ||
        "The invoice payment balance could not be updated."
    );
  }

  return invoice;
}
