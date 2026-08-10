const env = require('../../config/env');

// Picks the storage backend at require-time based on STORAGE_DRIVER: 'local' (disk, needs a
// persistent volume) or 's3' (any S3-compatible bucket, e.g. Cloudflare R2 — used when running
// without a persistent disk, such as Render's free web service plan).
module.exports = env.storageDriver === 's3' ? require('./s3Driver') : require('./localDriver');
