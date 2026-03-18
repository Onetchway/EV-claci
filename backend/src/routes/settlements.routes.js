'use strict';

const router = require('express').Router();
const ctrl   = require('../controllers/settlements.controller');
const { authenticate } = require('../middleware/auth');
const { authorize }    = require('../middleware/rbac');

router.use(authenticate);

// GET /api/settlements - list
router.get('/', authorize('ADMIN', 'FINANCE'), ctrl.list);

// POST /api/settlements/generate - generate settlement
router.post('/generate', authorize('ADMIN', 'FINANCE'), ctrl.generate);

// GET /api/settlements/:id - detail
router.get('/:id', authorize('ADMIN', 'FINANCE', 'FRANCHISE'), ctrl.getOne);

// PUT /api/settlements/:id/approve
router.put('/:id/approve', authorize('ADMIN', 'FINANCE'), ctrl.approve);

// PUT /api/settlements/:id/mark-paid
router.put('/:id/mark-paid', authorize('ADMIN', 'FINANCE'), ctrl.markPaid);

// GET /api/settlements/:id/report
router.get('/:id/report', authorize('ADMIN', 'FINANCE'), ctrl.getReport);

// GET /api/settlements/:id/export - CSV export
router.get('/:id/export', authorize('ADMIN', 'FINANCE'), ctrl.exportCsv);

// PATCH /api/settlements/:id/status - generic status update
router.patch('/:id/status', authorize('ADMIN', 'FINANCE'), ctrl.updateStatus);

module.exports = router;
