"use client";

import { useFormStatus } from "react-dom";

/**
 * Submit button that asks for confirmation first and is disabled while
 * the form is being sent (so an email can't go twice).
 */
export default function ConfirmSubmitButton({
  confirmMessage,
  children,
  pendingLabel,
  className,
  disabled = false,
  title,
}: {
  confirmMessage: string;
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
  title?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      title={title}
      className={`${className ?? ""} disabled:cursor-not-allowed disabled:opacity-50`}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
