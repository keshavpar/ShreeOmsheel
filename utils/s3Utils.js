
const s3 = new AWS.S3();
const AWS = require('aws-sdk');
require('dotenv').config();

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});


const getSignedUrl = (key, expiresInSeconds = 300) => {
  if (!key) return null; // handle empty keys gracefully
  return s3.getSignedUrl('getObject', {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: key,
    Expires: expiresInSeconds,
  });
};

const getSignedUrlPromise = (key, expiresInSeconds = 300) => {
  if (!key) return Promise.resolve(null);
  return s3.getSignedUrlPromise('getObject', {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: key,
    Expires: expiresInSeconds,
  });
};

module.exports = {
  getSignedUrl,
  getSignedUrlPromise,
};
