import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { currentStaffRole } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

/* Owner-only count of timesheet weeks and holiday requests awaiting a decision. */
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { role, setUp } = await currentStaffRole(supabase);
  if (role !== "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!setUp) return NextResponse.json({ count: 0 });

  const [weeks, holidays] = await Promise.all([
    supabase.from("timesheet_weeks").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    supabase.from("holiday_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  return NextResponse.json(
    { count: (weeks.count ?? 0) + (holidays.count ?? 0) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
