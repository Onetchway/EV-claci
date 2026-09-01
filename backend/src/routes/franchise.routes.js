'use strict';

const router  = require('express').Router();
const ctrl    = require('../controllers/franchise.controller');
const portal  = require('../controllers/franchisePortal.controller');
const { authenticate } = require('../middleware/auth');
const { authorize }    = require('../middleware/rbac');
const { upload }       = require('../utils/upload');

router.use(authenticate);

// The franchise partner's own portal: a "franchise"-role user's own data,
// no :id param needed (and no way to pass someone else's) — resolved from
// req.user.franchise_id server-side. Mirrors crm/src/app/portal/[leadId]/
// page.tsx's sections (Livanto's franchise/investor portal): stage,
// documents, payments, bank details, support.
router.get('/portal/dashboard',        ctrl.portalDashboard);
router.get('/portal/documents',        portal.listOwnDocuments);
router.post('/portal/documents',       upload.single('file'), portal.uploadOwnDocument);
router.get('/portal/payments',         portal.listOwnPayments);
router.get('/portal/bank-details',     portal.getOwnBankDetails);
router.put('/portal/bank-details',     portal.saveOwnBankDetails);
router.get('/portal/support',          portal.listOwnSupportRequests);
router.post('/portal/support',         portal.createOwnSupportRequest);
router.get('/documents/:id/download',  portal.downloadDocument);

router.get('/',              authorize('ADMIN', 'FINANCE'), ctrl.list);
router.post('/',             authorize('ADMIN'), ctrl.create);
router.get('/:id/dashboard', ctrl.franchiseDashboard);
router.get('/:id',           ctrl.getOne);
router.put('/:id',           authorize('ADMIN'), ctrl.update);
router.delete('/:id',        authorize('ADMIN'), ctrl.remove);

// Admin-side management of a specific franchise's stage/payments — the
// franchise partner only ever sees these through the read-only portal/*
// routes above.
router.put('/:id/stage',              authorize('ADMIN'), portal.setStage);
router.get('/:id/payments',           authorize('ADMIN', 'FINANCE'), portal.listFranchisePayments);
router.post('/:id/payments',          authorize('ADMIN', 'FINANCE'), portal.createPayment);
router.put('/:id/payments/:paymentId/paid', authorize('ADMIN', 'FINANCE'), portal.markPaymentPaid);

module.exports = router;
