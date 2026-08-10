const crypto = require('crypto');
const path = require('path');
const { execFile } = require('child_process');
const express = require('express');
const env = require('../../config/env');
const { saveBufferAt } = require('../../services/storage');

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

// Mirrors a file (e.g. an EAS build artifact, which expires after 30 days) into permanent
// storage at a stable filename, so re-running this after a rebuild keeps the same download URL.
// Gated by the same SEED_SECRET as /seed — this is an admin bootstrap action, not a general
// upload API, so the bucket is fixed and the filename is sanitized to prevent path traversal.
router.post('/mirror-download', express.json(), async (req, res) => {
  const provided = req.headers['x-seed-secret'];
  if (!env.seedSecret || !provided || !timingSafeEqual(provided, env.seedSecret)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { sourceUrl, filename } = req.body || {};
  if (!sourceUrl || !filename) {
    return res.status(400).json({ error: 'sourceUrl and filename are required' });
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
    return res.status(400).json({ error: 'filename may only contain letters, numbers, dots, dashes and underscores' });
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(sourceUrl);
  } catch {
    return res.status(400).json({ error: 'sourceUrl is not a valid URL' });
  }
  if (parsedUrl.protocol !== 'https:') {
    return res.status(400).json({ error: 'sourceUrl must be https' });
  }

  try {
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      return res.status(502).json({ error: `Fetching sourceUrl failed: ${response.status}` });
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const { url } = await saveBufferAt('downloads', filename, buffer);
    res.json({ ok: true, url, bytes: buffer.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
