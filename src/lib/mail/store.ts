/*
 * Mailbox connection for the SIGNED-IN user only, read with their own
 * session (RLS: user_id = auth.uid()). Never returned to the browser.
 */
import { createClient } from "@/lib/supabase/server";
import { currentStaffRole } from "@/lib/staff-auth";
import { openSecret, sealSecret } from "@/lib/mail/crypto";

type Client = Awaited<ReturnType<typeof createClient>>;

export type MailAccount = {
  email: string;
  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
};

export type MailCredentials = MailAccount & { password: string };

export type MailUser = { supabase: Client; userId: string; role: "owner" | "employee" };

/** Signed-in, active owner or employee; null otherwise. */
export async function getMailUser(): Promise<MailUser | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { role } = await currentStaffRole(supabase);
  if (role !== "owner" && role !== "employee") return null;
  return { supabase, userId: data.user.id, role };
}

const COLUMNS = "email, imap_host, imap_port, imap_secure, smtp_host, smtp_port, smtp_secure, secret_ciphertext, secret_iv, secret_tag";

/** { setUp:false } when supabase/staff_mailboxes.sql hasn't been run. */
export async function loadMailbox(user: MailUser): Promise<{ setUp: boolean; account: MailAccount | null }> {
  const { data, error } = await user.supabase
    .from("mailbox_connections")
    .select("email, imap_host, imap_port, imap_secure, smtp_host, smtp_port, smtp_secure")
    .eq("user_id", user.userId)
    .maybeSingle();
  if (error) return { setUp: false, account: null };
  return { setUp: true, account: (data as MailAccount | null) ?? null };
}

export async function loadCredentials(user: MailUser): Promise<MailCredentials | null> {
  const { data, error } = await user.supabase.from("mailbox_connections").select(COLUMNS).eq("user_id", user.userId).maybeSingle();
  if (error || !data) return null;
  const row = data as MailAccount & { secret_ciphertext: string; secret_iv: string; secret_tag: string };
  try {
    const password = openSecret({ ciphertext: row.secret_ciphertext, iv: row.secret_iv, tag: row.secret_tag }, `${user.userId}:${row.email}`);
    return {
      email: row.email,
      imap_host: row.imap_host,
      imap_port: row.imap_port,
      imap_secure: row.imap_secure,
      smtp_host: row.smtp_host,
      smtp_port: row.smtp_port,
      smtp_secure: row.smtp_secure,
      password,
    };
  } catch {
    return null;
  }
}

export async function saveMailbox(user: MailUser, creds: MailCredentials) {
  const sealed = sealSecret(creds.password, `${user.userId}:${creds.email}`);
  const { password: _omit, ...account } = creds;
  void _omit;
  return user.supabase.from("mailbox_connections").upsert(
    {
      user_id: user.userId,
      ...account,
      secret_ciphertext: sealed.ciphertext,
      secret_iv: sealed.iv,
      secret_tag: sealed.tag,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
}

export async function deleteMailbox(user: MailUser) {
  return user.supabase.from("mailbox_connections").delete().eq("user_id", user.userId);
}
