import Link from "next/link";
import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { additionalQuoteTerms } from "@/lib/quote-additional-terms";
import { quoteEditRules } from "@/lib/quote-form";
import QuoteFormFields from "../../quote-form-fields";
import { updateQuote } from "../../actions";

type EditQuotePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function EditQuotePage({
  params,
  searchParams,
}: EditQuotePageProps) {
  const { id } = await params;
  const query = await searchParams;

  const supabase = await createClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select(`
      id,
      quote_number,
      status,
      client_id,
      job_id,
      title,
      description,
      quote_date,
      valid_until,
      vat_enabled,
      customer_message,
      terms,
      internal_notes
    `)
    .eq("id", id)
    .maybeSingle();

  if (!quote) {
    notFound();
  }

  // Include the quote's own job even if it has since been cancelled, so
  // saving never silently unlinks it.
  const jobFilter = quote.job_id
    ? `status.neq.Cancelled,id.eq.${quote.job_id}`
    : "status.neq.Cancelled";

  const [clientsResult, jobsResult, itemsResult] = await Promise.all([
    supabase
      .from("clients")
      .select("id, display_name, first_name, last_name")
      .order("display_name", { ascending: true }),

    supabase
      .from("jobs")
      .select(`
        id,
        job_number,
        title,
        client_id,
        status,
        clients (
          id,
          display_name,
          first_name,
          last_name
        )
      `)
      .or(jobFilter)
      .order("created_at", { ascending: false }),

    supabase
      .from("quote_items")
      .select("id, description, quantity, unit, unit_price, item_type, sort_order")
      .eq("quote_id", id)
      .order("sort_order", { ascending: true }),
  ]);

  const clients = clientsResult.data ?? [];
  const jobs = jobsResult.data ?? [];
  const selectedJob = jobs.find((job) => job.id === quote.job_id) || null;

  const initialItems = (itemsResult.data ?? []).map((item) => ({
    id: String(item.id),
    description: item.description ?? "",
    quantity: Number(item.quantity ?? 1),
    unit: item.unit || "item",
    unit_price: Number(item.unit_price ?? 0),
    item_type: item.item_type === "Materials" ? ("Materials" as const) : ("Labour" as const),
  }));

  const rules = quoteEditRules(quote.status);
  const quoteLabel = quote.quote_number || "Quote";

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <Link
              href={`/quotes/${quote.id}`}
              className="text-sm font-medium text-slate-500 hover:text-slate-900"
            >
              ← Back to {quoteLabel}
            </Link>

            <h1 className="mt-4 text-3xl font-bold text-slate-900">
              Edit Quote {quote.quote_number}
            </h1>

            <p className="mt-2 text-slate-500">
              Update the quote details, line items and terms. Totals are recalculated when you save.
            </p>
          </div>

          {query.error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
              {query.error}
            </div>
          )}

          {itemsResult.error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
              The line items for this quote could not be loaded. Please reload before saving.
            </div>
          )}

          {rules.clientHasOlderVersion && (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
              <p className="font-semibold">
                {quote.status === "Viewed"
                  ? "The client has viewed this quote."
                  : "This quote has been sent to the client."}
              </p>
              <p className="mt-1">
                The client has an older version. Their quote link will show your changes once saved, but they
                won&apos;t be told. Use <span className="font-semibold">Save and resend</span> to email them the
                updated quote.
              </p>
            </div>
          )}

          <form action={updateQuote}>
            <input type="hidden" name="quote_id" value={quote.id} />

            {rules.needsAcceptedAck && (
              <section className="mb-8 rounded-2xl border border-red-200 bg-red-50 p-6">
                <h2 className="text-lg font-semibold text-red-800">This quote has been accepted</h2>
                <label className="mt-3 flex items-start gap-3 text-sm text-red-800">
                  <input
                    type="checkbox"
                    name="accepted_ack"
                    value="yes"
                    required
                    className="mt-0.5 h-4 w-4 rounded border-red-300"
                  />
                  <span>
                    This quote has been accepted. Changes won&apos;t update any contract already created.
                  </span>
                </label>
              </section>
            )}

            <QuoteFormFields
              clients={clients}
              jobs={jobs}
              selectedJob={selectedJob}
              initialItems={initialItems}
              initialVatEnabled={Boolean(quote.vat_enabled)}
              defaults={{
                jobId: quote.job_id || "",
                clientId: quote.client_id || "",
                title: quote.title || "",
                description: quote.description || "",
                quoteDate: quote.quote_date || "",
                validUntil: quote.valid_until || "",
                customerMessage: quote.customer_message || "",
                terms: additionalQuoteTerms(quote.terms) ?? "",
                internalNotes: quote.internal_notes || "",
              }}
            />

            <div className="mt-8 flex flex-wrap items-center justify-end gap-3">
              <Link
                href={`/quotes/${quote.id}`}
                className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Link>

              <button
                type="submit"
                name="intent"
                value="save"
                className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700"
              >
                Save changes
              </button>
              {rules.clientHasOlderVersion && (
                <button
                  type="submit"
                  name="intent"
                  value="save_resend"
                  className="rounded-lg border border-slate-900 bg-white px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                >
                  Save and resend
                </button>
              )}

            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
