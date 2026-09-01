'use strict';

/**
 * Tenant scoping for "shared" deployment mode (one instance + one database
 * serving multiple clients — see platform/README.md's deployment_mode
 * table). In "dedicated" and "isolated" mode every user's tenant_id is
 * NULL and every helper below is a no-op, so this file only matters once
 * a deploy actually has multi-tenant users.
 *
 * How a user gets a tenant_id: at Google sign-in, resolved from the
 * request's Host header via src/utils/resolveTenant.js + src/config/
 * passport.js (subdomain/custom-domain routing, set per tenant from the
 * super-admin console — see platform/README.md's "Domain routing"
 * section). Once a user exists, their tenant_id is fixed — moving an
 * *existing* user to a different tenant is deliberately not exposed via
 * PUT /api/users/:id (see users.service.js's update()); that's a
 * platform-level action, not something a tenant's own admin should be
 * able to do to another tenant's user.
 */

// SQL fragment + param for scoping a query to the current user's tenant.
// Returns { clause: '', params: [] } when not in shared mode (tenant_id
// is null) — callers splice `clause` into their WHERE/AND chain untouched.
function tenantWhere(req, paramIndex) {
  const tenantId = req.user?.tenant_id;
  if (!tenantId) return { clause: '', params: [] };
  return { clause: `tenant_id = $${paramIndex}`, params: [tenantId] };
}

// The tenant_id to stamp on a newly-created row: the acting user's own
// tenant_id (or null outside shared mode).
function tenantIdForInsert(req) {
  return req.user?.tenant_id || null;
}

module.exports = { tenantWhere, tenantIdForInsert };
