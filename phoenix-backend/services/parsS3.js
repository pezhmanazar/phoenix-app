// services/parsS3.js
const { S3Client } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");

function must(name) {
  const v = String(process.env[name] || "").trim();
  if (!v) throw new Error(`ENV_MISSING:${name}`);
  return v;
}

function makeClient() {
  const endpoint = must("PARS_S3_ENDPOINT");
  const region = String(process.env.PARS_S3_REGION || "us-east-1").trim() || "us-east-1";
  const accessKeyId = must("PARS_S3_ACCESS_KEY");
  const secretAccessKey = must("PARS_S3_SECRET_KEY");

  return new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true, // پارس‌پک معمولا path-style می‌خواد
  });
}

// ✅ گرفتن لینک استریم (GET) برای کلید مشخص
async function presignGet({ key, expiresSec = 3600 }) {
  const Bucket = must("PARS_S3_BUCKET");
  const s3 = makeClient();

  const cmd = new GetObjectCommand({
    Bucket,
    Key: key,
    // برای استریم بهتره cache-control رو از سمت CDN/Origin تنظیم کنی، اینجا لازم نیست
  });

  const url = await getSignedUrl(s3, cmd, { expiresIn: expiresSec });
  return url;
}

// (اختیاری) اگر بعدا خواستی آپلود مستقیم از کلاینت داشته باشی
async function presignPut({ key, contentType, expiresSec = 900 }) {
  const Bucket = must("PARS_S3_BUCKET");
  const s3 = makeClient();

  const cmd = new PutObjectCommand({
    Bucket,
    Key: key,
    ContentType: contentType || "application/octet-stream",
  });

  const url = await getSignedUrl(s3, cmd, { expiresIn: expiresSec });
  return url;
}

module.exports = {
  presignGet,
  presignPut,
};