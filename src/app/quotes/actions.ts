"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type QuoteItemInput = {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
};

export async function addQuote(formData: FormData) {
  const supabase = await createClient();

  const jobId =
    String(formData.get("job_id") ?? "").trim() || null;

  let clientId =
    String(formData.get("client_id") ?? "").trim() || null;

  const title =
    String(formData.get("title") ?? "").trim();

  const quoteDate =
    String(formData.get("quote_date") ?? "").trim();

  const validUntil =
    String(formData.get("valid_until") ?? "").trim() || null;

  const customerMessage =
    String(formData.get("customer_message") ?? "").trim() || null;

  const terms =
    String(formData.get("terms") ?? "").trim() || null;

  const internalNotes =
    String(formData.get("internal_notes") ?? "").trim() || null;

  const rawItems =
    String(formData.get("items") ?? "[]");

  if (!title || !quoteDate) {
    redirect(
      `/quotes/new?job=${jobId ?? ""}&error=Quote%20title%20and%20date%20are%20required`
    );
  }

  if (jobId) {
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select(`
        id,
        client_id
      `)
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      console.error(jobError);

      redirect(
        `/quotes/new?error=Unable%20to%20find%20the%20selected%20job`
      );
    }

    clientId = job.client_id;
  }

  if (!clientId) {
    redirect(
      `/quotes/new?job=${jobId ?? ""}&error=A%20client%20is%20required`
    );
  }

  let parsedItems: QuoteItemInput[] = [];

  try {
    const incoming = JSON.parse(rawItems);

    if (!Array.isArray(incoming)) {
      throw new Error("Quote items must be an array.");
    }

    parsedItems = incoming
      .map((item) => ({
        description: String(item.description ?? "").trim(),
        quantity: Number(item.quantity ?? 0),
        unit: String(item.unit ?? "").trim(),
        unit_price: Number(item.unit_price ?? 0),
      }))
      .filter((item) => item.description);
  } catch (error) {
    console.error(error);

    redirect(
      `/quotes/new?job=${jobId ?? ""}&error=Unable%20to%20read%20quote%20items`
    );
  }

  if (parsedItems.length === 0) {
    redirect(
      `/quotes/new?job=${jobId ?? ""}&error=Please%20add%20at%20least%20one%20quote%20item`
    );
  }

  const invalidItem = parsedItems.some(
    (item) =>
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0 ||
      !Number.isFinite(item.unit_price) ||
      item.unit_price < 0
  );

  if (invalidItem) {
    redirect(
      `/quotes/new?job=${jobId ?? ""}&error=Quote%20items%20contain%20invalid%20values`
    );
  }

  const amount = parsedItems.reduce(
    (total, item) =>
      total + item.quantity * item.unit_price,
    0
  );

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .insert({
      client_id: clientId,
      job_id: jobId,
      title,
      status: "Draft",
      quote_date: quoteDate,
      valid_until: validUntil,
      amount,
      customer_message: customerMessage,
      terms,
      internal_notes: internalNotes,
    })
    .select(`
      id,
      quote_number
    `)
    .single();

  if (quoteError || !quote) {
    console.error("Quote insert error:", quoteError);

    redirect(
      `/quotes/new?job=${jobId ?? ""}&error=Unable%20to%20save%20quote`
    );
  }

  const quoteItems = parsedItems.map(
    (item, index) => ({
      quote_id: quote.id,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit || null,
      unit_price: item.unit_price,
      sort_order: index,
    })
  );

  const { error: itemError } = await supabase
    .from("quote_items")
    .insert(quoteItems);

  if (itemError) {
    console.error("Quote item insert error:", itemError);

    await supabase
      .from("quotes")
      .delete()
      .eq("id", quote.id);

    redirect(
      `/quotes/new?job=${jobId ?? ""}&error=Unable%20to%20save%20quote%20items`
    );
  }

  revalidatePath("/quotes");
  revalidatePath("/");

  if (jobId) {
    revalidatePath(`/jobs/${jobId}`);
  }

  revalidatePath(`/clients/${clientId}`);

  redirect(`/quotes/${quote.id}`);
}