const express = require('express');
const prisma = require('../../config/prisma');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { createProjectStages, computePaymentMilestones } = require('./stageGating');

const router = express.Router();

router.use(requireAuth());

router.get('/', async (req, res) => {
  const where = {};
  if (req.query.clientId) where.clientId = req.query.clientId;
  if (req.query.status) where.status = req.query.status;
  if (req.user.role !== 'ADMIN') where.assignedEngineerId = req.user.id;

  const projects = await prisma.project.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      client: true,
      assignedEngineer: { select: { id: true, name: true, email: true } },
      stages: { include: { stageTemplate: true } },
    },
  });

  const result = projects.map((p) => ({
    ...p,
    stageProgress: {
      total: p.stages.length,
      approved: p.stages.filter((s) => s.status === 'APPROVED').length,
      submitted: p.stages.filter((s) => s.status === 'SUBMITTED').length,
    },
  }));

  res.json({ projects: result });
});

router.post('/', requireRole('ADMIN'), async (req, res) => {
  const { clientId, siteName, address, lat, lng, assignedEngineerId } = req.body || {};
  if (!clientId || !siteName || !address) {
    return res.status(400).json({ error: 'clientId, siteName and address are required' });
  }

  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: { clientId, siteName, address, lat, lng, assignedEngineerId },
    });
    await createProjectStages(tx, { projectId: created.id, clientId });
    return created;
  });

  res.status(201).json({ project });
});

router.get('/:id', async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      client: true,
      assignedEngineer: { select: { id: true, name: true, email: true } },
      stages: {
        include: { stageTemplate: true, approvedBy: { select: { id: true, name: true } } },
      },
    },
  });
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (req.user.role !== 'ADMIN' && project.assignedEngineerId !== req.user.id) {
    return res.status(403).json({ error: 'Not assigned to this project' });
  }

  const sortedStages = [...project.stages].sort((a, b) => a.stageTemplate.order - b.stageTemplate.order);
  const stagesByKey = new Map(sortedStages.map((s) => [s.stageTemplate.key, s]));
  const paymentMilestones = computePaymentMilestones(stagesByKey);

  res.json({ project: { ...project, stages: sortedStages }, paymentMilestones });
});

router.patch('/:id', requireRole('ADMIN'), async (req, res) => {
  const { siteName, address, lat, lng, status, assignedEngineerId } = req.body || {};
  const project = await prisma.project.update({
    where: { id: req.params.id },
    data: {
      ...(siteName !== undefined && { siteName }),
      ...(address !== undefined && { address }),
      ...(lat !== undefined && { lat }),
      ...(lng !== undefined && { lng }),
      ...(status !== undefined && { status }),
      ...(assignedEngineerId !== undefined && { assignedEngineerId }),
    },
  });
  res.json({ project });
});

module.exports = router;
