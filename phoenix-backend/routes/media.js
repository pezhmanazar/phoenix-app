import express from "express";
import { presignGet } from "../services/parsS3.js";

const router = express.Router();

// GET /api/media/presign-get?key=...
router.get("/presign-get", async (req, res) => {
  try {
    const key = String(req.query.key || "").trim();
    if (!key) return res.status(400).json({ ok: false, error: "MISSING_KEY" });

    // امنیت پایه: فقط داخل پوشه media/ اجازه بده (اگه می‌خوای آزادترش کنی بگو)
    if (!key.startsWith("media/")) {
      return res.status(403).json({ ok: false, error: "KEY_NOT_ALLOWED" });
    }

    const url = await presignGet({ key, expiresSec: 60 * 60 }); // 1h
    return res.json({ ok: true, url });
  } catch (e) {
    console.error("[media.presign-get] error:", e?.message || e);
    return res.status(500).json({ ok: false, error: "PRESIGN_FAILED" });
  }
});

export default router;