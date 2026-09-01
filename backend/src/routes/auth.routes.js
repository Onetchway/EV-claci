'use strict';

const router   = require('express').Router();
const passport = require('passport');
const jwt      = require('jsonwebtoken');
const { authenticate } = require('../middleware/auth');
const authService = require('../services/auth.service');

const JWT_SECRET   = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// POST /api/auth/login — email/password, an alternative to Google OAuth
// for deploys/testing where OAuth isn't set up. See src/services/auth.service.js.
router.post('/login', async (req, res, next) => {
  try {
    const { token, user } = await authService.login(req.body);
    res.json({ success: true, data: { token, user } });
  } catch (err) { next(err); }
});

// Redirect to Google consent screen
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

// Google OAuth callback
router.get('/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${FRONTEND_URL}/auth/callback?error=access_denied`,
  }),
  (req, res) => {
    try {
      if (!req.user) return res.redirect(`${FRONTEND_URL}/auth/callback?error=access_denied`);
      const payload = {
        id:           req.user.id,
        email:        req.user.email,
        name:         req.user.name,
        picture:      req.user.picture || null,
        role:         req.user.role,
        franchise_id: req.user.franchise_id || null,
      };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
      res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`);
    } catch (err) {
      console.error('Auth callback error:', err);
      res.redirect(`${FRONTEND_URL}/auth/callback?error=server_error`);
    }
  }
);

// GET /api/auth/failure
router.get('/failure', (req, res) => {
  res.status(401).json({
    success: false,
    message: 'Google authentication failed. Please ensure you are using an authorized email domain.',
  });
});

// GET /api/auth/me - current user
router.get('/me', authenticate, (req, res) => {
  res.json({ success: true, data: req.user, message: 'User retrieved successfully' });
});

// POST /api/auth/logout - client-side token removal
router.post('/logout', (req, res) => {
  res.status(200).json({ success: true, data: null, message: 'Logged out successfully' });
});

module.exports = router;
