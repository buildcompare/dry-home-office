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

  /* =========================================================
     FORM DATA
     ========================================================= */

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

  if (
    !invoiceId
  ) {
    redirect(
      "/guarantees/new?error=Invoice%20could%20not%20be%20identified"
    );
  }

  /* =========================================================
     SOURCE INVOICE
     ========================================================= */

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
   * The invoice type does not matter.
   *
   * Guarantees now belong to the financially-complete
   * JOB workflow:
   *
   * Accepted Quote
   * +
   * Accepted Variations
   * =
   * Approved Job Value
   *
   * A guarantee can be created when:
   *
   * 1. The source invoice belongs to the accepted quote/job
   * 2. The full Approved Job Value has been invoiced
   * 3. Every active invoice on that job has been paid
   */

  if (
    !invoice.quote_id
  ) {
    redirect(
      `/invoices/${invoiceId}?error=This%20invoice%20is%20not%20linked%20to%20an%20accepted%20quote.%20Guarantees%20are%20created%20once%20the%20approved%20job%20is%20financially%20complete`
    );
  }

  const quoteId =
    invoice.quote_id;

  /* =========================================================
     QUOTE
     ========================================================= */

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
    redirect(
      `/invoices/${invoiceId}?error=The%20linked%20quote%20could%20not%20be%20found`
    );
  }

  const resolvedJobId =
    invoice.job_id ||
    quote.job_id ||
    null;

  const quoteTotal =
    money(
      Number(
        quote.amount ??
          0
      )
    );

  if (
    quoteTotal <=
    0
  ) {
    redirect(
      `/invoices/${invoiceId}?error=The%20accepted%20quote%20does%20not%20have%20a%20valid%20value`
    );
  }

  /* =========================================================
     ACCEPTED VARIATIONS
     ========================================================= */

  let acceptedVariationValue =
    0;

  if (
    resolvedJobId
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
          resolvedJobId
        )
        .eq(
          "status",
          "Accepted"
        );

    if (
      variationsError
    ) {
      console.error(
        "Guarantee variation calculation error:",
        variationsError
      );

      redirect(
        `/invoices/${invoiceId}?error=Accepted%20variations%20could%20not%20be%20checked`
      );
    }

    /*
     * Keep this consistent with the invoicing workflow.
     *
     * Variations explicitly linked to this accepted quote,
     * plus older variations with no quote_id, form part of
     * the Approved Job Value.
     */

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
              total,
              variation
            ) =>
              total +
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

  /* =========================================================
     ALL ACTIVE JOB INVOICES
     ========================================================= */

  let linkedInvoices:
    {
      id: string;
      status: string;
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
      amount_paid:
        | number
        | string
        | null;
    }[] = [];

  if (
    resolvedJobId
  ) {
    const {
      data:
        jobInvoices,
      error:
        linkedInvoicesError,
    } =
      await supabase
        .from(
          "invoices"
        )
        .select(`
          id,
          status,
          amount,
          subtotal,
          vat_amount,
          amount_paid
        `)
        .eq(
          "job_id",
          resolvedJobId
        )
        .neq(
          "status",
          "Cancelled"
        );

    if (
      linkedInvoicesError
    ) {
      console.error(
        "Guarantee invoice calculation error:",
        linkedInvoicesError
      );

      redirect(
        `/invoices/${invoiceId}?error=The%20job%20invoices%20could%20not%20be%20checked`
      );
    }

    linkedInvoices =
      jobInvoices ??
      [];
  } else {
    /*
     * Older records may not have a job_id.
     * Fall back to the accepted quote relationship.
     */

    const {
      data:
        quoteInvoices,
      error:
        linkedInvoicesError,
    } =
      await supabase
        .from(
          "invoices"
        )
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
        );

    if (
      linkedInvoicesError
    ) {
      console.error(
        "Guarantee invoice calculation error:",
        linkedInvoicesError
      );

      redirect(
        `/invoices/${invoiceId}?error=The%20linked%20invoices%20could%20not%20be%20checked`
      );
    }

    linkedInvoices =
      quoteInvoices ??
      [];
  }

  /* =========================================================
     FINANCIAL COMPLETION
     ========================================================= */

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
    approvedJobValue >
      0 &&
    totalInvoiced >=
      approvedJobValue -
        0.009;

  if (
    !fullyInvoiced
  ) {
    const remaining =
      money(
        Math.max(
          0,
          approvedJobValue -
            totalInvoiced
        )
      );

    redirect(
      `/invoices/${invoiceId}?error=${encodeURIComponent(
        `The approved job has not been fully invoiced yet. £${remaining.toFixed(
          2
        )} remains to invoice.`
      )}`
    );
  }

  const everyInvoicePaid =
    linkedInvoices.length >
      0 &&
    linkedInvoices.every(
      (
        linkedInvoice
      ) => {
        const invoiceTotal =
          invoiceRowTotal(
            linkedInvoice
          );

        const amountPaid =
          money(
            Number(
              linkedInvoice.amount_paid ??
                0
            )
          );

        return (
          invoiceTotal >
            0 &&
          amountPaid >=
            invoiceTotal -
              0.009
        );
      }
    );

  if (
    !everyInvoicePaid
  ) {
    redirect(
      `/invoices/${invoiceId}?error=Every%20active%20invoice%20for%20the%20approved%20job%20must%20be%20paid%20in%20full%20before%20a%20guarantee%20can%20be%20generated`
    );
  }

  /* =========================================================
     STOP DUPLICATE GUARANTEES

     Guarantees currently store invoice_id rather than
     job_id / quote_id.

     Therefore check every active invoice belonging to the
     completed job for an existing active guarantee.
     ========================================================= */

  const linkedInvoiceIds =
    linkedInvoices.map(
      (
        linkedInvoice
      ) =>
        linkedInvoice.id
    );

  if (
    linkedInvoiceIds.length >
    0
  ) {
    const {
      data:
        existingGuarantees,
    } =
      await supabase
        .from(
          "guarantees"
        )
        .select(
          "id"
        )
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
            ascending:
              false,
          }
        )
        .limit(
          1
        );

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

  /* =========================================================
     GENERATE GUARANTEE NUMBER

     Example:
     DH-G-2026-0001
     ========================================================= */

  const year =
    new Date()
      .getFullYear();

  const {
    data:
      latestGuarantee,
  } =
    await supabase
      .from(
        "guarantees"
      )
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
          ascending:
            false,
        }
      )
      .limit(
        1
      );

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

  /* =========================================================
     CREATE GUARANTEE
     ========================================================= */

  const {
    data:
      guarantee,
    error:
      guaranteeError,
  } =
    await supabase
      .from(
        "guarantees"
      )
      .insert({
        guarantee_number:
          guaranteeNumber,

        client_id:
          invoice.client_id,

        job_id:
          resolvedJobId,

        contract_id:
          invoice.contract_id,

        /*
         * Keep a source invoice for compatibility with
         * the existing guarantees schema/customer pages.
         *
         * Eligibility itself is based on the entire
         * approved job value.
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
          durationYears >
          0
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

  /* =========================================================
     REVALIDATE
     ========================================================= */

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
    resolvedJobId
  ) {
    revalidatePath(
      `/jobs/${resolvedJobId}`
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

function invoiceRowTotal(
  invoice: {
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
  }
) {
  const amount =
    Number(
      invoice.amount ??
        0
    );

  if (
    Number.isFinite(
      amount
    ) &&
    amount >
      0
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