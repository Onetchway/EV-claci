const prisma = require('../../config/prisma');

/**
 * Creates one ProjectStage per StageTemplate for a new project. A stage with no prerequisites
 * (StageDependency rows) is immediately workable (NOT_STARTED); any stage with prerequisites
 * starts LOCKED until they're all APPROVED. This is a general dependency graph rather than a
 * fixed order+1 chain, so a client can define parallel workstreams (e.g. two stages that both
 * gate a downstream one) purely through StageDependency config — no code changes per client.
 */
async function createProjectStages(tx, { projectId, clientId }) {
  const stageTemplates = await tx.stageTemplate.findMany({
    where: { clientId },
    orderBy: { order: 'asc' },
    include: { dependsOn: true },
  });
  await tx.projectStage.createMany({
    data: stageTemplates.map((st) => ({
      projectId,
      stageTemplateId: st.id,
      status: st.dependsOn.length === 0 ? 'NOT_STARTED' : 'LOCKED',
    })),
  });
}

/**
 * Unlocks any stage that lists the just-approved stage as a prerequisite, but only once ALL of
 * that stage's prerequisites are APPROVED — this is what makes parallel workstreams correct
 * (a stage gated by two branches waits for the slower one).
 */
async function unlockNextStage(tx, approvedProjectStage) {
  const dependents = await tx.stageDependency.findMany({
    where: { dependsOnTemplateId: approvedProjectStage.stageTemplateId },
    select: { stageTemplateId: true },
  });

  for (const { stageTemplateId } of dependents) {
    const targetStage = await tx.projectStage.findUnique({
      where: {
        projectId_stageTemplateId: { projectId: approvedProjectStage.projectId, stageTemplateId },
      },
    });
    if (!targetStage || targetStage.status !== 'LOCKED') continue;

    const prerequisites = await tx.stageDependency.findMany({
      where: { stageTemplateId },
      select: { dependsOnTemplateId: true },
    });
    const prerequisiteStages = await tx.projectStage.findMany({
      where: {
        projectId: approvedProjectStage.projectId,
        stageTemplateId: { in: prerequisites.map((p) => p.dependsOnTemplateId) },
      },
    });
    const allApproved =
      prerequisiteStages.length === prerequisites.length &&
      prerequisiteStages.every((s) => s.status === 'APPROVED');
    if (!allApproved) continue;

    await tx.projectStage.update({ where: { id: targetStage.id }, data: { status: 'NOT_STARTED' } });
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
