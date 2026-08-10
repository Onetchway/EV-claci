const express = require('express');
const prisma = require('../../config/prisma');
const { requireAuth } = require('../../middleware/auth');
const { hasPermission, hasProjectPermission, requirePermission } = require('../../middleware/permissions');
const { PERMISSIONS } = require('../../config/permissions');
const { logAudit } = require('../../services/audit');
const { createProjectStages, computePaymentMilestones } = require('./stageGating');
const { getResolvedProjectConfigs, setProjectConfig, clearProjectConfig } = require('../../services/config');

const router = express.Router();

const MEMBER_SELECT = {
  id: true,
  userId: true,
  roleId: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true } },
  role: { select: { id: true, key: true, name: true } },
};

router.use(requireAuth());

router.get('/', async (req, res) => {
  const where = {};
  if (req.query.clientId) where.clientId = req.query.clientId;
  if (req.query.status) where.status = req.query.status;
  if (!hasPermission(req.user, PERMISSIONS.PROJECTS_VIEW_ALL.key)) {
    // Legacy single-assignee OR new multi-member visibility — both kept so nobody loses access
    // during the transition from assignedEngineerId to ProjectMember.
    where.OR = [{ assignedEngineerId: req.user.id }, { members: { some: { userId: req.user.id } } }];
  }

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

router.post('/', requirePermission(PERMISSIONS.PROJECTS_CREATE.key), async (req, res) => {
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

  await logAudit({
    actorId: req.user.id,
    action: 'project.create',
    entityType: 'Project',
    entityId: project.id,
    after: project,
  });

  res.status(201).json({ project });
});

router.get('/:id', async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      client: true,
      assignedEngineer: { select: { id: true, name: true, email: true } },
      members: { select: MEMBER_SELECT },
      stages: {
        include: { stageTemplate: true, approvedBy: { select: { id: true, name: true } } },
      },
    },
  });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const isMember = project.members.some((m) => m.userId === req.user.id);
  const isLegacyAssignee = project.assignedEngineerId === req.user.id;
  if (!hasPermission(req.user, PERMISSIONS.PROJECTS_VIEW_ALL.key) && !isMember && !isLegacyAssignee) {
    return res.status(403).json({ error: 'Not assigned to this project' });
  }

  const sortedStages = [...project.stages].sort((a, b) => a.stageTemplate.order - b.stageTemplate.order);
  const stagesByKey = new Map(sortedStages.map((s) => [s.stageTemplate.key, s]));
  const paymentMilestones = await computePaymentMilestones(project.clientId, stagesByKey);
  const canAssignMembers = await hasProjectPermission(req.user, project.id, PERMISSIONS.PROJECTS_ASSIGN_MEMBERS.key);
  const canManageProject = await hasProjectPermission(req.user, project.id, PERMISSIONS.PROJECTS_MANAGE.key);

  res.json({ project: { ...project, stages: sortedStages }, paymentMilestones, canAssignMembers, canManageProject });
});

router.patch('/:id', async (req, res) => {
  const before = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: 'Project not found' });
  if (!(await hasProjectPermission(req.user, before.id, PERMISSIONS.PROJECTS_MANAGE.key))) {
    return res.status(403).json({ error: 'Forbidden — missing permission: projects.manage' });
  }

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

  await logAudit({
    actorId: req.user.id,
    action: 'project.update',
    entityType: 'Project',
    entityId: project.id,
    before,
    after: project,
  });

  res.json({ project });
});

// ─── Project members (multi-assignee, project-scoped roles) ──────────────────────────────

router.get('/:id/members', async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) return res.status(404).json({ error: 'Project not found' });
  const isMember = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: project.id, userId: req.user.id } },
  });
  if (!hasPermission(req.user, PERMISSIONS.PROJECTS_VIEW_ALL.key) && !isMember && project.assignedEngineerId !== req.user.id) {
    return res.status(403).json({ error: 'Not assigned to this project' });
  }
  const members = await prisma.projectMember.findMany({
    where: { projectId: project.id },
    select: MEMBER_SELECT,
    orderBy: { createdAt: 'asc' },
  });
  res.json({ members });
});

router.post('/:id/members', async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (!(await hasProjectPermission(req.user, project.id, PERMISSIONS.PROJECTS_ASSIGN_MEMBERS.key))) {
    return res.status(403).json({ error: 'Forbidden — missing permission: projects.assignMembers' });
  }
  const { userId, roleId } = req.body || {};
  if (!userId || !roleId) return res.status(400).json({ error: 'userId and roleId are required' });

  const member = await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId } },
    update: { roleId },
    create: { projectId: project.id, userId, roleId },
    select: MEMBER_SELECT,
  });

  await logAudit({
    actorId: req.user.id,
    action: 'project.member.add',
    entityType: 'Project',
    entityId: project.id,
    after: member,
  });

  res.status(201).json({ member });
});

router.delete('/:id/members/:memberId', async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (!(await hasProjectPermission(req.user, project.id, PERMISSIONS.PROJECTS_ASSIGN_MEMBERS.key))) {
    return res.status(403).json({ error: 'Forbidden — missing permission: projects.assignMembers' });
  }
  const member = await prisma.projectMember.findUnique({ where: { id: req.params.memberId } });
  if (!member || member.projectId !== project.id) {
    return res.status(404).json({ error: 'Member not found on this project' });
  }
  await prisma.projectMember.delete({ where: { id: member.id } });

  await logAudit({
    actorId: req.user.id,
    action: 'project.member.remove',
    entityType: 'Project',
    entityId: project.id,
    before: member,
  });

  res.json({ ok: true });
});

// ─── Project configuration (client/project override hierarchy) ───────────────────────────────

router.get('/:id/config', async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) return res.status(404).json({ error: 'Project not found' });
  const isMember = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: project.id, userId: req.user.id } },
  });
  if (!hasPermission(req.user, PERMISSIONS.PROJECTS_VIEW_ALL.key) && !isMember && project.assignedEngineerId !== req.user.id) {
    return res.status(403).json({ error: 'Not assigned to this project' });
  }
  const configs = await getResolvedProjectConfigs(project);
  res.json({ configs });
});

router.put('/:id/config/:key', async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (!(await hasProjectPermission(req.user, project.id, PERMISSIONS.PROJECTS_MANAGE.key))) {
    return res.status(403).json({ error: 'Forbidden — missing permission: projects.manage' });
  }
  const { value } = req.body || {};
  try {
    await setProjectConfig(project.id, req.params.key, value);
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }
  await logAudit({
    actorId: req.user.id,
    action: 'project.config.set',
    entityType: 'Project',
    entityId: project.id,
    after: { key: req.params.key, value },
  });
  res.json({ ok: true });
});

router.delete('/:id/config/:key', async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (!(await hasProjectPermission(req.user, project.id, PERMISSIONS.PROJECTS_MANAGE.key))) {
    return res.status(403).json({ error: 'Forbidden — missing permission: projects.manage' });
  }
  try {
    await clearProjectConfig(project.id, req.params.key);
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }
  await logAudit({
    actorId: req.user.id,
    action: 'project.config.clear',
    entityType: 'Project',
    entityId: project.id,
    after: { key: req.params.key },
  });
  res.json({ ok: true });
});

module.exports = router;
