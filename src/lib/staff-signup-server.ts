import { createAdminClient } from "@/lib/supabase/admin";
import type { AuthUserLite } from "@/lib/staff-signup";

/**
 * Looks up each login's auth record (sign-up / last sign-in) with the
 * service role. Returns null when that isn't available, so the Staff page
 * can fall back to the simple Active / Invited label.
 */
export async function loadAuthUsers(userIds: string[]): Promise<Map<string, AuthUserLite> | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const admin = createAdminClient();
    const results = await Promise.all(
      [...new Set(userIds)].map(async (id) => {
        const { data, error } = await admin.auth.admin.getUserById(id);
        if (error) {
          if (error.status === 404) return [id, null] as const;
          throw error;
        }
        return [id, (data.user as AuthUserLite) ?? null] as const;
      })
    );
    const map = new Map<string, AuthUserLite>();
    for (const [id, user] of results) if (user) map.set(id, user);
    return map;
  } catch {
    return null;
  }
}
