'use strict';

const { query } = require('../config/database');
const audit = require('./audit.service');

const listCatalog = async () => {
  const res = await query(`SELECT * FROM modules ORDER BY name`);
  return res.rows;
};

const updateCatalog = async (key, data) => {
  const fields = []; const params = []; let idx = 1;
  for (const f of ['name', 'description', 'is_default_enabled']) {
    if (data[f] !== undefined) { fields.push(`${f} = $${idx++}`); params.push(data[f]); }
  }
  if (!fields.length) { const e = new Error('No valid fields to update.'); e.status = 400; throw e; }
  params.push(key);
  const res = await query(`UPDATE modules SET ${fields.join(', ')} WHERE key = $${idx} RETURNING *`, params);
  if (!res.rows[0]) { const e = new Error('Module not found'); e.status = 404; throw e; }
  return res.rows[0];
};

// Full effective module set for a tenant: catalog defaults overridden by
// whatever this tenant has explicitly been toggled to. Same shape as
// features.service.js's listForTenant.
const listForTenant = async (tenantId) => {
  const res = await query(
    `SELECT m.key, m.name, m.description,
            COALESCE(tm.enabled, m.is_default_enabled) AS enabled
     FROM modules m
     LEFT JOIN tenant_modules tm ON tm.tenant_id = $1 AND tm.module_key = m.key
     ORDER BY m.name`,
    [tenantId]
  );
  return res.rows;
};

const setForTenant = async (tenantId, moduleKey, enabled, actor) => {
  const catalogRes = await query(`SELECT key FROM modules WHERE key = $1`, [moduleKey]);
  if (!catalogRes.rows[0]) { const e = new Error('Unknown module key.'); e.status = 400; throw e; }

  await query(
    `INSERT INTO tenant_modules (tenant_id, module_key, enabled, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (tenant_id, module_key)
     DO UPDATE SET enabled = $3, updated_by = $4, updated_at = NOW()`,
    [tenantId, moduleKey, enabled, actor?.id || null]
  );

  await audit.log({
    superAdminId: actor?.id,
    tenantId,
    action: enabled ? 'module.enabled' : 'module.disabled',
    details: { module_key: moduleKey },
  });

  return { tenant_id: tenantId, module_key: moduleKey, enabled };
};

const bulkSetForTenant = async (tenantId, modules, actor) => {
  const results = [];
  for (const { module_key, enabled } of modules) {
    results.push(await setForTenant(tenantId, module_key, enabled, actor));
  }
  return results;
};

module.exports = { listCatalog, updateCatalog, listForTenant, setForTenant, bulkSetForTenant };
