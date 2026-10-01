import { createClient } from "@/lib/supabase/server";

export type NumberKind = "quote" | "invoice" | "contract" | "guarantee" | "job";

const fallback = {
  quote_prefix: "Q-",
  invoice_prefix: "INV-",
  contract_prefix: "C-",
  guarantee_prefix: "G-",
  job_prefix: "JOB-",
  quote_next: 1001,
  invoice_next: 1001,
  contract_next: 1001,
  guarantee_next: 1001,
  job_next: 1001,
};

export function formatDocumentNumber(prefix: string, next: number) {
  return `${prefix}${String(next).padStart(4, "0")}`;
}

export async function allocateDocumentNumber(kind: NumberKind) {
  const supabase = await createClient();
  const prefixKey = `${kind}_prefix`;
  const nextKey = `${kind}_next`;

  const { data, error } = await supabase
    .from("office_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) {
    return formatDocumentNumber(
      fallback[prefixKey as keyof typeof fallback] as string,
      fallback[nextKey as keyof typeof fallback] as number
    );
  }

  const prefix = String(data[prefixKey] || fallback[prefixKey as keyof typeof fallback]);
  const next = Number(data[nextKey] || 1001);
  const number = formatDocumentNumber(prefix, next);

  await supabase
    .from("office_settings")
    .update({ [nextKey]: next + 1 })
    .eq("id", 1);

  return number;
}
