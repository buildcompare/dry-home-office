/* Pure helpers for the Email tab (safe for tests and the client). */

export type ParsedAddress = { name: string | null; address: string };

const EMAIL = /^[^\s@<>(),;:"]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

/** "A <a@x.com>, b@y.com; "Smith, J" <j@z.com>" → addresses. */
export function parseAddressList(input: string): { ok: true; list: ParsedAddress[] } | { ok: false; error: string } {
  const parts: string[] = [];
  let current = "";
  let quoted = false;
  let angle = false;
  for (const ch of input) {
    if (ch === '"') quoted = !quoted;
    if (!quoted && ch === "<") angle = true;
    if (!quoted && ch === ">") angle = false;
    if (!quoted && !angle && (ch === "," || ch === ";" || ch === "\n")) {
      parts.push(current);
      current = "";
    } else current += ch;
  }
  parts.push(current);

  const list: ParsedAddress[] = [];
  for (const raw of parts.map((p) => p.trim()).filter(Boolean)) {
    const match = /^(.*)<([^>]+)>$/.exec(raw);
    const address = (match ? match[2] : raw).trim();
    const name = match ? match[1].trim().replace(/^"|"$/g, "").trim() || null : null;
    if (!EMAIL.test(address)) return { ok: false, error: `"${raw.slice(0, 60)}" isn't a valid email address.` };
    list.push({ name, address });
  }
  if (list.length > 50) return { ok: false, error: "Please send to 50 people or fewer." };
  return { ok: true, list };
}

export function formatAddressList(list: ParsedAddress[]) {
  return list.map((a) => (a.name ? `"${a.name.replace(/"/g, "")}" <${a.address}>` : a.address)).join(", ");
}

export function replySubject(subject: string, prefix: "Re" | "Fwd") {
  const clean = subject.trim() || "(no subject)";
  const re = prefix === "Re" ? /^(re|aw|sv)\s*:/i : /^(fwd?|fw)\s*:/i;
  return re.test(clean) ? clean : `${prefix}: ${clean}`;
}

export function quoteText(text: string, header: string) {
  const body = text.replace(/\r\n/g, "\n").trim().split("\n").map((line) => `> ${line}`).join("\n");
  return `\n\n${header}\n${body}`;
}

/** Remove one address (case-insensitive) and duplicates. */
export function withoutAddress(list: string[], self: string) {
  const seen = new Set<string>();
  return list.filter((entry) => {
    const parsed = parseAddressList(entry);
    const address = parsed.ok && parsed.list[0] ? parsed.list[0].address.toLowerCase() : entry.toLowerCase();
    if (address === self.toLowerCase() || seen.has(address)) return false;
    seen.add(address);
    return true;
  });
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const MAX_ATTACHMENT_BYTES = 3.5 * 1024 * 1024;

export function safeFolder(value: unknown) {
  return typeof value === "string" && value.length > 0 && value.length <= 200 && !/[\r\n\0]/.test(value) ? value : "INBOX";
}

export function safeUid(value: unknown) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n < 2 ** 32 ? n : null;
}
