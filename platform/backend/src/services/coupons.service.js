'use strict';

const { query } = require('../config/database');
const audit = require('./audit.service');

const list = async () => {
  const res = await query(`SELECT * FROM coupons ORDER BY created_at DESC`);
  return res.rows;
};

const create = async (data) => {
  if (!data.code) { const e = new Error('code is required.'); e.status = 400; throw e; }
  if (!['percent', 'fixed'].includes(data.discount_type)) {
    const e = new Error("discount_type must be 'percent' or 'fixed'."); e.status = 400; throw e;
  }
  const res = await query(
    `INSERT INTO coupons (code, discount_type, amount, duration_invoices, is_active)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [data.code.toUpperCase(), data.discount_type, data.amount, data.duration_invoices || null, data.is_active ?? true]
  );
  return res.rows[0];
};

const update = async (id, data) => {
  const fields = []; const params = []; let idx = 1;
  for (const f of ['is_active']) {
    if (data[f] !== undefined) { fields.push(`${f} = $${idx++}`); params.push(data[f]); }
  }
  if (!fields.length) { const e = new Error('No valid fields to update.'); e.status = 400; throw e; }
  params.push(id);
  const res = await query(`UPDATE coupons SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, params);
  if (!res.rows[0]) { const e = new Error('Coupon not found'); e.status = 404; throw e; }
  return res.rows[0];
};

// Every coupon currently assigned to a tenant.
const listForTenant = async (tenantId) => {
  const res = await query(
    `SELECT tc.id, tc.invoices_applied, tc.active, tc.assigned_at,
            c.id AS coupon_id, c.code, c.discount_type, c.amount, c.duration_invoices
     FROM tenant_coupons tc JOIN coupons c ON c.id = tc.coupon_id
     WHERE tc.tenant_id = $1 ORDER BY tc.assigned_at DESC`,
    [tenantId]
  );
  return res.rows;
};

const assignToTenant = async (tenantId, couponId, actor) => {
  const couponRes = await query(`SELECT id FROM coupons WHERE id = $1 AND is_active = true`, [couponId]);
  if (!couponRes.rows[0]) { const e = new Error('Unknown or inactive coupon.'); e.status = 400; throw e; }
  const res = await query(
    `INSERT INTO tenant_coupons (tenant_id, coupon_id, active) VALUES ($1,$2,true) RETURNING *`,
    [tenantId, couponId]
  );
  await audit.log({ superAdminId: actor?.id, tenantId, action: 'coupon.assigned', details: { coupon_id: couponId } });
  return res.rows[0];
};

const unassignFromTenant = async (tenantId, tenantCouponId, actor) => {
  const res = await query(
    `UPDATE tenant_coupons SET active = false WHERE id = $1 AND tenant_id = $2 RETURNING id`,
    [tenantCouponId, tenantId]
  );
  if (!res.rows[0]) { const e = new Error('Not assigned to this tenant.'); e.status = 404; throw e; }
  await audit.log({ superAdminId: actor?.id, tenantId, action: 'coupon.unassigned', details: { tenant_coupon_id: tenantCouponId } });
};

// The single active, not-yet-exhausted coupon to apply to this tenant's
// next invoice (a tenant is assumed to have at most one active coupon at
// a time -- simplest model that still covers "first month free" /
// "10% off" style promos). Computes the discount amount against
// `subtotal` but does not mutate anything -- the caller (invoices.service.js
// or the preview endpoint) applies it and, on actual invoice generation,
// increments invoices_applied itself.
const activeCouponForTenant = async (tenantId, subtotal) => {
  const res = await query(
    `SELECT tc.id AS tenant_coupon_id, c.id AS coupon_id, c.code, c.discount_type, c.amount, c.duration_invoices, tc.invoices_applied
     FROM tenant_coupons tc JOIN coupons c ON c.id = tc.coupon_id
     WHERE tc.tenant_id = $1 AND tc.active = true AND c.is_active = true
       AND (c.duration_invoices IS NULL OR tc.invoices_applied < c.duration_invoices)
     ORDER BY tc.assigned_at DESC LIMIT 1`,
    [tenantId]
  );
  const row = res.rows[0];
  if (!row) return null;
  const discount = row.discount_type === 'percent'
    ? +(subtotal * (Number(row.amount) / 100)).toFixed(2)
    : Math.min(Number(row.amount), subtotal);
  return { ...row, discount };
};

const recordCouponApplied = async (tenantCouponId) => {
  await query(`UPDATE tenant_coupons SET invoices_applied = invoices_applied + 1 WHERE id = $1`, [tenantCouponId]);
};

module.exports = {
  list, create, update, listForTenant, assignToTenant, unassignFromTenant,
  activeCouponForTenant, recordCouponApplied,
};
