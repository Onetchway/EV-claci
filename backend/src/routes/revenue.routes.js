'use strict';

const router = require('express').Router();
const ctrl   = require('../controllers/revenue.controller');
const { authenticate } = require('../middleware/auth');
const { authorize }    = require('../middleware/rbac');

router.use(authenticate);

// GET /api/revenue - list with filters
router.get('/', ctrl.list);

// GET /api/revenue/summary - aggregated totals
router.get('/summary', ctrl.summary);

// GET /api/revenue/export/csv - CSV export
router.get('/export/csv', ctrl.exportCsv);

// GET /api/revenue/station/:stationId/pnl - full P&L for station
router.get('/station/:stationId/pnl', ctrl.pnl);

// GET /api/revenue/station/:stationId - revenue by station
router.get('/station/:stationId', ctrl.byStation);

// POST /api/revenue/compute - recompute daily revenue for a station
router.post('/compute', authorize('ADMIN', 'FINANCE'), ctrl.computeRevenue);

module.exports = router;
