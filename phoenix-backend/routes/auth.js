// routes/auth.js
const express = require("express");
const router = express.Router();

/**
 * POST /api/auth/send-otp
 * body:
 * { "phone": "0914..." }
 *
 * فعلاً کد فیک برمی‌گردونیم برای تست مسیر.
 */
router.post("/auth/send-otp", async (req, res) => {
  try {
    const { phone } = req.body || {};
    if (!phone) {
      return res.status(400).json({ ok: false, error: "PHONE_REQUIRED" });
    }

    // فعلاً فقط لاگ می‌گیریم
    console.log("[auth.send-otp] phone =", phone);

    // اینجا بعداً OTP واقعی تولید و SMS می‌کنیم
    // فعلاً فقط پیام موفقیت تستی:
    return res.json({
      ok: true,
      data: {
        phone,
        message: "OTP_SENT_FAKE_FOR_NOW",
      },
    });
  } catch (e) {
    console.error("[auth.send-otp] error", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

/**
 * POST /api/auth/verify-otp
 * body:
 * { "phone": "0914...", "code": "123456" }
 *
 * فعلاً کد را چک نمی‌کنیم و فقط پاسخ موفق تستی می‌دهیم.
 * در قدم‌های بعدی اینجا OTP واقعی + JWT را پیاده می‌کنیم.
 */
router.post("/auth/verify-otp", async (req, res) => {
  try {
    const { phone, code } = req.body || {};
    if (!phone || !code) {
      return res
        .status(400)
        .json({ ok: false, error: "PHONE_AND_CODE_REQUIRED" });
    }

    console.log("[auth.verify-otp] phone =", phone, "code =", code);

    // اینجا بعداً OTP واقعی و JWT را می‌سازیم
    return res.json({
      ok: true,
      data: {
        phone,
        // فعلاً توکن فیک، فقط برای تست مسیر
        token: "FAKE_TOKEN_FOR_NOW",
      },
    });
  } catch (e) {
    console.error("[auth.verify-otp] error", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

module.exports = router;