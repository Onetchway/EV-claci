const router = require('express').Router();
const ctrl   = require('../controllers/sessions.controller');
const { authenticate } = require('../middleware/auth');
const { authorize }    = require('../middleware/rbac');

router.use(authenticate);

router.get('/',         ctrl.list);
router.post('/',        authorize('ADMIN', 'OPERATIONS'), ctrl.create);
router.get('/:id',      ctrl.getOne);
router.patch('/:id/end', authorize('ADMIN', 'OPERATIONS'), ctrl.endSession);

module.exports = router;
