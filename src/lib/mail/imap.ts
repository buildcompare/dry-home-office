/* IMAP access (server only) for the signed-in user's own mailbox. */
import { ImapFlow, type ListResponse } from "imapflow";
import { simpleParser, type AddressObject } from "mailparser";
import sanitizeHtml from "sanitize-html";
import type { MailCredentials } from "@/lib/mail/store";

export const PAGE_SIZE = 25;

export type FolderRole = "inbox" | "sent" | "drafts" | "trash" | "junk" | "archive" | "other";
export type MailFolder = { path: string; name: string; role: FolderRole };
export type MailListItem = {
  uid: number;
  from: string;
  fromAddress: string;
  subject: string;
  date: string | null;
  unread: boolean;
  hasAttachments: boolean;
};
export type MailAttachment = { index: number; filename: string; contentType: string; size: number };
export type MailMessage = {
  uid: number;
  folder: string;
  subject: string;
  from: string;
  fromAddress: string;
  to: string[];
  cc: string[];
  replyTo: string[];
  date: string | null;
  messageId: string | null;
  references: string[];
  html: string | null;
  text: string;
  attachments: MailAttachment[];
  unread: boolean;
};

export class MailLoginError extends Error {}

function client(creds: MailCredentials) {
  return new ImapFlow({
    host: creds.imap_host,
    port: creds.imap_port,
    secure: creds.imap_secure,
    auth: { user: creds.email, pass: creds.password },
    logger: false,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
    tls: { servername: creds.imap_host, minVersion: "TLSv1.2" },
  });
}

export async function withImap<T>(creds: MailCredentials, fn: (imap: ImapFlow) => Promise<T>): Promise<T> {
  const imap = client(creds);
  try {
    await imap.connect();
  } catch (error) {
    const auth = (error as { authenticationFailed?: boolean }).authenticationFailed;
    throw new MailLoginError(auth ? "The email address or password was not accepted." : "Couldn't reach the mail server.");
  }
  try {
    return await fn(imap);
  } finally {
    await imap.logout().catch(() => imap.close());
  }
}

/** Login test for the connect form (no messages read). */
export async function testImapLogin(creds: MailCredentials) {
  await withImap(creds, async () => true);
}

const ROLE_BY_USE: Record<string, FolderRole> = {
  "\\Sent": "sent",
  "\\Drafts": "drafts",
  "\\Trash": "trash",
  "\\Junk": "junk",
  "\\Archive": "archive",
};

function roleOf(box: ListResponse): FolderRole {
  if (box.path.toUpperCase() === "INBOX") return "inbox";
  if (box.specialUse && ROLE_BY_USE[box.specialUse]) return ROLE_BY_USE[box.specialUse];
  const name = box.name.toLowerCase();
  if (/^sent( items| messages| mail)?$/.test(name)) return "sent";
  if (/^drafts?$/.test(name)) return "drafts";
  if (/^(trash|deleted( items| messages)?|bin)$/.test(name)) return "trash";
  if (/^(spam|junk( e-?mail)?)$/.test(name)) return "junk";
  return "other";
}

const ORDER: FolderRole[] = ["inbox", "sent", "drafts", "trash", "junk", "archive", "other"];

export async function listFolders(imap: ImapFlow): Promise<MailFolder[]> {
  const boxes = await imap.list();
  return boxes
    .filter((box) => !box.flags.has("\\Noselect") && !box.flags.has("\\NonExistent"))
    .map((box) => ({ path: box.path, name: box.path.toUpperCase() === "INBOX" ? "Inbox" : box.name, role: roleOf(box) }))
    .sort((a, b) => ORDER.indexOf(a.role) - ORDER.indexOf(b.role) || a.name.localeCompare(b.name));
}

export function folderFor(folders: MailFolder[], role: FolderRole) {
  return folders.find((folder) => folder.role === role) ?? null;
}

function formatAddress(list: { name?: string; address?: string }[] | undefined) {
  const first = list?.[0];
  return { name: first?.name || first?.address || "(unknown)", address: first?.address || "" };
}

function hasAttachment(structure: unknown): boolean {
  const node = structure as { disposition?: string; childNodes?: unknown[] } | undefined;
  if (!node) return false;
  if (node.disposition?.toLowerCase() === "attachment") return true;
  return (node.childNodes ?? []).some(hasAttachment);
}

export async function listMessages(imap: ImapFlow, folder: string, page: number) {
  const lock = await imap.getMailboxLock(folder, { readOnly: true });
  try {
    const mailbox = imap.mailbox;
    const total = mailbox ? mailbox.exists : 0;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const current = Math.min(Math.max(1, page), pages);
    const items: MailListItem[] = [];
    if (total > 0) {
      const high = total - (current - 1) * PAGE_SIZE;
      const low = Math.max(1, high - PAGE_SIZE + 1);
      for await (const msg of imap.fetch(`${low}:${high}`, { uid: true, envelope: true, flags: true, internalDate: true, bodyStructure: true })) {
        const from = formatAddress(msg.envelope?.from);
        const when = msg.envelope?.date ?? msg.internalDate;
        items.push({
          uid: msg.uid,
          from: from.name,
          fromAddress: from.address,
          subject: msg.envelope?.subject || "(no subject)",
          date: when ? new Date(when).toISOString() : null,
          unread: !msg.flags?.has("\\Seen"),
          hasAttachments: hasAttachment(msg.bodyStructure),
        });
      }
    }
    items.sort((a, b) => b.uid - a.uid);
    return { items, total, page: current, pages };
  } finally {
    lock.release();
  }
}

function addresses(value: AddressObject | AddressObject[] | undefined) {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list.flatMap((group) => group.value.map((a) => (a.name ? `${a.name} <${a.address ?? ""}>` : a.address ?? ""))).filter(Boolean);
}

export function sanitiseEmailHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "span", "font", "center", "h1", "h2", "u", "s"]),
    allowedAttributes: {
      "*": ["style", "align", "valign", "width", "height", "bgcolor", "color", "border", "cellpadding", "cellspacing", "dir"],
      a: ["href", "name", "title"],
      img: ["src", "alt", "title", "width", "height"],
      font: ["face", "size", "color"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["https", "data"] },
    transformTags: {
      a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer" } }),
    },
    disallowedTagsMode: "discard",
  });
}

async function parsed(imap: ImapFlow, folder: string, uid: number) {
  const lock = await imap.getMailboxLock(folder, { readOnly: true });
  try {
    const msg = await imap.fetchOne(String(uid), { source: true, flags: true }, { uid: true });
    if (!msg || !msg.source) return null;
    return { mail: await simpleParser(msg.source), unread: !msg.flags?.has("\\Seen"), source: msg.source };
  } finally {
    lock.release();
  }
}

export async function getMessage(imap: ImapFlow, folder: string, uid: number, markRead = true): Promise<MailMessage | null> {
  const result = await parsed(imap, folder, uid);
  if (!result) return null;
  const { mail } = result;
  if (markRead && result.unread) await setRead(imap, folder, uid, true).catch(() => {});
  const from = mail.from?.value?.[0];
  const refs = mail.references ? (Array.isArray(mail.references) ? mail.references : [mail.references]) : [];
  return {
    uid,
    folder,
    subject: mail.subject || "(no subject)",
    from: from?.name || from?.address || "(unknown)",
    fromAddress: from?.address || "",
    to: addresses(mail.to),
    cc: addresses(mail.cc),
    replyTo: addresses(mail.replyTo),
    date: mail.date ? mail.date.toISOString() : null,
    messageId: mail.messageId ?? null,
    references: refs,
    html: typeof mail.html === "string" ? sanitiseEmailHtml(mail.html) : null,
    text: mail.text ?? "",
    attachments: mail.attachments
      .map((a, index) => ({ index, filename: a.filename || `attachment-${index + 1}`, contentType: a.contentType || "application/octet-stream", size: a.size }))
      .filter((_, index) => mail.attachments[index].contentDisposition !== "inline" || !mail.attachments[index].cid),
    unread: false,
  };
}

export async function getAttachment(imap: ImapFlow, folder: string, uid: number, index: number) {
  const result = await parsed(imap, folder, uid);
  const att = result?.mail.attachments[index];
  if (!att) return null;
  return { filename: att.filename || `attachment-${index + 1}`, contentType: att.contentType || "application/octet-stream", content: att.content };
}

/** Original attachments, for forwarding. */
export async function getAllAttachments(imap: ImapFlow, folder: string, uid: number) {
  const result = await parsed(imap, folder, uid);
  return (result?.mail.attachments ?? [])
    .filter((a) => a.contentDisposition !== "inline" || !a.cid)
    .map((a, i) => ({ filename: a.filename || `attachment-${i + 1}`, contentType: a.contentType, content: a.content }));
}

export async function setRead(imap: ImapFlow, folder: string, uid: number, read: boolean) {
  const lock = await imap.getMailboxLock(folder);
  try {
    if (read) await imap.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
    else await imap.messageFlagsRemove(String(uid), ["\\Seen"], { uid: true });
  } finally {
    lock.release();
  }
}

/** Move to Trash; if already in Trash (or there is no Trash), delete for good. */
export async function deleteMessage(imap: ImapFlow, folder: string, uid: number) {
  const trash = folderFor(await listFolders(imap), "trash");
  const lock = await imap.getMailboxLock(folder);
  try {
    if (trash && trash.path !== folder) await imap.messageMove(String(uid), trash.path, { uid: true });
    else await imap.messageDelete(String(uid), { uid: true });
  } finally {
    lock.release();
  }
}

export async function appendToSent(imap: ImapFlow, raw: Buffer) {
  const sent = folderFor(await listFolders(imap), "sent");
  if (!sent) return false;
  await imap.append(sent.path, raw, ["\\Seen"]);
  return true;
}
