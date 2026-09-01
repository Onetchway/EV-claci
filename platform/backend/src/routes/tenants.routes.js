'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/tenants.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

// Public: a tenant CRM instance calls this (unauthenticated, server-to-server)
// to resolve which tenant an inbound Host header belongs to. Returns only
// non-sensitive routing info (id/name/slug/status/deployment_mode).
router.get('/resolve', ctrl.resolveByHost);

router.use(authenticate);

router.get('/', ctrl.list);
router.post('/', requireRole('super_admin'), ctrl.create);
router.get('/:id', ctrl.getOne);
router.put('/:id', requireRole('super_admin'), ctrl.update);
router.patch('/:id/status', requireRole('super_admin'), ctrl.setStatus);
router.post('/:id/rotate-key', requireRole('super_admin'), ctrl.rotateApiKey);
router.delete('/:id', requireRole('super_admin'), ctrl.remove);

module.exports = router;
