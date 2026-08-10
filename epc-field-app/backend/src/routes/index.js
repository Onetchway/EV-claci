const express = require('express');

const authRoutes = require('../modules/auth/auth.routes');
const usersRoutes = require('../modules/users/users.routes');
const clientsRoutes = require('../modules/clients/clients.routes');
const projectsRoutes = require('../modules/projects/projects.routes');
const stagesRoutes = require('../modules/stages/stages.routes');
const submissionsRoutes = require('../modules/submissions/submissions.routes');
const adminRoutes = require('../modules/admin/admin.routes');

const router = express.Router();

router.get('/health', (req, res) => res.json({ ok: true }));

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/users', usersRoutes);
router.use('/clients', clientsRoutes);
router.use('/projects', projectsRoutes);
router.use('/project-stages', stagesRoutes);
// submissionsRoutes defines both /project-stages/:stageId/submissions and /submissions/* and is
// mounted at '/' with its own unconditional requireAuth() — must come after any route (like
// /admin) that needs to handle requests without a bearer token, or it'll swallow them first.
router.use('/', submissionsRoutes);

module.exports = router;
