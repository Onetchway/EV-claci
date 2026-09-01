'use strict';

const { query, getClient } = require('../config/database');
const { paginate, paginatedResponse } = require('../utils/pagination');
const { nextInvoiceNumber } = require('../utils/invoiceNumber');
const audit = require('./audit.service');

const list = async (filters) => {
  const { page, limit, skip } = paginate(filters);
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filters.tenant_id) { conditions.push(`i.tenant_id = $${idx++}`); params.push(filters.tenant_id); }
  if (filters.status) { conditions.push(`i.status = $${idx++}`); params.push(filters.status); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await query(`SELECT COUNT(*) FROM invoices i ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const dataRes = await query(
    `SELECT i.*, t.name AS tenant_name, t.slug AS tenant_slug
     FROM invoices i
     JOIN tenants t ON t.id = i.tenant_id
     ${where}
     ORDER BY i.issued_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, skip]
  );

  return paginatedResponse(dataRes.rows, total, page, limit);
};

const getOne = async (id) => {
  const invRes = await query(
    `SELECT i.*, t.name AS tenant_name, t.slug AS tenant_slug, t.contact_email
     FROM invoices i JOIN tenants t ON t.id = i.tenant_id WHERE i.id = $1`,
    [id]
  );
  const invoice = invRes.rows[0];
  if (!invoice) { const e = new Error('Invoice not found'); e.status = 404; throw e; }

  const lineItemsRes = await query(`SELECT * FROM invoice_line_items WHERE invoice_id = $1`, [id]);
  invoice.line_items = lineItemsRes.rows;
  return invoice;
};

// Resolve the effective billing terms for a tenant: per-tenant override
// wins, otherwise fall back to its assigned plan.
const resolveBillingTerms = (tenant, plan) => ({
  billing_model: tenant.billing_model_override || plan?.billing_model,
  fixed_monthly_amount: tenant.fixed_monthly_amount_override ?? plan?.fixed_monthly_amount ?? 0,
  per_employee_amount: tenant.per_employee_amount_override ?? plan?.per_employee_amount ?? 0,
  currency: plan?.currency || 'INR',
  tax_percent: plan?.tax_percent ?? 18,
});

// Generates one invoice for a tenant covering [periodStart, periodEnd).
// Idempotent per (tenant, period) — re-running for a period that already
// has an invoice is a no-op and returns the existing one.
const generateForTenant = async (tenantId, periodStart, periodEnd, actor) => {
  const tenantRes = await query(`SELECT * FROM tenants WHERE id = $1`, [tenantId]);
  const tenant = tenantRes.rows[0];
  if (!tenant) { const e = new Error('Tenant not found'); e.status = 404; throw e; }
  if (tenant.status !== 'active') { const e = new Error('Only active tenants can be invoiced.'); e.status = 400; throw e; }

  const existing = await query(
    `SELECT * FROM invoices WHERE tenant_id = $1 AND period_start = $2 AND period_end = $3`,
    [tenantId, periodStart.toISOString().slice(0, 10), periodEnd.toISOString().slice(0, 10)]
  );
  if (existing.rows[0]) return existing.rows[0];

  const planRes = tenant.billing_plan_id
    ? await query(`SELECT * FROM billing_plans WHERE id = $1`, [tenant.billing_plan_id])
    : { rows: [] };
  const terms = resolveBillingTerms(tenant, planRes.rows[0]);
  if (!terms.billing_model) { const e = new Error('Tenant has no billing plan or override configured.'); e.status = 400; throw e; }

  let employeeCount = null;
  let unitAmount = 0;
  let subtotal = 0;
  let description;

  if (terms.billing_model === 'per_employee') {
    const usageRes = await query(
      `SELECT employee_count FROM tenant_usage_snapshots
       WHERE tenant_id = $1 AND period_month = $2`,
      [tenantId, periodStart.toISOString().slice(0, 10)]
    );
    employeeCount = usageRes.rows[0]?.employee_count ?? 0;
    unitAmount = Number(terms.per_employee_amount);
    subtotal = employeeCount * unitAmount;
    description = `Per-employee billing — ${employeeCount} employee(s) × ${terms.currency} ${unitAmount}`;
  } else {
    unitAmount = Number(terms.fixed_monthly_amount);
    subtotal = unitAmount;
    description = `Fixed monthly subscription — ${terms.currency} ${unitAmount}`;
  }

  const taxAmount = +(subtotal * (Number(terms.tax_percent) / 100)).toFixed(2);
  const totalAmount = +(subtotal + taxAmount).toFixed(2);
  const invoiceNumber = await nextInvoiceNumber(periodStart);
  const dueAt = new Date(periodEnd);
  dueAt.setDate(dueAt.getDate() + 15);

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const invRes = await client.query(
      `INSERT INTO invoices
         (tenant_id, invoice_number, period_start, period_end, billing_model, employee_count,
          unit_amount, subtotal, tax_percent, tax_amount, total_amount, currency, status, due_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'issued',$13)
       RETURNING *`,
      [
        tenantId, invoiceNumber, periodStart.toISOString().slice(0, 10), periodEnd.toISOString().slice(0, 10),
        terms.billing_model, employeeCount, unitAmount, subtotal, terms.tax_percent, taxAmount, totalAmount,
        terms.currency, dueAt.toISOString(),
      ]
    );
    const invoice = invRes.rows[0];

    await client.query(
      `INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_amount, amount)
       VALUES ($1,$2,$3,$4,$5)`,
      [invoice.id, description, employeeCount ?? 1, unitAmount, subtotal]
    );

    await client.query('COMMIT');

    await audit.log({
      superAdminId: actor?.id,
      tenantId,
      action: 'invoice.generated',
      details: { invoice_number: invoiceNumber, total_amount: totalAmount },
    });

    return invoice;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const setStatus = async (id, status, actor) => {
  const extraSet = status === 'paid' ? ', paid_at = NOW()' : '';
  const res = await query(
    `UPDATE invoices SET status = $1${extraSet} WHERE id = $2 RETURNING *`,
    [status, id]
  );
  if (!res.rows[0]) { const e = new Error('Invoice not found'); e.status = 404; throw e; }
  await audit.log({ superAdminId: actor?.id, tenantId: res.rows[0].tenant_id, action: `invoice.${status}`, details: { invoice_id: id } });
  return res.rows[0];
};

module.exports = { list, getOne, generateForTenant, setStatus, resolveBillingTerms };
