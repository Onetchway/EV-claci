const express = require('express');
const prisma = require('../../config/prisma');
const { requireAuth } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/permissions');
const { PERMISSIONS } = require('../../config/permissions');
const { logAudit } = require('../../services/audit');
const { getResolvedClientConfigs, setClientConfig, clearClientConfig } = require('../../services/config');

const router = express.Router();

router.use(requireAuth());

router.get('/', async (req, res) => {
  const clients = await prisma.client.findMany({ orderBy: { name: 'asc' } });
  res.json({ clients });
});

router.post('/', requirePermission(PERMISSIONS.CLIENTS_MANAGE.key), async (req, res) => {
  const { name, logoUrl } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  const client = await prisma.client.create({ data: { name, logoUrl } });
  await logAudit({ actorId: req.user.id, action: 'client.create', entityType: 'Client', entityId: client.id, after: client });
  res.status(201).json({ client });
});

router.get('/:id', async (req, res) => {
  const client = await prisma.client.findUnique({ where: { id: req.params.id } });
  if (!client) return res.status(404).json({ error: 'Client not found' });
  res.json({ client });
});

router.get('/:id/stage-templates', async (req, res) => {
  const stageTemplates = await prisma.stageTemplate.findMany({
    where: { clientId: req.params.id },
    orderBy: { order: 'asc' },
    include: {
      fieldDefs: { orderBy: { order: 'asc' } },
      photoSlots: { orderBy: { order: 'asc' } },
      dependsOn: { select: { dependsOnTemplateId: true } },
      approvalRule: true,
    },
  });
  res.json({
    stageTemplates: stageTemplates.map(({ dependsOn, approvalRule, ...st }) => ({
      ...st,
      dependsOnTemplateIds: dependsOn.map((d) => d.dependsOnTemplateId),
      approvalRule: {
        requiredApprovals: approvalRule?.requiredApprovals ?? 1,
        eligibleRoleKeys: approvalRule?.eligibleRoleKeys ?? [],
      },
    })),
  });
});

const FIELD_TYPES = ['text', 'number', 'date', 'select', 'checkbox', 'table', 'photo', 'file'];

/**
 * Lets a new client (e.g. one with no seeded stages yet) get its execution playbook — stages,
 * form fields, required photos — defined entirely from the dashboard, exactly like V-Green's are
 * today. Without this, onboarding a client required editing prisma/seed.js and redeploying.
 */
router.post('/:id/stage-templates', requirePermission(PERMISSIONS.CLIENTS_MANAGE.key), async (req, res) => {
  const client = await prisma.client.findUnique({ where: { id: req.params.id } });
  if (!client) return res.status(404).json({ error: 'Client not found' });
  const { key, name, order } = req.body || {};
  if (!key || !name) return res.status(400).json({ error: 'key and name are required' });

  const maxOrder = await prisma.stageTemplate.aggregate({ where: { clientId: client.id }, _max: { order: true } });
  const nextOrder = order !== undefined ? Number(order) : (maxOrder._max.order || 0) + 1;

  let stageTemplate;
  try {
    stageTemplate = await prisma.stageTemplate.create({
      data: { clientId: client.id, key, name, order: nextOrder },
      include: { fieldDefs: true, photoSlots: true },
    });
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: `A stage with key "${key}" already exists for this client` });
    throw err;
  }

  // Backfill this stage onto the client's existing projects too, not just future ones — otherwise
  // a project created before this stage existed would never show it. A freshly created stage has
  // no dependencies yet (those are configured afterward), so NOT_STARTED is always correct here.
  const existingProjects = await prisma.project.findMany({ where: { clientId: client.id }, select: { id: true } });
  if (existingProjects.length > 0) {
    await prisma.projectStage.createMany({
      data: existingProjects.map((p) => ({ projectId: p.id, stageTemplateId: stageTemplate.id, status: 'NOT_STARTED' })),
      skipDuplicates: true,
    });
  }

  await logAudit({
    actorId: req.user.id,
    action: 'stageTemplate.create',
    entityType: 'StageTemplate',
    entityId: stageTemplate.id,
    after: stageTemplate,
  });
  res.status(201).json({
    stageTemplate: { ...stageTemplate, dependsOnTemplateIds: [], approvalRule: { requiredApprovals: 1, eligibleRoleKeys: [] } },
  });
});

router.patch('/:id/stage-templates/:stageTemplateId', requirePermission(PERMISSIONS.CLIENTS_MANAGE.key), async (req, res) => {
  const before = await prisma.stageTemplate.findUnique({ where: { id: req.params.stageTemplateId } });
  if (!before || before.clientId !== req.params.id) {
    return res.status(404).json({ error: 'Stage template not found for this client' });
  }
  const { name, order } = req.body || {};
  const stageTemplate = await prisma.stageTemplate.update({
    where: { id: before.id },
    data: {
      ...(name !== undefined && { name }),
      ...(order !== undefined && { order: Number(order) }),
    },
  });
  await logAudit({
    actorId: req.user.id,
    action: 'stageTemplate.update',
    entityType: 'StageTemplate',
    entityId: stageTemplate.id,
    before,
    after: stageTemplate,
  });
  res.json({ stageTemplate });
});

router.delete('/:id/stage-templates/:stageTemplateId', requirePermission(PERMISSIONS.CLIENTS_MANAGE.key), async (req, res) => {
  const before = await prisma.stageTemplate.findUnique({ where: { id: req.params.stageTemplateId } });
  if (!before || before.clientId !== req.params.id) {
    return res.status(404).json({ error: 'Stage template not found for this client' });
  }
  const inUseCount = await prisma.projectStage.count({ where: { stageTemplateId: before.id } });
  if (inUseCount > 0) {
    return res.status(400).json({
      error: `Cannot delete — ${inUseCount} project(s) already have this stage. Existing project data is never deleted automatically.`,
    });
  }
  await prisma.stageTemplate.delete({ where: { id: before.id } });
  await logAudit({
    actorId: req.user.id,
    action: 'stageTemplate.delete',
    entityType: 'StageTemplate',
    entityId: before.id,
    before,
  });
  res.json({ ok: true });
});

router.post(
  '/:id/stage-templates/:stageTemplateId/fields',
  requirePermission(PERMISSIONS.CLIENTS_MANAGE.key),
  async (req, res) => {
    const template = await prisma.stageTemplate.findUnique({ where: { id: req.params.stageTemplateId } });
    if (!template || template.clientId !== req.params.id) {
      return res.status(404).json({ error: 'Stage template not found for this client' });
    }
    const { key, label, type, required, order, groupLabel, optionsJson } = req.body || {};
    if (!key || !label || !type) return res.status(400).json({ error: 'key, label and type are required' });
    if (!FIELD_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${FIELD_TYPES.join(', ')}` });
    }
    const maxOrder = await prisma.formFieldDef.aggregate({ where: { stageTemplateId: template.id }, _max: { order: true } });
    const nextOrder = order !== undefined ? Number(order) : (maxOrder._max.order || 0) + 1;

    let field;
    try {
      field = await prisma.formFieldDef.create({
        data: {
          stageTemplateId: template.id,
          key,
          label,
          type,
          required: !!required,
          order: nextOrder,
          groupLabel: groupLabel || null,
          optionsJson: optionsJson || null,
        },
      });
    } catch (err) {
      if (err.code === 'P2002') return res.status(400).json({ error: `A field with key "${key}" already exists on this stage` });
      throw err;
    }
    await logAudit({
      actorId: req.user.id,
      action: 'formFieldDef.create',
      entityType: 'FormFieldDef',
      entityId: field.id,
      after: field,
    });
    res.status(201).json({ field });
  },
);

router.patch(
  '/:id/stage-templates/:stageTemplateId/fields/:fieldId',
  requirePermission(PERMISSIONS.CLIENTS_MANAGE.key),
  async (req, res) => {
    const before = await prisma.formFieldDef.findUnique({ where: { id: req.params.fieldId } });
    if (!before || before.stageTemplateId !== req.params.stageTemplateId) {
      return res.status(404).json({ error: 'Field not found on this stage' });
    }
    const { label, required, order, groupLabel, optionsJson } = req.body || {};
    const field = await prisma.formFieldDef.update({
      where: { id: before.id },
      data: {
        ...(label !== undefined && { label }),
        ...(required !== undefined && { required: !!required }),
        ...(order !== undefined && { order: Number(order) }),
        ...(groupLabel !== undefined && { groupLabel: groupLabel || null }),
        ...(optionsJson !== undefined && { optionsJson: optionsJson || null }),
      },
    });
    await logAudit({
      actorId: req.user.id,
      action: 'formFieldDef.update',
      entityType: 'FormFieldDef',
      entityId: field.id,
      before,
      after: field,
    });
    res.json({ field });
  },
);

router.delete(
  '/:id/stage-templates/:stageTemplateId/fields/:fieldId',
  requirePermission(PERMISSIONS.CLIENTS_MANAGE.key),
  async (req, res) => {
    const before = await prisma.formFieldDef.findUnique({ where: { id: req.params.fieldId } });
    if (!before || before.stageTemplateId !== req.params.stageTemplateId) {
      return res.status(404).json({ error: 'Field not found on this stage' });
    }
    await prisma.formFieldDef.delete({ where: { id: before.id } });
    await logAudit({
      actorId: req.user.id,
      action: 'formFieldDef.delete',
      entityType: 'FormFieldDef',
      entityId: before.id,
      before,
    });
    res.json({ ok: true });
  },
);

router.post(
  '/:id/stage-templates/:stageTemplateId/photo-slots',
  requirePermission(PERMISSIONS.CLIENTS_MANAGE.key),
  async (req, res) => {
    const template = await prisma.stageTemplate.findUnique({ where: { id: req.params.stageTemplateId } });
    if (!template || template.clientId !== req.params.id) {
      return res.status(404).json({ error: 'Stage template not found for this client' });
    }
    const { key, label, required, order } = req.body || {};
    if (!key || !label) return res.status(400).json({ error: 'key and label are required' });
    const maxOrder = await prisma.photoSlot.aggregate({ where: { stageTemplateId: template.id }, _max: { order: true } });
    const nextOrder = order !== undefined ? Number(order) : (maxOrder._max.order || 0) + 1;

    let slot;
    try {
      slot = await prisma.photoSlot.create({
        data: { stageTemplateId: template.id, key, label, required: required !== undefined ? !!required : true, order: nextOrder },
      });
    } catch (err) {
      if (err.code === 'P2002') return res.status(400).json({ error: `A photo slot with key "${key}" already exists on this stage` });
      throw err;
    }
    await logAudit({
      actorId: req.user.id,
      action: 'photoSlot.create',
      entityType: 'PhotoSlot',
      entityId: slot.id,
      after: slot,
    });
    res.status(201).json({ slot });
  },
);

router.patch(
  '/:id/stage-templates/:stageTemplateId/photo-slots/:slotId',
  requirePermission(PERMISSIONS.CLIENTS_MANAGE.key),
  async (req, res) => {
    const before = await prisma.photoSlot.findUnique({ where: { id: req.params.slotId } });
    if (!before || before.stageTemplateId !== req.params.stageTemplateId) {
      return res.status(404).json({ error: 'Photo slot not found on this stage' });
    }
    const { label, required, order } = req.body || {};
    const slot = await prisma.photoSlot.update({
      where: { id: before.id },
      data: {
        ...(label !== undefined && { label }),
        ...(required !== undefined && { required: !!required }),
        ...(order !== undefined && { order: Number(order) }),
      },
    });
    await logAudit({
      actorId: req.user.id,
      action: 'photoSlot.update',
      entityType: 'PhotoSlot',
      entityId: slot.id,
      before,
      after: slot,
    });
    res.json({ slot });
  },
);

router.delete(
  '/:id/stage-templates/:stageTemplateId/photo-slots/:slotId',
  requirePermission(PERMISSIONS.CLIENTS_MANAGE.key),
  async (req, res) => {
    const before = await prisma.photoSlot.findUnique({ where: { id: req.params.slotId } });
    if (!before || before.stageTemplateId !== req.params.stageTemplateId) {
      return res.status(404).json({ error: 'Photo slot not found on this stage' });
    }
    const inUseCount = await prisma.photo.count({ where: { photoSlotId: before.id } });
    if (inUseCount > 0) {
      return res.status(400).json({ error: `Cannot delete — ${inUseCount} photo(s) already uploaded to this slot.` });
    }
    await prisma.photoSlot.delete({ where: { id: before.id } });
    await logAudit({
      actorId: req.user.id,
      action: 'photoSlot.delete',
      entityType: 'PhotoSlot',
      entityId: before.id,
      before,
    });
    res.json({ ok: true });
  },
);

router.put(
  '/:id/stage-templates/:stageTemplateId/approval-rule',
  requirePermission(PERMISSIONS.CLIENTS_MANAGE.key),
  async (req, res) => {
    const { id: clientId, stageTemplateId } = req.params;
    const template = await prisma.stageTemplate.findUnique({ where: { id: stageTemplateId } });
    if (!template || template.clientId !== clientId) {
      return res.status(404).json({ error: 'Stage template not found for this client' });
    }

    const { requiredApprovals, eligibleRoleKeys } = req.body || {};
    const requiredNum = Number(requiredApprovals);
    if (!Number.isInteger(requiredNum) || requiredNum < 1) {
      return res.status(400).json({ error: 'requiredApprovals must be a positive integer' });
    }
    if (!Array.isArray(eligibleRoleKeys) || !eligibleRoleKeys.every((k) => typeof k === 'string')) {
      return res.status(400).json({ error: 'eligibleRoleKeys must be an array of role keys' });
    }

    const before = await prisma.approvalRule.findUnique({ where: { stageTemplateId } });
    await prisma.approvalRule.upsert({
      where: { stageTemplateId },
      update: { requiredApprovals: requiredNum, eligibleRoleKeys },
      create: { stageTemplateId, requiredApprovals: requiredNum, eligibleRoleKeys },
    });

    await logAudit({
      actorId: req.user.id,
      action: 'stageTemplate.approvalRule.update',
      entityType: 'StageTemplate',
      entityId: stageTemplateId,
      before: before ? { requiredApprovals: before.requiredApprovals, eligibleRoleKeys: before.eligibleRoleKeys } : null,
      after: { requiredApprovals: requiredNum, eligibleRoleKeys },
    });

    res.json({ ok: true });
  },
);

router.get('/:id/payment-milestones', async (req, res) => {
  const milestones = await prisma.paymentMilestoneDef.findMany({
    where: { clientId: req.params.id },
    orderBy: { order: 'asc' },
  });
  res.json({ milestones });
});

router.post('/:id/payment-milestones', requirePermission(PERMISSIONS.CLIENTS_MANAGE.key), async (req, res) => {
  const client = await prisma.client.findUnique({ where: { id: req.params.id } });
  if (!client) return res.status(404).json({ error: 'Client not found' });
  const { key, label, percent, order, ruleJson } = req.body || {};
  if (!key || !label || percent === undefined || order === undefined || !ruleJson) {
    return res.status(400).json({ error: 'key, label, percent, order and ruleJson are required' });
  }
  const milestone = await prisma.paymentMilestoneDef.create({
    data: { clientId: client.id, key, label, percent: Number(percent), order: Number(order), ruleJson },
  });
  await logAudit({
    actorId: req.user.id,
    action: 'paymentMilestone.create',
    entityType: 'PaymentMilestoneDef',
    entityId: milestone.id,
    after: milestone,
  });
  res.status(201).json({ milestone });
});

router.patch('/:id/payment-milestones/:milestoneId', requirePermission(PERMISSIONS.CLIENTS_MANAGE.key), async (req, res) => {
  const before = await prisma.paymentMilestoneDef.findUnique({ where: { id: req.params.milestoneId } });
  if (!before || before.clientId !== req.params.id) {
    return res.status(404).json({ error: 'Payment milestone not found for this client' });
  }
  const { label, percent, order, ruleJson } = req.body || {};
  const milestone = await prisma.paymentMilestoneDef.update({
    where: { id: before.id },
    data: {
      ...(label !== undefined && { label }),
      ...(percent !== undefined && { percent: Number(percent) }),
      ...(order !== undefined && { order: Number(order) }),
      ...(ruleJson !== undefined && { ruleJson }),
    },
  });
  await logAudit({
    actorId: req.user.id,
    action: 'paymentMilestone.update',
    entityType: 'PaymentMilestoneDef',
    entityId: milestone.id,
    before,
    after: milestone,
  });
  res.json({ milestone });
});

router.delete('/:id/payment-milestones/:milestoneId', requirePermission(PERMISSIONS.CLIENTS_MANAGE.key), async (req, res) => {
  const before = await prisma.paymentMilestoneDef.findUnique({ where: { id: req.params.milestoneId } });
  if (!before || before.clientId !== req.params.id) {
    return res.status(404).json({ error: 'Payment milestone not found for this client' });
  }
  await prisma.paymentMilestoneDef.delete({ where: { id: before.id } });
  await logAudit({
    actorId: req.user.id,
    action: 'paymentMilestone.delete',
    entityType: 'PaymentMilestoneDef',
    entityId: before.id,
    before,
  });
  res.json({ ok: true });
});

/**
 * Returns true if setting `stageTemplateId`'s prerequisites to `newDependsOnIds` would create a
 * cycle anywhere in the client's dependency graph — walks the tentative graph via DFS looking
 * for a path back to the starting node.
 */
async function wouldCreateCycle(clientId, stageTemplateId, newDependsOnIds) {
  const templates = await prisma.stageTemplate.findMany({ where: { clientId }, select: { id: true } });
  const existingDeps = await prisma.stageDependency.findMany({
    where: { stageTemplateId: { in: templates.map((t) => t.id) } },
    select: { stageTemplateId: true, dependsOnTemplateId: true },
  });

  const graph = new Map(templates.map((t) => [t.id, new Set()]));
  for (const dep of existingDeps) {
    if (dep.stageTemplateId === stageTemplateId) continue; // superseded by newDependsOnIds
    graph.get(dep.stageTemplateId)?.add(dep.dependsOnTemplateId);
  }
  graph.set(stageTemplateId, new Set(newDependsOnIds));

  const visiting = new Set();
  const visited = new Set();
  function dfs(node) {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const next of graph.get(node) || []) {
      if (dfs(next)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  }
  return dfs(stageTemplateId);
}

router.put(
  '/:id/stage-templates/:stageTemplateId/dependencies',
  requirePermission(PERMISSIONS.CLIENTS_MANAGE.key),
  async (req, res) => {
    const { id: clientId, stageTemplateId } = req.params;
    const template = await prisma.stageTemplate.findUnique({ where: { id: stageTemplateId } });
    if (!template || template.clientId !== clientId) {
      return res.status(404).json({ error: 'Stage template not found for this client' });
    }

    const { dependsOnTemplateIds } = req.body || {};
    if (!Array.isArray(dependsOnTemplateIds)) {
      return res.status(400).json({ error: 'dependsOnTemplateIds must be an array' });
    }
    const uniqueIds = [...new Set(dependsOnTemplateIds)];
    if (uniqueIds.includes(stageTemplateId)) {
      return res.status(400).json({ error: 'A stage cannot depend on itself' });
    }
    if (uniqueIds.length > 0) {
      const validCount = await prisma.stageTemplate.count({ where: { id: { in: uniqueIds }, clientId } });
      if (validCount !== uniqueIds.length) {
        return res.status(400).json({ error: 'One or more dependsOnTemplateIds are invalid for this client' });
      }
    }
    if (await wouldCreateCycle(clientId, stageTemplateId, uniqueIds)) {
      return res.status(400).json({ error: 'This dependency set would create a cycle' });
    }

    const before = await prisma.stageDependency.findMany({
      where: { stageTemplateId },
      select: { dependsOnTemplateId: true },
    });

    await prisma.$transaction([
      prisma.stageDependency.deleteMany({ where: { stageTemplateId } }),
      ...(uniqueIds.length > 0
        ? [
            prisma.stageDependency.createMany({
              data: uniqueIds.map((dependsOnTemplateId) => ({ stageTemplateId, dependsOnTemplateId })),
            }),
          ]
        : []),
    ]);

    await logAudit({
      actorId: req.user.id,
      action: 'stageTemplate.dependencies.update',
      entityType: 'StageTemplate',
      entityId: stageTemplateId,
      before: { dependsOnTemplateIds: before.map((b) => b.dependsOnTemplateId) },
      after: { dependsOnTemplateIds: uniqueIds },
    });

    res.json({ ok: true });
  },
);

router.get('/:id/config', async (req, res) => {
  const client = await prisma.client.findUnique({ where: { id: req.params.id } });
  if (!client) return res.status(404).json({ error: 'Client not found' });
  const configs = await getResolvedClientConfigs(client.id);
  res.json({ configs });
});

router.put('/:id/config/:key', requirePermission(PERMISSIONS.CLIENTS_MANAGE.key), async (req, res) => {
  const client = await prisma.client.findUnique({ where: { id: req.params.id } });
  if (!client) return res.status(404).json({ error: 'Client not found' });
  const { value } = req.body || {};
  try {
    await setClientConfig(client.id, req.params.key, value);
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }
  await logAudit({
    actorId: req.user.id,
    action: 'client.config.set',
    entityType: 'Client',
    entityId: client.id,
    after: { key: req.params.key, value },
  });
  res.json({ ok: true });
});

router.delete('/:id/config/:key', requirePermission(PERMISSIONS.CLIENTS_MANAGE.key), async (req, res) => {
  const client = await prisma.client.findUnique({ where: { id: req.params.id } });
  if (!client) return res.status(404).json({ error: 'Client not found' });
  try {
    await clearClientConfig(client.id, req.params.key);
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }
  await logAudit({
    actorId: req.user.id,
    action: 'client.config.clear',
    entityType: 'Client',
    entityId: client.id,
    after: { key: req.params.key },
  });
  res.json({ ok: true });
});

module.exports = router;
