// routes/auth.js
import express from "express";
import jwt from "jsonwebtoken"; // ⬅️ این خط جدید
const router = express.Router();

/* ---------------- Config OTP ---------------- */
const OTP_CODE_LENGTH = 6;                // طول کد
const OTP_EXPIRE_MIN = 3;                 // چند دقیقه معتبر باشد
const OTP_MAX_TRIES = 5;                  // حداکثر تلاش اشتباه
const DEV_STATIC_OTP = process.env.DEV_STATIC_OTP || "111111";

// اگر بخواهیم در حالت توسعه همیشه کد ثابت باشد
const IS_DEV =
  process.env.NODE_ENV !== "production" ||
  process.env.DEV_OTP === "1";

// تنظیمات sms.ir
const SMSIR_API_KEY = process.env.SMSIR_API_KEY || "";
const SMSIR_TEMPLATE_ID = Number(process.env.SMSIR_TEMPLATE_ID || 0);

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
 *
 * فرمت خروجی:
 * {
 *   ok: true,
 *   data: {
 *     phone: "09...",
 *     expiresInSec: 180,
 *     devHint?: "123456",   // فقط در dev
 *     smsSent?: boolean,
 *     smsError?: string | null
 *   }
 * }
 */
router.post("/send-otp", async (req, res) => {
  try {
    const { phone } = req.body || {};
    if (!phone) {
      return res.status(400).json({ ok: false, error: "PHONE_REQUIRED" });
    }

    const normalized = normalizeIranPhone(phone);
    if (!normalized || !/^09\d{9}$/.test(normalized)) {
      return res.status(400).json({ ok: false, error: "INVALID_PHONE" });
    }

    // اگر توسعه است، از کد ثابت استفاده می‌کنیم، در غیر اینصورت کد تصادفی
    const code = IS_DEV ? DEV_STATIC_OTP : generateOtpCode();
    const expiresAt = Date.now() + OTP_EXPIRE_MIN * 60 * 1000;

    // ذخیره در حافظه (برای verify-otp فعلی)
    otpStore.set(normalized, {
      code,
      expiresAt,
      tries: 0,
    });

    let smsSent = false;
    let smsError = null;

    // اگر تنظیمات sms.ir موجود است و dev نیست، پیامک واقعی بفرست
    if (SMSIR_API_KEY && SMSIR_TEMPLATE_ID && !IS_DEV) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10_000); // 10s

        const payload = {
          mobile: normalized,
          templateId: SMSIR_TEMPLATE_ID,
          parameters: [{ name: "CODE", value: code }],
        };

        const resp = await fetch("https://api.sms.ir/v1/send/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-KEY": SMSIR_API_KEY,
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timer);

        const text = await resp.text().catch(() => "");
        let data = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          data = { raw: text };
        }

        console.log("[auth.send-otp] sms.ir status =", resp.status);
        console.log("[auth.send-otp] sms.ir body   =", data);

        // طبق داکیومنت sms.ir معمولاً status === 1 یعنی موفق
        if (resp.ok && data && data.status === 1) {
          smsSent = true;
        } else {
          smsError = data?.message || `SMS_SEND_FAILED_STATUS_${resp.status}`;
        }
      } catch (e) {
        console.error("[auth.send-otp] SMS fatal error:", e?.message || e);
        smsError = e?.message || "SMS_SEND_EXCEPTION";
      }
    } else {
      // اگر تنظیمات SMS ناقص است، فقط لاگ می‌گیریم؛ لاگین را نمی‌خوابانیم
      if (!SMSIR_API_KEY || !SMSIR_TEMPLATE_ID) {
        console.warn("[auth.send-otp] SMSIR env not set; skipping SMS send");
      }
    }

    console.log(
      "[auth.send-otp] phone =",
      normalized,
      "code =",
      code,
      "smsSent =",
      smsSent,
      "IS_DEV =",
      IS_DEV
    );

    return res.json({
      ok: true,
      data: {
        phone: normalized,
        expiresInSec: OTP_EXPIRE_MIN * 60,
        devHint: IS_DEV ? code : undefined, // برای تست در dev
        smsSent,
        smsError,
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
 * این همون نسخه‌ایه که الان باهاش اپ کار می‌کنه؛
 * فقط OTP رو از otpStore می‌خونه و در صورت موفقیت، سشن JWT می‌سازه.
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

    const submitted = String(code).trim();
    if (submitted !== record.code) {
      record.tries += 1;
      otpStore.set(normalized, record);
      return res.status(400).json({ ok: false, error: "OTP_INVALID" });
    }

    // موفق: OTP مصرف شود
otpStore.delete(normalized);
console.log("[auth.verify-otp] SUCCESS for phone =", normalized);

// 🔑 ساختن JWT سشن اپ
const appSecret =
  process.env.APP_JWT_SECRET || process.env.JWT_SECRET || "";
const sessionExpiresInSec = 30 * 24 * 60 * 60; // ۳۰ روز

let sessionToken = "FAKE_TOKEN_FOR_NOW";

if (appSecret) {
  sessionToken = jwt.sign(
    { phone: normalized },         // می‌تونی بعداً userId هم اضافه کنی
    appSecret,
    { expiresIn: sessionExpiresInSec }
  );
} else {
  console.warn(
    "[auth.verify-otp] APP_JWT_SECRET missing, using fallback token"
  );
}

return res.json({
  ok: true,
  data: {
    phone: normalized,
    token: sessionToken,
    sessionExpiresInSec,
  },
});
  } catch (e) {
    console.error("[auth.verify-otp] error", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

export default router;