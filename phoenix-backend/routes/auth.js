// routes/auth.js
import express from "express";

const router = express.Router();

/* ---------------- Config OTP ---------------- */

const OTP_CODE_LENGTH = 6;                       // طول کد
const OTP_EXPIRE_MIN = 3;                        // چند دقیقه معتبر باشد
const OTP_MAX_TRIES = 5;                         // حداکثر تلاش اشتباه
const DEV_STATIC_OTP = process.env.DEV_STATIC_OTP || "111111"; // برای تست

// اگر بخواهیم در حالت توسعه همیشه کد ثابت باشد
const IS_DEV =
  process.env.NODE_ENV !== "production" ||
  process.env.DEV_OTP === "1";

/* ساده‌ترین نرمال‌سازی شماره ایران */
function normalizeIranPhone(v = "") {
  const only = String(v).replace(/\D/g, "");
  if (only.startsWith("0098")) return "0" + only.slice(3);
  if (only.startsWith("098")) return "0" + only.slice(3);
  if (only.startsWith("98")) return "0" + only.slice(2);
  if (only.startsWith("9") && only.length === 10) return "0" + only;
  if (only.startsWith("0")) return only;
  return only;
}

/* تولید کد OTP */
function generateOtpCode() {
  let code = "";
  for (let i = 0; i < OTP_CODE_LENGTH; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
}

/* ---------------- ذخیره موقتی OTP در حافظه سرور ----------------
   key = phoneNormalized
   value = { code, expiresAt: number(ms), tries: number }
----------------------------------------------------------------- */

const otpStore = new Map();

/**
 * POST /api/auth/send-otp
 * body: { "phone": "0914..." }
 */
router.post("/send-otp", async (req, res) => {
  try {
    const { phone } = req.body || {};
    if (!phone) {
      return res.status(400).json({ ok: false, error: "PHONE_REQUIRED" });
    }

    const normalized = normalizeIranPhone(phone);

    // اگر توسعه است، از کد ثابت استفاده می‌کنیم، در غیر اینصورت کد تصادفی
    const code = IS_DEV ? DEV_STATIC_OTP : generateOtpCode();
    const expiresAt = Date.now() + OTP_EXPIRE_MIN * 60 * 1000;

    otpStore.set(normalized, {
      code,
      expiresAt,
      tries: 0,
    });

    console.log("[auth.send-otp] phone =", normalized, "code =", code);

    // اینجا بعداً SMS واقعی می‌زنیم؛ فعلاً فقط پیام موفقیت
    return res.json({
      ok: true,
      data: {
        phone: normalized,
        expiresInSec: OTP_EXPIRE_MIN * 60,
        devHint: IS_DEV ? code : undefined, // در پروڈاکشن می‌تونی حذفش کنی
      },
    });
  } catch (e) {
    console.error("[auth.send-otp] error", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

/**
 * POST /api/auth/verify-otp
 * body: { "phone": "0914...", "code": "123456" }
 *
 * فعلاً فقط OTP را چک می‌کنیم؛
 * در قدم بعدی اینجا JWT واقعی و سشن را می‌سازیم.
 */
router.post("/verify-otp", async (req, res) => {
  try {
    const { phone, code } = req.body || {};
    if (!phone || !code) {
      return res
        .status(400)
        .json({ ok: false, error: "PHONE_AND_CODE_REQUIRED" });
    }

    const normalized = normalizeIranPhone(phone);
    const record = otpStore.get(normalized);

    if (!record) {
      return res.status(400).json({ ok: false, error: "OTP_NOT_FOUND" });
    }

    // چک انقضا
    if (Date.now() > record.expiresAt) {
      otpStore.delete(normalized);
      return res.status(400).json({ ok: false, error: "OTP_EXPIRED" });
    }

    // چک تعداد تلاش
    if (record.tries >= OTP_MAX_TRIES) {
      otpStore.delete(normalized);
      return res
        .status(429)
        .json({ ok: false, error: "OTP_TOO_MANY_TRIES" });
    }

    // تطبیق کد
    const submitted = String(code).trim();
    if (submitted !== record.code) {
      record.tries += 1;
      otpStore.set(normalized, record);
      return res.status(400).json({ ok: false, error: "OTP_INVALID" });
    }

    // موفق: OTP مصرف شود
    otpStore.delete(normalized);

    console.log("[auth.verify-otp] SUCCESS for phone =", normalized);

    // فعلاً فقط تایید موفق؛ در قدم بعدی توکن JWT واقعی را اینجا می‌سازیم
    return res.json({
      ok: true,
      data: {
        phone: normalized,
        token: "FAKE_TOKEN_FOR_NOW", // قدم بعدی: جایگزینی با JWT واقعی
      },
    });
  } catch (e) {
    console.error("[auth.verify-otp] error", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

export default router;