// Reuses the single shared S3 client from utils/s3Utils rather than building a
// second, identically-configured one and pulling in the full aws-sdk again.
const { s3 } = require('../utils/s3Utils');

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
