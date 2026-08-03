// Import only the S3 client, not the whole SDK — the full `aws-sdk` require
// costs ~22.9 MB RSS vs ~14.2 MB for this path alone.
const S3 = require('aws-sdk/clients/s3');
require('dotenv').config();

// Single shared client for the whole process. s3controller previously built a
// second, identically-configured client; it now imports this one.
//
// ── Credential decoupling ───────────────────────────────────────────────────
// .env currently defines SECRET_STR twice: once as the JWT signing secret and
// again, further down, as the AWS secret access key. dotenv keeps the last
// value, so the AWS key silently wins and JWTs are signed with it. The two
// concerns are entangled: rotating either one breaks the other.
//
// This reads AWS_SECRET_ACCESS_KEY first and only falls back to SECRET_STR, so
// the untangling can happen without a code change and without a single
// deployment that logs everybody out:
//
//   1. Deploy this. Nothing changes — the fallback preserves today's behaviour.
//   2. Add AWS_SECRET_ACCESS_KEY=<current AWS key> to .env and restart. S3 now
//      has its own variable; still no user impact.
//   3. Rotate the AWS key in IAM and update AWS_SECRET_ACCESS_KEY. No JWT impact.
//   4. Separately, whenever a logout-everyone window is acceptable, replace
//      SECRET_STR with a fresh JWT-only secret and delete the duplicate line.
//
// Step 4 is the only one with user-visible impact, and it is now independent
// of the AWS rotation rather than forced to happen at the same moment.
const awsSecret = process.env.AWS_SECRET_ACCESS_KEY || process.env.SECRET_STR;

if (!process.env.AWS_SECRET_ACCESS_KEY) {
  console.warn(
    '[s3] AWS_SECRET_ACCESS_KEY is not set; falling back to SECRET_STR. ' +
    'Set AWS_SECRET_ACCESS_KEY so the AWS key and the JWT secret can be rotated independently.'
  );
}

const s3 = new S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: awsSecret,
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