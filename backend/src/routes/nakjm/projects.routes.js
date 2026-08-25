'use strict';

const router = require('express').Router();
const ctrl     = require('../../controllers/nakjm/projects.controller');
const teamCtrl = require('../../controllers/nakjm/team.controller');
const { authenticate } = require('../../middleware/auth');
const { authorize }    = require('../../middleware/rbac');

router.use(authenticate);

router.get('/',                 authorize('ADMIN', 'OPERATIONS', 'FINANCE'), ctrl.list);
router.post('/',                authorize('ADMIN', 'OPERATIONS'), ctrl.create);
router.get('/:id',              authorize('ADMIN', 'OPERATIONS', 'FINANCE'), ctrl.getOne);
router.put('/:id',              authorize('ADMIN', 'OPERATIONS'), ctrl.update);
router.delete('/:id',           authorize('ADMIN'), ctrl.remove);
router.get('/:id/analytics',    authorize('ADMIN', 'OPERATIONS', 'FINANCE'), ctrl.analytics);

// Project <-> team assignment
router.get('/:projectId/team',                          authorize('ADMIN', 'OPERATIONS', 'FINANCE'), teamCtrl.listByProject);
router.post('/:projectId/team',                          authorize('ADMIN', 'OPERATIONS'), teamCtrl.assignToProject);
router.delete('/:projectId/team/:teamMemberId',          authorize('ADMIN', 'OPERATIONS'), teamCtrl.unassignFromProject);

module.exports = router;
