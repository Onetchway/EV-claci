'use strict';

const { query } = require('../config/database');

// Authenticates a TENANT's own CRM backend calling in to self-report usage
// (e.g. its current employee count for per-employee billing). This is the
// only inbound channel from a tenant, and it never lets the platform pull
// data — the tenant always pushes exactly the numbers it chooses to share.
const authenticateTenant = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-tenant-api-key'];
    if (!apiKey) return res.status(401).json({ error: 'Missing X-Tenant-Api-Key header.' });
    const result = await query(
      `SELECT id, name, slug, status FROM tenants WHERE api_key = $1`,
      [apiKey]
    );
    const tenant = result.rows[0];
    if (!tenant) return res.status(401).json({ error: 'Invalid tenant API key.' });
    if (tenant.status === 'cancelled') return res.status(403).json({ error: 'Tenant is cancelled.' });
    req.tenant = tenant;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { authenticateTenant };
