"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createGuarantee(
  formData: FormData
) {
  const supabase =
    await createClient();

  const invoiceId =
    String(
      formData.get("invoice_id") || ""
    ).trim();

  const guaranteeType =
    String(
      formData.get("guarantee_type") || ""
    ).trim() || null;

  const title =
    String(
      formData.get("title") || ""
    ).trim() || null;

  const issueDate =
    String(
      formData.get("issue_date") || ""
    ).trim();

  const durationYears =
    Number(
      formData.get("duration_years") || 0
    );

  const expiryDate =
    String(
      formData.get("expiry_date") || ""
    ).trim() || null;

  const coveredWorks =
    String(
      formData.get("covered_works") || ""
    ).trim() || null;

  const terms =
    String(
      formData.get("terms") || ""
    ).trim() || null;

  const exclusions =
    String(
      formData.get("exclusions") || ""
    ).trim() || null;

  const customerMessage =
    String(
      formData.get("customer_message") || ""
    ).trim() || null;

  const internalNotes =
    String(
      formData.get("internal_notes") || ""
    ).trim() || null;

  if (!invoiceId) {
    redirect(
      "/guarantees/new?error=Invoice%20could%20not%20be%20identified"
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
      "/guarantees/new?error=Invoice%20could%20not%20be%20found"
    );
  }

  if (
    invoice.invoice_type !==
    "Final"
  ) {
    redirect(
      `/invoices/${invoiceId}?error=Guarantees%20can%20only%20be%20generated%20from%20a%20Final%20invoice`
    );
  }

  if (
    invoice.status !==
    "Paid"
  ) {
    redirect(
      `/invoices/${invoiceId}?error=The%20Final%20invoice%20must%20be%20paid%20before%20a%20guarantee%20can%20be%20generated`
    );
  }

  const invoiceTotal =
    Number(
      invoice.amount ?? 0
    );

  const amountPaid =
    Number(
      invoice.amount_paid ?? 0
    );

  if (
    amountPaid <
    invoiceTotal - 0.009
  ) {
    redirect(
      `/invoices/${invoiceId}?error=The%20invoice%20has%20not%20been%20paid%20in%20full`
    );
  }

  /*
   * Stop duplicate guarantees being
   * created from the same invoice.
   */
  const {
    data: existingGuarantee,
  } = await supabase
    .from("guarantees")
    .select("id")
    .eq(
      "invoice_id",
      invoiceId
    )
    .neq(
      "status",
      "Cancelled"
    )
    .maybeSingle();

  if (
    existingGuarantee
  ) {
    redirect(
      `/guarantees/${existingGuarantee.id}`
    );
  }

  /*
   * Generate the next guarantee number.
   *
   * Format:
   * DH-G-2026-0001
   */
  const year =
    new Date().getFullYear();

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

  let nextNumber = 1;

  if (
    latestGuarantee &&
    latestGuarantee.length > 0
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
        lastSequence + 1;
    }
  }

  const guaranteeNumber =
    `DH-G-${year}-${String(
      nextNumber
    ).padStart(4, "0")}`;

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
          .slice(0, 10),

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
    .select("id")
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

  revalidatePath(
    "/guarantees"
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
    `/guarantees/${guarantee.id}`
  );
}