"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  redirect,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/server";

export async function createGuarantee(
  formData: FormData
) {
  const supabase =
    await createClient();

  /*
   * -------------------------------------------------------
   * FORM DATA
   * -------------------------------------------------------
   */

  const invoiceId =
    String(
      formData.get(
        "invoice_id"
      ) || ""
    ).trim();

  const guaranteeType =
    String(
      formData.get(
        "guarantee_type"
      ) || ""
    ).trim() || null;

  const title =
    String(
      formData.get(
        "title"
      ) || ""
    ).trim() || null;

  const issueDate =
    String(
      formData.get(
        "issue_date"
      ) || ""
    ).trim();

  const durationYears =
    Number(
      formData.get(
        "duration_years"
      ) || 0
    );

  const expiryDate =
    String(
      formData.get(
        "expiry_date"
      ) || ""
    ).trim() || null;

  const coveredWorks =
    String(
      formData.get(
        "covered_works"
      ) || ""
    ).trim() || null;

  const terms =
    String(
      formData.get(
        "terms"
      ) || ""
    ).trim() || null;

  const exclusions =
    String(
      formData.get(
        "exclusions"
      ) || ""
    ).trim() || null;

  const customerMessage =
    String(
      formData.get(
        "customer_message"
      ) || ""
    ).trim() || null;

  const internalNotes =
    String(
      formData.get(
        "internal_notes"
      ) || ""
    ).trim() || null;

  if (!invoiceId) {
    redirect(
      "/guarantees/new?error=Invoice%20could%20not%20be%20identified"
    );
  }

  /*
   * -------------------------------------------------------
   * SOURCE INVOICE
   * -------------------------------------------------------
   */

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
      quote_id,
      invoice_type,
      status,
      amount,
      subtotal,
      vat_amount,
      amount_paid
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
    redirect(
      "/guarantees/new?error=Invoice%20could%20not%20be%20found"
    );
  }

  /*
   * -------------------------------------------------------
   * GUARANTEE ELIGIBILITY
   * -------------------------------------------------------
   *
   * We no longer require the source invoice to be
   * labelled "Final".
   *
   * The quote is now the source of truth.
   *
   * A guarantee can be created when:
   *
   * 1. The source invoice belongs to a quote
   * 2. The full quote value has been invoiced
   * 3. Every active invoice linked to that quote is
   *    fully paid
   */

  if (!invoice.quote_id) {
    redirect(
      `/invoices/${invoiceId}?error=This%20invoice%20is%20not%20linked%20to%20a%20quote.%20Guarantees%20are%20created%20once%20the%20quote%20is%20financially%20complete`
    );
  }

  const quoteId =
    invoice.quote_id;

  const [
    quoteResult,
    linkedInvoicesResult,
  ] = await Promise.all([
    supabase
      .from("quotes")
      .select(`
        id,
        amount
      `)
      .eq(
        "id",
        quoteId
      )
      .single(),

    supabase
      .from("invoices")
      .select(`
        id,
        status,
        amount,
        subtotal,
        vat_amount,
        amount_paid
      `)
      .eq(
        "quote_id",
        quoteId
      )
      .neq(
        "status",
        "Cancelled"
      ),
  ]);

  const quote =
    quoteResult.data;

  if (
    quoteResult.error ||
    !quote
  ) {
    redirect(
      `/invoices/${invoiceId}?error=The%20linked%20quote%20could%20not%20be%20found`
    );
  }

  const linkedInvoices =
    linkedInvoicesResult.data ??
    [];

  const quoteTotal =
    money(
      Number(
        quote.amount ?? 0
      )
    );

  const totalInvoiced =
    money(
      linkedInvoices.reduce(
        (
          total,
          linkedInvoice
        ) =>
          total +
          invoiceRowTotal(
            linkedInvoice
          ),
        0
      )
    );

  const fullyInvoiced =
    quoteTotal > 0 &&
    totalInvoiced >=
      quoteTotal -
        0.009;

  if (!fullyInvoiced) {
    redirect(
      `/invoices/${invoiceId}?error=The%20quote%20has%20not%20been%20fully%20invoiced%20yet`
    );
  }

  const everyInvoicePaid =
    linkedInvoices.length >
      0 &&
    linkedInvoices.every(
      (linkedInvoice) => {
        const invoiceTotal =
          invoiceRowTotal(
            linkedInvoice
          );

        const amountPaid =
          Number(
            linkedInvoice.amount_paid ??
              0
          );

        return (
          invoiceTotal > 0 &&
          amountPaid >=
            invoiceTotal -
              0.009
        );
      }
    );

  if (!everyInvoicePaid) {
    redirect(
      `/invoices/${invoiceId}?error=All%20invoices%20linked%20to%20the%20quote%20must%20be%20paid%20before%20a%20guarantee%20can%20be%20generated`
    );
  }

  /*
   * -------------------------------------------------------
   * STOP DUPLICATE GUARANTEES
   * -------------------------------------------------------
   *
   * Guarantees currently store invoice_id rather than
   * quote_id.
   *
   * We therefore look for an existing active guarantee
   * attached to ANY invoice belonging to this quote.
   */

  const linkedInvoiceIds =
    linkedInvoices.map(
      (linkedInvoice) =>
        linkedInvoice.id
    );

  if (
    linkedInvoiceIds.length >
    0
  ) {
    const {
      data:
        existingGuarantees,
    } = await supabase
      .from("guarantees")
      .select("id")
      .in(
        "invoice_id",
        linkedInvoiceIds
      )
      .neq(
        "status",
        "Cancelled"
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .limit(1);

    const existingGuarantee =
      existingGuarantees?.[0];

    if (
      existingGuarantee
    ) {
      redirect(
        `/guarantees/${existingGuarantee.id}`
      );
    }
  }

  /*
   * -------------------------------------------------------
   * GENERATE GUARANTEE NUMBER
   *
   * Example:
   * DH-G-2026-0001
   * -------------------------------------------------------
   */

  const year =
    new Date()
      .getFullYear();

  const {
    data: latestGuarantee,
  } = await supabase
    .from("guarantees")
    .select(
      "guarantee_number"
    )
    .like(
      "guarantee_number",
      `DH-G-${year}-%`
    )
    .order(
      "guarantee_number",
      {
        ascending: false,
      }
    )
    .limit(1);

  let nextNumber =
    1;

  if (
    latestGuarantee &&
    latestGuarantee.length >
      0
  ) {
    const lastNumber =
      latestGuarantee[0]
        .guarantee_number;

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
        lastSequence +
        1;
    }
  }

  const guaranteeNumber =
    `DH-G-${year}-${String(
      nextNumber
    ).padStart(
      4,
      "0"
    )}`;

  /*
   * -------------------------------------------------------
   * CREATE GUARANTEE
   * -------------------------------------------------------
   */

  const {
    data: guarantee,
    error: guaranteeError,
  } = await supabase
    .from("guarantees")
    .insert({
      guarantee_number:
        guaranteeNumber,

      client_id:
        invoice.client_id,

      job_id:
        invoice.job_id,

      contract_id:
        invoice.contract_id,

      /*
       * Keep the source invoice for compatibility with
       * the existing guarantees table and customer pages.
       */
      invoice_id:
        invoice.id,

      guarantee_type:
        guaranteeType,

      title,

      status:
        "Draft",

      issue_date:
        issueDate ||
        new Date()
          .toISOString()
          .slice(
            0,
            10
          ),

      duration_years:
        durationYears > 0
          ? durationYears
          : null,

      expiry_date:
        expiryDate,

      covered_works:
        coveredWorks,

      terms,

      exclusions,

      customer_message:
        customerMessage,

      internal_notes:
        internalNotes,
    })
    .select(
      "id"
    )
    .single();

  if (
    guaranteeError ||
    !guarantee
  ) {
    console.error(
      "Guarantee creation error:",
      guaranteeError
    );

    redirect(
      `/guarantees/new?invoice=${invoiceId}&error=Guarantee%20could%20not%20be%20created`
    );
  }

  /*
   * -------------------------------------------------------
   * REVALIDATE
   * -------------------------------------------------------
   */

  revalidatePath(
    "/guarantees"
  );

  revalidatePath(
    `/invoices/${invoiceId}`
  );

  revalidatePath(
    `/quotes/${quoteId}`
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
    `/guarantees/${guarantee.id}`
  );
}

/* =========================================================
   INVOICE TOTAL
   ========================================================= */

function invoiceRowTotal(invoice: {
  amount?:
    | number
    | string
    | null;

  subtotal?:
    | number
    | string
    | null;

  vat_amount?:
    | number
    | string
    | null;
}) {
  const amount =
    Number(
      invoice.amount ?? 0
    );

  if (
    Number.isFinite(
      amount
    ) &&
    amount > 0
  ) {
    return money(
      amount
    );
  }

  const subtotal =
    Number(
      invoice.subtotal ??
        0
    );

  const vatAmount =
    Number(
      invoice.vat_amount ??
        0
    );

  return money(
    (
      Number.isFinite(
        subtotal
      )
        ? subtotal
        : 0
    ) +
      (
        Number.isFinite(
          vatAmount
        )
          ? vatAmount
          : 0
      )
  );
}

/* =========================================================
   MONEY
   ========================================================= */

function money(
  value: number
) {
  return Math.round(
    (
      value +
      Number.EPSILON
    ) *
      100
  ) / 100;
}