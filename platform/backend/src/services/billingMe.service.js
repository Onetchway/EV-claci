'use strict';

const { query } = require('../config/database');
const tenantsService = require('./tenants.service');
const invoicesService = require('./invoices.service');
const paymentsService = require('./payments.service');
const credits = require('./credits.service');

// Everything a tenant's own CRM is allowed to know about its billing —
// authenticated by the tenant's own API key (see middleware/tenantAuth.js),
// so this must never leak another tenant's data or the tenant's own
// gateway/internal ids beyond what's useful to display.
const overview = async (tenantId) => {
  const tenant = await tenantsService.getOne(tenantId);
  const creditBalance = await credits.balanceForTenant(tenantId);
  return {
    name: tenant.name,
    status: tenant.status,
    billing_plan_name: tenant.billing_plan_name || null,
    billing_model: tenant.billing_model_override || tenant.plan_billing_model || null,
    mrr: tenant.mrr,
    currency: tenant.currency || 'INR',
    next_billing_at: tenant.status === 'active' ? tenant.next_billing_at : null,
    trial_ends_at: tenant.trial_ends_at,
    credit_balance: creditBalance,
  };
};

const listInvoices = async (tenantId) => {
  const res = await invoicesService.list({ tenant_id: tenantId, limit: 100 });
  return res.data.map((i) => ({
    id: i.id,
    invoice_number: i.invoice_number,
    period_start: i.period_start,
    period_end: i.period_end,
    total_amount: i.total_amount,
    currency: i.currency,
    status: i.status,
    due_at: i.due_at,
    paid_at: i.paid_at,
  }));
};

const getInvoiceReceipt = async (tenantId, invoiceId) => {
  const paymentRes = await query(
    `SELECT p.id FROM payments p
     JOIN invoices i ON i.id = p.invoice_id
     WHERE p.invoice_id = $1 AND i.tenant_id = $2 AND p.status = 'paid'
     ORDER BY p.updated_at DESC LIMIT 1`,
    [invoiceId, tenantId]
  );
  const payment = paymentRes.rows[0];
  if (!payment) { const e = new Error('No paid payment found for this invoice.'); e.status = 404; throw e; }
  return paymentsService.getReceipt(payment.id);
};

module.exports = { overview, listInvoices, getInvoiceReceipt };
