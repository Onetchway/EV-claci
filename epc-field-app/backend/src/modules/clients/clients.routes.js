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
    },
  });
  res.json({
    stageTemplates: stageTemplates.map(({ dependsOn, ...st }) => ({
      ...st,
      dependsOnTemplateIds: dependsOn.map((d) => d.dependsOnTemplateId),
    })),
  });
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
