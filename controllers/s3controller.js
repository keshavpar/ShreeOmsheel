const AWS = require('aws-sdk');
require('dotenv').config();

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.SECRET_STR,
  region: process.env.AWS_REGION
});

exports.getSignedUrlForAadhaar = async (req, res) => {
  const { fileName, fileType } = req.body;

  if (!fileName || !fileType) {
    return res.status(400).json({ error: 'Missing fileName or fileType' });
  }

  const bucket = process.env.AWS_S3_BUCKET_NAME;
  if (!bucket) {
    console.error('Missing AWS_S3_BUCKET in env');
    return res.status(500).json({ error: 'Missing bucket name' });
  }

  const params = {
    Bucket: bucket,
    Key: fileName,
    ContentType: fileType,
    Expires: 300
  };

  const getParams = {
    Bucket: bucket,
    Key: fileName,
    Expires: 300
  };

  try {
    const uploadUrl = await s3.getSignedUrlPromise('putObject', params);
    const signedGetUrl = await s3.getSignedUrlPromise('getObject', getParams);

    return res.status(200).json({
      status: 'success',
      uploadUrl,
      fileUrl: signedGetUrl
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to generate signed URL' });
  }
};
