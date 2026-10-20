import Link from "next/link";
import { mailKeyConfigured } from "@/lib/mail/crypto";
import { mailDefaults } from "@/lib/mail/config";
import { loadCredentials, loadMailbox, type MailUser } from "@/lib/mail/store";
import {
  getMessage,
  listFolders,
  listMessages,
  MailLoginError,
  withImap,
  type MailFolder,
  type MailListItem,
  type MailMessage,
} from "@/lib/mail/imap";
import { formatBytes, quoteText, replySubject, safeFolder, safeUid, withoutAddress } from "@/lib/mail/addresses";
import { connectMailbox, deleteMailMessage, disconnectMailbox, markMessage } from "@/lib/mail/actions";
import ComposeForm, { type ComposeDefaults } from "@/components/mail/ComposeForm";

export type MailSearchParams = {
  folder?: string;
  page?: string;
  uid?: string;
  compose?: string;
  error?: string;
  notice?: string;
  email?: string;
};

const card = "rounded-2xl bg-white p-5 shadow-sm";
const input =
  "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#252525] focus:ring-2 focus:ring-[#f29e23]/40";
const btnPrimary = "rounded-xl bg-[#be1e2d] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#a31926]";
const btnGhost = "rounded-lg bg-white px-3 py-2 text-sm font-semibold text-[#252525] shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50";

const FOLDER_LABEL: Record<string, string> = { inbox: "Inbox", sent: "Sent", drafts: "Drafts", trash: "Trash", junk: "Spam", archive: "Archive" };

function when(iso: string | null, long = false) {
  if (!iso) return "";
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions = long
    ? { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }
    : { day: "numeric", month: "short", timeZone: "Europe/London" };
  return d.toLocaleString("en-GB", opts);
}

function Notice({ error, notice }: { error?: string; notice?: string }) {
  if (error) return <p className="mb-4 rounded-xl border-l-4 border-[#be1e2d] bg-white p-3 text-sm font-medium text-[#be1e2d] shadow-sm" role="alert">{error}</p>;
  if (notice) return <p className="mb-4 rounded-xl border-l-4 border-[#252525] bg-white p-3 text-sm font-medium text-[#252525] shadow-sm">{notice}</p>;
  return null;
}

function Header({ email, base, connected }: { email?: string; base: string; connected: boolean }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#be1e2d]">Email</p>
        <h1 className="mt-1 break-all text-2xl font-bold text-[#252525] sm:text-3xl">{email ?? "Your work email"}</h1>
      </div>
      {connected && (
        <Link href={`${base}?compose=new`} className={btnPrimary}>
          Compose
        </Link>
      )}
    </div>
  );
}

function ConnectForm({ email }: { email?: string }) {
  const d = mailDefaults();
  return (
    <section className={`${card} max-w-xl`}>
      <h2 className="text-lg font-semibold text-[#252525]">Connect your mailbox</h2>
      <p className="mt-1 text-sm text-slate-600">
        Use your DryHome work email and its mailbox password (the one you use for webmail or your phone). We check it with the mail server, then store it encrypted. You only need to do this once.
      </p>
      <form action={connectMailbox} className="mt-4 space-y-3">
        <label className="block text-sm font-medium text-slate-700">
          Email address
          <input name="email" type="email" required defaultValue={email} autoComplete="username" spellCheck={false} autoCapitalize="off" className={input} placeholder="name@dryhomedampproofing.co.uk" />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Mailbox password
          <input name="password" type="password" required autoComplete="current-password" spellCheck={false} className={input} />
        </label>
        <details className="rounded-xl bg-slate-50 p-3 text-sm">
          <summary className="cursor-pointer font-semibold text-slate-700">Server settings (only if the office tells you to change them)</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-slate-600">
              Incoming (IMAP) server
              <input name="imap_host" placeholder={d.imap_host} className={input} spellCheck={false} autoCapitalize="off" />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              IMAP port
              <input name="imap_port" placeholder={String(d.imap_port)} inputMode="numeric" className={input} />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Outgoing (SMTP) server
              <input name="smtp_host" placeholder={d.smtp_host} className={input} spellCheck={false} autoCapitalize="off" />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              SMTP port
              <input name="smtp_port" placeholder={String(d.smtp_port)} inputMode="numeric" className={input} />
            </label>
          </div>
        </details>
        <button className={btnPrimary}>Connect mailbox</button>
      </form>
    </section>
  );
}

function FolderTabs({ folders, current, base }: { folders: MailFolder[]; current: string; base: string }) {
  return (
    <nav className="-mx-1 mb-4 flex gap-1 overflow-x-auto px-1 pb-1" aria-label="Folders">
      {folders.map((f) => {
        const active = f.path === current;
        return (
          <Link
            key={f.path}
            href={`${base}?folder=${encodeURIComponent(f.path)}`}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
              active ? "bg-[#252525] text-white" : "bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {FOLDER_LABEL[f.role] ?? f.name}
          </Link>
        );
      })}
    </nav>
  );
}

function MessageList({ items, folder, base, page, pages, total }: { items: MailListItem[]; folder: string; base: string; page: number; pages: number; total: number }) {
  const href = (p: number) => `${base}?folder=${encodeURIComponent(folder)}&page=${p}`;
  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
      {items.length === 0 ? (
        <p className="p-6 text-sm text-slate-500">No messages in this folder.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((m) => (
            <li key={m.uid}>
              <Link
                href={`${base}?folder=${encodeURIComponent(folder)}&uid=${m.uid}`}
                className={`flex items-start gap-3 px-4 py-3 transition hover:bg-slate-50 ${m.unread ? "border-l-4 border-[#be1e2d] bg-[#be1e2d]/[0.03]" : "border-l-4 border-transparent"}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={`truncate text-sm ${m.unread ? "font-bold text-[#252525]" : "text-slate-700"}`}>{m.from}</p>
                    <p className="shrink-0 text-xs text-slate-500">{when(m.date)}</p>
                  </div>
                  <p className={`truncate text-sm ${m.unread ? "font-semibold text-[#252525]" : "text-slate-600"}`}>
                    {m.hasAttachments && <span aria-label="Has attachments" className="mr-1">📎</span>}
                    {m.subject}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
        <span>
          {total} message{total === 1 ? "" : "s"} · page {page} of {pages}
        </span>
        <span className="flex gap-2">
          {page > 1 && <Link className={btnGhost} href={href(page - 1)}>← Newer</Link>}
          {page < pages && <Link className={btnGhost} href={href(page + 1)}>Older →</Link>}
        </span>
      </div>
    </section>
  );
}

function MessageView({ message, base }: { message: MailMessage; base: string }) {
  const q = `folder=${encodeURIComponent(message.folder)}&uid=${message.uid}`;
  const doc = message.html
    ? `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; font-src https: data:"><style>body{margin:0;padding:4px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#252525;word-wrap:break-word}img{max-width:100%;height:auto}table{max-width:100%}</style></head><body>${message.html}</body></html>`
    : null;
  return (
    <article className={card}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Link href={`${base}?folder=${encodeURIComponent(message.folder)}`} className="text-sm font-semibold text-slate-500 hover:text-[#252525]">
          ← Back
        </Link>
      </div>
      <h2 className="text-xl font-bold text-[#252525]">{message.subject}</h2>
      <div className="mt-2 space-y-0.5 text-sm text-slate-600">
        <p>
          <span className="font-semibold text-[#252525]">{message.from}</span>
          {message.fromAddress && message.fromAddress !== message.from && <span className="text-slate-500"> &lt;{message.fromAddress}&gt;</span>}
        </p>
        {message.to.length > 0 && <p className="break-words">To: {message.to.join(", ")}</p>}
        {message.cc.length > 0 && <p className="break-words">Cc: {message.cc.join(", ")}</p>}
        <p className="text-xs text-slate-500">{when(message.date, true)}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link className={btnGhost} href={`${base}?${q}&compose=reply`}>Reply</Link>
        <Link className={btnGhost} href={`${base}?${q}&compose=replyall`}>Reply all</Link>
        <Link className={btnGhost} href={`${base}?${q}&compose=forward`}>Forward</Link>
        <form action={markMessage}>
          <input type="hidden" name="folder" value={message.folder} />
          <input type="hidden" name="uid" value={message.uid} />
          <input type="hidden" name="read" value="false" />
          <button className={btnGhost}>Mark unread</button>
        </form>
        <form action={deleteMailMessage}>
          <input type="hidden" name="folder" value={message.folder} />
          <input type="hidden" name="uid" value={message.uid} />
          <button className="rounded-lg px-3 py-2 text-sm font-semibold text-[#be1e2d] ring-1 ring-[#be1e2d]/30 hover:bg-[#be1e2d]/10">Delete</button>
        </form>
      </div>

      {message.attachments.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {message.attachments.map((a) => (
            <li key={a.index}>
              <a
                href={`${base}/attachment?${q}&i=${a.index}`}
                className="inline-flex max-w-[16rem] items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm text-[#252525] hover:bg-slate-200"
              >
                <span aria-hidden>📎</span>
                <span className="truncate">{a.filename}</span>
                <span className="shrink-0 text-xs text-slate-500">{formatBytes(a.size)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 border-t border-slate-100 pt-4">
        {doc ? (
          <iframe
            title="Message"
            srcDoc={doc}
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer"
            className="h-[65vh] w-full rounded-lg border border-slate-100 bg-white"
          />
        ) : (
          <pre className="whitespace-pre-wrap break-words font-sans text-sm text-[#252525]">{message.text}</pre>
        )}
      </div>
    </article>
  );
}

function composeDefaults(mode: string, message: MailMessage | null, self: string): ComposeDefaults {
  if (!message || mode === "new") return { mode: "new", to: "", cc: "", subject: "", body: "" };
  const header = `On ${when(message.date, true)}, ${message.from}${message.fromAddress ? ` <${message.fromAddress}>` : ""} wrote:`;
  const refs = [...message.references, ...(message.messageId ? [message.messageId] : [])].join(" ");
  if (mode === "forward") {
    return {
      mode: "forward",
      to: "",
      cc: "",
      subject: replySubject(message.subject, "Fwd"),
      body: `\n\n---------- Forwarded message ----------\nFrom: ${message.from} <${message.fromAddress}>\nDate: ${when(message.date, true)}\nSubject: ${message.subject}\nTo: ${message.to.join(", ")}\n\n${message.text}`,
      sourceFolder: message.folder,
      sourceUid: message.uid,
      originalAttachments: message.attachments.length,
    };
  }
  const replyTo = message.replyTo.length ? message.replyTo : [message.fromAddress ? `${message.from} <${message.fromAddress}>` : message.from];
  const all = mode === "replyall";
  return {
    mode: all ? "replyall" : "reply",
    to: withoutAddress(replyTo, all ? self : "").join(", ") || replyTo.join(", "),
    cc: all ? withoutAddress([...message.to, ...message.cc], self).filter((a) => !replyTo.includes(a)).join(", ") : "",
    subject: replySubject(message.subject, "Re"),
    body: quoteText(message.text, header),
    sourceFolder: message.folder,
    sourceUid: message.uid,
    inReplyTo: message.messageId ?? undefined,
    references: refs || undefined,
  };
}

export default async function MailApp({ base, user, params }: { base: string; user: MailUser; params: MailSearchParams }) {
  if (!mailKeyConfigured()) {
    return (
      <div>
        <Header base={base} connected={false} />
        <p className={`${card} border-l-4 border-[#f29e23] text-sm text-[#252525]`}>
          Email isn&apos;t set up yet. The office needs to add the <code>MAIL_CREDENTIALS_KEY</code> setting before mailboxes can be connected.
        </p>
      </div>
    );
  }

  const { setUp, account } = await loadMailbox(user);
  if (!setUp) {
    return (
      <div>
        <Header base={base} connected={false} />
        <p className={`${card} border-l-4 border-[#f29e23] text-sm text-[#252525]`}>
          Email isn&apos;t set up yet – the office needs to run <code>supabase/staff_mailboxes.sql</code>.
        </p>
      </div>
    );
  }

  if (!account) {
    return (
      <div>
        <Header base={base} connected={false} />
        <Notice error={params.error} notice={params.notice} />
        <ConnectForm email={params.email} />
      </div>
    );
  }

  const creds = await loadCredentials(user);
  const folderPath = safeFolder(params.folder);
  const uid = safeUid(params.uid);
  const page = Math.max(1, Number(params.page) || 1);
  const compose = ["new", "reply", "replyall", "forward"].includes(params.compose ?? "") ? params.compose! : null;

  type Loaded = {
    folders: MailFolder[];
    list: Awaited<ReturnType<typeof listMessages>> | null;
    message: MailMessage | null;
    failure: string | null;
  };
  const loadMail = async (): Promise<Loaded> => {
    if (!creds) return { folders: [], list: null, message: null, failure: "Your saved password couldn't be read. Please disconnect and connect again." };
    try {
      return await withImap(creds, async (imap) => {
        const folders = await listFolders(imap);
        const message = uid ? await getMessage(imap, folderPath, uid, !compose) : null;
        const list = !uid && !compose ? await listMessages(imap, folderPath, page) : null;
        return { folders, list, message, failure: null };
      });
    } catch (error) {
      return {
        folders: [],
        list: null,
        message: null,
        failure:
          error instanceof MailLoginError
            ? `${error.message} If you changed your mailbox password, disconnect and connect again.`
            : "The mailbox couldn't be loaded. Please try again.",
      };
    }
  };
  const { folders, list: listed, message: shown, failure } = await loadMail();

  const disconnect = (
    <form action={disconnectMailbox} className="mt-6 flex flex-wrap items-center gap-3 text-xs text-slate-500">
      <span>Connected as {account.email} via {account.imap_host}.</span>
      <button className="rounded-lg px-3 py-1.5 font-semibold text-[#be1e2d] ring-1 ring-[#be1e2d]/30 hover:bg-[#be1e2d]/10">Disconnect mailbox</button>
    </form>
  );

  return (
    <div>
      <Header email={account.email} base={base} connected />
      <Notice error={params.error ?? failure ?? undefined} notice={params.notice} />
      {folders.length > 0 && <FolderTabs folders={folders} current={folderPath} base={base} />}
      {compose ? (
        <section className={card}>
          <ComposeForm
            defaults={composeDefaults(compose, shown, account.email)}
            cancelHref={shown ? `${base}?folder=${encodeURIComponent(folderPath)}&uid=${shown.uid}` : `${base}?folder=${encodeURIComponent(folderPath)}`}
          />
        </section>
      ) : shown ? (
        <MessageView message={shown} base={base} />
      ) : listed ? (
        <MessageList {...listed} folder={folderPath} base={base} />
      ) : uid && !failure ? (
        <p className={`${card} text-sm text-slate-500`}>That message couldn&apos;t be found (it may have been moved or deleted).</p>
      ) : null}
      {disconnect}
    </div>
  );
}
