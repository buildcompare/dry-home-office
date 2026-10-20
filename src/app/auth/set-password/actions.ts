"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";

/**
 * Called after an employee saves their password. The first time, stamps
 * user_metadata.password_set_at (so the Staff page shows "Signed up") and
 * adds a Recent activity event. Safe to call repeatedly; never throws.
 */
export async function markPasswordSet(): Promise<void> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return;
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    if (typeof meta.password_set_at === "string" && meta.password_set_at) return;

    const now = new Date().toISOString();
    const { error } = await supabase.auth.updateUser({ data: { password_set_at: now, invite_pending: false } });
    if (error) return;

    // Only employees get a "signed up" event, and only via the service role
    // (employees can't write the office's activity log themselves).
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
    const admin = createAdminClient();
    const { data: member } = await admin
      .from("staff_members")
      .select("id, name, role")
      .or(`user_id.eq.${user.id}${user.email ? `,email.ilike.${user.email.replace(/[,()]/g, "")}` : ""}`)
      .limit(1)
      .maybeSingle();
    if (!member || member.role !== "employee") return;

    const name = String(member.name || user.email || "An employee");
    await logActivity(admin, {
      event_type: "staff.signed_up",
      record_type: null,
      record_id: null,
      summary: `${name} signed up to the staff portal`,
      metadata: { name, staff_id: member.id },
    });
  } catch {
    // Degrade silently – the password itself has already been saved.
  }
}
