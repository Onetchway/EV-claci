'use strict';

const crypto = require('crypto');
const { query } = require('../config/database');
const audit = require('./audit.service');
const invoices = require('./invoices.service');

// Talks to Razorpay's plain REST API directly (Basic auth, key_id:key_secret)
// instead of pulling in their SDK -- this integration only needs "create an
// order" and "refund a payment", both single POSTs.
const razorpayConfigured = () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

const razorpayRequest = async (path, body) => {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data?.error?.description || `Razorpay request failed (${res.status}).`);
    e.status = 502;
    throw e;
  }
  return data;
};

// Creates a Razorpay order for a tenant's issued invoice and records the
// attempt. Returns what the frontend's Razorpay Checkout widget needs
// (order_id, amount, currency, key_id) -- the actual card/UPI flow happens
// entirely client-side against Razorpay, this backend never sees card data.
const createOrderForInvoice = async (invoiceId, actor) => {
  if (!razorpayConfigured()) {
    const e = new Error('Razorpay is not configured on this platform backend (RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET).');
    e.status = 503;
    throw e;
  }

  const invoice = await invoices.getOne(invoiceId);
  if (invoice.status === 'paid') { const e = new Error('This invoice is already paid.'); e.status = 400; throw e; }
  if (invoice.status === 'void') { const e = new Error('This invoice has been voided.'); e.status = 400; throw e; }

  const amountPaise = Math.round(Number(invoice.total_amount) * 100);
  const order = await razorpayRequest('/orders', {
    amount: amountPaise,
    currency: invoice.currency,
    receipt: invoice.invoice_number,
    notes: { invoice_id: invoice.id, tenant_id: invoice.tenant_id },
  });

  const res = await query(
    `INSERT INTO payments (invoice_id, tenant_id, gateway, gateway_order_id, amount, currency, status)
     VALUES ($1,$2,'razorpay',$3,$4,$5,'created') RETURNING *`,
    [invoice.id, invoice.tenant_id, order.id, invoice.total_amount, invoice.currency]
  );

  await audit.log({ superAdminId: actor?.id, tenantId: invoice.tenant_id, action: 'payment.order_created', details: { invoice_id: invoice.id, order_id: order.id } });

  return {
    payment_id: res.rows[0].id,
    order_id: order.id,
    amount: amountPaise,
    currency: invoice.currency,
    key_id: process.env.RAZORPAY_KEY_ID,
    invoice_number: invoice.invoice_number,
  };
};

const listForInvoice = async (invoiceId) => {
  const res = await query(`SELECT * FROM payments WHERE invoice_id = $1 ORDER BY created_at DESC`, [invoiceId]);
  return res.rows;
};

const verifyWebhookSignature = (rawBody, signature) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  // timingSafeEqual requires equal-length buffers; a length mismatch is
  // itself proof the signature doesn't match.
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// Handles Razorpay's payment.captured / payment.failed webhook events.
// rawBody must be the exact bytes Razorpay signed (see app.js's
// express.json verify hook) -- re-serializing req.body would break
// signature verification on any whitespace/key-order difference.
const handleWebhook = async (rawBody, signature) => {
  if (!verifyWebhookSignature(rawBody, signature)) {
    const e = new Error('Invalid webhook signature.'); e.status = 400; throw e;
  }
  const event = JSON.parse(rawBody.toString('utf8'));
  const payload = event.payload?.payment?.entity;
  if (!payload) return { ignored: true, event: event.event };

  const paymentRes = await query(`SELECT * FROM payments WHERE gateway_order_id = $1`, [payload.order_id]);
  const payment = paymentRes.rows[0];
  if (!payment) return { ignored: true, reason: 'unknown order_id' };

  if (event.event === 'payment.captured') {
    await query(
      `UPDATE payments SET status = 'paid', gateway_payment_id = $1, updated_at = NOW() WHERE id = $2`,
      [payload.id, payment.id]
    );
    await invoices.setStatus(payment.invoice_id, 'paid', null);
    await audit.log({ tenantId: payment.tenant_id, action: 'payment.captured', details: { invoice_id: payment.invoice_id, payment_id: payload.id } });
  } else if (event.event === 'payment.failed') {
    await query(
      `UPDATE payments SET status = 'failed', gateway_payment_id = $1, failure_reason = $2, updated_at = NOW() WHERE id = $3`,
      [payload.id, payload.error_description || 'Payment failed', payment.id]
    );
    await audit.log({ tenantId: payment.tenant_id, action: 'payment.failed', details: { invoice_id: payment.invoice_id, reason: payload.error_description } });
  }

  return { ok: true };
};

// Refunds a captured payment. Calls Razorpay's refund API when configured;
// otherwise records the refund as a manual/offline action (e.g. a bank
// transfer reversal) so the ledger still reflects reality even without a
// live gateway wired up.
const refund = async (paymentId, actor) => {
  const res = await query(`SELECT * FROM payments WHERE id = $1`, [paymentId]);
  const payment = res.rows[0];
  if (!payment) { const e = new Error('Payment not found'); e.status = 404; throw e; }
  if (payment.status !== 'paid') { const e = new Error('Only a paid payment can be refunded.'); e.status = 400; throw e; }

  if (razorpayConfigured() && payment.gateway_payment_id) {
    await razorpayRequest(`/payments/${payment.gateway_payment_id}/refund`, {});
  }

  const updated = await query(
    `UPDATE payments SET status = 'refunded', updated_at = NOW() WHERE id = $1 RETURNING *`,
    [paymentId]
  );
  await audit.log({ superAdminId: actor?.id, tenantId: payment.tenant_id, action: 'payment.refunded', details: { payment_id: paymentId, invoice_id: payment.invoice_id } });
  return updated.rows[0];
};

module.exports = { createOrderForInvoice, listForInvoice, handleWebhook, refund, razorpayConfigured };
