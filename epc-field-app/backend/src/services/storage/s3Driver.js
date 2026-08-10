const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuid } = require('uuid');
const env = require('../../config/env');

const client = new S3Client({
  region: 'auto',
  endpoint: env.s3.endpoint,
  credentials: {
    accessKeyId: env.s3.accessKeyId,
    secretAccessKey: env.s3.secretAccessKey,
  },
});

const CONTENT_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.pdf': 'application/pdf',
  '.apk': 'application/vnd.android.package-archive',
};

/** Uploads a buffer to the configured S3-compatible bucket (e.g. Cloudflare R2) and returns its public URL. */
async function saveBuffer(bucket, buffer, extension) {
  const key = `${bucket}/${uuid()}${extension}`;
  await client.send(
    new PutObjectCommand({
      Bucket: env.s3.bucket,
      Key: key,
      Body: buffer,
      ContentType: CONTENT_TYPES[extension] || 'application/octet-stream',
    })
  );
  return { url: `${env.s3.publicBaseUrl}/${key}` };
}

/** Like saveBuffer, but at a caller-chosen filename — overwrites on repeat calls, giving a stable
 * URL across re-uploads (e.g. a "latest" app download link that survives rebuilds). */
async function saveBufferAt(bucket, filename, buffer) {
  const key = `${bucket}/${filename}`;
  const extension = path.extname(filename);
  await client.send(
    new PutObjectCommand({
      Bucket: env.s3.bucket,
      Key: key,
      Body: buffer,
      ContentType: CONTENT_TYPES[extension] || 'application/octet-stream',
    })
  );
  return { url: `${env.s3.publicBaseUrl}/${key}` };
}

module.exports = { saveBuffer, saveBufferAt };
