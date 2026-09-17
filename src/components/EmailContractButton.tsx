"use client";

import { useState } from "react";

type EmailContractButtonProps = {
  contractId: string;
  recipient: string | null;
  status: string;
};

export default function EmailContractButton({
  contractId,
  recipient,
  status,
}: EmailContractButtonProps) {
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
      status === "Signed"
        ? `Send this contract again to ${recipient}?`
        : `Send this contract to ${recipient}?`;

    if (!window.confirm(message)) {
      return;
    }

    setSending(true);

    try {
      const response =
        await fetch(
          `/contracts/${contractId}/send`,
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
          "Unable to send contract"
        );
      }

      window.location.reload();
    } catch (error) {
      console.error(error);

      alert(
        "The contract could not be sent."
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
          ? "Send Contract"
          : "Send Again"}
    </button>
  );
}