"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { formatCurrency, money } from "@/lib/money";
import {
  DeleteError,
  collectDeleteGraph,
  deleteContractRecord,
  deleteGraph,
  deleteGuaranteeRecord,
  deleteInvoiceRecord,
  deleteQuoteRecord,
  deleteVariationRecord,
  graphPaidTotal,
  graphSummary,
  graphTotal,
  invoicePayments,
  linkedRefs,
  loadSingle,
} from "@/lib/record-delete";
import {
  confirmSatisfied,
  isDeleteKind,
  type DeleteKind,
  type DeletePreview,
  type DeleteState,
} from "@/lib/delete-preview";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type Plan = Extract<DeletePreview, { ok: true }> & {
  run: (supabase: SupabaseServerClient) => Promise<{ done: string[]; warnings: string[] }>;
  redirectTo: (message: string) => string;
};

const str = (value: unknown) => (value === null || value === undefined ? "" : String(value));

function listLabels(refs: { label: string }[], max = 4) {
  const shown = refs.slice(0, max).map((ref) => ref.label);
  return refs.length > max ? `${shown.join(", ")} and ${refs.length - max} more` : shown.join(", ");
}

function withParam(path: string, key: string, value: string) {
  const [base, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set(key, value.slice(0, 400));
  return `${base}?${params.toString()}`;
}

/* =========================================================
   PLANS (what will be deleted, how to confirm, how to run it)
   ========================================================= */

async function buildPlan(supabase: SupabaseServerClient, kind: DeleteKind, id: string): Promise<Plan> {
  const base = { ok: true as const, kind, id, notes: [] as string[], summary: [] as Plan["summary"], blocked: null as string | null };

  /* ---------- job / survey: the job and everything linked ---------- */

  if (kind === "job" || kind === "survey") {
    const graph = await collectDeleteGraph(supabase, { jobIds: [id] });
    const job = graph.jobs.find((ref) => ref.id === id);
    if (!job) throw new DeleteError(kind === "survey" ? "This survey could not be found." : "This job could not be found.");

    const name = job.label.split(" – ")[0] || job.label;
    const linked = graphTotal(graph) - 1;
    const paid = graphPaidTotal(graph);
    const noun = kind === "survey" ? "survey" : "job";
    const notes: string[] = [];

    if (paid > 0) notes.push(`This ${noun} has ${formatCurrency(paid)} of payments recorded. Those payment records are deleted too.`);
    if (graph.scheduleEvents.some((event) => event.google_event_id)) notes.push("Appointments copied to Google Calendar are deleted there as well.");
    if (!graph.surveyReportsAvailable) notes.push("Survey reports storage isn't set up yet, so there are no reports to delete.");

    return {
      ...base,
      name,
      heading: `Delete ${name}?`,
      warning:
        linked > 0
          ? `This permanently deletes the ${noun} and everything linked to it. It cannot be undone.`
          : `This permanently deletes the ${noun}. Nothing else is linked to it. It cannot be undone.`,
      notes,
      summary: graphSummary(graph),
      confirm:
        paid > 0
          ? { mode: "type", text: name, label: `Type ${name} to confirm` }
          : linked > 0
            ? { mode: "tick", label: `I understand this deletes ${name} and the ${linked} linked record${linked === 1 ? "" : "s"} listed above.` }
            : { mode: "none" },
      token: `${graphTotal(graph)}:${money(paid)}`,
      submitLabel: linked > 0 ? `Delete ${noun} and everything linked to it` : `Delete ${noun}`,
      run: (client) => deleteGraph(client, graph),
      redirectTo: (message) => withParam(kind === "survey" ? "/surveys" : "/jobs", kind === "survey" ? "notice" : "deleted", message),
    };
  }

  /* ---------- client ---------- */

  if (kind === "client") {
    const graph = await collectDeleteGraph(supabase, { clientId: id });
    const name = graph.client?.label ?? "Client";
    const linked = graphTotal(graph) - 1;
    const paid = graphPaidTotal(graph);
    const notes: string[] = [];

    if (paid > 0) notes.push(`Their invoices have ${formatCurrency(paid)} of payments recorded. Those payment records are deleted too.`);
    if (graph.scheduleEvents.some((event) => event.google_event_id)) notes.push("Appointments copied to Google Calendar are deleted there as well.");

    return {
      ...base,
      name,
      heading: `Delete ${name}?`,
      warning:
        linked > 0
          ? "This permanently deletes the client and all their records listed below. It cannot be undone."
          : "This client has no linked records. Deleting them is permanent and cannot be undone.",
      notes,
      summary: graphSummary(graph),
      confirm:
        linked > 0
          ? { mode: "type", text: name, label: `Type the client's name (${name}) to confirm` }
          : { mode: "tick", label: "I understand that deleting this client is permanent and cannot be undone." },
      token: `${graphTotal(graph)}:${money(paid)}`,
      submitLabel: linked > 0 ? "Delete client and all their records" : "Delete client permanently",
      run: (client) => deleteGraph(client, graph),
      redirectTo: (message) => withParam("/clients", "deleted", message),
    };
  }

  /* ---------- invoice ---------- */

  if (kind === "invoice") {
    const invoice = await loadSingle(supabase, "invoices", id);
    if (!invoice) throw new DeleteError("This invoice could not be found.");

    const name = str(invoice.invoice_number) || "this invoice";
    const payments = await invoicePayments(supabase, id);
    const paid = money(Math.max(payments.reduce((sum, p) => sum + p.amount, 0), Number(invoice.amount_paid ?? 0) || 0));
    const guarantees = await linkedRefs(supabase, "guarantees", "invoice_id", id, "guarantee_number", "guarantee");
    const notes: string[] = [];

    if (paid > 0) {
      notes.push(
        `This invoice has ${formatCurrency(paid)} of payments recorded. ${
          payments.length > 0 ? `The ${payments.length === 1 ? "payment record is" : `${payments.length} payment records are`} deleted too.` : ""
        }`.trim()
      );
    }
    if (guarantees.length > 0) {
      notes.push(`${listLabels(guarantees)} ${guarantees.length === 1 ? "is" : "are"} linked to this invoice. The link is cleared and the guarantee${guarantees.length === 1 ? " is" : "s are"} kept.`);
    }

    return {
      ...base,
      name,
      heading: `Delete ${name}?`,
      warning: "This permanently deletes the invoice and its line items. It cannot be undone.",
      notes,
      summary: payments.length > 0 ? [{ label: `${payments.length} payment record${payments.length === 1 ? "" : "s"}`, items: payments.map((p) => formatCurrency(p.amount)) }] : [],
      confirm:
        paid > 0
          ? { mode: "type", text: name, label: `Type ${name} to confirm` }
          : guarantees.length > 0
            ? { mode: "tick", label: "I understand the guarantee link will be cleared." }
            : { mode: "none" },
      token: `${payments.length}:${guarantees.length}:${paid}`,
      submitLabel: "Delete invoice",
      run: async (client) => ({ done: await deleteInvoiceRecord(client, id, name), warnings: [] }),
      redirectTo: (message) => withParam("/invoices", "deleted", message),
    };
  }

  /* ---------- quote ---------- */

  if (kind === "quote") {
    const quote = await loadSingle(supabase, "quotes", id);
    if (!quote) throw new DeleteError("This quote could not be found.");

    const name = str(quote.quote_number) || "this quote";
    const [contracts, invoices, variations] = await Promise.all([
      linkedRefs(supabase, "contracts", "quote_id", id, "contract_number", "contract"),
      linkedRefs(supabase, "invoices", "quote_id", id, "invoice_number", "invoice"),
      linkedRefs(supabase, "variations", "quote_id", id, "variation_number", "variation"),
    ]);
    const users = [...contracts, ...variations, ...invoices];

    return {
      ...base,
      name,
      heading: `Delete ${name}?`,
      warning: "This permanently deletes the quote and its line items. It cannot be undone.",
      blocked:
        users.length > 0
          ? `${name} can't be deleted on its own because ${listLabels(users, 6)} ${users.length === 1 ? "is" : "are"} based on it. Delete ${users.length === 1 ? "that" : "those"} first, or use “Delete job and everything linked to it” on the job page.`
          : null,
      confirm: { mode: "none" },
      token: `${users.length}`,
      submitLabel: "Delete quote",
      run: async (client) => ({ done: await deleteQuoteRecord(client, id, name), warnings: [] }),
      redirectTo: (message) => withParam("/quotes", "deleted", message),
    };
  }

  /* ---------- contract ---------- */

  if (kind === "contract") {
    const contract = await loadSingle(supabase, "contracts", id);
    if (!contract) throw new DeleteError("This contract could not be found.");

    const name = str(contract.contract_number) || "this contract";
    const [invoices, guarantees, events] = await Promise.all([
      linkedRefs(supabase, "invoices", "contract_id", id, "invoice_number", "invoice"),
      linkedRefs(supabase, "guarantees", "contract_id", id, "guarantee_number", "guarantee"),
      linkedRefs(supabase, "schedule_events", "contract_id", id, "title", "appointment"),
    ]);
    const kept = [...invoices, ...guarantees];
    const notes: string[] = [];

    if (kept.length > 0) notes.push(`${listLabels(kept, 6)} ${kept.length === 1 ? "is" : "are"} linked to this contract. The link is cleared and ${kept.length === 1 ? "that record is" : "those records are"} kept.`);
    if (events.length > 0) notes.push(`${events.length} Schedule appointment${events.length === 1 ? " is" : "s are"} linked to it. ${events.length === 1 ? "It stays" : "They stay"} on the job, without the contract link.`);

    return {
      ...base,
      name,
      heading: `Delete ${name}?`,
      warning: "This permanently deletes the contract. It cannot be undone.",
      notes,
      confirm:
        kept.length + events.length > 0
          ? { mode: "tick", label: "I understand the links listed above will be cleared." }
          : { mode: "none" },
      token: `${invoices.length}:${guarantees.length}:${events.length}`,
      submitLabel: "Delete contract",
      run: async (client) => ({ done: await deleteContractRecord(client, id, name), warnings: [] }),
      redirectTo: (message) => withParam("/contracts", "deleted", message),
    };
  }

  /* ---------- guarantee ---------- */

  if (kind === "guarantee") {
    const guarantee = await loadSingle(supabase, "guarantees", id);
    if (!guarantee) throw new DeleteError("This guarantee could not be found.");

    const name = str(guarantee.guarantee_number) || "this guarantee";

    return {
      ...base,
      name,
      heading: `Delete ${name}?`,
      warning: "This permanently deletes the guarantee. Any link the customer was sent stops working. It cannot be undone.",
      confirm: { mode: "none" },
      token: "0",
      submitLabel: "Delete guarantee",
      run: async (client) => ({ done: await deleteGuaranteeRecord(client, id, name), warnings: [] }),
      redirectTo: (message) => withParam("/guarantees", "deleted", message),
    };
  }

  /* ---------- variation ---------- */

  const variation = await loadSingle(supabase, "variations", id);
  if (!variation) throw new DeleteError("This variation could not be found.");

  const name = str(variation.variation_number) || "this variation";
  const jobId = str(variation.job_id);
  const quoteId = str(variation.quote_id);
  const accepted = /accepted/i.test(str(variation.status));

  return {
    ...base,
    name,
    heading: `Delete ${name}?`,
    warning: "This permanently deletes the variation and its line items. It cannot be undone.",
    notes: accepted ? ["This variation has been accepted by the customer."] : [],
    confirm: accepted ? { mode: "tick", label: "I understand this accepted variation will be deleted." } : { mode: "none" },
    token: "0",
    submitLabel: "Delete variation",
    run: async (client) => ({ done: await deleteVariationRecord(client, id, name), warnings: [] }),
    redirectTo: (message) =>
      withParam(jobId ? `/jobs/${jobId}` : quoteId ? `/quotes/${quoteId}` : "/jobs", "deleted", message),
  };
}

async function signedInClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ? supabase : null;
}

/* =========================================================
   PREVIEW (dialog opens)
   ========================================================= */

export async function previewDelete(kind: string, id: string): Promise<DeletePreview> {
  if (!isDeleteKind(kind) || !id) return { ok: false, error: "Unknown record." };

  const supabase = await signedInClient();
  if (!supabase) return { ok: false, error: "Please sign in again." };

  try {
    const plan = await buildPlan(supabase, kind, id);
    // Functions can't be sent to the browser.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { run, redirectTo, ...preview } = plan;
    return preview;
  } catch (error) {
    if (error instanceof DeleteError) return { ok: false, error: error.message };
    console.error("Delete preview error:", error);
    return { ok: false, error: "The delete check failed. Nothing was deleted." };
  }
}

/* =========================================================
   DELETE (confirmed in the dialog)
   ========================================================= */

export async function deleteRecord(_previous: DeleteState, formData: FormData): Promise<DeleteState> {
  const kind = String(formData.get("kind") ?? "");
  const id = String(formData.get("id") ?? "");

  if (!isDeleteKind(kind) || !id) return { error: "Unknown record." };

  const supabase = await signedInClient();
  if (!supabase) return { error: "Please sign in again." };

  let target: string;

  try {
    const plan = await buildPlan(supabase, kind, id);

    if (plan.blocked) return { error: plan.blocked };

    if (String(formData.get("token") ?? "") !== plan.token) {
      return { error: "The linked records changed since this dialog opened. Close it and try again so you can review the new list. Nothing was deleted." };
    }

    if (
      !confirmSatisfied(plan.confirm, {
        ticked: formData.get("confirm") === "yes",
        typed: String(formData.get("confirm_text") ?? ""),
      })
    ) {
      return { error: plan.confirm.mode === "type" ? `Please type ${plan.confirm.text} exactly to confirm.` : "Please tick the box to confirm." };
    }

    const result = await plan.run(supabase);
    const extra = result.done.filter((entry) => !entry.startsWith("cleared") && entry !== plan.name && entry !== "the client" && !((kind === "job" || kind === "survey") && entry === "1 job"));
    const message = [
      `Deleted ${plan.name}${extra.length > 0 ? ` (with ${extra.join(", ")})` : ""}.`,
      ...result.warnings,
    ].join(" ");

    target = plan.redirectTo(message);
  } catch (error) {
    revalidatePath("/", "layout");
    if (error instanceof DeleteError) return { error: error.message };
    console.error("Delete error:", error);
    return { error: "Something went wrong while deleting. Refresh the page to see what is left." };
  }

  revalidatePath("/", "layout");
  redirect(target);
}
