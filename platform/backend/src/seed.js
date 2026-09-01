'use strict';

// Bootstraps the first super admin.
// Usage: npm run seed -- --email you@livanto.com --name "Your Name" --password "changeme123"

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query, pool } = require('./config/database');

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
    console.error('Usage: npm run seed -- --email you@livanto.com --name "Your Name" --password "changeme123"');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const res = await query(
    `INSERT INTO super_admins (name, email, password_hash, role)
     VALUES ($1, $2, $3, 'super_admin')
     ON CONFLICT (email) DO UPDATE SET password_hash = $3, name = $1
     RETURNING id, name, email, role`,
    [name, email.toLowerCase(), passwordHash]
  );
  console.log('Super admin ready:', res.rows[0]);
  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
