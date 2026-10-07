"use server";

import { createClient } from "@/lib/supabase/server";
import { calculateInvoiceTotals, insertInvoiceWithItems } from "@/lib/invoice-create";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type InvoiceItem = {
  description?: string;
  quantity?: number | string;
  unit?: string;
  unit_price?: number | string;
  item_type?: string;
};

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

/* =========================================================
   CREATE INVOICE
   ========================================================= */

export async function addInvoice(
  formData: FormData
) {
  const supabase =
    await createClient();

  let contractId =
    String(
      formData.get(
        "contract_id"
      ) ?? ""
    ).trim() || null;

  let clientId =
    String(
      formData.get(
        "client_id"
      ) ?? ""
    ).trim() || null;

  let jobId =
    String(
      formData.get(
        "job_id"
      ) ?? ""
    ).trim() || null;

  let quoteId =
    String(
      formData.get(
        "quote_id"
      ) ?? ""
    ).trim() || null;

  const invoiceType =
    String(
      formData.get(
        "invoice_type"
      ) ?? ""
    ).trim() ||
    "Interim";

  const title =
    String(
      formData.get(
        "title"
      ) ?? ""
    ).trim() ||
    "Invoice";

  const description =
    String(
      formData.get(
        "description"
      ) ?? ""
    ).trim() ||
    null;

  const invoiceDate =
    String(
      formData.get(
        "invoice_date"
      ) ?? ""
    ).trim() ||
    null;

  const dueDate =
    String(
      formData.get(
        "due_date"
      ) ?? ""
    ).trim() ||
    null;

  const customerMessage =
    String(
      formData.get(
        "customer_message"
      ) ?? ""
    ).trim() ||
    null;

  const paymentTerms =
    String(
      formData.get(
        "payment_terms"
      ) ?? ""
    ).trim() ||
    null;

  const internalNotes =
    String(
      formData.get(
        "internal_notes"
      ) ?? ""
    ).trim() ||
    null;

  const vatEnabledValue =
    String(
      formData.get(
        "vat_enabled"
      ) ?? ""
    ).toLowerCase();

  const vatEnabled =
    vatEnabledValue === "true" ||
    vatEnabledValue === "on" ||
    vatEnabledValue === "1";

  const vatRateRaw =
    Number(
      formData.get(
        "vat_rate"
      ) ?? 20
    );

  const vatRate =
    Number.isFinite(
      vatRateRaw
    )
      ? vatRateRaw
      : 20;

  /* =======================================================
     READ INVOICE ITEMS
     ======================================================= */

  let items: InvoiceItem[] = [];

  try {
    const itemsJson =
      String(
        formData.get(
          "items"
        ) ?? "[]"
      );

    const parsed =
      JSON.parse(
        itemsJson
      );

    if (
      Array.isArray(
        parsed
      )
    ) {
      items =
        parsed;
    }
  } catch {
    throw new Error(
      "The invoice items could not be read."
    );
  }

  const cleanedItems =
    items
      .map(
        (
          item
        ) => {
          const quantity =
            Number(
              item.quantity ??
                0
            );

          const unitPrice =
            Number(
              item.unit_price ??
                0
            );

          return {
            description:
              String(
                item.description ??
                  ""
              ).trim(),

            quantity:
              Number.isFinite(
                quantity
              )
                ? quantity
                : 0,

            unit:
              String(
                item.unit ??
                  ""
              ).trim() ||
              "item",

            unit_price:
              Number.isFinite(
                unitPrice
              )
                ? unitPrice
                : 0,

            item_type:
              String(
                item.item_type ??
                  ""
              ).trim() ||
              "Labour",
          };
        }
      )
      .filter(
        (
          item
        ) =>
          item.description !==
            "" ||
          item.unit_price !==
            0
      );

  if (
    cleanedItems.length ===
    0
  ) {
    throw new Error(
      "Please add at least one invoice item."
    );
  }

  /* =======================================================
     CONTRACT SOURCE
     ======================================================= */

  if (
    contractId
  ) {
    const {
      data: contract,
      error:
        contractError,
    } =
      await supabase
        .from(
          "contracts"
        )
        .select(`
          id,
          client_id,
          job_id,
          quote_id,
          amount,
          status
        `)
        .eq(
          "id",
          contractId
        )
        .single();

    if (
      contractError ||
      !contract
    ) {
      throw new Error(
        "The linked contract could not be found."
      );
    }

    if (
      contract.status !==
      "Signed"
    ) {
      throw new Error(
        "Invoices can only be created from a signed contract."
      );
    }

    clientId =
      contract.client_id ??
      clientId;

    jobId =
      contract.job_id ??
      jobId;

    quoteId =
      contract.quote_id ??
      quoteId;
  }

  /* =======================================================
     QUOTE SOURCE
     ======================================================= */

  let sourceQuote:
    | {
        id: string;
        client_id:
          | string
          | null;
        job_id:
          | string
          | null;
        amount:
          | number
          | string
          | null;
        status: string;
      }
    | null = null;

  if (
    quoteId
  ) {
    const {
      data: quote,
      error:
        quoteError,
    } =
      await supabase
        .from(
          "quotes"
        )
        .select(`
          id,
          client_id,
          job_id,
          amount,
          status
        `)
        .eq(
          "id",
          quoteId
        )
        .single();

    if (
      quoteError ||
      !quote
    ) {
      throw new Error(
        "The linked quote could not be found."
      );
    }

    sourceQuote =
      quote;

    clientId =
      quote.client_id ??
      clientId;

    jobId =
      quote.job_id ??
      jobId;
  }

  if (
    !clientId
  ) {
    throw new Error(
      "A client must be linked to the invoice."
    );
  }

  /* =======================================================
     CALCULATE INVOICE TOTAL
     ======================================================= */

  const {
    subtotal,
    total,
  } =
    calculateInvoiceTotals(
      cleanedItems,
      vatEnabled,
      vatRate
    );

  if (
    subtotal <= 0
  ) {
    throw new Error(
      "The invoice amount must be greater than £0."
    );
  }

  /* =======================================================
     APPROVED JOB VALUE

     Accepted quote
     +
     Accepted variations
     =
     Approved job value
     ======================================================= */

  if (
    quoteId &&
    sourceQuote
  ) {
    const quoteTotal =
      money(
        Number(
          sourceQuote.amount ??
            0
        )
      );

    if (
      quoteTotal <= 0
    ) {
      throw new Error(
        "The linked quote does not have a valid total."
      );
    }

    let acceptedVariationValue =
      0;

    if (
      jobId
    ) {
      const {
        data:
          acceptedVariations,
        error:
          variationsError,
      } =
        await supabase
          .from(
            "variations"
          )
          .select(`
            id,
            quote_id,
            amount,
            status
          `)
          .eq(
            "job_id",
            jobId
          )
          .eq(
            "status",
            "Accepted"
          );

      if (
        variationsError
      ) {
        throw new Error(
          "Unable to calculate the accepted variation value."
        );
      }

      acceptedVariationValue =
        money(
          (
            acceptedVariations ??
            []
          )
            .filter(
              (
                variation
              ) =>
                !variation.quote_id ||
                variation.quote_id ===
                  quoteId
            )
            .reduce(
              (
                sum,
                variation
              ) =>
                sum +
                Number(
                  variation.amount ??
                    0
                ),
              0
            )
        );
    }

    const approvedJobValue =
      money(
        quoteTotal +
          acceptedVariationValue
      );

    /* =====================================================
       ALL EXISTING JOB INVOICES

       Once we have a job, the financial cap belongs to the
       job rather than to an individual variation.
       ===================================================== */

    let previousInvoices:
      {
        id: string;
        amount:
          | number
          | string
          | null;
        subtotal:
          | number
          | string
          | null;
        vat_amount:
          | number
          | string
          | null;
        status: string;
      }[] = [];

    if (
      jobId
    ) {
      const {
        data:
          jobInvoices,
        error:
          previousInvoicesError,
      } =
        await supabase
          .from(
            "invoices"
          )
          .select(`
            id,
            amount,
            subtotal,
            vat_amount,
            status
          `)
          .eq(
            "job_id",
            jobId
          )
          .neq(
            "status",
            "Cancelled"
          );

      if (
        previousInvoicesError
      ) {
        throw new Error(
          "Unable to calculate the amount already invoiced."
        );
      }

      previousInvoices =
        jobInvoices ??
        [];
    } else {
      const {
        data:
          quoteInvoices,
        error:
          previousInvoicesError,
      } =
        await supabase
          .from(
            "invoices"
          )
          .select(`
            id,
            amount,
            subtotal,
            vat_amount,
            status
          `)
          .eq(
            "quote_id",
            quoteId
          )
          .neq(
            "status",
            "Cancelled"
          );

      if (
        previousInvoicesError
      ) {
        throw new Error(
          "Unable to calculate the amount already invoiced."
        );
      }

      previousInvoices =
        quoteInvoices ??
        [];
    }

    const alreadyInvoiced =
      money(
        previousInvoices.reduce(
          (
            sum,
            invoice
          ) =>
            sum +
            invoiceRowTotal(
              invoice
            ),
          0
        )
      );

    const remainingBalance =
      money(
        Math.max(
          0,
          approvedJobValue -
            alreadyInvoiced
        )
      );

    if (
      toPence(
        total
      ) >
      toPence(
        remainingBalance
      )
    ) {
      throw new Error(
        `This invoice cannot exceed the remaining approved job balance of £${remainingBalance.toFixed(
          2
        )}.`
      );
    }
  }

  /* =======================================================
     CONTRACT ONLY

     This is retained for contracts that are not linked to
     an accepted quotation.
     ======================================================= */

  else if (
    contractId
  ) {
    const {
      data: contract,
      error:
        contractError,
    } =
      await supabase
        .from(
          "contracts"
        )
        .select(
          "id, amount"
        )
        .eq(
          "id",
          contractId
        )
        .single();

    if (
      contractError ||
      !contract
    ) {
      throw new Error(
        "Unable to calculate the contract balance."
      );
    }

    const contractTotal =
      money(
        Number(
          contract.amount ??
            0
        )
      );

    if (
      contractTotal >
      0
    ) {
      const {
        data:
          previousInvoices,
        error:
          previousInvoicesError,
      } =
        await supabase
          .from(
            "invoices"
          )
          .select(`
            id,
            amount,
            subtotal,
            vat_amount,
            status
          `)
          .eq(
            "contract_id",
            contractId
          )
          .neq(
            "status",
            "Cancelled"
          );

      if (
        previousInvoicesError
      ) {
        throw new Error(
          "Unable to calculate the amount already invoiced."
        );
      }

      const alreadyInvoiced =
        money(
          (
            previousInvoices ??
            []
          ).reduce(
            (
              sum,
              invoice
            ) =>
              sum +
              invoiceRowTotal(
                invoice
              ),
            0
          )
        );

      const remainingBalance =
        money(
          Math.max(
            0,
            contractTotal -
              alreadyInvoiced
          )
        );

      if (
        toPence(
          total
        ) >
        toPence(
          remainingBalance
        )
      ) {
        throw new Error(
          `This invoice cannot exceed the remaining contract balance of £${remainingBalance.toFixed(
            2
          )}.`
        );
      }
    }
  }

  /* =======================================================
     INSERT INVOICE + ITEMS
     Shared with the Book Survey flow.
     ======================================================= */

  const invoice =
    await insertInvoiceWithItems(
      supabase,
      {
        clientId,
        jobId,
        quoteId,
        contractId,
        invoiceType,
        title,
        description,
        invoiceDate,
        dueDate,
        customerMessage,
        paymentTerms,
        internalNotes,
        vatEnabled,
        vatRate,
      },
      cleanedItems
    );

  /* =======================================================
     REFRESH
     ======================================================= */

  revalidatePath(
    "/invoices"
  );

  if (
    quoteId
  ) {
    revalidatePath(
      `/quotes/${quoteId}`
    );
  }

  if (
    contractId
  ) {
    revalidatePath(
      `/contracts/${contractId}`
    );
  }

  if (
    clientId
  ) {
    revalidatePath(
      `/clients/${clientId}`
    );
  }

  if (
    jobId
  ) {
    revalidatePath(
      `/jobs/${jobId}`
    );
  }

  redirect(
    `/invoices/${invoice.id}`
  );
}

/* =========================================================
   RECORD INVOICE PAYMENT
   ========================================================= */

export async function recordInvoicePayment(
  formData: FormData
) {
  const supabase =
    await createClient();

  const invoiceId =
    String(
      formData.get(
        "invoice_id"
      ) ?? ""
    ).trim();

  const paymentAmountRaw =
    Number(
      formData.get(
        "payment_amount"
      ) ?? 0
    );

  const paymentDate =
    String(
      formData.get(
        "payment_date"
      ) ?? ""
    ).trim();

  const paymentMethod =
    String(
      formData.get(
        "payment_method"
      ) ?? ""
    ).trim() ||
    null;

  const paymentReference =
    String(
      formData.get(
        "payment_reference"
      ) ?? ""
    ).trim() ||
    null;

  const paymentNotes =
    String(
      formData.get(
        "payment_notes"
      ) ?? ""
    ).trim() ||
    null;

  if (
    !invoiceId
  ) {
    throw new Error(
      "Invoice ID is missing."
    );
  }

  if (
    !Number.isFinite(
      paymentAmountRaw
    ) ||
    paymentAmountRaw <=
      0
  ) {
    throw new Error(
      "Payment amount must be greater than £0."
    );
  }

  const paymentAmount =
    money(
      paymentAmountRaw
    );

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

  /* =======================================================
     REFRESH PAGES
     ======================================================= */

  revalidatePath(
    "/invoices"
  );

  revalidatePath(
    `/invoices/${invoiceId}`
  );

  if (
    invoice.client_id
  ) {
    revalidatePath(
      `/clients/${invoice.client_id}`
    );
  }

  if (
    invoice.job_id
  ) {
    revalidatePath(
      `/jobs/${invoice.job_id}`
    );
  }

  if (
    invoice.quote_id
  ) {
    revalidatePath(
      `/quotes/${invoice.quote_id}`
    );
  }

  if (
    invoice.contract_id
  ) {
    revalidatePath(
      `/contracts/${invoice.contract_id}`
    );
  }

  redirect(
    `/invoices/${invoiceId}`
  );
}