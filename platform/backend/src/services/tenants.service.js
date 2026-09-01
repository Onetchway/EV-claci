'use strict';

const crypto = require('crypto');
const { query } = require('../config/database');
const { paginate, paginatedResponse } = require('../utils/pagination');
const audit = require('./audit.service');

const slugify = (name) =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const generateApiKey = () => `tk_${crypto.randomBytes(24).toString('hex')}`;

const list = async (filters) => {
  const { page, limit, skip } = paginate(filters);
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filters.status) { conditions.push(`status = $${idx++}`); params.push(filters.status); }
  if (filters.deployment_mode) { conditions.push(`deployment_mode = $${idx++}`); params.push(filters.deployment_mode); }
  if (filters.search) {
    conditions.push(`(name ILIKE $${idx} OR contact_email ILIKE $${idx} OR slug ILIKE $${idx})`);
    params.push(`%${filters.search}%`);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await query(`SELECT COUNT(*) FROM tenants ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const dataRes = await query(
    `SELECT t.id, t.name, t.slug, t.contact_name, t.contact_email, t.contact_phone,
            t.deployment_mode, t.custom_domain, t.status, t.billing_plan_id, t.billing_day,
            t.billing_model_override, t.fixed_monthly_amount_override, t.per_employee_amount_override,
            t.trial_ends_at, t.created_at, t.updated_at,
            bp.name AS billing_plan_name
     FROM tenants t
     LEFT JOIN billing_plans bp ON bp.id = t.billing_plan_id
     ${where}
     ORDER BY t.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, skip]
  );

  return paginatedResponse(dataRes.rows, total, page, limit);
};

const getOne = async (id) => {
  const res = await query(
    `SELECT t.*, bp.name AS billing_plan_name
     FROM tenants t
     LEFT JOIN billing_plans bp ON bp.id = t.billing_plan_id
     WHERE t.id = $1`,
    [id]
  );
  const tenant = res.rows[0];
  if (!tenant) { const e = new Error('Tenant not found'); e.status = 404; throw e; }
  delete tenant.api_key; // never echo the live key back on reads
  return tenant;
};

const create = async (data, actor) => {
  const required = ['name', 'contact_name', 'contact_email'];
  for (const f of required) {
    if (!data[f]) { const e = new Error(`${f} is required.`); e.status = 400; throw e; }
  }

  const slug = data.slug ? slugify(data.slug) : slugify(data.name);
  const apiKey = generateApiKey();

  const res = await query(
    `INSERT INTO tenants
       (name, slug, contact_name, contact_email, contact_phone, deployment_mode,
        custom_domain, status, billing_plan_id, billing_day, api_key, trial_ends_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      data.name,
      slug,
      data.contact_name,
      data.contact_email,
      data.contact_phone || null,
      data.deployment_mode || 'shared',
      data.custom_domain || null,
      data.status || 'trial',
      data.billing_plan_id || null,
      data.billing_day || 1,
      apiKey,
      data.trial_ends_at || null,
    ]
  );

  const tenant = res.rows[0];

  await audit.log({ superAdminId: actor?.id, tenantId: tenant.id, action: 'tenant.created', details: { name: tenant.name } });

  // Return the API key exactly once, at creation — the tenant's own
  // backend needs it to authenticate self-reported usage. It is never
  // exposed again after this response.
  return tenant;
};

const ALLOWED_UPDATE_FIELDS = [
  'name', 'contact_name', 'contact_email', 'contact_phone', 'deployment_mode',
  'custom_domain', 'status', 'billing_plan_id', 'billing_model_override',
  'fixed_monthly_amount_override', 'per_employee_amount_override', 'billing_day',
  'trial_ends_at',
];

const update = async (id, data, actor) => {
  const fields = []; const params = []; let idx = 1;
  for (const f of ALLOWED_UPDATE_FIELDS) {
    if (data[f] !== undefined) { fields.push(`${f} = $${idx++}`); params.push(data[f]); }
  }
  if (!fields.length) { const e = new Error('No valid fields to update.'); e.status = 400; throw e; }
  fields.push('updated_at = NOW()');
  params.push(id);

  const res = await query(`UPDATE tenants SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, params);
  if (!res.rows[0]) { const e = new Error('Tenant not found'); e.status = 404; throw e; }

  await audit.log({ superAdminId: actor?.id, tenantId: id, action: 'tenant.updated', details: data });

  const tenant = res.rows[0];
  delete tenant.api_key;
  return tenant;
};

const setStatus = async (id, status, actor) => update(id, { status }, actor);

const rotateApiKey = async (id, actor) => {
  const apiKey = generateApiKey();
  const res = await query(
    `UPDATE tenants SET api_key = $1, updated_at = NOW() WHERE id = $2 RETURNING id, api_key`,
    [apiKey, id]
  );
  if (!res.rows[0]) { const e = new Error('Tenant not found'); e.status = 404; throw e; }
  await audit.log({ superAdminId: actor?.id, tenantId: id, action: 'tenant.api_key_rotated' });
  return res.rows[0];
};

const remove = async (id, actor) => {
  const res = await query(`DELETE FROM tenants WHERE id = $1 RETURNING id`, [id]);
  if (!res.rows[0]) { const e = new Error('Tenant not found'); e.status = 404; throw e; }
  await audit.log({ superAdminId: actor?.id, tenantId: id, action: 'tenant.deleted' });
};

module.exports = { list, getOne, create, update, setStatus, rotateApiKey, remove };
