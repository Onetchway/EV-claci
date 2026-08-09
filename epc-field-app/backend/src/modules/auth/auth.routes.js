const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../../config/prisma');
const { signToken, requireAuth } = require('../../middleware/auth');

const router = express.Router();

function sanitizeUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !user.isActive) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = signToken(user);
  res.json({ token, user: sanitizeUser(user) });
});

router.get('/me', requireAuth(), async (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

module.exports = router;
