"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function addContract(
  formData: FormData
) {
  const supabase = await createClient();

  const quoteId =
    String(
      formData.get("quote_id") || ""
    ).trim() || null;

  let clientId =
    String(
      formData.get("client_id") || ""
    ).trim();

  let jobId =
    String(
      formData.get("job_id") || ""
    ).trim() || null;

  const title =
    String(
      formData.get("title") || ""
    ).trim() || null;

  const description =
    String(
      formData.get("description") || ""
    ).trim() || null;

  const terms =
    String(
      formData.get("terms") || ""
    ).trim() || null;

  const customerMessage =
    String(
      formData.get("customer_message") || ""
    ).trim() || null;

  const internalNotes =
    String(
      formData.get("internal_notes") || ""
    ).trim() || null;

  const contractDate =
    String(
      formData.get("contract_date") || ""
    ).trim();

  const amountRaw =
    String(
      formData.get("amount") || "0"
    ).trim();

  const amount =
    Number(amountRaw);

  if (
    !Number.isFinite(amount) ||
    amount < 0
  ) {
    redirect(
      "/contracts/new?error=Please%20enter%20a%20valid%20contract%20value"
    );
  }

  /*
   * If this contract came from a quote,
   * always trust the quote for the linked
   * client/job.
   */
  if (quoteId) {
    const {
      data: quote,
      error: quoteError,
    } = await supabase
      .from("quotes")
      .select(`
        id,
        client_id,
        job_id,
        status
      `)
      .eq("id", quoteId)
      .single();

    if (quoteError || !quote) {
      redirect(
        "/contracts/new?error=Unable%20to%20find%20the%20selected%20quote"
      );
    }

    if (quote.status !== "Accepted") {
      redirect(
        "/contracts/new?error=Contracts%20can%20only%20be%20created%20from%20accepted%20quotes"
      );
    }

    clientId = quote.client_id;
    jobId = quote.job_id;
  }

  if (!clientId) {
    redirect(
      "/contracts/new?error=Please%20select%20a%20client"
    );
  }

  const {
    data: contract,
    error,
  } = await supabase
    .from("contracts")
    .insert({
      client_id: clientId,
      job_id: jobId,
      quote_id: quoteId,
      title,
      status: "Draft",
      contract_date:
        contractDate ||
        new Date()
          .toISOString()
          .slice(0, 10),
      description,
      terms,
      customer_message:
        customerMessage,
      internal_notes:
        internalNotes,
      amount,
    })
    .select("id")
    .single();

  if (error || !contract) {
    console.error(
      "Contract creation error:",
      error
    );

    redirect(
      "/contracts/new?error=Unable%20to%20create%20contract"
    );
  }

  revalidatePath("/");
  revalidatePath("/contracts");

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

  revalidatePath(
    `/clients/${clientId}`
  );

  redirect(
    `/contracts/${contract.id}`
  );
}