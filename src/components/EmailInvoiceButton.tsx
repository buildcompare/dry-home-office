"use client";

import { useState } from "react";

type EmailInvoiceButtonProps = {
  invoiceId: string;
  recipient: string | null;
  status: string;
};

export default function EmailInvoiceButton({
  invoiceId,
  recipient,
  status,
}: EmailInvoiceButtonProps) {
  const [sending, setSending] =
    useState(false);

  async function handleSend() {
    if (!recipient) {
      alert(
        "This client does not have an email address."
      );

      return;
    }

    const message =
      status === "Sent" ||
      status === "Viewed" ||
      status === "Part Paid" ||
      status === "Paid"
        ? `Send this invoice again to ${recipient}?`
        : `Send this invoice to ${recipient}?`;

    if (!window.confirm(message)) {
      return;
    }

    setSending(true);

    try {
      const response =
        await fetch(
          `/invoices/${invoiceId}/send`,
          {
            method: "POST",
          }
        );

      if (response.redirected) {
        window.location.href =
          response.url;

        return;
      }

      if (!response.ok) {
        throw new Error(
          "Unable to send invoice"
        );
      }

      window.location.reload();
    } catch (error) {
      console.error(error);

      alert(
        "The invoice could not be sent."
      );

      setSending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSend}
      disabled={
        sending ||
        !recipient
      }
      className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {sending
        ? "Sending..."
        : status === "Draft"
          ? "Send Invoice"
          : "Send Again"}
    </button>
  );
}