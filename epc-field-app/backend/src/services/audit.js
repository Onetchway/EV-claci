const prisma = require('../config/prisma');

/**
 * Records an audit log entry. Never throws — an audit-logging failure should never break the
 * request it's describing; it's logged to the console instead so it's still visible in Render
 * logs without taking the API down.
 */
async function logAudit({ actorId, action, entityType, entityId, before, after }) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actorId || null,
        action,
        entityType,
        entityId: entityId || null,
        beforeJson: before ?? undefined,
        afterJson: after ?? undefined,
      },
    });
  } catch (err) {
    console.error('Failed to write audit log', { action, entityType, entityId }, err);
  }
}

module.exports = { logAudit };
