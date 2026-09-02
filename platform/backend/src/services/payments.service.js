'use strict';

const crypto = require('crypto');
const { query } = require('../config/database');
const audit = require('./audit.service');
const invoices = require('./invoices.service');
const notifications = require('./notifications.service');
const { sendReceiptEmail } = require('./email.service');

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

const razorpayGet = async (path) => {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    headers: { Authorization: `Basic ${auth}` },
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
    await notifications.emit({ type: 'payment_received', title: 'Payment received', message: `${payment.currency} ${payment.amount}`, tenantId: payment.tenant_id });
    getReceipt(payment.id)
      .then(sendReceiptEmail)
      .catch((err) => console.error(`[payments] Failed to email receipt for payment ${payment.id}:`, err.message));

    // When the tenant checked "save card" during Checkout, Razorpay puts
    // token_id/customer_id straight on the captured payment entity — no
    // separate token.captured event needed. Recording it here is what lets
    // chargeSavedMethod bill this tenant automatically next period.
    if (payload.token_id && payload.customer_id) {
      await query(
        `INSERT INTO tenant_payment_methods (tenant_id, gateway, gateway_customer_id, gateway_token_id, card_last4, card_network, active)
         VALUES ($1,'razorpay',$2,$3,$4,$5,true)
         ON CONFLICT (tenant_id, gateway_token_id) DO UPDATE SET active = true`,
        [payment.tenant_id, payload.customer_id, payload.token_id, payload.card?.last4 || null, payload.card?.network || null]
      ).catch((err) => console.error(`[payments] Failed to save payment method for tenant ${payment.tenant_id}:`, err.message));
    }
  } else if (event.event === 'payment.failed') {
    await query(
      `UPDATE payments SET status = 'failed', gateway_payment_id = $1, failure_reason = $2, updated_at = NOW() WHERE id = $3`,
      [payload.id, payload.error_description || 'Payment failed', payment.id]
    );
    await audit.log({ tenantId: payment.tenant_id, action: 'payment.failed', details: { invoice_id: payment.invoice_id, reason: payload.error_description } });
    await notifications.emit({ type: 'payment_failed', title: 'Payment failed', message: payload.error_description || 'Payment failed', tenantId: payment.tenant_id });
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

  // A refunded payment must not leave its invoice showing 'paid' -- that
  // would both misrepresent the ledger and block createOrderForInvoice
  // (which refuses to re-collect on an invoice already marked paid).
  // 'void' is the closest status the invoices table's CHECK constraint
  // allows for "this invoice's obligation was reversed, needs review."
  await invoices.setStatus(payment.invoice_id, 'void', actor);

  await audit.log({ superAdminId: actor?.id, tenantId: payment.tenant_id, action: 'payment.refunded', details: { payment_id: paymentId, invoice_id: payment.invoice_id } });
  return updated.rows[0];
};

// A printable receipt for one successful payment — tied to the gateway's
// own payment id when we have one (a real Razorpay capture), falling back
// to our own payment row id for a manually-recorded / refund-adjacent case.
const getReceipt = async (paymentId) => {
  const res = await query(
    `SELECT p.*, i.invoice_number, i.period_start, i.period_end,
            t.name AS tenant_name, t.contact_name, t.contact_email
     FROM payments p
     JOIN invoices i ON i.id = p.invoice_id
     JOIN tenants t ON t.id = p.tenant_id
     WHERE p.id = $1`,
    [paymentId]
  );
  const payment = res.rows[0];
  if (!payment) { const e = new Error('Payment not found'); e.status = 404; throw e; }
  if (payment.status !== 'paid') { const e = new Error('Only a paid payment has a receipt.'); e.status = 400; throw e; }

  return {
    receipt_number: `RCPT-${(payment.gateway_payment_id || payment.id).slice(-10).toUpperCase()}`,
    payment_id: payment.id,
    gateway_payment_id: payment.gateway_payment_id,
    auto_charged: payment.auto_charged,
    amount: payment.amount,
    currency: payment.currency,
    paid_at: payment.updated_at,
    invoice_number: payment.invoice_number,
    period_start: payment.period_start,
    period_end: payment.period_end,
    tenant_name: payment.tenant_name,
    contact_name: payment.contact_name,
    contact_email: payment.contact_email,
  };
};

// Error-recovery action (spec section 51): a substitute for "retry the
// webhook" -- Razorpay doesn't let us replay a past webhook delivery on
// demand, so instead this asks Razorpay directly what actually happened to
// this order's payments and reconciles our row to match, for a payment
// stuck at 'created' because its webhook delivery was lost, delayed, or
// arrived before RAZORPAY_WEBHOOK_SECRET was configured.
const syncPaymentStatus = async (paymentId, actor) => {
  if (!razorpayConfigured()) {
    const e = new Error('Razorpay is not configured on this platform backend (RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET).');
    e.status = 503;
    throw e;
  }
  const res = await query(`SELECT * FROM payments WHERE id = $1`, [paymentId]);
  const payment = res.rows[0];
  if (!payment) { const e = new Error('Payment not found'); e.status = 404; throw e; }
  if (!payment.gateway_order_id) { const e = new Error('This payment has no gateway order to look up.'); e.status = 400; throw e; }
  if (payment.status !== 'created') return { synced: false, reason: 'already_finalized', status: payment.status };

  const orderPayments = await razorpayGet(`/orders/${payment.gateway_order_id}/payments`);
  const latest = (orderPayments.items || []).sort((a, b) => b.created_at - a.created_at)[0];
  if (!latest) return { synced: false, reason: 'no_payment_attempts_yet' };

  if (latest.status === 'captured') {
    await query(`UPDATE payments SET status = 'paid', gateway_payment_id = $1, updated_at = NOW() WHERE id = $2`, [latest.id, paymentId]);
    await invoices.setStatus(payment.invoice_id, 'paid', actor);
    await audit.log({ superAdminId: actor?.id, tenantId: payment.tenant_id, action: 'payment.synced', details: { invoice_id: payment.invoice_id, payment_id: latest.id, status: 'captured' } });
    getReceipt(paymentId).then(sendReceiptEmail).catch(() => {});
    return { synced: true, status: 'paid' };
  }
  if (latest.status === 'failed') {
    await query(`UPDATE payments SET status = 'failed', gateway_payment_id = $1, failure_reason = $2, updated_at = NOW() WHERE id = $3`, [latest.id, latest.error_description || 'Payment failed', paymentId]);
    await audit.log({ superAdminId: actor?.id, tenantId: payment.tenant_id, action: 'payment.synced', details: { invoice_id: payment.invoice_id, payment_id: latest.id, status: 'failed' } });
    return { synced: true, status: 'failed' };
  }
  return { synced: false, reason: `gateway_status_${latest.status}` };
};

const listPaymentMethods = async (tenantId) => {
  const res = await query(
    `SELECT id, gateway, card_last4, card_network, active, created_at
     FROM tenant_payment_methods WHERE tenant_id = $1 AND active ORDER BY created_at DESC`,
    [tenantId]
  );
  return res.rows;
};

const deactivatePaymentMethod = async (id, actor) => {
  const res = await query(
    `UPDATE tenant_payment_methods SET active = false WHERE id = $1 RETURNING tenant_id`,
    [id]
  );
  if (!res.rows[0]) { const e = new Error('Payment method not found'); e.status = 404; throw e; }
  await audit.log({ superAdminId: actor?.id, tenantId: res.rows[0].tenant_id, action: 'payment_method.removed', details: { payment_method_id: id } });
  return { ok: true };
};

// Best-effort recurring charge against a tenant's saved card (spec section
// 41's auto-charge). Never throws -- a tenant with no saved method, or a
// declined/erroring charge, should fall back to the normal "invoice sits as
// issued, tenant pays via the link" flow rather than blocking invoice
// generation. Razorpay's saved-card recurring charge (POST /payments/create/
// recurring) needs a live RAZORPAY_KEY_ID/SECRET and a real saved token to
// actually exercise -- this cannot be verified against a live gateway in
// this environment, so treat the gateway call itself as unverified even
// though the surrounding bookkeeping (order/payment rows, status handling)
// follows the exact same pattern as createOrderForInvoice/handleWebhook,
// which *are* verified.
const chargeSavedMethod = async (invoice, tenant) => {
  if (!razorpayConfigured()) return { attempted: false, reason: 'razorpay_not_configured' };

  const methodRes = await query(
    `SELECT * FROM tenant_payment_methods WHERE tenant_id = $1 AND active ORDER BY created_at DESC LIMIT 1`,
    [invoice.tenant_id]
  );
  const method = methodRes.rows[0];
  if (!method) return { attempted: false, reason: 'no_saved_method' };

  const amountPaise = Math.round(Number(invoice.total_amount) * 100);
  let order;
  try {
    order = await razorpayRequest('/orders', {
      amount: amountPaise,
      currency: invoice.currency,
      receipt: invoice.invoice_number,
      notes: { invoice_id: invoice.id, tenant_id: invoice.tenant_id, auto_charge: '1' },
    });
  } catch (err) {
    return { attempted: true, ok: false, reason: `order_creation_failed: ${err.message}` };
  }

  const paymentRow = await query(
    `INSERT INTO payments (invoice_id, tenant_id, gateway, gateway_order_id, amount, currency, status, auto_charged)
     VALUES ($1,$2,'razorpay',$3,$4,$5,'created',true) RETURNING *`,
    [invoice.id, invoice.tenant_id, order.id, invoice.total_amount, invoice.currency]
  );

  try {
    const charge = await razorpayRequest('/payments/create/recurring', {
      email: tenant.contact_email,
      contact: tenant.contact_phone || undefined,
      amount: amountPaise,
      currency: invoice.currency,
      order_id: order.id,
      customer_id: method.gateway_customer_id,
      token: method.gateway_token_id,
      recurring: '1',
    });

    if (charge.status === 'captured') {
      await query(`UPDATE payments SET status = 'paid', gateway_payment_id = $1, updated_at = NOW() WHERE id = $2`, [charge.id, paymentRow.rows[0].id]);
      await invoices.setStatus(invoice.id, 'paid', null);
      await audit.log({ tenantId: invoice.tenant_id, action: 'payment.auto_charged', details: { invoice_id: invoice.id, payment_id: charge.id } });
      getReceipt(paymentRow.rows[0].id).then(sendReceiptEmail).catch(() => {});
      return { attempted: true, ok: true, status: 'captured' };
    }
    // Not immediately captured (e.g. pending) -- the payment.captured
    // webhook will finalize it via gateway_order_id, same as a manual pay.
    return { attempted: true, ok: true, status: charge.status };
  } catch (err) {
    await query(`UPDATE payments SET status = 'failed', failure_reason = $1, updated_at = NOW() WHERE id = $2`, [err.message, paymentRow.rows[0].id]);
    await notifications.emit({ type: 'auto_charge_failed', title: `Auto-charge failed: ${invoice.invoice_number}`, message: err.message, tenantId: invoice.tenant_id });
    return { attempted: true, ok: false, reason: err.message };
  }
};

module.exports = {
  createOrderForInvoice, listForInvoice, handleWebhook, refund, razorpayConfigured, getReceipt,
  listPaymentMethods, deactivatePaymentMethod, chargeSavedMethod, syncPaymentStatus,
};
