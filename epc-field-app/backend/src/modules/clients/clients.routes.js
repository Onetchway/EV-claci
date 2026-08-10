const express = require('express');
const prisma = require('../../config/prisma');
const { requireAuth } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/permissions');
const { PERMISSIONS } = require('../../config/permissions');
const { logAudit } = require('../../services/audit');

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
    },
  });
  res.json({ stageTemplates });
});

module.exports = router;
