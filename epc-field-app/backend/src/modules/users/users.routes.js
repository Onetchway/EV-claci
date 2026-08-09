const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../../config/prisma');
const { requireAuth, requireRole } = require('../../middleware/auth');

const router = express.Router();

function sanitizeUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

// Admin-only: manage engineer/admin accounts.
router.use(requireAuth(), requireRole('ADMIN'));

router.get('/', async (req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ users: users.map(sanitizeUser) });
});

router.post('/', async (req, res) => {
  const { email, password, name, phone, role } = req.body || {};
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'email, password and name are required' });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase().trim(),
      passwordHash,
      name,
      phone,
      role: role === 'ADMIN' ? 'ADMIN' : 'ENGINEER',
    },
  });
  res.status(201).json({ user: sanitizeUser(user) });
});

router.patch('/:id', async (req, res) => {
  const { name, phone, role, isActive } = req.body || {};
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(phone !== undefined && { phone }),
      ...(role !== undefined && { role }),
      ...(isActive !== undefined && { isActive }),
    },
  });
  res.json({ user: sanitizeUser(user) });
});

module.exports = router;
