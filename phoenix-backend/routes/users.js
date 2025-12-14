// routes/users.js
import express from "express";
import prisma from "../utils/prisma.js";

const router = express.Router();

// برای اینکه بتوانیم از req.body استفاده کنیم
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

/* ---------- auth با شماره موبایل (بدون JWT) ---------- */
/**
 * منطق:
 *   - شماره را از query.phone یا body.phone می‌خوانیم
 *   - اگر قابل نرمال‌سازی بود → req.userPhone
 *   - اگر نبود → 401 با PHONE_REQUIRED
 */
function authUser(req, res, next) {
  const fromQuery = normalizePhone(req.query?.phone);
  const fromBody = normalizePhone(req.body?.phone);
  const phone = fromQuery || fromBody;

  if (!phone) {
    console.warn("[users.authUser] missing or invalid phone in query/body", {
      queryPhone: req.query?.phone,
      bodyPhone: req.body?.phone,
    });
    return res.status(401).json({ ok: false, error: "PHONE_REQUIRED" });
  }

  req.userPhone = phone;
  return next();
}

function noStore(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0, s-maxage=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  // برای اینکه CDNها با query های مختلف قاطی نکنن
  res.setHeader("Vary", "Origin");
}

/* ---------- GET /api/users/me ---------- */
/**
 * اپ تو:
 *   GET https://qoqnoos.app/api/users/me?phone=09...
 * اینجا فقط شماره را می‌گیرد و رکورد را برمی‌گرداند.
 */
router.get("/me", authUser, async (req, res) => {
  try {
    noStore(res); // 👈👈👈 این خط

    const phone = req.userPhone;
    const user = await prisma.user.findUnique({
      where: { phone },
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

/* ---------- POST /api/users/me/delete ----------
   حذف کامل کاربر از DB (به‌جای DELETE چون WCDN DELETE را می‌بُرد)
   POST https://qoqnoos.app/api/users/me/delete?phone=09...
   یا body: { phone: "09..." }
------------------------------------------------ */
router.post("/me/delete", authUser, async (req, res) => {
  try {
    noStore(res);
    const phone = req.userPhone;

    // اگر کاربر وجود نداشت، ok=true برگردون که اپ گیر نکنه
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (!existing) {
      return res.json({ ok: true, data: { deleted: false, reason: "not_found" } });
    }

    await prisma.user.delete({ where: { phone } });

    return res.json({ ok: true, data: { deleted: true } });
  } catch (e) {
    console.error("[users.me.delete] error:", e);
    const code = e?.code ? String(e.code) : "";
    const errorLabel = code && code.startsWith("P") ? `PRISMA_${code}` : "SERVER_ERROR";
    return res.status(500).json({ ok: false, error: errorLabel });
  }
});

/* ---------- POST /api/users/upsert ----------
   پروفایل‌ویزارد و ادیت پروفایل
   اپ تو:
   POST https://qoqnoos.app/api/users/upsert  (body شامل phone و بقیه فیلدها)
------------------------------------------------ */
router.post("/upsert", authUser, async (req, res) => {
  try {
    const phone = req.userPhone;

    const {
      fullName,
      gender,
      birthDate,
      profileCompleted,
      avatarUrl,      // در Prisma نداریم، نادیده می‌گیریم
      plan,
      planExpiresAt,
      lastLoginAt,    // در Prisma نداریم، نادیده می‌گیریم
    } = req.body || {};

    console.log("[users.upsert] HIT phone =", phone, "body =", req.body);

    const birthDateValue = parseDateOrNull(birthDate);
    const planExpiresValue = parseDateOrNull(planExpiresAt);

    // فقط وقتی فیلدها واقعا پر هستن، تو update می‌ذاریم
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

    // اگر هیچ آپدیتی نیست، فقط همان رکورد فعلی را برگردان
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
        gender:
          typeof gender === "string" && gender.trim().length > 0
            ? gender.trim()
            : null,
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
   کال از pay/verify (بدون middleware authUser)
   اینجا هم با شماره موبایل کار می‌کنیم
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
        gender:
          typeof gender === "string" && gender.trim().length > 0
            ? gender.trim()
            : null,
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