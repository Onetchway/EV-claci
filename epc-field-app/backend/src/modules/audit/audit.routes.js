const express = require('express');
const prisma = require('../../config/prisma');
const { requireAuth } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/permissions');
const { PERMISSIONS } = require('../../config/permissions');

const router = express.Router();

router.use(requireAuth(), requirePermission(PERMISSIONS.AUDIT_VIEW.key));

// Simple offset pagination + optional entityType/entityId filter — sufficient for an internal
// audit viewer at current scale; revisit if volume grows enough to need cursor pagination.
router.get('/', async (req, res) => {
  const take = Math.min(Number(req.query.limit) || 50, 200);
  const skip = Number(req.query.offset) || 0;
  const where = {};
  if (req.query.entityType) where.entityType = req.query.entityType;
  if (req.query.entityId) where.entityId = req.query.entityId;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      include: { actor: { select: { id: true, name: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({ logs, total });
});

module.exports = router;
