/*
 * Minimal Svix signature verification (the scheme Resend webhooks use).
 * Signed content is `${svix-id}.${svix-timestamp}.${rawBody}`, HMAC-SHA256
 * with the base64 secret after the "whsec_" prefix. The svix-signature
 * header holds one or more space-separated "v1,<base64>" values.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export const SVIX_TOLERANCE_SECONDS = 5 * 60;

export type SvixHeaders = {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
};

export function svixSignature(secret: string, id: string, timestamp: string, body: string) {
  const key = Buffer.from(secret.trim().replace(/^whsec_/, ""), "base64");
  return createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
}

export function verifySvixSignature(
  secret: string,
  headers: SvixHeaders,
  body: string,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): boolean {
  const { id, timestamp, signature } = headers;
  if (!secret || !id || !timestamp || !signature) return false;

  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(nowSeconds - sentAt) > SVIX_TOLERANCE_SECONDS) return false;

  const expected = Buffer.from(svixSignature(secret, id, timestamp, body));

  return signature.split(" ").some((part) => {
    const [version, value] = part.split(",", 2);
    if (version !== "v1" || !value) return false;
    const given = Buffer.from(value);
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
