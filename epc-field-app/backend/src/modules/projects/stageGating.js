const prisma = require('../../config/prisma');

/**
 * Creates one ProjectStage per StageTemplate for a new project, in playbook order.
 * The first stage is immediately workable (NOT_STARTED); the rest are LOCKED until the
 * preceding stage is APPROVED — this encodes the Playbook's hard gates (e.g. "No site work
 * should be started without layout approval").
 */
async function createProjectStages(tx, { projectId, clientId }) {
  const stageTemplates = await tx.stageTemplate.findMany({
    where: { clientId },
    orderBy: { order: 'asc' },
  });
  await tx.projectStage.createMany({
    data: stageTemplates.map((st, index) => ({
      projectId,
      stageTemplateId: st.id,
      status: index === 0 ? 'NOT_STARTED' : 'LOCKED',
    })),
  });
}

/** Unlocks the next stage (by StageTemplate.order) once the given stage is approved. */
async function unlockNextStage(tx, approvedProjectStage) {
  const currentTemplate = await tx.stageTemplate.findUnique({
    where: { id: approvedProjectStage.stageTemplateId },
  });
  const nextTemplate = await tx.stageTemplate.findFirst({
    where: { clientId: currentTemplate.clientId, order: { gt: currentTemplate.order } },
    orderBy: { order: 'asc' },
  });
  if (!nextTemplate) return;
  const nextProjectStage = await tx.projectStage.findUnique({
    where: {
      projectId_stageTemplateId: {
        projectId: approvedProjectStage.projectId,
        stageTemplateId: nextTemplate.id,
      },
    },
  });
  if (nextProjectStage && nextProjectStage.status === 'LOCKED') {
    await tx.projectStage.update({
      where: { id: nextProjectStage.id },
      data: { status: 'NOT_STARTED' },
    });
  }
}

/**
 * Computes V-Green's payment milestone tracker (Playbook §12) from stage statuses.
 * stagesByKey: Map<stageTemplateKey, ProjectStage>
 */
function computePaymentMilestones(stagesByKey) {
  const isApproved = (key) => stagesByKey.get(key)?.status === 'APPROVED';
  const isSubmittedOrApproved = (key) =>
    ['SUBMITTED', 'APPROVED'].includes(stagesByKey.get(key)?.status);

  const goLiveApproved = isApproved('COMMISSIONING') && isApproved('HOTO');
  const hotoApprovedAt = stagesByKey.get('HOTO')?.approvedAt;
  const warrantyDue =
    goLiveApproved && hotoApprovedAt
      ? new Date(hotoApprovedAt).getTime() + 365 * 24 * 60 * 60 * 1000 <= Date.now()
      : false;

  return [
    { key: 'APPENDIX_SIGNING', label: 'Appendix Signing', percent: 30, achieved: isSubmittedOrApproved('DISCOM') },
    { key: 'CIVIL_COMPLETION', label: 'Civil Work Completion', percent: 10, achieved: isApproved('CIVIL') },
    {
      key: 'CONSTRUCTION_HANDOVER',
      label: 'Construction Handover',
      percent: 30,
      achieved: isApproved('CHARGER_INSTALL') && isApproved('TESTING'),
    },
    { key: 'GO_LIVE', label: 'Go-Live', percent: 25, achieved: goLiveApproved },
    { key: 'WARRANTY_END', label: '1-Year Warranty Ends', percent: 5, achieved: warrantyDue },
  ];
}

module.exports = { createProjectStages, unlockNextStage, computePaymentMilestones };
