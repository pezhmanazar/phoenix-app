// routes/users.js
import express from "express";
import jwt from "jsonwebtoken";
import prisma from "../utils/prisma.js";

const router = express.Router();

// ✅ برای اینکه DEV_BYPASS بتواند از req.body استفاده کند
router.use(express.json());

/* ---------- helpers ---------- */
function normalizePhone(input) {
  const digits = String(input || "").replace(/\D/g, "");
  if (digits.startsWith("989") && digits.length === 12) return "0" + digits.slice(2);
  if (digits.startsWith("09") && digits.length === 11) return digits;
  if (digits.startsWith("9") && digits.length === 10) return "0" + digits;
  return null;
}

/* ---------- auth middleware (توکن + DEV_BYPASS) ---------- */
function authUser(req, res, next) {
  const header = String(req.headers["authorization"] || "");
  const [scheme, token] = header.split(" ");

  const secret =
    process.env.APP_JWT_SECRET ||
    process.env.OTP_JWT_SECRET ||
    process.env.JWT_SECRET ||
    "";

  const isDev = process.env.NODE_ENV !== "production";

  // 1) مسیر نرمال با Bearer token
  if (scheme === "Bearer" && token && secret) {
    try {
      const payload = jwt.verify(token, secret);
      const phone = normalizePhone(payload.phone);
      if (!phone) {
        return res.status(401).json({ ok: false, error: "INVALID_TOKEN_PHONE" });
      }
      req.userPhone = phone;
      req.userTokenPayload = payload;
      return next();
    } catch (e) {
      console.error("[users] token verify error:", e.message);
      // اگر پروداکشن هستیم، بای‌پس نداریم
      if (!isDev) {
        return res.status(401).json({ ok: false, error: "TOKEN_INVALID" });
      }
      // dev → ادامه می‌دهیم و بای‌پس را امتحان می‌کنیم
    }
  }

  // 2) ---------- DEV_BYPASS ----------
  if (isDev) {
    const fromQuery = normalizePhone(req.query?.phone);
    const fromBody = normalizePhone(req.body?.phone);

    const phone = fromQuery || fromBody;
    if (phone) {
      console.warn("[users][authUser] DEV_BYPASS → using phone =", phone);
      req.userPhone = phone;
      req.userTokenPayload = { phone, devBypass: true };
      return next();
    }
  }

  // 3) هیچ توکنی نداریم و نمی‌توانیم بای‌پس کنیم
  if (!secret && !isDev) {
    console.error("[users] APP_JWT_SECRET not set");
    return res
      .status(500)
      .json({ ok: false, error: "SERVER_MISCONFIGURED" });
  }

  return res.status(401).json({ ok: false, error: "NO_TOKEN" });
}

/* ---------- GET /api/users/me ---------- */
router.get("/me", authUser, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { phone: req.userPhone },
    });

    return res.json({
      ok: true,
      data: user || null,
    });
  } catch (e) {
    console.error("[users.me] error:", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

/* ---------- POST /api/users/upsert ---------- */
// بعد از تمام شدن پروفایل‌ویزارد این رو صدا می‌زنی
router.post("/upsert", authUser, async (req, res) => {
  try {
    const phone = req.userPhone;
    const {
      fullName,
      gender,
      birthDate,
      profileCompleted,
      avatarUrl,
      plan,
      planExpiresAt,
      lastLoginAt,
    } = req.body || {};

    let birthDateValue = null;
    if (birthDate) {
      const d = new Date(birthDate);
      if (!isNaN(d.getTime())) birthDateValue = d;
    }

    let planExpiresValue = null;
    if (planExpiresAt) {
      const d = new Date(planExpiresAt);
      if (!isNaN(d.getTime())) planExpiresValue = d;
    }

    const user = await prisma.user.upsert({
  where: { phone },
  create: {
    phone,
    fullName: fullName ?? "",
    gender: gender ?? null,
    birthDate: birthDateValue,
    // ✅ فعلاً فقط فیلدهایی که مطمئنیم در اسکیما هستن
    plan: plan || "free",
    planExpiresAt: planExpiresValue,
    // اگر profileCompleted در اسکیما نباشه، بعد از ارور بعدی حذفش می‌کنیم
    profileCompleted: !!profileCompleted,
  },
  update: {
    fullName: fullName ?? undefined,
    gender: gender ?? undefined,
    birthDate: birthDate ? birthDateValue : undefined,
    profileCompleted:
      typeof profileCompleted === "boolean"
        ? profileCompleted
        : undefined,
    plan: plan ?? undefined,
    planExpiresAt: planExpiresValue ?? undefined,
  },
});

    return res.json({ ok: true, data: user });
  } catch (e) {
    console.error("[users.upsert] error:", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

export default router;