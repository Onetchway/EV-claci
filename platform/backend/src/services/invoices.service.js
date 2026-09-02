'use strict';

const { query, getClient } = require('../config/database');
const { paginate, paginatedResponse } = require('../utils/pagination');
const { nextInvoiceNumber } = require('../utils/invoiceNumber');
const audit = require('./audit.service');
const { sendInvoiceEmail, emailConfigured } = require('./email.service');
const { proratedEmployeeCharge } = require('./usage.service');
const addOns = require('./addOns.service');
const coupons = require('./coupons.service');
const credits = require('./credits.service');

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

// Computes the base plan/employee charge for a tenant's period, shared by
// generateForTenant and previewForTenant so the two never diverge.
const computeBaseCharge = async (tenantId, tenant, terms, periodStart, periodEnd) => {
  let employeeCount = null;
  let unitAmount = 0;
  let subtotal = 0;
  let description;

  if (terms.billing_model === 'per_employee') {
    unitAmount = Number(terms.per_employee_amount);

    // Prorated by join/leave date when the tenant's CRM has reported that
    // detail (see usage.service.js's reportEmployees/proratedEmployeeCharge
    // -- Google Workspace style: a seat added mid-period is only charged
    // for the days it existed). Falls back to a flat headcount * rate from
    // tenant_usage_snapshots for a tenant that only ever called the
    // simpler POST /usage/report (or hasn't reported at all this period).
    const prorated = await proratedEmployeeCharge(tenantId, periodStart, periodEnd, unitAmount);
    if (prorated.employeeCount > 0) {
      employeeCount = prorated.employeeCount;
      subtotal = prorated.subtotal;
      description = `Per-employee billing (prorated by join/leave date) — ${employeeCount} employee(s) touched this period × ${terms.currency} ${unitAmount}`;
    } else {
      const usageRes = await query(
        `SELECT employee_count FROM tenant_usage_snapshots
         WHERE tenant_id = $1 AND period_month = $2`,
        [tenantId, periodStart.toISOString().slice(0, 10)]
      );
      employeeCount = usageRes.rows[0]?.employee_count ?? 0;
      subtotal = employeeCount * unitAmount;
      description = `Per-employee billing — ${employeeCount} employee(s) × ${terms.currency} ${unitAmount}`;
    }
  } else {
    unitAmount = Number(terms.fixed_monthly_amount);
    subtotal = unitAmount;
    description = `Fixed monthly subscription — ${terms.currency} ${unitAmount}`;
  }

  return { employeeCount, unitAmount, subtotal, description };
};

// Computes the full breakdown for a tenant's period — base charge, add-ons,
// coupon discount, tax, and available credit — without persisting anything.
// Shared by generateForTenant (which then writes it) and previewForTenant
// (which just returns it).
const computeInvoiceBreakdown = async (tenantId, periodStart, periodEnd) => {
  const tenantRes = await query(`SELECT * FROM tenants WHERE id = $1`, [tenantId]);
  const tenant = tenantRes.rows[0];
  if (!tenant) { const e = new Error('Tenant not found'); e.status = 404; throw e; }

  const planRes = tenant.billing_plan_id
    ? await query(`SELECT * FROM billing_plans WHERE id = $1`, [tenant.billing_plan_id])
    : { rows: [] };
  const terms = resolveBillingTerms(tenant, planRes.rows[0]);
  if (!terms.billing_model) { const e = new Error('Tenant has no billing plan or override configured.'); e.status = 400; throw e; }

  const base = await computeBaseCharge(tenantId, tenant, terms, periodStart, periodEnd);

  const addOnCharges = await addOns.activeChargesForTenant(tenantId);
  const addOnAmount = +addOnCharges.reduce((sum, a) => sum + Number(a.amount), 0).toFixed(2);
  const preDiscountSubtotal = +(base.subtotal + addOnAmount).toFixed(2);

  const coupon = await coupons.activeCouponForTenant(tenantId, preDiscountSubtotal);
  const discountAmount = coupon ? coupon.discount : 0;
  const discountedSubtotal = +(preDiscountSubtotal - discountAmount).toFixed(2);

  const taxAmount = +(discountedSubtotal * (Number(terms.tax_percent) / 100)).toFixed(2);
  const totalBeforeCredit = +(discountedSubtotal + taxAmount).toFixed(2);

  const creditBalance = await credits.balanceForTenant(tenantId);
  const creditApplicable = Math.max(0, Math.min(creditBalance, totalBeforeCredit));
  const totalAmount = +(totalBeforeCredit - creditApplicable).toFixed(2);

  return {
    tenant, terms, base, addOnCharges, addOnAmount, preDiscountSubtotal,
    coupon, discountAmount, discountedSubtotal, taxAmount, totalBeforeCredit,
    creditBalance, creditApplicable, totalAmount,
  };
};

// Computes the same breakdown as generateForTenant would produce, but
// persists nothing — for the "preview next invoice" UI (spec section 31).
const previewForTenant = async (tenantId, periodStart, periodEnd) => {
  const b = await computeInvoiceBreakdown(tenantId, periodStart, periodEnd);
  return {
    period_start: periodStart.toISOString().slice(0, 10),
    period_end: periodEnd.toISOString().slice(0, 10),
    billing_model: b.terms.billing_model,
    employee_count: b.base.employeeCount,
    unit_amount: b.base.unitAmount,
    base_subtotal: b.base.subtotal,
    add_ons: b.addOnCharges,
    add_on_amount: b.addOnAmount,
    subtotal: b.preDiscountSubtotal,
    coupon_code: b.coupon?.code || null,
    discount_amount: b.discountAmount,
    tax_percent: b.terms.tax_percent,
    tax_amount: b.taxAmount,
    total_before_credit: b.totalBeforeCredit,
    credit_balance: b.creditBalance,
    credit_applied: b.creditApplicable,
    total_amount: b.totalAmount,
    currency: b.terms.currency,
  };
};

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

  const b = await computeInvoiceBreakdown(tenantId, periodStart, periodEnd);
  const { terms, base } = b;

  const invoiceNumber = await nextInvoiceNumber(periodStart);
  const dueAt = new Date(periodEnd);
  dueAt.setDate(dueAt.getDate() + 15);

  const client = await getClient();
  let invoice;
  try {
    await client.query('BEGIN');
    const invRes = await client.query(
      `INSERT INTO invoices
         (tenant_id, invoice_number, period_start, period_end, billing_model, employee_count,
          unit_amount, subtotal, add_on_amount, discount_amount, coupon_code,
          tax_percent, tax_amount, total_amount, currency, status, due_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'issued',$16)
       RETURNING *`,
      [
        tenantId, invoiceNumber, periodStart.toISOString().slice(0, 10), periodEnd.toISOString().slice(0, 10),
        terms.billing_model, base.employeeCount, base.unitAmount, base.subtotal, b.addOnAmount, b.discountAmount,
        b.coupon?.code || null, terms.tax_percent, b.taxAmount, b.totalBeforeCredit, terms.currency, dueAt.toISOString(),
      ]
    );
    invoice = invRes.rows[0];

    await client.query(
      `INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_amount, amount)
       VALUES ($1,$2,$3,$4,$5)`,
      [invoice.id, base.description, base.employeeCount ?? 1, base.unitAmount, base.subtotal]
    );
    for (const addOn of b.addOnCharges) {
      await client.query(
        `INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_amount, amount)
         VALUES ($1,$2,1,$3,$3)`,
        [invoice.id, `Add-on — ${addOn.name}`, Number(addOn.amount)]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Credit consumption needs the invoice's real id, so it runs after the
  // invoice row is committed; coupon usage is recorded here too since both
  // are best-effort bookkeeping, not part of the invoice's own atomicity.
  if (b.coupon) {
    await coupons.recordCouponApplied(b.coupon.tenant_coupon_id);
  }
  const creditApplied = await credits.consumeForInvoice(tenantId, invoice.id, invoice.total_amount);
  if (creditApplied > 0) {
    const updated = await query(
      `UPDATE invoices SET credit_applied = $1, total_amount = total_amount - $1 WHERE id = $2 RETURNING *`,
      [creditApplied, invoice.id]
    );
    invoice = updated.rows[0];
  }

  await audit.log({
    superAdminId: actor?.id,
    tenantId,
    action: 'invoice.generated',
    details: { invoice_number: invoiceNumber, total_amount: invoice.total_amount },
  });

  sendInvoiceEmail(invoice, tenant).catch((err) => console.error(`[invoices] Failed to email ${invoiceNumber}:`, err.message));

  return invoice;
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

// Error-recovery action (spec section 51): re-send an invoice email
// on demand, for a tenant whose original delivery bounced or never sent
// (e.g. SMTP wasn't configured yet at generation time).
const resendEmail = async (id, actor) => {
  if (!emailConfigured()) {
    const e = new Error('Email delivery is not configured on this platform backend (SMTP_HOST/SMTP_USER/SMTP_PASS).');
    e.status = 503;
    throw e;
  }
  const invoice = await getOne(id);
  const tenantRes = await query(`SELECT * FROM tenants WHERE id = $1`, [invoice.tenant_id]);
  const tenant = tenantRes.rows[0];
  if (!tenant) { const e = new Error('Tenant not found'); e.status = 404; throw e; }

  await sendInvoiceEmail(invoice, tenant);
  await audit.log({ superAdminId: actor?.id, tenantId: invoice.tenant_id, action: 'invoice.email_resent', details: { invoice_id: id } });
  return { ok: true };
};

module.exports = { list, getOne, generateForTenant, previewForTenant, setStatus, resendEmail, resolveBillingTerms };
