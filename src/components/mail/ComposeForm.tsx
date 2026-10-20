"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { sendMailMessage, type SendState } from "@/lib/mail/actions";
import { formatBytes, MAX_ATTACHMENT_BYTES } from "@/lib/mail/addresses";

export type ComposeDefaults = {
  mode: "new" | "reply" | "replyall" | "forward";
  to: string;
  cc: string;
  subject: string;
  body: string;
  sourceFolder?: string;
  sourceUid?: number;
  inReplyTo?: string;
  references?: string;
  originalAttachments?: number;
};

const field =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#252525] focus:ring-2 focus:ring-[#f29e23]/40";

export default function ComposeForm({ defaults, cancelHref }: { defaults: ComposeDefaults; cancelHref: string }) {
  const [state, action, pending] = useActionState<SendState, FormData>(sendMailMessage, { error: null });
  const [files, setFiles] = useState<{ name: string; size: number }[]>([]);
  const [showCc, setShowCc] = useState(Boolean(defaults.cc));
  const total = files.reduce((sum, f) => sum + f.size, 0);
  const title = { new: "New email", reply: "Reply", replyall: "Reply all", forward: "Forward" }[defaults.mode];

  return (
    <form action={action} className="space-y-3">
      <h2 className="text-lg font-semibold text-[#252525]">{title}</h2>
      {state.error && (
        <p className="rounded-xl border-l-4 border-[#be1e2d] bg-white p-3 text-sm font-medium text-[#be1e2d] shadow-sm" role="alert">
          {state.error}
        </p>
      )}
      <input type="hidden" name="mode" value={defaults.mode} />
      {defaults.sourceFolder && <input type="hidden" name="source_folder" value={defaults.sourceFolder} />}
      {defaults.sourceUid && <input type="hidden" name="source_uid" value={defaults.sourceUid} />}
      {defaults.inReplyTo && <input type="hidden" name="in_reply_to" value={defaults.inReplyTo} />}
      {defaults.references && <input type="hidden" name="references" value={defaults.references} />}

      <label className="block text-sm font-medium text-slate-700">
        To
        <input name="to" required defaultValue={defaults.to} className={field} spellCheck={false} autoComplete="off" autoCapitalize="off" inputMode="email" placeholder="name@example.com, another@example.com" />
      </label>
      {showCc ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Cc
            <input name="cc" defaultValue={defaults.cc} className={field} spellCheck={false} autoComplete="off" autoCapitalize="off" inputMode="email" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Bcc
            <input name="bcc" className={field} spellCheck={false} autoComplete="off" autoCapitalize="off" inputMode="email" />
          </label>
        </div>
      ) : (
        <button type="button" onClick={() => setShowCc(true)} className="text-sm font-semibold text-[#be1e2d] hover:underline">
          Add Cc / Bcc
        </button>
      )}
      <label className="block text-sm font-medium text-slate-700">
        Subject
        <input name="subject" defaultValue={defaults.subject} className={field} spellCheck lang="en-GB" />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Message
        <textarea name="body" rows={12} defaultValue={defaults.body} className={`${field} font-[inherit]`} spellCheck lang="en-GB" />
      </label>

      <div className="rounded-xl bg-slate-50 p-3 text-sm">
        <label className="font-medium text-slate-700">
          Attachments
          <input
            type="file"
            name="attachments"
            multiple
            className="mt-1 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#252525] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
            onChange={(event) => setFiles(Array.from(event.target.files ?? []).map((f) => ({ name: f.name, size: f.size })))}
          />
        </label>
        {files.length > 0 && (
          <p className={`mt-1 text-xs ${total > MAX_ATTACHMENT_BYTES ? "font-semibold text-[#be1e2d]" : "text-slate-500"}`}>
            {files.length} file{files.length === 1 ? "" : "s"}, {formatBytes(total)}
            {total > MAX_ATTACHMENT_BYTES && " – too large to upload; please keep new attachments under 3.5 MB in total."}
          </p>
        )}
        {defaults.mode === "forward" && (defaults.originalAttachments ?? 0) > 0 && (
          <label className="mt-2 flex items-center gap-2 text-slate-700">
            <input type="checkbox" name="include_attachments" defaultChecked className="h-4 w-4 accent-[#be1e2d]" />
            Include the original {defaults.originalAttachments} attachment{defaults.originalAttachments === 1 ? "" : "s"}
          </label>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          disabled={pending || total > MAX_ATTACHMENT_BYTES}
          className="rounded-xl bg-[#be1e2d] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#a31926] disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send"}
        </button>
        <Link href={cancelHref} className="rounded-lg px-4 py-3 text-sm font-semibold text-[#252525] hover:bg-slate-100">
          Cancel
        </Link>
      </div>
    </form>
  );
}
