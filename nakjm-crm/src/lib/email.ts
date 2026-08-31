import "server-only";

import nodemailer from "nodemailer";

/**
 * Generic SMTP sender -- works with any provider (Gmail, Office365, SendGrid's
 * SMTP relay, Amazon SES, etc.) rather than locking the app to one vendor's
 * API. Silently no-ops (just logs) when SMTP_* env vars aren't set, so the
 * app never crashes because notification email hasn't been configured yet.
 */

let transporter: ReturnType<typeof nodemailer.createTransport> | null | undefined;

function getTransporter() {
  if (transporter !== undefined) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    transporter = null;
    return transporter;
  }
  const port = Number(SMTP_PORT) || 587;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

export function emailConfigured(): boolean {
  return getTransporter() !== null;
}

export async function sendEmail(params: { to: string | string[]; subject: string; html: string }): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.warn(`[email] SMTP not configured -- skipping "${params.subject}" to ${Array.isArray(params.to) ? params.to.join(", ") : params.to}`);
    return;
  }
  await t.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
}
