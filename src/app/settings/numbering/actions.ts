"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function saveNumbering(formData: FormData) {
  const supabase = await createClient();
  const row = {
    id: 1,
    quote_prefix: String(formData.get("quote_prefix") ?? "Q-").trim() || "Q-",
    invoice_prefix: String(formData.get("invoice_prefix") ?? "INV-").trim() || "INV-",
    contract_prefix: String(formData.get("contract_prefix") ?? "C-").trim() || "C-",
    guarantee_prefix: String(formData.get("guarantee_prefix") ?? "G-").trim() || "G-",
    job_prefix: String(formData.get("job_prefix") ?? "JOB-").trim() || "JOB-",
    quote_next: Number(formData.get("quote_next") ?? 1001),
    invoice_next: Number(formData.get("invoice_next") ?? 1001),
    contract_next: Number(formData.get("contract_next") ?? 1001),
    guarantee_next: Number(formData.get("guarantee_next") ?? 1001),
    job_next: Number(formData.get("job_next") ?? 1001),
  };

  const { error } = await supabase.from("office_settings").upsert(row);
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings/numbering");
}
