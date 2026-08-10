const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');
const env = require('../../config/env');

const ROOT = path.resolve(env.storageRoot);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/** Saves a buffer under storage/<bucket>/<filename> on local disk, served via the /files route. */
async function saveBuffer(bucket, buffer, extension) {
  const dir = path.join(ROOT, bucket);
  ensureDir(dir);
  const filename = `${uuid()}${extension}`;
  fs.writeFileSync(path.join(dir, filename), buffer);
  return { url: `${env.publicBaseUrl}/files/${bucket}/${filename}` };
}

module.exports = { saveBuffer };
