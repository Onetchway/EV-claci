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
          approvalRule: true,
        },
      },
      submissions: {
        orderBy: { version: 'desc' },
        include: {
          photos: { include: { photoSlot: true } },
          documents: { include: { uploadedBy: { select: { id: true, name: true } } } },
          submittedBy: { select: { id: true, name: true } },
        },
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

/** RoleDef keys this user currently holds that are relevant to this project: their global role
 * (if any) plus their ProjectMember role for this specific project (if they're a member). */
async function getUserRoleKeysForProject(user, projectId) {
  const keys = new Set();
  if (user.roleRef?.key) keys.add(user.roleRef.key);
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
    include: { role: true },
  });
  if (membership?.role?.key) keys.add(membership.role.key);
  return keys;
}

/**
 * Eligibility to approve/reject a stage submission: the user must have the base stages.approve
 * permission (globally or via project membership), AND — if the stage's ApprovalRule restricts
 * eligibility to specific roles — hold one of those roles. No ApprovalRule (or an empty
 * eligibleRoleKeys list) means anyone with the base permission is eligible, matching V1.
 */
async function isEligibleApprover(user, project, approvalRule) {
  const hasBasePermission = await hasProjectPermission(user, project.id, PERMISSIONS.STAGES_APPROVE.key);
  if (!hasBasePermission) return false;
  const eligibleRoleKeys = approvalRule?.eligibleRoleKeys || [];
  if (eligibleRoleKeys.length === 0) return true;
  const userRoleKeys = await getUserRoleKeysForProject(user, project.id);
  return eligibleRoleKeys.some((key) => userRoleKeys.has(key));
}

async function buildApprovalState(user, stage, latestSubmission) {
  const approvalRule = stage.stageTemplate.approvalRule;
  const requiredApprovals = approvalRule?.requiredApprovals ?? 1;
  const approvals = latestSubmission
    ? await prisma.stageApproval.findMany({
        where: { submissionId: latestSubmission.id },
        include: { approver: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      })
    : [];
  const eligible = await isEligibleApprover(user, stage.project, approvalRule);
  const alreadyDecided = approvals.some((a) => a.approverId === user.id);
  return { requiredApprovals, approvals, canApprove: eligible, alreadyDecided };
}

router.get('/:id', async (req, res) => {
  const stage = await loadStageOr404(req, res);
  if (!stage) return;
  const latestSubmission = stage.submissions[0] || null;
  const canManageSubmission = await hasProjectPermission(req.user, stage.project.id, PERMISSIONS.SUBMISSIONS_MANAGE.key);
  const approvalState = await buildApprovalState(req.user, stage, latestSubmission);
  res.json({ stage, latestSubmission, canManageSubmission, ...approvalState });
});

router.post('/:id/approve', async (req, res) => {
  const stage = await loadStageOr404(req, res);
  if (!stage) return;
  if (stage.status !== 'SUBMITTED') {
    return res.status(400).json({ error: 'Only a SUBMITTED stage can be approved' });
  }
  const approvalRule = stage.stageTemplate.approvalRule;
  if (!(await isEligibleApprover(req.user, stage.project, approvalRule))) {
    return res.status(403).json({ error: 'Forbidden — missing permission: stages.approve' });
  }
  const latestSubmission = stage.submissions[0];
  if (!latestSubmission) return res.status(400).json({ error: 'No submission to approve' });

  const { comment } = req.body || {};
  await prisma.stageApproval.upsert({
    where: { submissionId_approverId: { submissionId: latestSubmission.id, approverId: req.user.id } },
    update: { decision: 'APPROVED', comment: comment || null },
    create: { submissionId: latestSubmission.id, approverId: req.user.id, decision: 'APPROVED', comment: comment || null },
  });

  const requiredApprovals = approvalRule?.requiredApprovals ?? 1;
  const approvedCount = await prisma.stageApproval.count({
    where: { submissionId: latestSubmission.id, decision: 'APPROVED' },
  });
  const fullyApproved = approvedCount >= requiredApprovals;

  if (fullyApproved) {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.projectStage.update({
        where: { id: stage.id },
        data: { status: 'APPROVED', approvedAt: new Date(), approvedById: req.user.id, rejectionReason: null },
      });
      await unlockNextStage(tx, updated);
    });
  }

  await logAudit({
    actorId: req.user.id,
    action: fullyApproved ? 'stage.approve' : 'stage.approval.record',
    entityType: 'ProjectStage',
    entityId: stage.id,
    before: { status: stage.status },
    after: { status: fullyApproved ? 'APPROVED' : stage.status, approvedCount, requiredApprovals },
  });

  res.json({ ok: true, fullyApproved, approvedCount, requiredApprovals });
});

router.post('/:id/reject', async (req, res) => {
  const stage = await loadStageOr404(req, res);
  if (!stage) return;
  if (stage.status !== 'SUBMITTED') {
    return res.status(400).json({ error: 'Only a SUBMITTED stage can be rejected' });
  }
  const approvalRule = stage.stageTemplate.approvalRule;
  if (!(await isEligibleApprover(req.user, stage.project, approvalRule))) {
    return res.status(403).json({ error: 'Forbidden — missing permission: stages.approve' });
  }
  const { reason } = req.body || {};
  const latestSubmission = stage.submissions[0];
  if (latestSubmission) {
    await prisma.stageApproval.upsert({
      where: { submissionId_approverId: { submissionId: latestSubmission.id, approverId: req.user.id } },
      update: { decision: 'REJECTED', comment: reason || null },
      create: { submissionId: latestSubmission.id, approverId: req.user.id, decision: 'REJECTED', comment: reason || null },
    });
  }

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
