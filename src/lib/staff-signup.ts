/* Has an invited employee actually signed up? (pure) */

export type AuthUserLite = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  last_sign_in_at?: string | null;
  invited_at?: string | null;
  created_at?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

export type SignupStatus =
  | { state: "invited"; invitedAt: string | null }
  | { state: "signed_up"; signedUpAt: string | null; lastSignInAt: string | null }
  | { state: "unknown" };

/**
 * New invites carry user_metadata.invite_pending = true until the employee
 * sets a password (password_set_at). Older accounts without those markers
 * count as signed up once they have signed in at least once.
 */
export function signupStatus(user: AuthUserLite | null | undefined, invitedAt: string | null): SignupStatus {
  if (!user) return { state: "invited", invitedAt };
  const meta = user.user_metadata ?? {};
  const passwordSetAt = typeof meta.password_set_at === "string" ? meta.password_set_at : null;
  const pending = meta.invite_pending === true;
  const signedUp = passwordSetAt ? true : pending ? false : Boolean(user.last_sign_in_at);
  if (!signedUp) return { state: "invited", invitedAt: user.invited_at ?? invitedAt };
  return {
    state: "signed_up",
    signedUpAt: passwordSetAt ?? user.email_confirmed_at ?? user.created_at ?? null,
    lastSignInAt: user.last_sign_in_at ?? null,
  };
}

export function formatUkDate(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });
}

export function formatUkDateTime(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
}
