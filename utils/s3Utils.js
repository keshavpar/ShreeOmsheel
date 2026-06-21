const AWS = require('aws-sdk');
require('dotenv').config();

const s3 = new AWS.S3({
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
  getSignedUrl,
  getSignedUrlPromise,
};