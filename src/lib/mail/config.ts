/*
 * SiteGround mail defaults for dryhomedampproofing.co.uk (confirmed in
 * SiteGround's docs: IMAP 993 SSL/TLS, SMTP 465 SSL/TLS, full email
 * address as username; mail.<domain> has a valid certificate).
 * Override with MAIL_IMAP_HOST / MAIL_IMAP_PORT / MAIL_IMAP_SECURE and
 * MAIL_SMTP_HOST / MAIL_SMTP_PORT / MAIL_SMTP_SECURE, or per mailbox.
 */
export const MAIL_DOMAIN = "dryhomedampproofing.co.uk";

function bool(value: string | undefined, fallback: boolean) {
  if (value === undefined || value.trim() === "") return fallback;
  return !/^(0|false|no|off)$/i.test(value.trim());
}

function port(value: string | undefined, fallback: number) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : fallback;
}

export function mailDefaults() {
  return {
    imap_host: process.env.MAIL_IMAP_HOST?.trim() || `mail.${MAIL_DOMAIN}`,
    imap_port: port(process.env.MAIL_IMAP_PORT, 993),
    imap_secure: bool(process.env.MAIL_IMAP_SECURE, true),
    smtp_host: process.env.MAIL_SMTP_HOST?.trim() || `mail.${MAIL_DOMAIN}`,
    smtp_port: port(process.env.MAIL_SMTP_PORT, 465),
    smtp_secure: bool(process.env.MAIL_SMTP_SECURE, true),
  };
}

export function isValidHost(host: string) {
  return /^[a-z0-9.-]{1,253}$/i.test(host) && !host.startsWith(".") && host.includes(".");
}

/**
 * Per-mailbox server overrides are limited to the company domain and
 * SiteGround's own mail hosts, so the server can't be pointed elsewhere.
 */
export function isAllowedMailHost(host: string) {
  const h = host.trim().toLowerCase();
  if (!isValidHost(h)) return false;
  const defaults = mailDefaults();
  if (h === defaults.imap_host.toLowerCase() || h === defaults.smtp_host.toLowerCase()) return true;
  return h === MAIL_DOMAIN || h.endsWith(`.${MAIL_DOMAIN}`) || /^[a-z0-9-]+\.sgcpanel\.com$/.test(h) || /^[a-z0-9-]+\.siteground\.(com|biz|eu)$/.test(h);
}
