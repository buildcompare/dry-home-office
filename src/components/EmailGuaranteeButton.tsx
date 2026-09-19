"use client";

import { useState } from "react";

type EmailGuaranteeButtonProps = {
  guaranteeId: string;
  recipient: string | null;
  status: string;
};

export default function EmailGuaranteeButton({
  guaranteeId,
  recipient,
  status,
}: EmailGuaranteeButtonProps) {
  const [sending, setSending] =
    useState(false);

  async function sendGuarantee() {
    if (!recipient) {
      alert(
        "This client does not have an email address saved."
      );

      return;
    }

    const confirmed =
      window.confirm(
        `${
          status === "Issued" ||
          status === "Viewed"
            ? "Send this guarantee again"
            : "Send this guarantee"
        } to ${recipient}?`
      );

    if (!confirmed) {
      return;
    }

    setSending(true);

    try {
      const response =
        await fetch(
          `/guarantees/${guaranteeId}/send`,
          {
            method: "POST",
          }
        );

      if (!response.ok) {
        const result =
          await response.json().catch(
            () => null
          );

        throw new Error(
          result?.error ||
            "Guarantee could not be sent."
        );
      }

      window.location.href =
        `/guarantees/${guaranteeId}?sent=1`;
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Guarantee could not be sent."
      );

      setSending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={sendGuarantee}
      disabled={
        sending ||
        !recipient
      }
      className="rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {sending
        ? "Sending..."
        : status === "Issued" ||
            status === "Viewed"
          ? "Send Again"
          : "Send Guarantee"}
    </button>
  );
}