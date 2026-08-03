// Import only the S3 client, not the whole SDK — the full `aws-sdk` require
// costs ~22.9 MB RSS vs ~14.2 MB for this path alone.
const S3 = require('aws-sdk/clients/s3');
require('dotenv').config();

// Single shared client for the whole process. s3controller previously built a
// second, identically-configured client; it now imports this one.
// NOTE: secretAccessKey reads SECRET_STR because .env defines that name twice
// and the AWS value wins. Untouched here on purpose — splitting the two
// variables invalidates every issued JWT and is scheduled as Phase 2.3.
const s3 = new S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.SECRET_STR,
  region: process.env.AWS_REGION,
});

// If a full S3 URL is stored instead of just the key, extract the key portion.
const normalizeS3Key = (keyOrUrl) => {
  if (!keyOrUrl) return keyOrUrl;
  try {
    const url = new URL(keyOrUrl);
    // pathname starts with '/', strip the leading slash to get the S3 key
    return url.pathname.replace(/^\//, '');
  } catch {
    // Not a URL — already a plain key
    return keyOrUrl;
  }
};

const getSignedUrl = (key, expiresInSeconds = 300) => {
  if (!key) return null;
  return s3.getSignedUrl('getObject', {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: normalizeS3Key(key),
    Expires: expiresInSeconds,
  });
};

const getSignedUrlPromise = (key, expiresInSeconds = 300) => {
  if (!key) return Promise.resolve(null);
  return s3.getSignedUrlPromise('getObject', {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: normalizeS3Key(key),
    Expires: expiresInSeconds,
  });
};

module.exports = {
  s3,
  getSignedUrl,
  getSignedUrlPromise,
};