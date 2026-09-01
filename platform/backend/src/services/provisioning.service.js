'use strict';

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { query } = require('../config/database');
const audit = require('./audit.service');

// The three files that make up a full tenant CRM database (EV charging
// CRM + the NAKJM EPC CRM module + its documents table). Same source of
// truth a manually-provisioned deploy would run by hand.
const DATABASE_DIR = path.join(__dirname, '..', '..', '..', '..', 'database');
const SCHEMA_FILES = ['schema.sql', 'nakjm_schema.sql', 'nakjm_documents_schema.sql']
  .map((file) => path.join(DATABASE_DIR, file));

// Postgres identifiers can't be parameterized — this is the defense-in-depth
// check on top of the fact that tenant.slug is already normalized by
// tenants.service.js's slugify(). Reject anything that isn't this shape
// before it ever reaches a CREATE DATABASE / template string.
const SAFE_DB_NAME = /^[a-z][a-z0-9_]{2,60}$/;

function dbNameForTenant(slug) {
  const name = `tenant_${slug.replace(/-/g, '_')}`;
  if (!SAFE_DB_NAME.test(name)) {
    const e = new Error(`Tenant slug "${slug}" doesn't produce a safe database name.`); e.status = 400; throw e;
  }
  return name;
}

function buildConnectionString(adminUrl, databaseName) {
  const u = new URL(adminUrl);
  u.pathname = `/${databaseName}`;
  return u.toString();
}

function redact(connectionString) {
  const u = new URL(connectionString);
  u.username = '';
  u.password = '';
  return u.toString();
}

/**
 * Provisions a dedicated Postgres database for an "isolated"-mode tenant:
 * creates the database, loads the full CRM schema into it, and records a
 * (credential-free) reference to it on the tenant row. The connection
 * string WITH credentials is returned once, in the response — never
 * persisted anywhere. This is the automatable half of tenant provisioning;
 * "dedicated" mode (a tenant's own separate hosting) still needs a human,
 * since it depends on whichever hosting provider that tenant uses.
 */
const provisionIsolatedDatabase = async (tenantId, actor) => {
  const adminUrl = process.env.PROVISIONING_ADMIN_DATABASE_URL;
  if (!adminUrl) {
    const e = new Error('PROVISIONING_ADMIN_DATABASE_URL is not configured on this platform backend.'); e.status = 400; throw e;
  }

  const tenantRes = await query(`SELECT id, name, slug, deployment_mode FROM tenants WHERE id = $1`, [tenantId]);
  const tenant = tenantRes.rows[0];
  if (!tenant) { const e = new Error('Tenant not found'); e.status = 404; throw e; }
  if (tenant.deployment_mode !== 'isolated') {
    const e = new Error(`Only "isolated"-mode tenants use this. "${tenant.deployment_mode}" tenants provision differently — see platform/README.md.`);
    e.status = 400;
    throw e;
  }

  const dbName = dbNameForTenant(tenant.slug);

  const adminClient = new Client({ connectionString: adminUrl });
  await adminClient.connect();
  try {
    const exists = await adminClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (exists.rows.length) {
      const e = new Error(`Database "${dbName}" already exists — this tenant may already be provisioned.`); e.status = 409; throw e;
    }
    // Identifier interpolation is safe here only because dbNameForTenant()
    // already validated dbName against SAFE_DB_NAME above.
    await adminClient.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await adminClient.end();
  }

  const tenantConnectionString = buildConnectionString(adminUrl, dbName);
  const tenantClient = new Client({ connectionString: tenantConnectionString });
  await tenantClient.connect();
  try {
    for (const file of SCHEMA_FILES) {
      const sql = fs.readFileSync(file, 'utf8');
      await tenantClient.query(sql);
    }
  } finally {
    await tenantClient.end();
  }

  await query(
    `UPDATE tenants SET db_connection_ref = $1, updated_at = NOW() WHERE id = $2`,
    [redact(tenantConnectionString), tenantId]
  );

  await audit.log({
    superAdminId: actor?.id,
    tenantId,
    action: 'tenant.database_provisioned',
    details: { database: dbName },
  });

  return {
    database: dbName,
    connection_string: tenantConnectionString, // shown once — not persisted with credentials anywhere
    note: 'Save this now. It will not be shown again — the platform only stores a credential-free reference (tenants.db_connection_ref).',
  };
};

module.exports = { provisionIsolatedDatabase };
