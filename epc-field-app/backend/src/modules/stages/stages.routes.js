const express = require('express');
const prisma = require('../../config/prisma');
const { requireAuth } = require('../../middleware/auth');
const { hasPermission, hasProjectPermission } = require('../../middleware/permissions');
const { PERMISSIONS } = require('../../config/permissions');
const { logAudit } = require('../../services/audit');
const { unlockNextStage } = require('../projects/stageGating');

const router = express.Router();

router.use(requireAuth());

async function loadStageOr404(req, res) {
  const stage = await prisma.projectStage.findUnique({
    where: { id: req.params.id },
    include: {
      project: true,
      stageTemplate: {
        include: {
          fieldDefs: { orderBy: { order: 'asc' } },
          photoSlots: { orderBy: { order: 'asc' } },
        },
      },
      submissions: {
        orderBy: { version: 'desc' },
        include: { photos: { include: { photoSlot: true } }, submittedBy: { select: { id: true, name: true } } },
      },
    },
  });
  if (!stage) {
    res.status(404).json({ error: 'Project stage not found' });
    return null;
  }
  const isMember = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: stage.project.id, userId: req.user.id } },
  });
  const isLegacyAssignee = stage.project.assignedEngineerId === req.user.id;
  if (!hasPermission(req.user, PERMISSIONS.PROJECTS_VIEW_ALL.key) && !isMember && !isLegacyAssignee) {
    res.status(403).json({ error: 'Not assigned to this project' });
    return null;
  }
  return stage;
}

router.get('/:id', async (req, res) => {
  const stage = await loadStageOr404(req, res);
  if (!stage) return;
  const canApprove = await hasProjectPermission(req.user, stage.project.id, PERMISSIONS.STAGES_APPROVE.key);
  const canManageSubmission = await hasProjectPermission(req.user, stage.project.id, PERMISSIONS.SUBMISSIONS_MANAGE.key);
  res.json({ stage, latestSubmission: stage.submissions[0] || null, canApprove, canManageSubmission });
});

router.post('/:id/approve', async (req, res) => {
  const stage = await loadStageOr404(req, res);
  if (!stage) return;
  if (!(await hasProjectPermission(req.user, stage.project.id, PERMISSIONS.STAGES_APPROVE.key))) {
    return res.status(403).json({ error: 'Forbidden — missing permission: stages.approve' });
  }
  if (stage.status !== 'SUBMITTED') {
    return res.status(400).json({ error: 'Only a SUBMITTED stage can be approved' });
  }
  await prisma.$transaction(async (tx) => {
    const updated = await tx.projectStage.update({
      where: { id: stage.id },
      data: { status: 'APPROVED', approvedAt: new Date(), approvedById: req.user.id, rejectionReason: null },
    });
    await unlockNextStage(tx, updated);
  });

  await logAudit({
    actorId: req.user.id,
    action: 'stage.approve',
    entityType: 'ProjectStage',
    entityId: stage.id,
    before: { status: stage.status },
    after: { status: 'APPROVED' },
  });

  res.json({ ok: true });
});

router.post('/:id/reject', async (req, res) => {
  const stage = await loadStageOr404(req, res);
  if (!stage) return;
  if (!(await hasProjectPermission(req.user, stage.project.id, PERMISSIONS.STAGES_APPROVE.key))) {
    return res.status(403).json({ error: 'Forbidden — missing permission: stages.approve' });
  }
  if (stage.status !== 'SUBMITTED') {
    return res.status(400).json({ error: 'Only a SUBMITTED stage can be rejected' });
  }
  const { reason } = req.body || {};
  await prisma.projectStage.update({
    where: { id: stage.id },
    data: { status: 'REJECTED', rejectionReason: reason || 'Rejected by admin' },
  });

  await logAudit({
    actorId: req.user.id,
    action: 'stage.reject',
    entityType: 'ProjectStage',
    entityId: stage.id,
    before: { status: stage.status },
    after: { status: 'REJECTED', reason: reason || 'Rejected by admin' },
  });

  res.json({ ok: true });
});

module.exports = router;
