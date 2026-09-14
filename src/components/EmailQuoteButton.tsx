"use client";

import { useState } from "react";

type EmailQuoteButtonProps = {
  quoteId: string;
  recipient: string | null;
  status: string;
};

export default function EmailQuoteButton({
  quoteId,
  recipient,
  status,
}: EmailQuoteButtonProps) {
  const [sending, setSending] = useState(false);

  const hasEmail = Boolean(recipient);

  function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    if (!recipient) {
      event.preventDefault();
      return;
    }

    const message =
      status === "Sent"
        ? `Send this quotation again to ${recipient}?`
        : `Email this quotation to ${recipient}?`;

    const confirmed =
      window.confirm(message);

    if (!confirmed) {
      event.preventDefault();
      return;
    }

    setSending(true);
  }

  return (
    <form
      method="post"
      action={`/quotes/${quoteId}/send`}
      onSubmit={handleSubmit}
    >
      <button
        type="submit"
        disabled={!hasEmail || sending}
        className={`rounded-lg px-4 py-3 text-sm font-semibold transition ${
          hasEmail && !sending
            ? "bg-slate-900 text-white hover:bg-slate-700"
            : "cursor-not-allowed bg-slate-300 text-slate-500"
        }`}
        title={
          hasEmail
            ? `Send to ${recipient}`
            : "The client does not have an email address"
        }
      >
        {sending
          ? "Sending..."
          : status === "Sent"
            ? "Send Again"
            : "Email Quote"}
      </button>
    </form>
  );
}