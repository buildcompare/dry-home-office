import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import QuoteFormFields from "../quote-form-fields";
import { createClient } from "@/lib/supabase/server";
import { addQuote } from "../actions";

type NewQuotePageProps = {
  searchParams: Promise<{
    job?: string;
    error?: string;
  }>;
};

export default async function NewQuotePage({
  searchParams,
}: NewQuotePageProps) {
  const params = await searchParams;

  const selectedJobId =
    params.job || "";

  const supabase = await createClient();

  const [
    clientsResult,
    jobsResult,
  ] = await Promise.all([
    supabase
      .from("clients")
      .select(`
        id,
        display_name,
        first_name,
        last_name
      `)
      .order("display_name", {
        ascending: true,
      }),

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
      .neq("status", "Cancelled")
      .order("created_at", {
        ascending: false,
      }),
  ]);

  const clients =
    clientsResult.data ?? [];

  const jobs =
    jobsResult.data ?? [];

  const selectedJob =
    jobs.find(
      (job) =>
        job.id === selectedJobId
    ) || null;

  const selectedClientId =
    selectedJob?.client_id || "";

  const today =
    new Date()
      .toISOString()
      .slice(0, 10);

  const validDate = new Date();

  validDate.setDate(
    validDate.getDate() + 30
  );

  const validUntil =
    validDate
      .toISOString()
      .slice(0, 10);

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <Link
              href="/quotes"
              className="text-sm font-medium text-slate-500 hover:text-slate-900"
            >
              ← Back to Quotes
            </Link>

            <h1 className="mt-4 text-3xl font-bold text-slate-900">
              Create Quote
            </h1>

            <p className="mt-2 text-slate-500">
              Create a detailed quotation with
              labour, materials and optional VAT.
            </p>
          </div>

          {params.error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
              {decodeURIComponent(
                params.error
              )}
            </div>
          )}

          <form action={addQuote}>
            <QuoteFormFields
              clients={clients}
              jobs={jobs}
              selectedJob={selectedJob}
              defaults={{
                jobId: selectedJobId,
                clientId: selectedClientId,
                title: selectedJob?.title || "",
                description: "",
                quoteDate: today,
                validUntil,
                customerMessage:
                  "Thank you for the opportunity to provide a quotation for the proposed works. Please find our quotation detailed below.",
                terms: "",
                internalNotes: "",
              }}
            />

            <div className="mt-8 flex items-center justify-end gap-3">
              <Link
                href="/quotes"
                className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Link>

              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700"
              >
                Save Draft Quote
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}