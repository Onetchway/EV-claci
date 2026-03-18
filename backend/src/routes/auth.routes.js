const router   = require('express').Router();
const passport = require('passport');
const jwt      = require('jsonwebtoken');

// Redirect to Google consent screen
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

// Google OAuth callback
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.FRONTEND_URL}/login?error=unauthorized` }),
  (req, res) => {
    const token = jwt.sign({ id: req.user.id, role: req.user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  }
);

// Verify token / get current user
router.get('/me', require('../middleware/auth').authenticate, (req, res) => {
  const { id, email, name, avatar, role, franchiseId } = req.user;
  res.json({ id, email, name, avatar, role, franchiseId });
});

module.exports = router;
