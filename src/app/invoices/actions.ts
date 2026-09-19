"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type InvoiceItem = {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  item_type: string;
};

export async function addInvoice(
  formData: FormData
) {
  const supabase =
    await createClient();

  const contractId =
    String(
      formData.get("contract_id") || ""
    ).trim() || null;

  let clientId =
    String(
      formData.get("client_id") || ""
    ).trim();

  let jobId =
    String(
      formData.get("job_id") || ""
    ).trim() || null;

  let quoteId =
    String(
      formData.get("quote_id") || ""
    ).trim() || null;

  const invoiceType =
    String(
      formData.get("invoice_type") ||
        "Final"
    ).trim();

  const title =
    String(
      formData.get("title") || ""
    ).trim() || null;

  const description =
    String(
      formData.get("description") || ""
    ).trim() || null;

  const invoiceDate =
    String(
      formData.get("invoice_date") || ""
    ).trim();

  const dueDate =
    String(
      formData.get("due_date") || ""
    ).trim() || null;

  const customerMessage =
    String(
      formData.get(
        "customer_message"
      ) || ""
    ).trim() || null;

  const paymentTerms =
    String(
      formData.get(
        "payment_terms"
      ) || ""
    ).trim() || null;

  const internalNotes =
    String(
      formData.get(
        "internal_notes"
      ) || ""
    ).trim() || null;

  const vatEnabled =
    formData.get("vat_enabled") ===
    "on";

  const vatRate =
    Number(
      formData.get("vat_rate") || 20
    );

  /*
   * If invoice originates from
   * a contract, trust the contract
   * for client/job/quote.
   */
  if (contractId) {
    const {
      data: contract,
      error: contractError,
    } = await supabase
      .from("contracts")
      .select(`
        id,
        client_id,
        job_id,
        quote_id,
        status
      `)
      .eq("id", contractId)
      .single();

    if (
      contractError ||
      !contract
    ) {
      redirect(
        "/invoices/new?error=Unable%20to%20find%20the%20selected%20contract"
      );
    }

    if (
      contract.status !==
      "Signed"
    ) {
      redirect(
        "/invoices/new?error=Invoices%20can%20only%20be%20created%20from%20signed%20contracts"
      );
    }

    clientId =
      contract.client_id;

    jobId =
      contract.job_id;

    quoteId =
      contract.quote_id;
  }

  if (!clientId) {
    redirect(
      "/invoices/new?error=Please%20select%20a%20client"
    );
  }

  let items: InvoiceItem[] =
    [];

  try {
    items =
      JSON.parse(
        String(
          formData.get("items") ||
            "[]"
        )
      );
  } catch {
    redirect(
      "/invoices/new?error=Invoice%20items%20could%20not%20be%20read"
    );
  }

  items = items
    .map((item) => ({
      description:
        String(
          item.description || ""
        ).trim(),

      quantity:
        Number(item.quantity || 0),

      unit:
        String(
          item.unit || ""
        ).trim(),

      unit_price:
        Number(
          item.unit_price || 0
        ),

      item_type:
        String(
          item.item_type ||
            "Labour"
        ).trim(),
    }))
    .filter(
      (item) =>
        item.description &&
        item.quantity > 0
    );

  if (items.length === 0) {
    redirect(
      "/invoices/new?error=Please%20add%20at%20least%20one%20invoice%20item"
    );
  }

  const subtotal =
    items.reduce(
      (total, item) =>
        total +
        item.quantity *
          item.unit_price,
      0
    );

  const vatAmount =
    vatEnabled
      ? subtotal *
        (vatRate / 100)
      : 0;

  const total =
    subtotal +
    vatAmount;

  /*
   * Generate next invoice number.
   */
  const year =
    new Date().getFullYear();

  const {
    data: recentInvoices,
  } = await supabase
    .from("invoices")
    .select("invoice_number")
    .like(
      "invoice_number",
      `DH-I-${year}-%`
    )
    .order(
      "invoice_number",
      {
        ascending: false,
      }
    )
    .limit(1);

  let nextNumber = 1;

  if (
    recentInvoices &&
    recentInvoices.length > 0
  ) {
    const lastNumber =
      recentInvoices[0]
        .invoice_number;

    const lastSequence =
      Number(
        lastNumber
          .split("-")
          .pop()
      );

    if (
      Number.isFinite(
        lastSequence
      )
    ) {
      nextNumber =
        lastSequence + 1;
    }
  }

  const invoiceNumber =
    `DH-I-${year}-${String(
      nextNumber
    ).padStart(4, "0")}`;

  const {
    data: invoice,
    error,
  } = await supabase
    .from("invoices")
    .insert({
      invoice_number:
        invoiceNumber,

      client_id:
        clientId,

      job_id:
        jobId,

      quote_id:
        quoteId,

      contract_id:
        contractId,

      title,

      description,

      invoice_type:
        invoiceType,

      status: "Draft",

      invoice_date:
        invoiceDate ||
        new Date()
          .toISOString()
          .slice(0, 10),

      due_date:
        dueDate,

      subtotal,

      vat_enabled:
        vatEnabled,

      vat_rate:
        vatRate,

      vat_amount:
        vatAmount,

      amount:
        total,

      amount_paid: 0,

      customer_message:
        customerMessage,

      payment_terms:
        paymentTerms,

      internal_notes:
        internalNotes,
    })
    .select("id")
    .single();

  if (
    error ||
    !invoice
  ) {
    console.error(
      "Invoice creation error:",
      error
    );

    redirect(
      "/invoices/new?error=Unable%20to%20create%20invoice"
    );
  }

  const invoiceItems =
    items.map(
      (item, index) => ({
        invoice_id:
          invoice.id,

        description:
          item.description,

        quantity:
          item.quantity,

        unit:
          item.unit || null,

        unit_price:
          item.unit_price,

        item_type:
          item.item_type,

        sort_order:
          index,
      })
    );

  const {
    error: itemError,
  } = await supabase
    .from("invoice_items")
    .insert(invoiceItems);

  if (itemError) {
    console.error(
      "Invoice item error:",
      itemError
    );

    await supabase
      .from("invoices")
      .delete()
      .eq(
        "id",
        invoice.id
      );

    redirect(
      "/invoices/new?error=Invoice%20items%20could%20not%20be%20saved"
    );
  }

  revalidatePath("/");
  revalidatePath(
    "/invoices"
  );

  revalidatePath(
    `/clients/${clientId}`
  );

  if (jobId) {
    revalidatePath(
      `/jobs/${jobId}`
    );
  }

  if (quoteId) {
    revalidatePath(
      `/quotes/${quoteId}`
    );
  }

  if (contractId) {
    revalidatePath(
      `/contracts/${contractId}`
    );
  }

  redirect(
    `/invoices/${invoice.id}`
  );
}

/*
 * --------------------------------------------------
 * RECORD PAYMENT
 * --------------------------------------------------
 */
export async function recordInvoicePayment(
  formData: FormData
) {
  const supabase =
    await createClient();

  const invoiceId =
    String(
      formData.get("invoice_id") || ""
    ).trim();

  const amount =
    Number(
      formData.get("payment_amount") ||
        0
    );

  const paymentDate =
    String(
      formData.get("payment_date") ||
        ""
    ).trim();

  const paymentMethod =
    String(
      formData.get(
        "payment_method"
      ) || ""
    ).trim() || null;

  const paymentReference =
    String(
      formData.get(
        "payment_reference"
      ) || ""
    ).trim() || null;

  const notes =
    String(
      formData.get(
        "payment_notes"
      ) || ""
    ).trim() || null;

  if (!invoiceId) {
    redirect(
      "/invoices?error=Invoice%20could%20not%20be%20identified"
    );
  }

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    redirect(
      `/invoices/${invoiceId}?error=Please%20enter%20a%20valid%20payment%20amount`
    );
  }

  const {
    data: invoice,
    error: invoiceError,
  } = await supabase
    .from("invoices")
    .select(`
      id,
      client_id,
      job_id,
      contract_id,
      invoice_type,
      status,
      amount,
      amount_paid
    `)
    .eq("id", invoiceId)
    .single();

  if (
    invoiceError ||
    !invoice
  ) {
    redirect(
      `/invoices/${invoiceId}?error=Invoice%20could%20not%20be%20found`
    );
  }

  if (
    invoice.status ===
    "Cancelled"
  ) {
    redirect(
      `/invoices/${invoiceId}?error=Payments%20cannot%20be%20added%20to%20a%20cancelled%20invoice`
    );
  }

  const invoiceTotal =
    Number(
      invoice.amount ?? 0
    );

  const existingPaid =
    Number(
      invoice.amount_paid ?? 0
    );

  const outstandingBalance =
    Math.max(
      invoiceTotal -
        existingPaid,
      0
    );

  if (
    outstandingBalance <= 0
  ) {
    redirect(
      `/invoices/${invoiceId}?error=This%20invoice%20is%20already%20fully%20paid`
    );
  }

  if (
    amount >
    outstandingBalance + 0.009
  ) {
    redirect(
      `/invoices/${invoiceId}?error=Payment%20cannot%20be%20greater%20than%20the%20outstanding%20balance`
    );
  }

  const effectivePaymentDate =
    paymentDate ||
    new Date()
      .toISOString()
      .slice(0, 10);

  /*
   * First save the individual
   * payment record.
   */
  const {
    error: paymentError,
  } = await supabase
    .from("invoice_payments")
    .insert({
      invoice_id:
        invoiceId,

      amount,

      payment_date:
        effectivePaymentDate,

      payment_method:
        paymentMethod,

      payment_reference:
        paymentReference,

      notes,
    });

  if (paymentError) {
    console.error(
      "Payment save error:",
      paymentError
    );

    redirect(
      `/invoices/${invoiceId}?error=Payment%20could%20not%20be%20recorded`
    );
  }

  const newAmountPaid =
    existingPaid + amount;

  const fullyPaid =
    newAmountPaid >=
    invoiceTotal - 0.009;

  const newStatus =
    fullyPaid
      ? "Paid"
      : "Part Paid";

  const paidAt =
    fullyPaid
      ? new Date().toISOString()
      : null;

  const {
    error: updateError,
  } = await supabase
    .from("invoices")
    .update({
      amount_paid:
        newAmountPaid,

      status:
        newStatus,

      paid_at:
        paidAt,

      payment_method:
        paymentMethod,

      payment_reference:
        paymentReference,
    })
    .eq(
      "id",
      invoiceId
    );

  if (updateError) {
    console.error(
      "Invoice payment update error:",
      updateError
    );

    /*
     * Remove the payment we just
     * inserted if the invoice itself
     * could not be updated.
     */
    await supabase
      .from("invoice_payments")
      .delete()
      .eq(
        "invoice_id",
        invoiceId
      )
      .eq(
        "amount",
        amount
      )
      .eq(
        "payment_date",
        effectivePaymentDate
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .limit(1);

    redirect(
      `/invoices/${invoiceId}?error=Invoice%20payment%20totals%20could%20not%20be%20updated`
    );
  }

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
    invoice.contract_id
  ) {
    revalidatePath(
      `/contracts/${invoice.contract_id}`
    );
  }

  redirect(
    `/invoices/${invoiceId}?payment=success`
  );
}