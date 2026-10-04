import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

import { clientsToCsv } from "../csv";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
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
