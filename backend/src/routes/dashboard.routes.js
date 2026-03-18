const router = require('express').Router();
const ctrl   = require('../controllers/dashboard.controller');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/admin',     ctrl.admin);
router.get('/station/:stationId', ctrl.station);
router.get('/franchise/:franchiseId', ctrl.franchise);

module.exports = router;
