'use strict';

const { query } = require('../config/database');
const audit = require('./audit.service');

const listCatalog = async () => {
  const res = await query(`SELECT * FROM add_ons ORDER BY name`);
  return res.rows;
};

const createCatalog = async (data) => {
  if (!data.name) { const e = new Error('name is required.'); e.status = 400; throw e; }
  const res = await query(
    `INSERT INTO add_ons (name, description, amount, currency, is_active) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [data.name, data.description || null, data.amount || 0, data.currency || 'INR', data.is_active ?? true]
  );
  return res.rows[0];
};

const ALLOWED = ['name', 'description', 'amount', 'currency', 'is_active'];
const updateCatalog = async (id, data) => {
  const fields = []; const params = []; let idx = 1;
  for (const f of ALLOWED) {
    if (data[f] !== undefined) { fields.push(`${f} = $${idx++}`); params.push(data[f]); }
  }
  if (!fields.length) { const e = new Error('No valid fields to update.'); e.status = 400; throw e; }
  fields.push('updated_at = NOW()');
  params.push(id);
  const res = await query(`UPDATE add_ons SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, params);
  if (!res.rows[0]) { const e = new Error('Add-on not found'); e.status = 404; throw e; }
  return res.rows[0];
};

const removeCatalog = async (id) => {
  const res = await query(`DELETE FROM add_ons WHERE id = $1 RETURNING id`, [id]);
  if (!res.rows[0]) { const e = new Error('Add-on not found'); e.status = 404; throw e; }
};

// Every add-on attached to a tenant, with the effective amount (their own
// override, or the catalog price).
const listForTenant = async (tenantId) => {
  const res = await query(
    `SELECT tao.id, tao.add_on_id, tao.amount_override, tao.active, tao.created_at,
            ao.name, ao.description, ao.currency,
            COALESCE(tao.amount_override, ao.amount) AS effective_amount
     FROM tenant_add_ons tao
     JOIN add_ons ao ON ao.id = tao.add_on_id
     WHERE tao.tenant_id = $1
     ORDER BY tao.created_at DESC`,
    [tenantId]
  );
  return res.rows;
};

const attachToTenant = async (tenantId, addOnId, amountOverride, actor) => {
  const catalogRes = await query(`SELECT id FROM add_ons WHERE id = $1`, [addOnId]);
  if (!catalogRes.rows[0]) { const e = new Error('Unknown add-on.'); e.status = 400; throw e; }

  const res = await query(
    `INSERT INTO tenant_add_ons (tenant_id, add_on_id, amount_override, active)
     VALUES ($1, $2, $3, true)
     ON CONFLICT (tenant_id, add_on_id) DO UPDATE SET amount_override = $3, active = true
     RETURNING *`,
    [tenantId, addOnId, amountOverride ?? null]
  );
  await audit.log({ superAdminId: actor?.id, tenantId, action: 'addon.attached', details: { add_on_id: addOnId } });
  return res.rows[0];
};

const detachFromTenant = async (tenantId, addOnId, actor) => {
  const res = await query(
    `UPDATE tenant_add_ons SET active = false WHERE tenant_id = $1 AND add_on_id = $2 RETURNING id`,
    [tenantId, addOnId]
  );
  if (!res.rows[0]) { const e = new Error('Not attached to this tenant.'); e.status = 404; throw e; }
  await audit.log({ superAdminId: actor?.id, tenantId, action: 'addon.detached', details: { add_on_id: addOnId } });
};

// Active add-ons contributing to this tenant's next invoice -- used by
// invoices.service.js and the billing-preview endpoint. Plain amounts,
// no tax (tax is applied once at the invoice-subtotal level).
const activeChargesForTenant = async (tenantId) => {
  const res = await query(
    `SELECT ao.name, COALESCE(tao.amount_override, ao.amount) AS amount, ao.currency
     FROM tenant_add_ons tao JOIN add_ons ao ON ao.id = tao.add_on_id
     WHERE tao.tenant_id = $1 AND tao.active = true AND ao.is_active = true`,
    [tenantId]
  );
  return res.rows;
};

module.exports = {
  listCatalog, createCatalog, updateCatalog, removeCatalog,
  listForTenant, attachToTenant, detachFromTenant, activeChargesForTenant,
};
