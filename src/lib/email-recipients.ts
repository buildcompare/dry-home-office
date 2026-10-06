/*
 * Shared helpers for building the list of email recipients
 * for a client (primary email first, then secondary email).
 *
 * Pure functions only, so this file is safe to import from
 * client components as well as server routes.
 */

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmailAddress(
  value: string
) {
  return EMAIL_PATTERN.test(
    value.trim()
  );
}

/**
 * Build a recipient list from any number of addresses.
 * Keeps the original order (primary first), trims values,
 * skips blanks and removes case-insensitive duplicates.
 */
export function buildRecipientList(
  ...emails: (
    | string
    | null
    | undefined
  )[]
) {
  const seen =
    new Set<string>();

  const recipients: string[] =
    [];

  for (const email of emails) {
    const trimmed =
      String(
        email ?? ""
      ).trim();

    if (!trimmed) {
      continue;
    }

    const key =
      trimmed.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    recipients.push(trimmed);
  }

  return recipients;
}

/**
 * Human-readable recipient list, e.g. "a@x.com and b@y.com".
 */
export function describeRecipients(
  recipients: string[]
) {
  if (
    recipients.length <= 1
  ) {
    return (
      recipients[0] ?? ""
    );
  }

  return `${recipients
    .slice(0, -1)
    .join(", ")} and ${
    recipients[
      recipients.length - 1
    ]
  }`;
}

/**
 * Value stored in the `sent_to` columns. A single address is
 * stored exactly as before; multiple addresses are comma separated.
 */
export function formatSentTo(
  recipients: string[]
) {
  return recipients.join(
    ", "
  );
}

/**
 * Resend accepts a string or an array. Keep sending a plain
 * string when there is only one recipient (existing behaviour).
 */
export function toResendRecipients(
  recipients: string[]
) {
  return recipients.length ===
    1
    ? recipients[0]
    : recipients;
}
