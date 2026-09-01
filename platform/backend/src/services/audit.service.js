'use strict';

const { query } = require('../config/database');

const log = async ({ superAdminId, tenantId, action, details }) => {
  await query(
    `INSERT INTO audit_log (super_admin_id, tenant_id, action, details) VALUES ($1, $2, $3, $4)`,
    [superAdminId || null, tenantId || null, action, details ? JSON.stringify(details) : null]
  );
};

module.exports = { log };
