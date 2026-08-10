const prisma = require('../config/prisma');

/** Permission keys granted by the user's global role (SUPER_ADMIN, MANAGEMENT, OPERATIONS_MANAGER, ...). */
function globalPermissionKeys(user) {
  if (!user?.roleRef?.rolePermissions) return [];
  return user.roleRef.rolePermissions.map((rp) => rp.permission.key);
}

/** True if the user's global role grants this permission — checks only User.roleRef, no DB call. */
function hasPermission(user, key) {
  return globalPermissionKeys(user).includes(key);
}

/**
 * True if the user can act on `projectId` with this permission — either because their global
 * role grants it everywhere, or because they're a ProjectMember of this specific project with a
 * role that grants it (e.g. a Project Manager scoped to just their own projects).
 */
async function hasProjectPermission(user, projectId, key) {
  if (!user || !projectId) return false;
  if (hasPermission(user, key)) return true;

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
    include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
  });
  if (!membership) return false;
  return membership.role.rolePermissions.some((rp) => rp.permission.key === key);
}

/** Express middleware for global (non-project-scoped) permission checks, e.g. users.manage. */
function requirePermission(key) {
  return (req, res, next) => {
    if (!hasPermission(req.user, key)) {
      return res.status(403).json({ error: `Forbidden — missing permission: ${key}` });
    }
    next();
  };
}

module.exports = { hasPermission, hasProjectPermission, requirePermission, globalPermissionKeys };
