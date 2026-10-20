/* AES-256-GCM for stored mailbox passwords. Key: MAIL_CREDENTIALS_KEY (32 bytes, base64). */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key(): Buffer | null {
  const raw = process.env.MAIL_CREDENTIALS_KEY?.trim();
  if (!raw) return null;
  try {
    const buf = Buffer.from(raw, "base64");
    return buf.length === 32 ? buf : null;
  } catch {
    return null;
  }
}

export function mailKeyConfigured() {
  return key() !== null;
}

export type SealedSecret = { ciphertext: string; iv: string; tag: string };

export function sealSecret(plain: string, aad: string): SealedSecret {
  const k = key();
  if (!k) throw new Error("Mail credentials key is not configured");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return { ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64") };
}

export function openSecret(sealed: SealedSecret, aad: string): string {
  const k = key();
  if (!k) throw new Error("Mail credentials key is not configured");
  const decipher = createDecipheriv("aes-256-gcm", k, Buffer.from(sealed.iv, "base64"));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(sealed.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(sealed.ciphertext, "base64")), decipher.final()]).toString("utf8");
}
