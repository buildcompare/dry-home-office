"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type RawVariationItem = {
  description?: string;
  quantity?: number | string;
  unit?: string;
  unit_price?: number | string;
  item_type?: string;
};

/* =========================================================
   CREATE VARIATION
   ========================================================= */

export async function addVariation(
  formData: FormData
) {
  const supabase =
    await createClient();

  const jobId =
    String(
      formData.get("job_id") || ""
    ).trim();

  const quoteId =
    String(
      formData.get("quote_id") || ""
    ).trim() || null;

  const title =
    String(
      formData.get("title") || ""
    ).trim();

  const description =
    String(
      formData.get("description") || ""
    ).trim();

  const variationDate =
    String(
      formData.get("variation_date") || ""
    ).trim();

  const validUntil =
    String(
      formData.get("valid_until") || ""
    ).trim() || null;

  const customerMessage =
    String(
      formData.get("customer_message") || ""
    ).trim() || null;

  const internalNotes =
    String(
      formData.get("internal_notes") || ""
    ).trim() || null;

  const vatEnabled =
    String(
      formData.get("vat_enabled") || "false"
    ) === "true";

  /* =========================================================
     VALIDATE JOB
     ========================================================= */

  if (!jobId) {
    redirect(
      "/variations/new?error=Please%20select%20a%20job"
    );
  }

  const {
    data: job,
    error: jobError,
  } = await supabase
    .from("jobs")
    .select(`
      id,
      client_id,
      status
    `)
    .eq(
      "id",
      jobId
    )
    .single();

  if (
    jobError ||
    !job
  ) {
    redirect(
      "/variations/new?error=Unable%20to%20find%20the%20selected%20job"
    );
  }

  const clientId =
    job.client_id;

  if (!clientId) {
    redirect(
      `/jobs/${jobId}?error=This%20job%20does%20not%20have%20a%20client`
    );
  }

  /* =========================================================
     VALIDATE QUOTE
     ========================================================= */

  if (quoteId) {
    const {
      data: quote,
      error: quoteError,
    } = await supabase
      .from("quotes")
      .select(`
        id,
        job_id,
        client_id,
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
        `/jobs/${jobId}?error=Unable%20to%20find%20the%20linked%20quote`
      );
    }

    if (
      quote.job_id &&
      quote.job_id !== jobId
    ) {
      redirect(
        `/jobs/${jobId}?error=The%20selected%20quote%20does%20not%20belong%20to%20this%20job`
      );
    }
  }

  /* =========================================================
     BASIC VALIDATION
     ========================================================= */

  if (!title) {
    redirect(
      `/variations/new?job=${jobId}&error=Please%20enter%20a%20variation%20title`
    );
  }

  if (!variationDate) {
    redirect(
      `/variations/new?job=${jobId}&error=Please%20enter%20a%20variation%20date`
    );
  }

  /* =========================================================
     ITEMS
     ========================================================= */

  const rawItems =
    String(
      formData.get("items") || "[]"
    );

  let parsedItems:
    RawVariationItem[] = [];

  try {
    parsedItems =
      JSON.parse(
        rawItems
      );
  } catch {
    redirect(
      `/variations/new?job=${jobId}&error=Unable%20to%20read%20variation%20items`
    );
  }

  const items =
    parsedItems
      .map(
        (
          item,
          index
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

          const itemType =
            item.item_type ===
            "Materials"
              ? "Materials"
              : "Labour";

          return {
            description:
              String(
                item.description ||
                  ""
              ).trim(),

            quantity:
              Number.isFinite(
                quantity
              ) &&
              quantity > 0
                ? quantity
                : 1,

            unit:
              String(
                item.unit ||
                  ""
              ).trim() ||
              "item",

            unit_price:
              Number.isFinite(
                unitPrice
              ) &&
              unitPrice >= 0
                ? unitPrice
                : 0,

            item_type:
              itemType,

            sort_order:
              index,
          };
        }
      )
      .filter(
        (item) =>
          item.description.length >
          0
      );

  if (
    items.length === 0
  ) {
    redirect(
      `/variations/new?job=${jobId}&error=Please%20add%20at%20least%20one%20labour%20or%20material%20item`
    );
  }

  /* =========================================================
     TOTALS
     ========================================================= */

  const subtotal =
    money(
      items.reduce(
        (
          total,
          item
        ) =>
          total +
          item.quantity *
            item.unit_price,
        0
      )
    );

  const vatRate =
    20;

  const vatAmount =
    vatEnabled
      ? money(
          subtotal *
            (vatRate / 100)
        )
      : 0;

  const total =
    money(
      subtotal +
        vatAmount
    );

  /* =========================================================
     CREATE VARIATION
     ========================================================= */

  const {
    data: variation,
    error: variationError,
  } = await supabase
    .from("variations")
    .insert({
      job_id:
        jobId,

      client_id:
        clientId,

      quote_id:
        quoteId,

      title,

      description:
        description ||
        null,

      status:
        "Draft",

      variation_date:
        variationDate,

      valid_until:
        validUntil,

      subtotal,

      vat_enabled:
        vatEnabled,

      vat_rate:
        vatRate,

      vat_amount:
        vatAmount,

      amount:
        total,

      customer_message:
        customerMessage,

      internal_notes:
        internalNotes,
    })
    .select(`
      id,
      variation_number
    `)
    .single();

  if (
    variationError ||
    !variation
  ) {
    console.error(
      "Variation creation error:",
      variationError
    );

    redirect(
      `/variations/new?job=${jobId}&error=Unable%20to%20create%20variation`
    );
  }

  /* =========================================================
     CREATE ITEMS
     ========================================================= */

  const variationItems =
    items.map(
      (item) => ({
        variation_id:
          variation.id,

        description:
          item.description,

        quantity:
          item.quantity,

        unit:
          item.unit,

        unit_price:
          item.unit_price,

        item_type:
          item.item_type,

        sort_order:
          item.sort_order,
      })
    );

  const {
    error: itemsError,
  } = await supabase
    .from(
      "variation_items"
    )
    .insert(
      variationItems
    );

  if (itemsError) {
    console.error(
      "Variation item creation error:",
      itemsError
    );

    /*
     * Clean up the variation if its
     * line items failed to save.
     */

    await supabase
      .from("variations")
      .delete()
      .eq(
        "id",
        variation.id
      );

    redirect(
      `/variations/new?job=${jobId}&error=Unable%20to%20save%20variation%20items`
    );
  }

  /* =========================================================
     REVALIDATE
     ========================================================= */

  revalidatePath(
    "/"
  );

  revalidatePath(
    "/variations"
  );

  revalidatePath(
    `/variations/${variation.id}`
  );

  revalidatePath(
    `/jobs/${jobId}`
  );

  revalidatePath(
    `/clients/${clientId}`
  );

  if (quoteId) {
    revalidatePath(
      `/quotes/${quoteId}`
    );
  }

  redirect(
    `/variations/${variation.id}`
  );
}

/* =========================================================
   MANUAL ACCEPT
   ========================================================= */

export async function manuallyAcceptVariation(
  formData: FormData
) {
  const supabase =
    await createClient();

  const variationId =
    String(
      formData.get(
        "variation_id"
      ) || ""
    ).trim();

  const acceptedBy =
    String(
      formData.get(
        "accepted_by"
      ) || ""
    ).trim() || null;

  if (!variationId) {
    redirect(
      "/variations?error=Unable%20to%20find%20the%20variation"
    );
  }

  const {
    data: variation,
    error: variationError,
  } = await supabase
    .from("variations")
    .select(`
      id,
      client_id,
      job_id,
      quote_id,
      status
    `)
    .eq(
      "id",
      variationId
    )
    .single();

  if (
    variationError ||
    !variation
  ) {
    redirect(
      `/variations/${variationId}?error=Unable%20to%20find%20the%20variation`
    );
  }

  if (
    variation.status ===
    "Accepted"
  ) {
    redirect(
      `/variations/${variationId}?warning=This%20variation%20is%20already%20accepted`
    );
  }

  if (
    variation.status ===
      "Cancelled" ||
    variation.status ===
      "Declined"
  ) {
    redirect(
      `/variations/${variationId}?error=This%20variation%20cannot%20be%20accepted%20in%20its%20current%20status`
    );
  }

  const acceptedAt =
    new Date().toISOString();

  const {
    error: updateError,
  } = await supabase
    .from("variations")
    .update({
      status:
        "Accepted",

      accepted_at:
        acceptedAt,

      declined_at:
        null,

      acceptance_method:
        "Manual",

      accepted_by:
        acceptedBy,
    })
    .eq(
      "id",
      variationId
    );

  if (updateError) {
    console.error(
      "Manual variation acceptance error:",
      updateError
    );

    redirect(
      `/variations/${variationId}?error=Unable%20to%20accept%20the%20variation`
    );
  }

  /* =========================================================
     IMPORTANT:
     Do not alter the Job status here.
     
     A variation may be accepted while the job is already
     Scheduled or In Progress, so changing the Job back to
     Accepted would corrupt the operational workflow.
     ========================================================= */

  revalidatePath(
    "/"
  );

  revalidatePath(
    "/variations"
  );

  revalidatePath(
    `/variations/${variationId}`
  );

  revalidatePath(
    `/jobs/${variation.job_id}`
  );

  if (
    variation.client_id
  ) {
    revalidatePath(
      `/clients/${variation.client_id}`
    );
  }

  if (
    variation.quote_id
  ) {
    revalidatePath(
      `/quotes/${variation.quote_id}`
    );
  }

  redirect(
    `/variations/${variationId}?accepted=manual`
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