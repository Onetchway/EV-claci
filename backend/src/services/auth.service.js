'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { resolveTenantBySlug } = require('../utils/resolveTenant');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';

// Email/password login — an alternative to Google OAuth, for deploys or
// local testing where OAuth isn't set up. Only works for a user that has
// a password_hash (set via createUser below); a Google-only user has none
// and this always rejects them with the same generic message.
//
// tenantSlug is passed by a path-routed deployment (app.alpha.com/xpulse —
// see frontend/middleware.js) to say which tenant's login page this is. When
// present, the user's own tenant must match, so one tenant's login page
// can't be used to sign into another tenant's account — same generic
// message either way, so this never confirms whether an email exists.
const login = async ({ email, password, tenantSlug }) => {
  if (!email || !password) { const e = new Error('Email and password are required.'); e.status = 400; throw e; }

  const res = await query(
    `SELECT id, name, email, picture, role, franchise_id, tenant_id, password_hash FROM users WHERE email = $1`,
    [email.toLowerCase()]
  );
  const user = res.rows[0];
  if (!user || !user.password_hash) { const e = new Error('Invalid credentials.'); e.status = 401; throw e; }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) { const e = new Error('Invalid credentials.'); e.status = 401; throw e; }

  if (tenantSlug) {
    const tenant = await resolveTenantBySlug(tenantSlug);
    if (!tenant || tenant.id !== user.tenant_id) { const e = new Error('Invalid credentials.'); e.status = 401; throw e; }
  }

  const payload = {
    id: user.id, email: user.email, name: user.name, picture: user.picture || null,
    role: user.role, franchise_id: user.franchise_id || null,
  };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

  delete user.password_hash;
  return { token, user };
};

// Creates a user with a password (as opposed to Google OAuth's auto-create
// on first sign-in). tenant_id is inherited from the creating admin, same
// rule as everywhere else in this app — see middleware/tenantScope.js.
const createUser = async ({ name, email, password, role = 'operations', franchise_id = null }, req) => {
  if (!name || !email || !password) { const e = new Error('name, email, and password are required.'); e.status = 400; throw e; }
  if (password.length < 8) { const e = new Error('Password must be at least 8 characters.'); e.status = 400; throw e; }

  const { tenantIdForInsert } = require('../middleware/tenantScope');
  const passwordHash = await bcrypt.hash(password, 10);

  const res = await query(
    `INSERT INTO users (name, email, password_hash, role, franchise_id, tenant_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, email, picture, role, franchise_id, tenant_id, created_at`,
    [name, email.toLowerCase(), passwordHash, role, franchise_id, tenantIdForInsert(req)]
  );
  return res.rows[0];
};

module.exports = { login, createUser };
