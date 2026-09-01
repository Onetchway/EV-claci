'use strict';

const { query } = require('../config/database');

// Tenants push exactly one number in — their current employee count — for
// the billing period. Nothing else about their employees crosses this line.
const reportUsage = async (tenantId, employeeCount) => {
  if (!Number.isInteger(employeeCount) || employeeCount < 0) {
    const e = new Error('employee_count must be a non-negative integer.'); e.status = 400; throw e;
  }

  const periodMonth = new Date();
  periodMonth.setDate(1);
  periodMonth.setHours(0, 0, 0, 0);

  const res = await query(
    `INSERT INTO tenant_usage_snapshots (tenant_id, period_month, employee_count, reported_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (tenant_id, period_month)
     DO UPDATE SET employee_count = $3, reported_at = NOW()
     RETURNING *`,
    [tenantId, periodMonth.toISOString().slice(0, 10), employeeCount]
  );
  return res.rows[0];
};

const latestForTenant = async (tenantId) => {
  const res = await query(
    `SELECT * FROM tenant_usage_snapshots WHERE tenant_id = $1 ORDER BY period_month DESC LIMIT 12`,
    [tenantId]
  );
  return res.rows;
};

module.exports = { reportUsage, latestForTenant };
