const { S3Client: R2Client } = require('@aws-sdk/client-s3');
const { Upload }             = require('@aws-sdk/lib-storage');

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
 * Uploads a Buffer to R2 and returns a public Worker URL.
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

  // Return the public Worker-based URL
  return `https://r2-list-and-serve.sumanths947.workers.dev/${key}`;
}

module.exports = { uploadToR2 };
