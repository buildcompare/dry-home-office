/*
 * Bearer token check for POST /api/survey-reports.
 * Disabled unless SURVEY_REPORTS_UPLOAD_TOKEN is set (min 24 chars).
 */

import { createHash, timingSafeEqual } from "node:crypto";

export const MIN_UPLOAD_TOKEN_LENGTH = 24;

export function configuredUploadToken(value = process.env.SURVEY_REPORTS_UPLOAD_TOKEN) {
  const token = value?.trim() ?? "";
  return token.length >= MIN_UPLOAD_TOKEN_LENGTH ? token : null;
}

export function bearerToken(header: string | null) {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header ?? "");
  return match ? match[1] : null;
}

/** Constant-time comparison (hashing first makes the lengths equal). */
export function tokensMatch(provided: string, expected: string) {
  const a = createHash("sha256").update(provided, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}
