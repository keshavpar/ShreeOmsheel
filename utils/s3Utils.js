const AWS = require('aws-sdk');
require('dotenv').config();

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,   // FIXED NAME
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY, // FIXED NAME
  region: process.env.AWS_REGION
});

// ✅ For GET signed URL (used in your controller)
const getSignedUrlPromise = async (key, expiresInSeconds = 300) => {
  if (!key) return null;

  return s3.getSignedUrlPromise('getObject', {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: key,
    Expires: expiresInSeconds,
  });
};

// ✅ For upload + preview (your Aadhaar use case)
const getSignedUrlForAadhaar = async (req, res) => {
  const { fileName, fileType } = req.body;

  if (!fileName || !fileType) {
    return res.status(400).json({ error: 'Missing fileName or fileType' });
  }

  const bucket = process.env.AWS_S3_BUCKET_NAME;

  try {
    const uploadUrl = await s3.getSignedUrlPromise('putObject', {
      Bucket: bucket,
      Key: fileName,
      ContentType: fileType,
      Expires: 300
    });

    const fileUrl = await s3.getSignedUrlPromise('getObject', {
      Bucket: bucket,
      Key: fileName,
      Expires: 300
    });

    return res.status(200).json({
      status: 'success',
      uploadUrl,
      fileUrl
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to generate signed URL' });
  }
};

module.exports = {
  getSignedUrlPromise,
  getSignedUrlForAadhaar
};