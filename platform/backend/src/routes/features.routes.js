'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/features.controller');
const { authenticate } = require('../middleware/auth');
const { authenticateTenant } = require('../middleware/tenantAuth');
const { requireRole } = require('../middleware/role');

// Tenant-authenticated: a tenant's own CRM instance asks which features it
// has enabled (see e.g. crm/src/lib/platform-features.ts). Same boundary
// as usage-reporting — the tenant's own API key, nothing a super admin
// session can use to reach into a tenant.
router.get('/me', authenticateTenant, ctrl.listForSelf);

router.use(authenticate);

router.get('/catalog', ctrl.listCatalog);
router.get('/tenants/:tenantId', ctrl.listForTenant);
router.put('/tenants/:tenantId', requireRole('super_admin'), ctrl.bulkSetForTenant);
router.put('/tenants/:tenantId/:featureKey', requireRole('super_admin'), ctrl.setForTenant);

module.exports = router;
