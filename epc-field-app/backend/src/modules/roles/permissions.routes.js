const express = require('express');
const prisma = require('../../config/prisma');
const { requireAuth } = require('../../middleware/auth');

const router = express.Router();

router.use(requireAuth());

router.get('/', async (req, res) => {
  const permissions = await prisma.permissionDef.findMany({ orderBy: { key: 'asc' } });
  res.json({ permissions });
});

module.exports = router;
