import Link from "next/link";

import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { isMissingSecondaryEmailColumn } from "@/lib/client-secondary-email";
import type { SurveyClientOption } from "@/lib/survey";
import SurveyForm from "./survey-form";

type ClientRow = {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
  secondary_email?: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  town: string | null;
  county: string | null;
  postcode: string | null;
};

const CLIENT_COLUMNS = `
  id,
  display_name,
  first_name,
  last_name,
  company_name,
  email,
  phone,
  address_line_1,
  address_line_2,
  town,
  county,
  postcode
`;

export default async function NewSurveyPage() {
  const supabase = await createClient();

  const withSecondary = await supabase
    .from("clients")
    .select(`${CLIENT_COLUMNS}, secondary_email`)
    .order("display_name");

  let rows = withSecondary.data as ClientRow[] | null;
  let error = withSecondary.error;

  if (isMissingSecondaryEmailColumn(error)) {
    // Database not migrated yet: carry on without secondary emails.
    const withoutSecondary = await supabase
      .from("clients")
      .select(CLIENT_COLUMNS)
      .order("display_name");

    rows = withoutSecondary.data as ClientRow[] | null;
    error = withoutSecondary.error;
  }

  if (error) {
    console.error("Book survey clients load error:", error);
  }

  const clients: SurveyClientOption[] = (rows ?? []).map((client) => ({
    id: client.id,
    name:
      client.display_name ||
      [client.first_name, client.last_name].filter(Boolean).join(" ") ||
      client.company_name ||
      "Unnamed client",
    company: client.company_name,
    email: client.email?.trim() || null,
    secondaryEmail: client.secondary_email?.trim() || null,
    phone: client.phone,
    addressLine1: client.address_line_1,
    addressLine2: client.address_line_2,
    town: client.town,
    county: client.county,
    postcode: client.postcode,
  }));

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="min-w-0 flex-1 p-4 pt-20 md:p-8">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/jobs"
            className="text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            ← Back to Jobs
          </Link>

          <div className="mb-6 mt-4 md:mb-8">
            <p className="text-sm font-medium text-slate-500">
              DryHome Office
            </p>

            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              Book Survey
            </h1>

            <p className="mt-2 text-slate-500">
              Creates the job, the Schedule appointment and the survey invoice in one go.
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              Clients could not be loaded. You can still add a new client below.
            </div>
          )}

          <SurveyForm clients={clients} />
        </div>
      </main>
    </div>
  );
}
