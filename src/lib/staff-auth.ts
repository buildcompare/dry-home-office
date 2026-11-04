/*
 * Who is signed in, and what they may do.
 *
 * Roles come from public.current_staff_role() (supabase/staff_portal.sql).
 * Until that SQL has been run the function doesn't exist and everyone is
 * treated as an owner, exactly like before.
 */

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normaliseRole, STAFF_HOME, TEAM_HOME, type StaffRole } from "@/lib/staff";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type StaffMemberRow = {
  id: string;
  user_id: string | null;
  email: string;
  name: string;
  role: string;
  active: boolean;
};

export type StaffContext = {
  userId: string | null;
  email: string | null;
  role: StaffRole;
  /** false when staff_portal.sql hasn't been run yet */
  setUp: boolean;
};

/*
 * Speed: the signed-in user and their role are looked up once per request
 * (React cache) and in parallel, instead of one Supabase round trip after
 * another on every page and server action.
 */
const sessionClient = cache(() => createClient());
const sessionUser = cache(async () => {
  const supabase = await sessionClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});
const sessionRole = cache(async () => currentStaffRole(await sessionClient()));
const sessionStaffId = cache(async () => {
  try {
    const { data } = await (await sessionClient()).rpc("current_staff_member_id");
    return typeof data === "string" ? data : null;
  } catch {
    return null;
  }
});

export async function currentStaffRole(
  supabase: Pick<SupabaseServerClient, "rpc">
): Promise<{ role: StaffRole; setUp: boolean }> {
  try {
    const { data, error } = await supabase.rpc("current_staff_role");
    if (error) return { role: "owner", setUp: false };
    return { role: normaliseRole(data), setUp: true };
  } catch {
    return { role: "owner", setUp: false };
  }
}

export async function getStaffContext(supabase?: SupabaseServerClient): Promise<StaffContext> {
  const client = supabase ?? (await createClient());
  const { data } = await client.auth.getUser();
  const user = data.user;
  if (!user) return { userId: null, email: null, role: "owner", setUp: false };
  const { role, setUp } = await currentStaffRole(client);
  return { userId: user.id, email: user.email ?? null, role, setUp };
}

/**
 * For every office server action: employees (and deactivated logins)
 * are sent to the staff portal before anything runs. Server actions can
 * be called from any page, so this check is needed on top of the proxy.
 */
export async function requireOfficeOwner() {
  const [user, { role }] = await Promise.all([sessionUser(), sessionRole()]);
  if (!user) return; // the action's own sign-in check handles this
  if (role !== "owner") redirect(STAFF_HOME);
}

/** Owner pages/actions for the Staff area. Returns the session client. */
export async function requireOwnerForTeam() {
  const [supabase, user, { role, setUp }] = await Promise.all([sessionClient(), sessionUser(), sessionRole()]);
  if (!user) redirect("/login");
  if (role !== "owner") redirect(STAFF_HOME);
  return { supabase, userId: user.id, email: user.email ?? null, setUp };
}

export type EmployeeSession =
  | { status: "ok"; supabase: SupabaseServerClient; staff: StaffMemberRow }
  | { status: "inactive" | "not-set-up" | "missing" };

/**
 * Staff portal pages/actions. Owners are sent to the owner Staff page.
 * Links the login to the staff row on first sign-in (rows created by
 * invite are matched by email until then).
 */
export const requireEmployee = cache(async (): Promise<EmployeeSession> => {
  // User check, role and staff id don't depend on each other: one round trip.
  const [supabase, user, { role, setUp }, staffId] = await Promise.all([
    sessionClient(),
    sessionUser(),
    sessionRole(),
    sessionStaffId(),
  ]);
  if (!user) redirect("/login");

  if (!setUp) return { status: "not-set-up" };
  if (role === "owner") redirect(TEAM_HOME);
  if (role === "inactive") return { status: "inactive" };
  if (!staffId) return { status: "missing" };

  const { data: row } = await supabase
    .from("staff_members")
    .select("id, user_id, email, name, role, active")
    .eq("id", staffId)
    .maybeSingle();

  if (!row) return { status: "missing" };

  const staff = row as StaffMemberRow;

  if (!staff.user_id) {
    try {
      const admin = createAdminClient();
      await admin.from("staff_members").update({ user_id: user.id }).eq("id", staff.id).is("user_id", null);
      staff.user_id = user.id;
    } catch {
      // Linking is a convenience: matching by email still works.
    }
  }

  return { status: "ok", supabase, staff };
});
