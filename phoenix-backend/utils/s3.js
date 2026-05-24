// utils/s3.js
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const {
  PANAH_S3_ENDPOINT,
  PANAH_S3_REGION,
  PANAH_S3_BUCKET,
  PANAH_S3_ACCESS_KEY,
  PANAH_S3_SECRET_KEY,
  PANAH_S3_SIGNED_URL_EXPIRES,
} = process.env;

if (
  !PANAH_S3_ENDPOINT ||
  !PANAH_S3_REGION ||
  !PANAH_S3_BUCKET ||
  !PANAH_S3_ACCESS_KEY ||
  !PANAH_S3_SECRET_KEY
) {
  console.warn("[PANAH_S3] Missing PANAH S3 environment variables. File storage may not work.");
}

export const s3Bucket = PANAH_S3_BUCKET;

export const s3Client = new S3Client({
  region: PANAH_S3_REGION,
  endpoint: PANAH_S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: PANAH_S3_ACCESS_KEY,
    secretAccessKey: PANAH_S3_SECRET_KEY,
  },
});

export async function uploadBufferToS3({ key, buffer, contentType }) {
  if (!key || !buffer) {
    throw new Error("uploadBufferToS3: key and buffer are required");
  }

  const command = new PutObjectCommand({
    Bucket: PANAH_S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType || "application/octet-stream",
  });

  await s3Client.send(command);

  return {
    bucket: PANAH_S3_BUCKET,
    key,
  };
}

export async function getSignedFileUrl(key) {
  if (!key) {
    throw new Error("getSignedFileUrl: key is required");
  }

  const expiresIn = Number(PANAH_S3_SIGNED_URL_EXPIRES || 300);

  const command = new GetObjectCommand({
    Bucket: PANAH_S3_BUCKET,
    Key: key,
  });

  return getSignedUrl(s3Client, command, {
    expiresIn,
  });
}

export async function getS3ObjectStream(key, range) {
  if (!key) {
    throw new Error("getS3ObjectStream: key is required");
  }

  const command = new GetObjectCommand({
    Bucket: PANAH_S3_BUCKET,
    Key: key,
    ...(range ? { Range: range } : {}),
  });

  return s3Client.send(command);
}
