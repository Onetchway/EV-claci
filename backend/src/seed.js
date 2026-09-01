'use strict';

// Bootstraps a user for email/password login (an alternative to Google
// OAuth — see src/services/auth.service.js). Defaults to role 'admin';
// pass --role and, for role=franchise, --franchiseId to seed a franchise
// partner's own portal login instead (see routes/franchise.routes.js's
// GET /portal/dashboard).
// Usage: npm run seed -- --email you@yourcompany.com --name "Your Name" --password "changeme123" [--role admin] [--franchiseId <uuid>]

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool, query } = require('./config/database');

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach((arg, i, arr) => {
    if (arg.startsWith('--')) args[arg.slice(2)] = arr[i + 1];
  });
  return args;
}

async function main() {
  const { email, name, password, role = 'admin', franchiseId = null } = parseArgs();
  if (!email || !name || !password) {
    console.error('Usage: npm run seed -- --email you@yourcompany.com --name "Your Name" --password "changeme123" [--role admin] [--franchiseId <uuid>]');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const res = await query(
    `INSERT INTO users (name, email, password_hash, role, franchise_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO UPDATE SET password_hash = $3, name = $1, role = $4, franchise_id = $5
     RETURNING id, name, email, role, franchise_id`,
    [name, email.toLowerCase(), passwordHash, role, franchiseId]
  );
  console.log('User ready:', res.rows[0]);
  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
