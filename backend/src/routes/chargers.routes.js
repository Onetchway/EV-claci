const router = require('express').Router();
const ctrl   = require('../controllers/chargers.controller');
const { authenticate } = require('../middleware/auth');
const { authorize }    = require('../middleware/rbac');

router.use(authenticate);

router.get('/',                   ctrl.list);
router.post('/',                  authorize('ADMIN', 'OPERATIONS'), ctrl.create);
router.get('/:id',                ctrl.getOne);
router.put('/:id',                authorize('ADMIN', 'OPERATIONS'), ctrl.update);
router.delete('/:id',             authorize('ADMIN'), ctrl.remove);
// OCPP mock
router.post('/:id/heartbeat',     ctrl.heartbeat);
router.post('/:id/remote-start',  authorize('ADMIN', 'OPERATIONS'), ctrl.remoteStart);
router.post('/:id/remote-stop',   authorize('ADMIN', 'OPERATIONS'), ctrl.remoteStop);
router.patch('/:id/status',       authorize('ADMIN', 'OPERATIONS'), ctrl.updateStatus);

module.exports = router;
