const router = require('express').Router();
const ctrl   = require('../controllers/settlements.controller');
const { authenticate } = require('../middleware/auth');
const { authorize }    = require('../middleware/rbac');

router.use(authenticate);

router.get('/',          authorize('ADMIN', 'FINANCE'), ctrl.list);
router.post('/generate', authorize('ADMIN', 'FINANCE'), ctrl.generate);
router.get('/:id',       authorize('ADMIN', 'FINANCE', 'FRANCHISE'), ctrl.getOne);
router.patch('/:id/status', authorize('ADMIN', 'FINANCE'), ctrl.updateStatus);
router.get('/:id/export',   authorize('ADMIN', 'FINANCE'), ctrl.exportCsv);

module.exports = router;
