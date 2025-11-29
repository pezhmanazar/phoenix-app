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

function parseDateOrNull(value) {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d;
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

/* ---------- GET /api/user/me ---------- */
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

/* ---------- POST /api/user/upsert ----------
   این برای پروفایل‌ویزارد و ادیت پروفایل داخل اپ است (با توکن / DEV_BYPASS)
------------------------------------------------ */
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

    const birthDateValue = parseDateOrNull(birthDate);
    const planExpiresValue = parseDateOrNull(planExpiresAt);
    const lastLoginValue = parseDateOrNull(lastLoginAt);

    const user = await prisma.user.upsert({
      where: { phone },
      create: {
        phone,
        fullName: fullName ?? "",
        gender: gender ?? null,
        birthDate: birthDateValue,
        avatarUrl: avatarUrl ?? null,
        profileCompleted: !!profileCompleted,
        plan: plan || "free",
        planExpiresAt: planExpiresValue,
        lastLoginAt: lastLoginValue,
      },
      update: {
        fullName: fullName ?? undefined,
        gender: gender ?? undefined,
        birthDate: birthDate ? birthDateValue : undefined,
        avatarUrl: avatarUrl ?? undefined,
        profileCompleted:
          typeof profileCompleted === "boolean"
            ? profileCompleted
            : undefined,
        plan: plan ?? undefined,
        planExpiresAt:
          typeof planExpiresAt !== "undefined" ? planExpiresValue : undefined,
        lastLoginAt:
          typeof lastLoginAt !== "undefined" ? lastLoginValue : undefined,
      },
    });

    return res.json({ ok: true, data: user });
  } catch (e) {
    console.error("[users.upsert] error:", e);

    const code = e?.code ? String(e.code) : "";
    const message = e?.message ? String(e.message) : "";

    const errorLabel =
      code && code.startsWith("P")
        ? `PRISMA_${code}`             // مثلا PRISMA_P2002
        : message || "SERVER_ERROR";

    return res.status(500).json({ ok: false, error: errorLabel });
  }
});

/* ---------- POST /api/user ----------
   ⬅️ این همونیه که از pay/verify.js صدا می‌زنی:
   body: { phone, plan, planExpiresAt, ... }

   - اینجا authUser نداریم، چون از سمت سرورِ پرداخت میاد
   - برای امنیت می‌تونی بعداً یک secret header هم چک کنی
------------------------------------------------ */
router.post("/", async (req, res) => {
  try {
    const rawPhone = req.body?.phone;
    const phone = normalizePhone(rawPhone);

    if (!phone) {
      return res.status(400).json({ ok: false, error: "PHONE_REQUIRED" });
    }

    const {
      fullName,
      avatarUrl,
      gender,
      birthDate,
      profileCompleted,
      plan,
      planExpiresAt,
      lastLoginAt,
    } = req.body || {};

    const birthDateValue = parseDateOrNull(birthDate);
    const planExpiresValue = parseDateOrNull(planExpiresAt);
    const lastLoginValue = parseDateOrNull(lastLoginAt);

    const user = await prisma.user.upsert({
      where: { phone },
      create: {
        phone,
        fullName: fullName ?? "",
        avatarUrl: avatarUrl ?? null,
        gender: gender ?? null,
        birthDate: birthDateValue,
        profileCompleted: !!profileCompleted,
        plan: plan || "free",
        planExpiresAt: planExpiresValue,
        lastLoginAt: lastLoginValue,
      },
      update: {
        fullName: fullName ?? undefined,
        avatarUrl: avatarUrl ?? undefined,
        gender: gender ?? undefined,
        birthDate: birthDate ? birthDateValue : undefined,
        profileCompleted:
          typeof profileCompleted === "boolean"
            ? profileCompleted
            : undefined,
        plan: plan ?? undefined,
        planExpiresAt:
          typeof planExpiresAt !== "undefined" ? planExpiresValue : undefined,
        lastLoginAt:
          typeof lastLoginAt !== "undefined" ? lastLoginValue : undefined,
      },
    });

    return res.json({ ok: true, data: user });
  } catch (e) {
    console.error("[users.root-post] error:", e);

    const code = e?.code ? String(e.code) : "";
    const message = e?.message ? String(e.message) : "";

    const errorLabel =
      code && code.startsWith("P")
        ? `PRISMA_${code}`
        : message || "SERVER_ERROR";

    return res.status(500).json({ ok: false, error: errorLabel });
  }
});

export default router;