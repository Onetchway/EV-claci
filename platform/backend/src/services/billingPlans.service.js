'use strict';

const { query } = require('../config/database');

const list = async () => {
  const res = await query(`SELECT * FROM billing_plans ORDER BY created_at DESC`);
  return res.rows;
};

const getOne = async (id) => {
  const res = await query(`SELECT * FROM billing_plans WHERE id = $1`, [id]);
  if (!res.rows[0]) { const e = new Error('Billing plan not found'); e.status = 404; throw e; }
  return res.rows[0];
};

const create = async (data) => {
  if (!data.name) { const e = new Error('name is required.'); e.status = 400; throw e; }
  if (!['per_employee', 'fixed_monthly'].includes(data.billing_model)) {
    const e = new Error("billing_model must be 'per_employee' or 'fixed_monthly'."); e.status = 400; throw e;
  }

  const res = await query(
    `INSERT INTO billing_plans (name, billing_model, fixed_monthly_amount, per_employee_amount, currency, tax_percent, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [
      data.name,
      data.billing_model,
      data.fixed_monthly_amount || 0,
      data.per_employee_amount || 0,
      data.currency || 'INR',
      data.tax_percent ?? 18,
      data.is_active ?? true,
    ]
  );
  return res.rows[0];
};

const ALLOWED = ['name', 'billing_model', 'fixed_monthly_amount', 'per_employee_amount', 'currency', 'tax_percent', 'is_active'];

const update = async (id, data) => {
  const fields = []; const params = []; let idx = 1;
  for (const f of ALLOWED) {
    if (data[f] !== undefined) { fields.push(`${f} = $${idx++}`); params.push(data[f]); }
  }
  if (!fields.length) { const e = new Error('No valid fields to update.'); e.status = 400; throw e; }
  fields.push('updated_at = NOW()');
  params.push(id);
  const res = await query(`UPDATE billing_plans SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, params);
  if (!res.rows[0]) { const e = new Error('Billing plan not found'); e.status = 404; throw e; }
  return res.rows[0];
};

const remove = async (id) => {
  const res = await query(`DELETE FROM billing_plans WHERE id = $1 RETURNING id`, [id]);
  if (!res.rows[0]) { const e = new Error('Billing plan not found'); e.status = 404; throw e; }
};

module.exports = { list, getOne, create, update, remove };
