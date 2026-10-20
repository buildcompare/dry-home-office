/* Sending (server only) through the user's own SMTP login. */
import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";
import type Mail from "nodemailer/lib/mailer";
import type { MailCredentials } from "@/lib/mail/store";

function transport(creds: MailCredentials) {
  return nodemailer.createTransport({
    host: creds.smtp_host,
    port: creds.smtp_port,
    secure: creds.smtp_secure,
    auth: { user: creds.email, pass: creds.password },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
    tls: { servername: creds.smtp_host, minVersion: "TLSv1.2" },
    logger: false,
  });
}

/** Login check only; no message is sent. */
export async function testSmtpLogin(creds: MailCredentials) {
  const t = transport(creds);
  try {
    await t.verify();
  } finally {
    t.close();
  }
}

/** Builds the message once, sends it, and returns the raw bytes for the Sent folder. */
export async function sendMail(creds: MailCredentials, message: Mail.Options, recipients: string[]) {
  const raw = await new MailComposer({ ...message, from: message.from ?? creds.email }).compile().build();
  const t = transport(creds);
  try {
    await t.sendMail({ envelope: { from: creds.email, to: recipients }, raw });
  } finally {
    t.close();
  }
  return raw;
}
