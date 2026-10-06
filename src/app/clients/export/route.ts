import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { isMissingSecondaryEmailColumn } from "@/lib/client-secondary-email";

import { clientsToCsv } from "../csv";

export async function GET() {
  const supabase = await createClient();

  const withSecondaryEmail = await supabase
    .from("clients")
    .select(`
      display_name,
      friendly_name,
      company_name,
      email,
      secondary_email,
      phone,
      address_line_1,
      address_line_2,
      town,
      county,
      postcode,
      notes
    `)
    .order("display_name", { ascending: true });

  let data: Parameters<typeof clientsToCsv>[0] | null =
    withSecondaryEmail.data;
  let error = withSecondaryEmail.error;

  if (isMissingSecondaryEmailColumn(error)) {
    // Database not migrated yet: export without secondary emails.
    const withoutSecondaryEmail = await supabase
      .from("clients")
      .select(`
        display_name,
        friendly_name,
        company_name,
        email,
        phone,
        address_line_1,
        address_line_2,
        town,
        county,
        postcode,
        notes
      `)
      .order("display_name", { ascending: true });

    data = withoutSecondaryEmail.data;
    error = withoutSecondaryEmail.error;
  }

  if (error) {
    console.error("Client export error:", error);
    return new NextResponse("Unable to export clients", {
      status: 500,
    });
  }

  const csv = clientsToCsv(data ?? []);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="clients.csv"',
    },
  });
}
