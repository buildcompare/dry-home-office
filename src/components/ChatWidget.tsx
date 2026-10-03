"use client";

import { FormEvent, useState } from "react";

type ChatMessage = {
  id: number;
  role: "user" | "bot";
  text: string;
};

function replyFor(text: string) {
  const lower = text.toLowerCase();

  if (lower.includes("invoice")) {
    return "I can talk through an invoice, but I won't create or change one from this chat.";
  }

  if (lower.includes("quote")) {
    return "Quotes are still made on the Quotes page. I won't create one from this chat.";
  }

  if (lower.includes("contract")) {
    return "Contracts are still made on the Contracts page. I won't change one from this chat.";
  }

  return `Got it. You said: “${text}”. I haven't changed any office records.`;
}

type ChatWidgetProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showLauncher?: boolean;
};

export default function ChatWidget({
  open: openProp,
  onOpenChange,
  showLauncher = true,
}: ChatWidgetProps = {}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;

  function setOpen(next: boolean | ((current: boolean) => boolean)) {
    const value = typeof next === "function" ? next(open) : next;
    onOpenChange?.(value);

    if (openProp === undefined) {
      setUncontrolledOpen(value);
    }
  }
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = draft.trim();

    if (!text) {
      return;
    }

    const sentAt = Date.now();

    setMessages((current) => [
      ...current,
      {
        id: sentAt,
        role: "user",
        text,
      },
      {
        id: sentAt + 1,
        role: "bot",
        text: replyFor(text),
      },
    ]);
    setDraft("");
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <section
          className="flex h-96 w-80 max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
          aria-label="Messages"
        >
          <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-3 text-white">
            <div>
              <p className="text-sm font-semibold">Messages</p>
              <p className="text-xs text-slate-400">
                Replies in this panel only
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-1 text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white"
              aria-label="Close messages"
            >
              Close
            </button>
          </header>

          <div className="flex-1 space-y-2 overflow-y-auto bg-slate-50 p-4">
            {messages.length === 0 ? (
              <p className="text-sm text-slate-500">
                No messages yet. Type one below.
              </p>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={
                    message.role === "user"
                      ? "ml-8 rounded-2xl rounded-br-md bg-slate-900 px-3 py-2 text-sm text-white"
                      : "mr-8 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  }
                >
                  {message.role === "bot" && (
                    <p className="mb-1 text-xs font-semibold text-slate-500">
                      Office
                    </p>
                  )}
                  {message.text}
                </div>
              ))
            )}
          </div>

          <form
            onSubmit={sendMessage}
            className="flex gap-2 border-t border-slate-200 p-3"
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Type a message"
              aria-label="Message"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900"
            />
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Send
            </button>
          </form>
        </section>
      )}

      {showLauncher && (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-700"
          aria-expanded={open}
          aria-label={open ? "Close chat" : "Open chat"}
        >
          Chat
        </button>
      )}
    </div>
  );
}
