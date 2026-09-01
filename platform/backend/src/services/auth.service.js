'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';

const login = async ({ email, password }) => {
  if (!email || !password) { const e = new Error('Email and password are required.'); e.status = 400; throw e; }

  const res = await query(
    `SELECT id, name, email, password_hash, role, is_active FROM super_admins WHERE email = $1`,
    [email.toLowerCase()]
  );
  const admin = res.rows[0];
  if (!admin || !admin.is_active) { const e = new Error('Invalid credentials.'); e.status = 401; throw e; }

  const valid = await bcrypt.compare(password, admin.password_hash);
  if (!valid) { const e = new Error('Invalid credentials.'); e.status = 401; throw e; }

  const token = jwt.sign(
    { id: admin.id, email: admin.email, role: admin.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    token,
    admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
  };
};

module.exports = { login };
