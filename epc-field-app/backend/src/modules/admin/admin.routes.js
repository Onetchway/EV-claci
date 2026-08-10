const crypto = require('crypto');
const path = require('path');
const { execFile } = require('child_process');
const express = require('express');
const env = require('../../config/env');

const router = express.Router();

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Bootstrap endpoint for running prisma/seed.js on hosts with no shell access (e.g. Render's
// free plan). Only active when SEED_SECRET is set; prisma/seed.js is itself idempotent (skips
// anything already seeded), so this is safe to call more than once.
router.post('/seed', (req, res) => {
  const provided = req.headers['x-seed-secret'];
  if (!env.seedSecret || !provided || !timingSafeEqual(provided, env.seedSecret)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const seedScript = path.join(__dirname, '../../../prisma/seed.js');
  execFile('node', [seedScript], { timeout: 60000 }, (err, stdout, stderr) => {
    if (err) {
      return res.status(500).json({ error: stderr || err.message, stdout });
    }
    res.json({ ok: true, output: stdout });
  });
});

module.exports = router;
