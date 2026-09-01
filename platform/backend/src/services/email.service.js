'use strict';

/**
 * Generic SMTP sender -- works with any provider (Gmail, Office365, SendGrid's
 * SMTP relay, Amazon SES, etc.) rather than locking the app to one vendor's
 * API. Silently no-ops (just logs) when SMTP_* env vars aren't set, so the
 * app never crashes because notification email hasn't been configured yet.
 */

const nodemailer = require('nodemailer');

let transporter;

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

function emailConfigured() {
  return getTransporter() !== null;
}

async function sendEmail({ to, subject, html }) {
  const t = getTransporter();
  if (!t) {
    console.warn(`[email] SMTP not configured -- skipping "${subject}" to ${Array.isArray(to) ? to.join(', ') : to}`);
    return;
  }
  await t.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, html });
}

async function sendInvoiceEmail(invoice, tenant) {
  const html = `
    <p>Hi ${tenant.contact_name},</p>
    <p>Your invoice for the billing period <strong>${invoice.period_start} – ${invoice.period_end}</strong> is ready.</p>
    <table cellpadding="6" style="border-collapse:collapse">
      <tr><td>Invoice number</td><td><strong>${invoice.invoice_number}</strong></td></tr>
      <tr><td>Billing model</td><td>${invoice.billing_model === 'per_employee' ? `Per employee (${invoice.employee_count} employees)` : 'Fixed monthly'}</td></tr>
      <tr><td>Subtotal</td><td>${invoice.currency} ${invoice.subtotal}</td></tr>
      <tr><td>Tax (${invoice.tax_percent}%)</td><td>${invoice.currency} ${invoice.tax_amount}</td></tr>
      <tr><td><strong>Total due</strong></td><td><strong>${invoice.currency} ${invoice.total_amount}</strong></td></tr>
      <tr><td>Due date</td><td>${new Date(invoice.due_at).toDateString()}</td></tr>
    </table>
    <p>Thanks for using Livanto.</p>
  `;
  await sendEmail({ to: tenant.contact_email, subject: `Invoice ${invoice.invoice_number} — ${tenant.name}`, html });
}

module.exports = { emailConfigured, sendEmail, sendInvoiceEmail };
