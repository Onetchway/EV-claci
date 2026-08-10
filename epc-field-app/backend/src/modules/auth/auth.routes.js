const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../../config/prisma');
const { signToken, requireAuth } = require('../../middleware/auth');

const router = express.Router();

const ROLE_INCLUDE = { roleRef: { include: { rolePermissions: { include: { permission: true } } } } };

/** Strips internal fields and flattens roleRef into roleKey/roleName/permissions for the client. */
function sanitizeUser(user) {
  const { passwordHash, roleRef, ...rest } = user;
  const permissions = roleRef ? roleRef.rolePermissions.map((rp) => rp.permission.key) : [];
  return {
    ...rest,
    roleKey: roleRef?.key || null,
    roleName: roleRef?.name || null,
    permissions,
  };
}

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: ROLE_INCLUDE,
  });
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
