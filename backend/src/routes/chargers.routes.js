'use strict';

const router = require('express').Router();
const ctrl   = require('../controllers/chargers.controller');
const { authenticate } = require('../middleware/auth');
const { authorize }    = require('../middleware/rbac');

router.use(authenticate);

router.get('/',                    ctrl.list);
router.post('/',                   authorize('ADMIN', 'OPERATIONS'), ctrl.create);
router.get('/:id',                 ctrl.getOne);
router.put('/:id',                 authorize('ADMIN', 'OPERATIONS'), ctrl.update);
router.delete('/:id',              authorize('ADMIN'), ctrl.remove);

// OCPP mock endpoints
router.post('/:id/heartbeat',      ctrl.heartbeat);
router.post('/:id/start-session',  authorize('ADMIN', 'OPERATIONS'), ctrl.remoteStart);
router.post('/:id/stop-session',   authorize('ADMIN', 'OPERATIONS'), ctrl.remoteStop);
router.patch('/:id/status',        authorize('ADMIN', 'OPERATIONS'), ctrl.updateStatus);

// Also keep old remote-start/remote-stop for backwards compat
router.post('/:id/remote-start',   authorize('ADMIN', 'OPERATIONS'), ctrl.remoteStart);
router.post('/:id/remote-stop',    authorize('ADMIN', 'OPERATIONS'), ctrl.remoteStop);

// Sessions for charger
router.get('/:id/sessions', async (req, res, next) => {
  try {
    const { query } = require('../config/database');
    const { page = 1, limit = 20 } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const countRes = await query(
      'SELECT COUNT(*) FROM charging_sessions WHERE charger_id = $1',
      [req.params.id]
    );
    const total = parseInt(countRes.rows[0].count, 10);
    const dataRes = await query(
      `SELECT cs.*, s.name AS station_name FROM charging_sessions cs
       LEFT JOIN stations s ON s.id = cs.station_id
       WHERE cs.charger_id = $1
       ORDER BY cs.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.params.id, parseInt(limit), offset]
    );
    res.json({
      success: true,
      data: dataRes.rows,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) },
      message: 'Charger sessions retrieved successfully',
    });
  } catch (e) { next(e); }
});

module.exports = router;
