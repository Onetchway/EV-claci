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
 * Evaluates one PaymentMilestoneDef.ruleJson against this project's stage statuses.
 * `achievedByKey` holds already-evaluated milestones in `order` so a rule can require another
 * milestone (e.g. warranty end requires go-live) without re-deriving it.
 */
function evaluateMilestoneRule(rule, stagesByKey, achievedByKey) {
  if (rule.type === 'statusIn') {
    return rule.stageKeys.every((key) => rule.statuses.includes(stagesByKey.get(key)?.status));
  }
  if (rule.type === 'daysAfterStageApproval') {
    if (rule.requiresMilestoneKey && !achievedByKey.get(rule.requiresMilestoneKey)) return false;
    const stage = stagesByKey.get(rule.stageKey);
    if (stage?.status !== 'APPROVED' || !stage.approvedAt) return false;
    return new Date(stage.approvedAt).getTime() + rule.days * 24 * 60 * 60 * 1000 <= Date.now();
  }
  return false;
}

/**
 * Computes a client's payment milestone tracker from its PaymentMilestoneDef rows and this
 * project's stage statuses — fully data-driven so each client's milestone structure (V-Green's
 * 30/10/30/25/5% Playbook §12 split, or any other client's) lives in config, not code.
 * stagesByKey: Map<stageTemplateKey, ProjectStage>
 */
async function computePaymentMilestones(clientId, stagesByKey) {
  const defs = await prisma.paymentMilestoneDef.findMany({
    where: { clientId },
    orderBy: { order: 'asc' },
  });
  const achievedByKey = new Map();
  const results = [];
  for (const def of defs) {
    const achieved = evaluateMilestoneRule(def.ruleJson, stagesByKey, achievedByKey);
    achievedByKey.set(def.key, achieved);
    results.push({ key: def.key, label: def.label, percent: def.percent, achieved });
  }
  return results;
}

module.exports = { createProjectStages, unlockNextStage, computePaymentMilestones };
