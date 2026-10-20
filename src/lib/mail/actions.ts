"use server";

/*
 * Email tab actions. Every action works only on the SIGNED-IN user's own
 * mailbox (credentials read with their session; RLS = own row only).
 * Passwords are never logged, returned or put in URLs.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getMailUser, loadCredentials, saveMailbox, deleteMailbox, type MailCredentials, type MailUser } from "@/lib/mail/store";
import { mailKeyConfigured } from "@/lib/mail/crypto";
import { isAllowedMailHost, mailDefaults } from "@/lib/mail/config";
import { MailLoginError, appendToSent, deleteMessage, getAllAttachments, setRead, testImapLogin, withImap } from "@/lib/mail/imap";
import { sendMail, testSmtpLogin } from "@/lib/mail/smtp";
import { MAX_ATTACHMENT_BYTES, formatAddressList, parseAddressList, safeFolder, safeUid } from "@/lib/mail/addresses";

const BASES = { employee: "/staff/email", owner: "/email" } as const;

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function go(base: string, params: Record<string, string>): never {
  const query = new URLSearchParams(params).toString();
  redirect(query ? `${base}?${query}` : base);
}

async function mailUser(): Promise<{ user: MailUser; base: string }> {
  const user = await getMailUser();
  if (!user) redirect("/login");
  return { user, base: BASES[user.role] };
}

async function credentialsOrBack(user: MailUser, base: string): Promise<MailCredentials> {
  const creds = await loadCredentials(user);
  if (!creds) go(base, { error: "Your mailbox isn't connected." });
  return creds;
}

function port(value: string, fallback: number) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : fallback;
}

export async function connectMailbox(formData: FormData) {
  const { user, base } = await mailUser();
  if (!mailKeyConfigured()) go(base, { error: "Email isn't set up yet." });

  const email = text(formData, "email").trim().toLowerCase();
  const password = text(formData, "password");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) go(base, { error: "Please enter your full email address." });
  if (!password || password.length > 512) go(base, { error: "Please enter your mailbox password." });

  const defaults = mailDefaults();
  const imapHost = text(formData, "imap_host").trim().toLowerCase() || defaults.imap_host;
  const smtpHost = text(formData, "smtp_host").trim().toLowerCase() || defaults.smtp_host;
  if (!isAllowedMailHost(imapHost) || !isAllowedMailHost(smtpHost)) {
    go(base, { error: "Mail servers must be dryhomedampproofing.co.uk or SiteGround hosts." });
  }
  const creds: MailCredentials = {
    email,
    password,
    imap_host: imapHost,
    imap_port: port(text(formData, "imap_port"), defaults.imap_port),
    imap_secure: defaults.imap_secure,
    smtp_host: smtpHost,
    smtp_port: port(text(formData, "smtp_port"), defaults.smtp_port),
    smtp_secure: defaults.smtp_secure,
  };
  // 993/465 are SSL/TLS; 143/587 use STARTTLS.
  if (text(formData, "imap_port")) creds.imap_secure = creds.imap_port !== 143;
  if (text(formData, "smtp_port")) creds.smtp_secure = creds.smtp_port === 465;

  let problem: string | null = null;
  try {
    await testImapLogin(creds);
  } catch (error) {
    problem = error instanceof MailLoginError ? error.message : "Couldn't sign in to the mailbox.";
  }
  if (!problem) {
    try {
      await testSmtpLogin(creds);
    } catch {
      problem = "Incoming mail worked, but the outgoing (SMTP) server rejected the login.";
    }
  }
  if (problem) go(base, { error: problem, email });

  const { error } = await saveMailbox(user, creds);
  if (error) go(base, { error: "The mailbox couldn't be saved. Has supabase/staff_mailboxes.sql been run?" });
  revalidatePath(base);
  go(base, { notice: "Mailbox connected." });
}

export async function disconnectMailbox() {
  const { user, base } = await mailUser();
  await deleteMailbox(user);
  revalidatePath(base);
  go(base, { notice: "Mailbox disconnected and your saved password deleted." });
}

export async function markMessage(formData: FormData) {
  const { user, base } = await mailUser();
  const folder = safeFolder(text(formData, "folder"));
  const uid = safeUid(text(formData, "uid"));
  const read = text(formData, "read") === "true";
  if (!uid) go(base, { folder });
  const creds = await credentialsOrBack(user, base);
  let failed = false;
  try {
    await withImap(creds, (imap) => setRead(imap, folder, uid, read));
  } catch {
    failed = true;
  }
  if (failed) go(base, { folder, error: "The message couldn't be updated." });
  go(base, read ? { folder, uid: String(uid) } : { folder });
}

export async function deleteMailMessage(formData: FormData) {
  const { user, base } = await mailUser();
  const folder = safeFolder(text(formData, "folder"));
  const uid = safeUid(text(formData, "uid"));
  if (!uid) go(base, { folder });
  const creds = await credentialsOrBack(user, base);
  let failed = false;
  try {
    await withImap(creds, (imap) => deleteMessage(imap, folder, uid));
  } catch {
    failed = true;
  }
  if (failed) go(base, { folder, error: "The message couldn't be deleted." });
  go(base, { folder, notice: "Message deleted." });
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export type SendState = { error: string | null };

export async function sendMailMessage(_prev: SendState, formData: FormData): Promise<SendState> {
  const { user, base } = await mailUser();
  const creds = await loadCredentials(user);
  if (!creds) return { error: "Your mailbox isn't connected." };

  const to = parseAddressList(text(formData, "to"));
  const cc = parseAddressList(text(formData, "cc"));
  const bcc = parseAddressList(text(formData, "bcc"));
  if (!to.ok) return { error: to.error };
  if (!cc.ok) return { error: cc.error };
  if (!bcc.ok) return { error: bcc.error };
  if (to.list.length === 0) return { error: "Please add at least one recipient." };

  const subject = text(formData, "subject").replace(/[\r\n]+/g, " ").trim().slice(0, 300);
  const body = text(formData, "body").slice(0, 200000);

  const files = formData.getAll("attachments").filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f && (f as File).size > 0);
  let totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  const attachments: { filename: string; content: Buffer; contentType?: string }[] = [];
  for (const file of files) {
    attachments.push({ filename: file.name || "attachment", content: Buffer.from(await file.arrayBuffer()), contentType: file.type || undefined });
  }

  const mode = text(formData, "mode");
  const sourceFolder = safeFolder(text(formData, "source_folder"));
  const sourceUid = safeUid(text(formData, "source_uid"));
  const inReplyTo = text(formData, "in_reply_to").slice(0, 998) || undefined;
  const references = text(formData, "references").slice(0, 4000) || undefined;

  let failure: string | null = null;
  try {
    await withImap(creds, async (imap) => {
      if (mode === "forward" && sourceUid && text(formData, "include_attachments") === "on") {
        for (const a of await getAllAttachments(imap, sourceFolder, sourceUid)) {
          totalBytes += a.content.length;
          attachments.push(a);
        }
      }
      if (totalBytes > MAX_ATTACHMENT_BYTES * 3) throw new Error("too-big");

      const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;white-space:pre-wrap">${escapeHtml(body)}</div>`;
      const raw = await sendMail(
        creds,
        {
          from: creds.email,
          to: formatAddressList(to.list),
          cc: cc.list.length ? formatAddressList(cc.list) : undefined,
          bcc: bcc.list.length ? formatAddressList(bcc.list) : undefined,
          subject: subject || "(no subject)",
          text: body,
          html,
          inReplyTo,
          references,
          attachments,
        },
        [...to.list, ...cc.list, ...bcc.list].map((a) => a.address)
      );
      await appendToSent(imap, raw).catch(() => false);
    });
  } catch (error) {
    failure =
      (error as Error).message === "too-big"
        ? "The attachments are too large. Please keep them under about 10 MB in total."
        : error instanceof MailLoginError
          ? error.message
          : "The email couldn't be sent. Please try again.";
  }
  if (failure) return { error: failure };

  go(base, { notice: "Email sent." });
}
