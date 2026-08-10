const express = require('express');
const prisma = require('../../config/prisma');
const { requireAuth } = require('../../middleware/auth');

const router = express.Router();

router.use(requireAuth());

// Any authenticated user can list roles — needed to populate role pickers (e.g. the Users
// page's role dropdown, or a project-member-add form), and it's not sensitive data.
router.get('/', async (req, res) => {
  const roles = await prisma.roleDef.findMany({
    orderBy: { name: 'asc' },
    include: { rolePermissions: { include: { permission: true } } },
  });
  res.json({
    roles: roles.map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      isSystem: r.isSystem,
      permissions: r.rolePermissions.map((rp) => rp.permission.key),
    })),
  });
});

module.exports = router;
