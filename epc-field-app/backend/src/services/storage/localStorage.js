const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');
const env = require('../../config/env');

const ROOT = path.resolve(env.storageRoot);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Saves a buffer under storage/<bucket>/<filename> and returns both the absolute
 * filesystem path (for further processing) and a public URL path (for serving via /files).
 */
function saveBuffer(bucket, buffer, extension) {
  const dir = path.join(ROOT, bucket);
  ensureDir(dir);
  const filename = `${uuid()}${extension}`;
  const absolutePath = path.join(dir, filename);
  fs.writeFileSync(absolutePath, buffer);
  const publicPath = `/files/${bucket}/${filename}`;
  return { absolutePath, publicPath, url: `${env.publicBaseUrl}${publicPath}` };
}

function absolutePathForBucketFile(bucket, filename) {
  return path.join(ROOT, bucket, filename);
}

module.exports = { ROOT, saveBuffer, absolutePathForBucketFile, ensureDir };
