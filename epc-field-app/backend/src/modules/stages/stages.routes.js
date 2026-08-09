const express = require('express');
const prisma = require('../../config/prisma');
const { requireAuth, requireRole } = require('../../middleware/auth');
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
  if (req.user.role !== 'ADMIN' && stage.project.assignedEngineerId !== req.user.id) {
    res.status(403).json({ error: 'Not assigned to this project' });
    return null;
  }
  return stage;
}

router.get('/:id', async (req, res) => {
  const stage = await loadStageOr404(req, res);
  if (!stage) return;
  res.json({ stage, latestSubmission: stage.submissions[0] || null });
});

router.post('/:id/approve', requireRole('ADMIN'), async (req, res) => {
  const stage = await loadStageOr404(req, res);
  if (!stage) return;
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
  res.json({ ok: true });
});

router.post('/:id/reject', requireRole('ADMIN'), async (req, res) => {
  const stage = await loadStageOr404(req, res);
  if (!stage) return;
  if (stage.status !== 'SUBMITTED') {
    return res.status(400).json({ error: 'Only a SUBMITTED stage can be rejected' });
  }
  const { reason } = req.body || {};
  await prisma.projectStage.update({
    where: { id: stage.id },
    data: { status: 'REJECTED', rejectionReason: reason || 'Rejected by admin' },
  });
  res.json({ ok: true });
});

module.exports = router;
