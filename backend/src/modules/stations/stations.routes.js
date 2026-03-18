'use strict';

const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/role');
const {
  listStations,
  getStation,
  createStation,
  updateStation,
  deleteStation,
  getStationSummary,
} = require('./stations.controller');

// All routes require authentication
router.use(authenticate);

// GET /api/stations - list with filters & pagination
router.get('/', listStations);

// GET /api/stations/:id - single station with asset/charger/bss counts
router.get('/:id', getStation);

// GET /api/stations/:id/summary - P&L summary for date range
router.get('/:id/summary', getStationSummary);

// POST /api/stations - create station (admin, operations)
router.post('/', requireRole('admin', 'operations'), createStation);

// PUT /api/stations/:id - update station (admin, operations)
router.put('/:id', requireRole('admin', 'operations'), updateStation);

// DELETE /api/stations/:id - delete station (admin only)
router.delete('/:id', requireRole('admin'), deleteStation);

module.exports = router;
