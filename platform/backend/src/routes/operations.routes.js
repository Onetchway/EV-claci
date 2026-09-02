'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/operations.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

router.use(authenticate);

router.get('/audit', ctrl.listAudit);

router.get('/notifications', ctrl.listNotifications);
router.patch('/notifications/:id/read', ctrl.markNotificationRead);
router.patch('/notifications/read-all', ctrl.markAllNotificationsRead);

router.get('/jobs', ctrl.listJobs);
router.get('/jobs/:name/history', ctrl.jobHistory);
router.post('/jobs/:name/run', requireRole('super_admin'), ctrl.runJob);

router.get('/health', ctrl.systemHealth);

router.get('/tenants/:tenantId/health', ctrl.tenantHealth);
router.get('/tenants/:tenantId/support-sessions', ctrl.listSupportSessions);
router.post('/tenants/:tenantId/support-sessions', requireRole('super_admin', 'support'), ctrl.startSupportSession);
router.patch('/support-sessions/:id/end', requireRole('super_admin', 'support'), ctrl.endSupportSession);

module.exports = router;
