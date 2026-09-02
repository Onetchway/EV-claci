'use strict';

const { query } = require('../config/database');

const log = async ({ superAdminId, tenantId, action, details }) => {
  await query(
    `INSERT INTO audit_log (super_admin_id, tenant_id, action, details) VALUES ($1, $2, $3, $4)`,
    [superAdminId || null, tenantId || null, action, details ? JSON.stringify(details) : null]
  );
};

const list = async (filters = {}) => {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filters.tenant_id) { conditions.push(`a.tenant_id = $${idx++}`); params.push(filters.tenant_id); }
  if (filters.action) { conditions.push(`a.action ILIKE $${idx++}`); params.push(`%${filters.action}%`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.min(Number(filters.limit) || 100, 500);

  const res = await query(
    `SELECT a.id, a.action, a.details, a.created_at,
            a.tenant_id, t.name AS tenant_name,
            a.super_admin_id, sa.name AS super_admin_name
     FROM audit_log a
     LEFT JOIN tenants t ON t.id = a.tenant_id
     LEFT JOIN super_admins sa ON sa.id = a.super_admin_id
     ${where}
     ORDER BY a.created_at DESC
     LIMIT $${idx}`,
    [...params, limit]
  );
  return res.rows;
};

module.exports = { log, list };
