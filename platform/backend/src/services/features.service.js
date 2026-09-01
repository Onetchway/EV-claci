'use strict';

const { query } = require('../config/database');
const audit = require('./audit.service');

const listCatalog = async () => {
  const res = await query(`SELECT * FROM feature_catalog ORDER BY category, name`);
  return res.rows;
};

// Full effective feature set for a tenant: catalog defaults overridden by
// whatever this tenant has explicitly been toggled to.
const listForTenant = async (tenantId) => {
  const res = await query(
    `SELECT fc.key, fc.name, fc.description, fc.category,
            COALESCE(tf.enabled, fc.is_default_enabled) AS enabled
     FROM feature_catalog fc
     LEFT JOIN tenant_features tf ON tf.tenant_id = $1 AND tf.feature_key = fc.key
     ORDER BY fc.category, fc.name`,
    [tenantId]
  );
  return res.rows;
};

const setForTenant = async (tenantId, featureKey, enabled, actor) => {
  const catalogRes = await query(`SELECT key FROM feature_catalog WHERE key = $1`, [featureKey]);
  if (!catalogRes.rows[0]) { const e = new Error('Unknown feature key.'); e.status = 400; throw e; }

  await query(
    `INSERT INTO tenant_features (tenant_id, feature_key, enabled, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (tenant_id, feature_key)
     DO UPDATE SET enabled = $3, updated_by = $4, updated_at = NOW()`,
    [tenantId, featureKey, enabled, actor?.id || null]
  );

  await audit.log({
    superAdminId: actor?.id,
    tenantId,
    action: enabled ? 'feature.enabled' : 'feature.disabled',
    details: { feature_key: featureKey },
  });

  return { tenant_id: tenantId, feature_key: featureKey, enabled };
};

const bulkSetForTenant = async (tenantId, features, actor) => {
  const results = [];
  for (const { feature_key, enabled } of features) {
    results.push(await setForTenant(tenantId, feature_key, enabled, actor));
  }
  return results;
};

module.exports = { listCatalog, listForTenant, setForTenant, bulkSetForTenant };
