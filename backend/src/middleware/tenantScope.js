'use strict';

/**
 * Tenant scoping for "shared" deployment mode (one instance + one database
 * serving multiple clients — see platform/README.md's deployment_mode
 * table). In "dedicated" and "isolated" mode every user's tenant_id is
 * NULL and every helper below is a no-op, so this file only matters once
 * a deploy actually has multi-tenant users.
 *
 * How a user gets a tenant_id: NOT self-serve OAuth signup — an unknown
 * Google login has no business auto-joining a specific client's tenant.
 * Instead, a tenant's own admin invites/creates users via POST /api/users
 * (see users.controller.js), and that endpoint stamps the new user's
 * tenant_id from the inviting admin's own req.user.tenant_id. So tenancy
 * propagates from whoever is already inside a tenant, never from the
 * signup flow itself.
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
