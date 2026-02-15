// services/parsS3.js  (ESM)
// پارس‌پک S3: تولید لینک‌های امضاشده برای استریم (GET) و آپلود (PUT)

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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
    forcePathStyle: true, // پارس‌پک معمولاً path-style می‌خواد
  });
}

// ✅ گرفتن لینک استریم (GET) برای کلید مشخص
export async function presignGet({ key, expiresSec = 3600 }) {
  const Bucket = must("PARS_S3_BUCKET");
  const s3 = makeClient();

  const cmd = new GetObjectCommand({
    Bucket,
    Key: key,
  });

  const url = await getSignedUrl(s3, cmd, { expiresIn: expiresSec });
  return url;
}

// (اختیاری) اگر بعداً خواستی آپلود مستقیم از کلاینت داشته باشی
export async function presignPut({ key, contentType, expiresSec = 900 }) {
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

export default {
  presignGet,
  presignPut,
};