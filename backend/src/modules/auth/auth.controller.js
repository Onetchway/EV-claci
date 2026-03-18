'use strict';

require('dotenv').config();
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * Handle Google OAuth callback
 * Signs a JWT and redirects to frontend with token
 */
function googleCallback(req, res) {
  try {
    if (!req.user) {
      return res.redirect(`${FRONTEND_URL}/auth/callback?error=access_denied`);
    }

    const payload = {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      franchise_id: req.user.franchise_id || null,
      name: req.user.name,
      picture: req.user.picture || null,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    return res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`);
  } catch (err) {
    console.error('Google callback error:', err);
    return res.redirect(`${FRONTEND_URL}/auth/callback?error=server_error`);
  }
}

/**
 * Get current authenticated user
 */
function getMe(req, res) {
  return res.status(200).json({
    success: true,
    data: req.user,
    message: 'User retrieved successfully',
  });
}

/**
 * Logout endpoint
 */
function logout(req, res) {
  return res.status(200).json({
    success: true,
    data: null,
    message: 'Logged out successfully',
  });
}

/**
 * Handle OAuth failure
 */
function authFailure(req, res) {
  return res.status(401).json({
    success: false,
    message: 'Google authentication failed. Please ensure you are using an authorized email domain.',
  });
}

module.exports = { googleCallback, getMe, logout, authFailure };
