const router = require('express').Router();
const ctrl   = require('../controllers/revenue.controller');
const { authenticate } = require('../middleware/auth');
const { authorize }    = require('../middleware/rbac');

router.use(authenticate);
router.use(authorize('ADMIN', 'FINANCE'));

router.get('/',              ctrl.list);
router.get('/summary',       ctrl.summary);
router.get('/pl',            ctrl.pnl);
router.get('/export',        ctrl.exportCsv);
router.post('/compute',      ctrl.computeRevenue);
router.get('/:stationId',    ctrl.byStation);

module.exports = router;
