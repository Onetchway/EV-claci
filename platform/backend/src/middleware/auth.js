'use strict';

const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// Authenticates a super-admin operator of the platform (never a tenant user).
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token provided.' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const res_ = await query('SELECT id, name, email, role, is_active FROM super_admins WHERE id = $1', [decoded.id]);
    const user = res_.rows[0];
    if (!user || !user.is_active) return res.status(401).json({ error: 'User not found or inactive.' });
    req.superAdmin = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expired.' });
    if (err.name === 'JsonWebTokenError') return res.status(401).json({ error: 'Invalid token.' });
    next(err);
  }
};

module.exports = { authenticate };
