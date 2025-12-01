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
    const phone = req.userPhone;
    const user = await prisma.user.findUnique({
      where: { phone },
    });
    console.log("[users.me] phone =", phone, "→ user =", JSON.stringify(user, null, 2));
    return res.json({
      ok: true,
      data: user || null,
    });
  } catch (e) {
    console.error("[users.me] error:", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

/* ---------- POST /api/users/upsert ----------
   پروفایل‌ویزارد و ادیت پروفایل (با توکن / DEV_BYPASS)
------------------------------------------------ */
router.post("/upsert", authUser, async (req, res) => {
  try {
    const phone = req.userPhone;

    const {
      fullName,
      gender,
      birthDate,
      profileCompleted,
      avatarUrl,      // در Prisma نداریم
      plan,
      planExpiresAt,
      lastLoginAt,    // در Prisma نداریم
    } = req.body || {};

    console.log("[users.upsert] HIT phone =", phone, "body =", req.body);

    const birthDateValue = parseDateOrNull(birthDate);
    const planExpiresValue = parseDateOrNull(planExpiresAt);

    // 👇 فقط وقتی فیلدها واقعا پر هستن، تو update می‌ذاریم
    const updateData = {};

    if (typeof fullName === "string" && fullName.trim().length > 0) {
      updateData.fullName = fullName.trim();
    }

    if (typeof gender === "string" && gender.trim().length > 0) {
      updateData.gender = gender.trim();
    }

    if (birthDate !== undefined) {
      updateData.birthDate = birthDateValue;
    }

    if (typeof profileCompleted === "boolean") {
      updateData.profileCompleted = profileCompleted;
    }

    if (plan !== undefined) {
      updateData.plan = plan;
    }

    if (planExpiresAt !== undefined) {
      updateData.planExpiresAt = planExpiresValue;
    }

    // اگر هیچ آپدیتی نیست، فقط برگردون
    if (Object.keys(updateData).length === 0) {
      const existing = await prisma.user.findUnique({ where: { phone } });
      console.log("[users.upsert] NO_UPDATE phone =", phone, "existing =", existing);
      return res.json({ ok: true, data: existing });
    }

    const user = await prisma.user.upsert({
      where: { phone },
      create: {
        phone,
        fullName: typeof fullName === "string" ? fullName.trim() : "",
        gender: typeof gender === "string" && gender.trim().length > 0 ? gender.trim() : null,
        birthDate: birthDateValue,
        profileCompleted: !!profileCompleted,
        plan: plan || "free",
        planExpiresAt: planExpiresValue,
      },
      update: updateData,
    });

    console.log("[users.upsert] UPSERT_RESULT user =", user);

    return res.json({ ok: true, data: user });
  } catch (e) {
    console.error("[users.upsert] error:", e);
    const code = e?.code ? String(e.code) : "";
    const errorLabel =
      code && code.startsWith("P")
        ? `PRISMA_${code}`
        : "SERVER_ERROR";
    return res.status(500).json({ ok: false, error: errorLabel });
  }
});

/* ---------- POST /api/users ----------
   کال از pay/verify (بدون توکن)
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
      avatarUrl,      // نادیده گرفته می‌شود
      gender,
      birthDate,
      profileCompleted,
      plan,
      planExpiresAt,
      lastLoginAt,    // نادیده گرفته می‌شود
    } = req.body || {};

    console.log("[users.root-post] HIT phone =", phone, "body =", req.body);

    const birthDateValue = parseDateOrNull(birthDate);
    const planExpiresValue = parseDateOrNull(planExpiresAt);

    // ⚠️ اینجا هم مثل بالا: فقط اگر واقعا مقدار معنادار داریم، آپدیت کن
    const updateData = {};

    if (typeof fullName === "string" && fullName.trim().length > 0) {
      updateData.fullName = fullName.trim();
    }
    if (typeof gender === "string" && gender.trim().length > 0) {
      updateData.gender = gender.trim();
    }
    if (birthDate !== undefined) {
      updateData.birthDate = birthDateValue;
    }
    if (typeof profileCompleted === "boolean") {
      updateData.profileCompleted = profileCompleted;
    }
    if (plan !== undefined) {
      updateData.plan = plan;
    }
    if (planExpiresAt !== undefined) {
      updateData.planExpiresAt = planExpiresValue;
    }

    console.log("[users.root-post] updateData =", updateData);

    const user = await prisma.user.upsert({
      where: { phone },
      create: {
        phone,
        fullName: typeof fullName === "string" ? fullName.trim() : "",
        gender: typeof gender === "string" && gender.trim().length > 0 ? gender.trim() : null,
        birthDate: birthDateValue,
        profileCompleted: !!profileCompleted,
        plan: plan || "free",
        planExpiresAt: planExpiresValue,
      },
      update: updateData,
    });

    console.log("[users.root-post] UPSERT_RESULT user =", user);

    return res.json({ ok: true, data: user });
  } catch (e) {
    console.error("[users.root-post] error:", e);
    const code = e?.code ? String(e.code) : "";
    const errorLabel =
      code && code.startsWith("P")
        ? `PRISMA_${code}`
        : "SERVER_ERROR";
    return res.status(500).json({ ok: false, error: errorLabel });
  }
});

export default router;