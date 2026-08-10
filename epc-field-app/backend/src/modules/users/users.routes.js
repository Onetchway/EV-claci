const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../../config/prisma');
const { requireAuth } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/permissions');
const { PERMISSIONS, ROLES } = require('../../config/permissions');
const { logAudit } = require('../../services/audit');

const router = express.Router();

const ROLE_INCLUDE = { roleRef: { include: { rolePermissions: { include: { permission: true } } } } };

function sanitizeUser(user) {
  const { passwordHash, roleRef, ...rest } = user;
  return {
    ...rest,
    roleKey: roleRef?.key || null,
    roleName: roleRef?.name || null,
    permissions: roleRef ? roleRef.rolePermissions.map((rp) => rp.permission.key) : [],
  };
}

/** New roles beyond ADMIN/ENGINEER have no legacy enum equivalent — default to the safer,
 * lower-privilege ENGINEER so old `role === 'ADMIN'` checks in the frontend stay correct. */
function legacyRoleFor(roleKey) {
  const def = ROLES[roleKey];
  return def?.legacyRole || 'ENGINEER';
}

// Managing accounts and role assignment is a single, tightly-held permission.
router.use(requireAuth(), requirePermission(PERMISSIONS.USERS_MANAGE.key));

router.get('/', async (req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' }, include: ROLE_INCLUDE });
  res.json({ users: users.map(sanitizeUser) });
});

router.post('/', async (req, res) => {
  const { email, password, name, phone, roleKey } = req.body || {};
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'email, password and name are required' });
  }
  const role = await prisma.roleDef.findUnique({ where: { key: roleKey || 'FIELD_ENGINEER' } });
  if (!role) return res.status(400).json({ error: `Unknown roleKey "${roleKey}"` });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase().trim(),
      passwordHash,
      name,
      phone,
      role: legacyRoleFor(role.key),
      roleId: role.id,
    },
    include: ROLE_INCLUDE,
  });

  await logAudit({
    actorId: req.user.id,
    action: 'user.create',
    entityType: 'User',
    entityId: user.id,
    after: sanitizeUser(user),
  });

  res.status(201).json({ user: sanitizeUser(user) });
});

router.patch('/:id', async (req, res) => {
  const before = await prisma.user.findUnique({ where: { id: req.params.id }, include: ROLE_INCLUDE });
  if (!before) return res.status(404).json({ error: 'User not found' });

  const { name, phone, roleKey, isActive } = req.body || {};
  let roleUpdate = {};
  if (roleKey !== undefined) {
    const role = await prisma.roleDef.findUnique({ where: { key: roleKey } });
    if (!role) return res.status(400).json({ error: `Unknown roleKey "${roleKey}"` });
    roleUpdate = { role: legacyRoleFor(role.key), roleId: role.id };
  }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(phone !== undefined && { phone }),
      ...(isActive !== undefined && { isActive }),
      ...roleUpdate,
    },
    include: ROLE_INCLUDE,
  });

  await logAudit({
    actorId: req.user.id,
    action: 'user.update',
    entityType: 'User',
    entityId: user.id,
    before: sanitizeUser(before),
    after: sanitizeUser(user),
  });

  res.json({ user: sanitizeUser(user) });
});

module.exports = router;
