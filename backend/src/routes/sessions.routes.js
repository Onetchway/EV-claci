'use strict';

const router = require('express').Router();
const ctrl   = require('../controllers/sessions.controller');
const { authenticate } = require('../middleware/auth');
const { authorize }    = require('../middleware/rbac');

router.use(authenticate);

// GET /api/sessions/export/csv - CSV export (must be before /:id)
router.get('/export/csv', ctrl.exportCsv);

// GET /api/sessions - list sessions
router.get('/', ctrl.list);

// POST /api/sessions - create session
router.post('/', authorize('ADMIN', 'OPERATIONS'), ctrl.create);

// GET /api/sessions/:id - session detail
router.get('/:id', ctrl.getOne);

// PATCH /api/sessions/:id/end - end session
router.patch('/:id/end', authorize('ADMIN', 'OPERATIONS'), ctrl.endSession);

module.exports = router;
