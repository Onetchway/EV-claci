'use strict';

const { query } = require('../config/database');
const audit = require('./audit.service');

const listForTenant = async (tenantId) => {
  const res = await query(
    `SELECT * FROM tenant_credits WHERE tenant_id = $1 ORDER BY created_at DESC`,
    [tenantId]
  );
  return res.rows;
};

const balanceForTenant = async (tenantId) => {
  const res = await query(
    `SELECT COALESCE(SUM(amount), 0) AS balance FROM tenant_credits WHERE tenant_id = $1`,
    [tenantId]
  );
  return Number(res.rows[0].balance);
};

const addCredit = async (tenantId, amount, reason, actor) => {
  if (!Number.isFinite(amount) || amount === 0) { const e = new Error('amount must be a non-zero number.'); e.status = 400; throw e; }
  const res = await query(
    `INSERT INTO tenant_credits (tenant_id, amount, reason, created_by) VALUES ($1,$2,$3,$4) RETURNING *`,
    [tenantId, amount, reason || null, actor?.id || null]
  );
  await audit.log({ superAdminId: actor?.id, tenantId, action: 'credit.added', details: { amount, reason } });
  return res.rows[0];
};

// Consumes up to `subtotal` of this tenant's current credit balance,
// recording the debit against the invoice it was used on. Returns the
// amount actually applied (never more than the balance, never more than
// subtotal). Caller (invoices.service.js) runs this only after the
// invoice row already exists, so invoiceId is always real.
const consumeForInvoice = async (tenantId, invoiceId, subtotal) => {
  const balance = await balanceForTenant(tenantId);
  const applied = Math.min(balance, subtotal);
  if (applied <= 0) return 0;
  await query(
    `INSERT INTO tenant_credits (tenant_id, amount, reason, invoice_id) VALUES ($1,$2,$3,$4)`,
    [tenantId, -applied, 'Applied to invoice', invoiceId]
  );
  return applied;
};

module.exports = { listForTenant, balanceForTenant, addCredit, consumeForInvoice };
