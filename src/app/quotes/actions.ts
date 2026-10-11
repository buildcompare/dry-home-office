"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logRecordActivity } from "@/lib/activity";
import { allocateDocumentNumber } from "@/lib/numbering";
import {
  calculateQuoteTotals,
  readQuoteFields,
  quoteEditRules,
  readQuoteItems,
} from "@/lib/quote-form";


export async function addQuote(
  formData: FormData
) {
  const supabase = await createClient();

  const fields = readQuoteFields(formData);

  let clientId = fields.clientId;

  const {
    jobId,
    title,
    description,
    quoteDate,
    validUntil,
    customerMessage,
    terms,
    internalNotes,
    vatEnabled,
  } = fields;

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

  const items =
    readQuoteItems(formData);

  if (!items) {
    redirect(
      "/quotes/new?error=Unable%20to%20read%20quote%20items"
    );
  }

  if (
    items.length === 0
  ) {
    redirect(
      "/quotes/new?error=Please%20add%20at%20least%20one%20labour%20or%20material%20item"
    );
  }

  const {
    subtotal,
    vatRate,
    vatAmount,
    total,
  } = calculateQuoteTotals(
    items,
    vatEnabled
  );

  const {
    data: quote,
    error: quoteError,
  } = await supabase
    .from("quotes")
    .insert({
      quote_number:
        await allocateDocumentNumber("quote"),
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

  await logRecordActivity(supabase, {
    event_type: "quote.accepted",
    record_type: "quote",
    record_id: String(quoteId),
    metadata: { manual: true },
  });

  redirect(
    `/quotes/${quoteId}?accepted=manual`
  );
}
/* =========================================================
   UPDATE QUOTE (Edit Quote)
   Same parsing and totals as addQuote. Line items are changed in a
   safe order – update kept lines, insert new lines, update the quote,
   then delete removed lines – and everything is put back if any step
   fails, so a failed save never loses data.
   ========================================================= */

type QuoteItemRow = {
  id: string;
  description: string | null;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  item_type: string | null;
  sort_order: number | null;
};

const QUOTE_EDIT_COLUMNS = `
  id,
  status,
  client_id,
  job_id,
  public_token,
  title,
  description,
  quote_date,
  valid_until,
  subtotal,
  vat_enabled,
  vat_rate,
  vat_amount,
  amount,
  customer_message,
  terms,
  internal_notes
`;

export async function updateQuote(
  formData: FormData
) {
  const supabase = await createClient();

  const quoteId = String(
    formData.get("quote_id") || ""
  ).trim();

  if (!quoteId) {
    redirect(
      "/quotes?error=Unable%20to%20find%20the%20quote"
    );
  }

  const back = `/quotes/${quoteId}/edit`;
  const fail = (message: string): never =>
    redirect(
      `${back}?error=${encodeURIComponent(message)}`
    );

  const intent = String(
    formData.get("intent") || "save"
  );

  const { data: original, error: loadError } =
    await supabase
      .from("quotes")
      .select(QUOTE_EDIT_COLUMNS)
      .eq("id", quoteId)
      .single();

  if (loadError || !original) {
    console.error("Quote edit load error:", loadError);
    redirect(
      "/quotes?error=Unable%20to%20find%20the%20quote"
    );
  }

  const rules = quoteEditRules(original.status);

  if (
    rules.needsAcceptedAck &&
    formData.get("accepted_ack") !== "yes"
  ) {
    fail(
      "This quote has been accepted. Tick the box to confirm you understand changes won't update any contract already created."
    );
  }

  const fields = readQuoteFields(formData);
  let clientId = fields.clientId;

  if (fields.jobId) {
    const { data: job, error: jobError } =
      await supabase
        .from("jobs")
        .select("id, client_id")
        .eq("id", fields.jobId)
        .single();

    if (jobError || !job) {
      fail("Unable to find the selected job");
    }

    clientId = job!.client_id;
  }

  if (!clientId) fail("Please select a client");
  if (!fields.title) fail("Please enter a quote title");

  const items = readQuoteItems(formData);

  if (!items) fail("Unable to read quote items");

  if (items!.length === 0) {
    fail("Please add at least one labour or material item");
  }

  const totals = calculateQuoteTotals(
    items!,
    fields.vatEnabled
  );

  /* ---------- current lines ---------- */

  const { data: existingData, error: existingError } =
    await supabase
      .from("quote_items")
      .select(
        "id, description, quantity, unit, unit_price, item_type, sort_order"
      )
      .eq("quote_id", quoteId);

  if (existingError) {
    console.error("Quote edit items load error:", existingError);
    fail("The current line items could not be loaded, so nothing was changed.");
  }

  const existing = (existingData ?? []) as QuoteItemRow[];
  const existingById = new Map(
    existing.map((row) => [String(row.id), row])
  );

  const kept = items!.filter(
    (item) => item.id && existingById.has(item.id)
  );
  const added = items!.filter(
    (item) => !item.id || !existingById.has(item.id)
  );
  const keptIds = new Set(kept.map((item) => item.id));
  const removed = existing.filter(
    (row) => !keptIds.has(String(row.id))
  );

  /* ---------- rollback ---------- */

  const updatedOriginals: QuoteItemRow[] = [];
  let insertedIds: string[] = [];
  let headerUpdated = false;

  async function rollback() {
    let ok = true;

    if (headerUpdated) {
      const { error } = await supabase
        .from("quotes")
        .update({
          client_id: original!.client_id,
          job_id: original!.job_id,
          title: original!.title,
          description: original!.description,
          quote_date: original!.quote_date,
          valid_until: original!.valid_until,
          subtotal: original!.subtotal,
          vat_enabled: original!.vat_enabled,
          vat_rate: original!.vat_rate,
          vat_amount: original!.vat_amount,
          amount: original!.amount,
          customer_message: original!.customer_message,
          terms: original!.terms,
          internal_notes: original!.internal_notes,
        })
        .eq("id", quoteId);
      if (error) ok = false;
    }

    if (insertedIds.length > 0) {
      const { error } = await supabase
        .from("quote_items")
        .delete()
        .in("id", insertedIds);
      if (error) ok = false;
    }

    for (const row of updatedOriginals) {
      const { error } = await supabase
        .from("quote_items")
        .update({
          description: row.description,
          quantity: row.quantity,
          unit: row.unit,
          unit_price: row.unit_price,
          item_type: row.item_type,
          sort_order: row.sort_order,
        })
        .eq("id", row.id);
      if (error) ok = false;
    }

    return ok;
  }

  async function abort(step: string, error: unknown): Promise<never> {
    console.error(`Quote edit ${step} error:`, error);
    const restored = await rollback();

    return fail(
      restored
        ? `Your changes could not be saved (${step}). The quote has been left exactly as it was.`
        : `Your changes could not be saved (${step}), and the quote could not be fully put back. Please check its line items before sending it.`
    );
  }

  /* 1. Update kept lines */

  for (const item of kept) {
    const { data, error } = await supabase
      .from("quote_items")
      .update({
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        item_type: item.item_type,
        sort_order: item.sort_order,
      })
      .eq("id", item.id!)
      .eq("quote_id", quoteId)
      .select("id");

    if (error || !data || data.length === 0) {
      await abort("updating a line item", error ?? "no row updated");
    }

    updatedOriginals.push(existingById.get(item.id!)!);
  }

  /* 2. Insert new lines */

  if (added.length > 0) {
    const { data, error } = await supabase
      .from("quote_items")
      .insert(
        added.map((item) => ({
          quote_id: quoteId,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          item_type: item.item_type,
          sort_order: item.sort_order,
        }))
      )
      .select("id");

    if (error || !data || data.length !== added.length) {
      insertedIds = (data ?? []).map((row) => String(row.id));
      await abort("adding new line items", error ?? "not all lines saved");
    }

    insertedIds = (data ?? []).map((row) => String(row.id));
  }

  /* 3. Update the quote */

  const { data: headerData, error: headerError } = await supabase
    .from("quotes")
    .update({
      client_id: clientId,
      job_id: fields.jobId,
      title: fields.title,
      description: fields.description || null,
      quote_date: fields.quoteDate,
      valid_until: fields.validUntil,
      subtotal: totals.subtotal,
      vat_enabled: fields.vatEnabled,
      vat_rate: totals.vatRate,
      vat_amount: totals.vatAmount,
      amount: totals.total,
      customer_message: fields.customerMessage,
      terms: fields.terms,
      internal_notes: fields.internalNotes,
    })
    .eq("id", quoteId)
    .select("id");

  if (headerError || !headerData || headerData.length === 0) {
    await abort("updating the quote", headerError ?? "no row updated");
  }

  headerUpdated = true;

  /* 4. Delete removed lines (last, so nothing is lost if an earlier step fails) */

  if (removed.length > 0) {
    const removedIds = removed.map((row) => String(row.id));
    const { data, error } = await supabase
      .from("quote_items")
      .delete()
      .in("id", removedIds)
      .eq("quote_id", quoteId)
      .select("id");

    if (error || (data?.length ?? 0) < removedIds.length) {
      await abort(
        "removing deleted line items",
        error ?? "row level security blocked deleting from quote_items"
      );
    }
  }

  /* ---------- done ---------- */

  revalidatePath("/");
  revalidatePath("/quotes");
  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath(back);

  if (original.public_token) {
    revalidatePath(`/q/${original.public_token}`);
  }

  for (const jobId of new Set([original.job_id, fields.jobId].filter(Boolean))) {
    revalidatePath(`/jobs/${jobId}`);
  }

  for (const id of new Set([original.client_id, clientId].filter(Boolean))) {
    revalidatePath(`/clients/${id}`);
  }

  redirect(
    intent === "save_resend" && rules.clientHasOlderVersion
      ? `/quotes/${quoteId}?saved=1&resend=1`
      : `/quotes/${quoteId}?saved=1`
  );
}
