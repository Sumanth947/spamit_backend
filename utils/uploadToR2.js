// backend/utils/uploadToR2.js

const { S3Client: R2Client } = require('@aws-sdk/client-s3');
const { Upload }             = require('@aws-sdk/lib-storage');

// R2 “S3-compatible” client
const r2 = new R2Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

/**
 * Uploads a Buffer directly to R2 (multipart if >5MB).
 */
async function uploadToR2(buffer, key, contentType) {
  const uploader = new Upload({
    client: r2,
    params: {
      Bucket:      process.env.R2_BUCKET_NAME,
      Key:         key,
      Body:        buffer,
      ContentType: contentType,
    },
    queueSize: 4,
    partSize:  5 * 1024 * 1024,
  });

  await uploader.done();
  return `https://r2-list-and-serve.sumanths947.workers.dev/${key}`;

}

module.exports = { uploadToR2 };
