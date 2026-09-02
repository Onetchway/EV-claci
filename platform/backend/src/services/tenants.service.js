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
      data.custom_domain ? data.custom_domain.trim().toLowerCase() : null,
      data.status || 'trial',
      data.billing_plan_id || null,
      data.billing_day || 1,
      apiKey,
      data.trial_ends_at || null,
    ]
  );

  const tenant = res.rows[0];

  await audit.log({ superAdminId: actor?.id, tenantId: tenant.id, action: 'tenant.created', details: { name: tenant.name } });

  // Provisions this tenant's actual CRM login — see crm/src/app/api/
  // platform/provision-tenant/route.ts. Best-effort: a provisioning
  // failure (CRM_PROVISION_URL unset, that CRM instance unreachable, etc.)
  // never fails tenant creation itself — the super admin can retry
  // provisioning separately, the tenant row already exists either way.
  // Only meaningful for a tenant onboarded onto the shared crm/ CRM (see
  // README's deployment_mode table); a dedicated/isolated tenant running
  // its own separate instance provisions itself some other way.
  let crmProvisioning = { configured: Boolean(process.env.CRM_PROVISION_URL && process.env.CRM_PROVISION_SECRET) };
  if (crmProvisioning.configured) {
    try {
      const response = await fetch(`${process.env.CRM_PROVISION_URL}/api/platform/provision-tenant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Provision-Secret': process.env.CRM_PROVISION_SECRET },
        body: JSON.stringify({
          slug: tenant.slug,
          name: tenant.name,
          adminEmail: tenant.contact_email,
          adminName: tenant.contact_name,
          // Lets the CRM immediately look up this tenant's own enabled
          // features (GET /api/features/me, authenticated by this same
          // key) instead of failing open to "everything enabled" until
          // someone manually pastes it in later.
          tenantApiKey: tenant.api_key,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        crmProvisioning = {
          configured: true, ok: true,
          orgId: data.orgId, loginEmail: tenant.contact_email, temporaryPassword: data.temporaryPassword,
        };
        await audit.log({ superAdminId: actor?.id, tenantId: tenant.id, action: 'tenant.crm_provisioned', details: { orgId: data.orgId } });
      } else {
        console.error('[tenants] CRM provisioning failed:', response.status, await response.text().catch(() => ''));
        crmProvisioning = { configured: true, ok: false };
      }
    } catch (err) {
      console.error('[tenants] CRM provisioning request failed:', err.message);
      crmProvisioning = { configured: true, ok: false };
    }
  }

  // Return the API key exactly once, at creation — the tenant's own
  // backend needs it to authenticate self-reported usage. It is never
  // exposed again after this response. crmProvisioning.temporaryPassword
  // is the same one-time deal, for the CRM login this just created.
  return { ...tenant, crmProvisioning };
};

const ALLOWED_UPDATE_FIELDS = [
  'name', 'slug', 'contact_name', 'contact_email', 'contact_phone', 'deployment_mode',
  'custom_domain', 'status', 'billing_plan_id', 'billing_model_override',
  'fixed_monthly_amount_override', 'per_employee_amount_override', 'billing_day',
  'trial_ends_at',
];

const update = async (id, data, actor) => {
  const fields = []; const params = []; let idx = 1;
  if (data.slug !== undefined) data.slug = slugify(data.slug);
  if (data.custom_domain !== undefined) data.custom_domain = data.custom_domain ? data.custom_domain.trim().toLowerCase() : null;
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

// Domain-based tenant resolution, called by a tenant CRM instance running
// in "shared" mode (one instance, many tenants) to figure out which
// tenant a given inbound Host header belongs to — before that request has
// any authenticated user to read tenant_id off of. Public by design: it
// only returns non-sensitive routing info, never tenant data.
const resolveByHost = async (host) => {
  if (!host) { const e = new Error('host is required.'); e.status = 400; throw e; }
  const bareHost = host.split(':')[0].toLowerCase();

  const byCustomDomain = await query(
    `SELECT id, name, slug, status, deployment_mode FROM tenants WHERE custom_domain = $1`,
    [bareHost]
  );
  if (byCustomDomain.rows[0]) return byCustomDomain.rows[0];

  const baseDomain = process.env.PLATFORM_BASE_DOMAIN;
  if (baseDomain && bareHost.endsWith(`.${baseDomain}`)) {
    const slug = bareHost.slice(0, -(baseDomain.length + 1));
    const bySlug = await query(
      `SELECT id, name, slug, status, deployment_mode FROM tenants WHERE slug = $1`,
      [slug]
    );
    if (bySlug.rows[0]) return bySlug.rows[0];
  }

  const e = new Error('No tenant matches this host.'); e.status = 404; throw e;
};

// Path-based tenant resolution, called by a tenant CRM instance running in
// "shared" mode when deployed under a single domain that routes tenants by
// URL path instead of subdomain (e.g. app.alpha.com/xpulse rather than
// xpulse.alpha.com) — see frontend/middleware.js. Same public, non-sensitive
// contract as resolveByHost above; slug is just matched directly since it's
// already the unambiguous tenant identifier (no domain-stripping needed).
const resolveBySlug = async (slug) => {
  if (!slug) { const e = new Error('slug is required.'); e.status = 400; throw e; }
  const res = await query(
    `SELECT id, name, slug, status, deployment_mode FROM tenants WHERE slug = $1`,
    [slug.toLowerCase()]
  );
  if (!res.rows[0]) { const e = new Error('No tenant matches this slug.'); e.status = 404; throw e; }
  return res.rows[0];
};

const remove = async (id, actor) => {
  const res = await query(`DELETE FROM tenants WHERE id = $1 RETURNING id`, [id]);
  if (!res.rows[0]) { const e = new Error('Tenant not found'); e.status = 404; throw e; }
  await audit.log({ superAdminId: actor?.id, tenantId: id, action: 'tenant.deleted' });
};

module.exports = { list, getOne, create, update, setStatus, rotateApiKey, remove, resolveByHost, resolveBySlug };
