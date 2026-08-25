'use strict';

const router = require('express').Router();
const ctrl   = require('../../controllers/nakjm/documents.controller');
const { authenticate } = require('../../middleware/auth');
const { authorize }    = require('../../middleware/rbac');
const { upload }       = require('../../utils/upload');

router.use(authenticate);

router.get('/',              authorize('ADMIN', 'OPERATIONS', 'FINANCE'), ctrl.list);
router.post('/',             authorize('ADMIN', 'OPERATIONS', 'FINANCE'), upload.single('file'), ctrl.upload);
router.get('/:id/download',  authorize('ADMIN', 'OPERATIONS', 'FINANCE'), ctrl.download);
router.delete('/:id',        authorize('ADMIN', 'OPERATIONS'), ctrl.remove);

// BOQ Excel import — parse only, returns items for review before saving via POST /nakjm/boq
router.post('/parse-boq', authorize('ADMIN', 'OPERATIONS'), upload.single('file'), ctrl.parseBoq);

module.exports = router;
