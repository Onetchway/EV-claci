'use strict';

const express = require('express');
const router = express.Router();
const passport = require('../../config/passport');
const { authenticate } = require('../../middleware/auth');
const { googleCallback, getMe, logout, authFailure } = require('./auth.controller');

// Initiate Google OAuth flow
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

// Google OAuth callback
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: '/api/auth/failure',
  }),
  googleCallback
);

// Auth failure handler
router.get('/failure', authFailure);

// Get current user
router.get('/me', authenticate, getMe);

// Logout (client-side token removal, server acknowledges)
router.post('/logout', logout);

module.exports = router;
