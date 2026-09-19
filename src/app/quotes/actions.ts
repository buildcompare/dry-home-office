"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type RawQuoteItem = {
  description?: string;
  quantity?: number | string;
  unit?: string;
  unit_price?: number | string;
  item_type?: string;
};

export async function addQuote(
  formData: FormData
) {
  const supabase = await createClient();

  let clientId = String(
    formData.get("client_id") || ""
  ).trim();

  const jobId =
    String(
      formData.get("job_id") || ""
    ).trim() || null;

  const title = String(
    formData.get("title") || ""
  ).trim();

  const description = String(
    formData.get("description") || ""
  ).trim();

  const quoteDate = String(
    formData.get("quote_date") || ""
  ).trim();

  const validUntil =
    String(
      formData.get("valid_until") || ""
    ).trim() || null;

  const customerMessage =
    String(
      formData.get("customer_message") ||
        ""
    ).trim() || null;

  const terms =
    String(
      formData.get("terms") || ""
    ).trim() || null;

  const internalNotes =
    String(
      formData.get("internal_notes") ||
        ""
    ).trim() || null;

  const vatEnabled =
    String(
      formData.get("vat_enabled") ||
        "false"
    ) === "true";

  if (jobId) {
    const {
      data: job,
      error: jobError,
    } = await supabase
      .from("jobs")
      .select(
        "id, client_id"
      )
      .eq("id", jobId)
      .single();

    if (
      jobError ||
      !job
    ) {
      redirect(
        "/quotes/new?error=Unable%20to%20find%20the%20selected%20job"
      );
    }

    clientId =
      job.client_id;
  }

  if (!clientId) {
    redirect(
      "/quotes/new?error=Please%20select%20a%20client"
    );
  }

  if (!title) {
    redirect(
      "/quotes/new?error=Please%20enter%20a%20quote%20title"
    );
  }

  const rawItems = String(
    formData.get("items") ||
      "[]"
  );

  let parsedItems: RawQuoteItem[] =
    [];

  try {
    parsedItems =
      JSON.parse(rawItems);
  } catch {
    redirect(
      "/quotes/new?error=Unable%20to%20read%20quote%20items"
    );
  }

  const items = parsedItems
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
        item.description
          .length > 0
    );

  if (
    items.length === 0
  ) {
    redirect(
      "/quotes/new?error=Please%20add%20at%20least%20one%20labour%20or%20material%20item"
    );
  }

  const subtotal =
    items.reduce(
      (
        total,
        item
      ) =>
        total +
        item.quantity *
          item.unit_price,
      0
    );

  const vatRate = 20;

  const vatAmount =
    vatEnabled
      ? subtotal *
        (vatRate / 100)
      : 0;

  const total =
    subtotal +
    vatAmount;

  const {
    data: quote,
    error: quoteError,
  } = await supabase
    .from("quotes")
    .insert({
      client_id:
        clientId,
      job_id:
        jobId,
      title,
      description:
        description ||
        null,
      status:
        "Draft",
      quote_date:
        quoteDate,
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
      terms,
      internal_notes:
        internalNotes,
    })
    .select("id")
    .single();

  if (
    quoteError ||
    !quote
  ) {
    console.error(
      "Quote creation error:",
      quoteError
    );

    redirect(
      "/quotes/new?error=Unable%20to%20create%20quote"
    );
  }

  const quoteItems =
    items.map(
      (item) => ({
        quote_id:
          quote.id,
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
    error:
      itemsError,
  } = await supabase
    .from("quote_items")
    .insert(
      quoteItems
    );

  if (itemsError) {
    console.error(
      "Quote item creation error:",
      itemsError
    );

    await supabase
      .from("quotes")
      .delete()
      .eq(
        "id",
        quote.id
      );

    redirect(
      "/quotes/new?error=Unable%20to%20save%20quote%20items"
    );
  }

  revalidatePath("/");
  revalidatePath(
    "/quotes"
  );
  revalidatePath(
    `/quotes/${quote.id}`
  );

  if (jobId) {
    revalidatePath(
      `/jobs/${jobId}`
    );
  }

  revalidatePath(
    `/clients/${clientId}`
  );

  redirect(
    `/quotes/${quote.id}`
  );
}

export async function manuallyAcceptQuote(
  formData: FormData
) {
  const supabase =
    await createClient();

  const quoteId =
    String(
      formData.get(
        "quote_id"
      ) || ""
    ).trim();

  if (!quoteId) {
    redirect(
      "/quotes?error=Unable%20to%20find%20the%20quote"
    );
  }

  const {
    data: quote,
    error:
      quoteError,
  } = await supabase
    .from("quotes")
    .select(`
      id,
      client_id,
      job_id,
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
      `/quotes/${quoteId}?error=Unable%20to%20find%20the%20quote`
    );
  }

  if (
    quote.status ===
    "Accepted"
  ) {
    redirect(
      `/quotes/${quoteId}?warning=This%20quote%20is%20already%20accepted`
    );
  }

  const acceptedAt =
    new Date().toISOString();

  const {
    error:
      updateError,
  } = await supabase
    .from("quotes")
    .update({
      status:
        "Accepted",
      accepted_at:
        acceptedAt,
      declined_at:
        null,
    })
    .eq(
      "id",
      quoteId
    );

  if (updateError) {
    console.error(
      "Manual quote acceptance error:",
      updateError
    );

    redirect(
      `/quotes/${quoteId}?error=Unable%20to%20accept%20the%20quote`
    );
  }

  if (quote.job_id) {
    const {
      error:
        jobUpdateError,
    } = await supabase
      .from("jobs")
      .update({
        status:
          "Accepted",
      })
      .eq(
        "id",
        quote.job_id
      );

    if (
      jobUpdateError
    ) {
      console.error(
        "Job status update error:",
        jobUpdateError
      );
    }

    revalidatePath(
      `/jobs/${quote.job_id}`
    );
  }

  revalidatePath("/");
  revalidatePath(
    "/quotes"
  );
  revalidatePath(
    `/quotes/${quoteId}`
  );
  revalidatePath(
    `/clients/${quote.client_id}`
  );

  redirect(
    `/quotes/${quoteId}?accepted=manual`
  );
}