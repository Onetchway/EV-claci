const express = require('express');
const prisma = require('../../config/prisma');
const { requireAuth } = require('../../middleware/auth');

const router = express.Router();

router.use(requireAuth());

// Any authenticated user can list config defs — needed to render client/project config editors,
// and it's just metadata (labels/types/defaults), not sensitive.
router.get('/', async (req, res) => {
  const configDefs = await prisma.configDef.findMany({ orderBy: { key: 'asc' } });
  res.json({ configDefs });
});

module.exports = router;
