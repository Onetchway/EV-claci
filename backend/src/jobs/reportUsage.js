'use strict';

/**
 * Reports this CRM's current employee count to the Livanto platform's
 * super-admin control plane, for per-employee billing.
 *
 * This is the ONLY data this tenant CRM sends to the platform. No employee
 * names, no operational data — a single count, pushed by this app, never
 * pulled by the platform. Configure PLATFORM_API_URL and
 * PLATFORM_TENANT_API_KEY (given when the super admin onboarded this
 * tenant) and run this on a schedule, e.g. a daily cron:
 *
 *   0 1 * * * cd /path/to/backend && npm run report-usage
 *
 * If PLATFORM_TENANT_API_KEY isn't set (e.g. running standalone, not
 * under the multi-tenant platform), this is a no-op.
 */

require('dotenv').config();
const { query, pool } = require('../config/database');

async function run() {
  const apiUrl = process.env.PLATFORM_API_URL;
  const apiKey = process.env.PLATFORM_TENANT_API_KEY;

  if (!apiUrl || !apiKey) {
    console.log('[report-usage] PLATFORM_API_URL / PLATFORM_TENANT_API_KEY not set — skipping (not running under the multi-tenant platform).');
    return;
  }

  const res = await query(`SELECT COUNT(*) FROM users`);
  const employeeCount = parseInt(res.rows[0].count, 10);

  const response = await fetch(`${apiUrl}/usage/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-Api-Key': apiKey },
    body: JSON.stringify({ employee_count: employeeCount }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Platform rejected usage report (${response.status}): ${body}`);
  }

  console.log(`[report-usage] Reported ${employeeCount} employees to the platform.`);
}

if (require.main === module) {
  run()
    .then(() => pool.end())
    .catch((err) => { console.error('[report-usage] Failed:', err.message); process.exit(1); });
}

module.exports = { run };
