'use strict';

// Bootstraps the first admin user for email/password login (an
// alternative to Google OAuth — see src/services/auth.service.js).
// Usage: npm run seed -- --email you@yourcompany.com --name "Your Name" --password "changeme123"

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
  const { email, name, password } = parseArgs();
  if (!email || !name || !password) {
    console.error('Usage: npm run seed -- --email you@yourcompany.com --name "Your Name" --password "changeme123"');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const res = await query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (email) DO UPDATE SET password_hash = $3, name = $1
     RETURNING id, name, email, role`,
    [name, email.toLowerCase(), passwordHash]
  );
  console.log('Admin user ready:', res.rows[0]);
  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
