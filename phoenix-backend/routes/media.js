// routes/media.js
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import express from "express";

const router = express.Router();

function must(name) {
  const v = String(process.env[name] || "").trim();
  if (!v) throw new Error(`ENV_MISSING:${name}`);
  return v;
}

function makeClient() {
  return new S3Client({
    region: String(process.env.PARS_S3_REGION || "us-east-1").trim() || "us-east-1",
    endpoint: must("PARS_S3_ENDPOINT"),
    credentials: {
      accessKeyId: must("PARS_S3_ACCESS_KEY"),
      secretAccessKey: must("PARS_S3_SECRET_KEY"),
    },
    forcePathStyle: true,
  });
}

// GET /api/media/stream?key=media/...
router.get("/stream", async (req, res) => {
  try {
    const key = String(req.query.key || "").trim();
    if (!key) return res.status(400).json({ ok: false, error: "MISSING_KEY" });
    if (!key.startsWith("media/")) {
      return res.status(403).json({ ok: false, error: "KEY_NOT_ALLOWED" });
    }

    const Bucket = must("PARS_S3_BUCKET");
    const s3 = makeClient();

    const out = await s3.send(new GetObjectCommand({ Bucket, Key: key }));

    // content headers
    const ct = String(out.ContentType || "application/octet-stream");
    res.setHeader("Content-Type", ct);
    if (out.ContentLength != null) res.setHeader("Content-Length", String(out.ContentLength));
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "private, max-age=0, no-store");

    // stream body
    out.Body.pipe(res);
  } catch (e) {
    console.error("[media.stream] error:", e?.name, e?.message || e);
    return res.status(500).json({ ok: false, error: "STREAM_FAILED" });
  }
});

export default router;