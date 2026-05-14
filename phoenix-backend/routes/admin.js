// routes/admin.js
import bcrypt from "bcrypt";
import crypto from "crypto";
import { Router } from "express";
import prisma from "../utils/prisma.js";

// ⬇️ افزوده‌های مرحله ویس/فایل
import fs from "fs";
import multer from "multer";
import path from "path";

const router = Router();

// Helper: ساعت به جلو
const inHours = (h) => new Date(Date.now() + h * 3600 * 1000);

// فقط در حالت dev این روت فعال باشه
if (process.env.NODE_ENV !== "production") {
  router.get("/_debug/admins", async (_req, res) => {
    const admins = await prisma.admin.findMany({
      select: { email: true, role: true, apiKey: true, passwordHash: true },
    });
    res.json({
      ok: true,
      admins: admins.map((a) => ({
        email: a.email,
        role: a.role,
        apiKey: a.apiKey,
        hasPassword: !!a.passwordHash,
      })),
    });
  });
}

/**
 * ✅ Login (apiKey یا email+password) → صدور توکن سشن
 * POST /api/admin/login
 * body: { apiKey } یا { email, password }
 */
router.post("/login", async (req, res) => {
  try {
    const { apiKey, email, password } = req.body || {};
    let admin = null;

    if (apiKey?.trim()) {
      admin = await prisma.admin.findUnique({ where: { apiKey: apiKey.trim() } });
      if (!admin) return res.status(401).json({ ok: false, error: "invalid_api_key" });
    } else if (email && password) {
      const emailNorm = String(email).trim().toLowerCase();
      admin = await prisma.admin.findFirst({
        where: { email: { equals: emailNorm, mode: "insensitive" } },
      });

      if (!admin || !admin.passwordHash) {
        return res.status(401).json({ ok: false, error: "invalid_credentials" });
      }
      const ok = await bcrypt.compare(String(password), admin.passwordHash);
      if (!ok) return res.status(401).json({ ok: false, error: "invalid_credentials" });
    } else {
      return res.status(400).json({ ok: false, error: "missing_login_fields" });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const session = await prisma.adminSession.create({
      data: {
        adminId: admin.id,
        token,
        expiresAt: inHours(24 * 7),
      },
    });

    return res.json({
      ok: true,
      token: session.token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        apiKey: admin.apiKey,
      },
      redirect: true,
    });
  } catch (e) {
    console.error("admin/login error:", e?.message || "unknown_error");
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/**
 * ✅ Verify token (برای میدل‌ور فرانت یا تست دستی)
 * GET /api/admin/verify   (Header: x-admin-token)
 */
router.get("/verify", async (req, res) => {
  try {
    const t = String(req.headers["x-admin-token"] || "");
    if (!t) return res.status(401).json({ ok: false, error: "token_required" });

    const session = await prisma.adminSession.findUnique({
      where: { token: t },
      include: { admin: true },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      return res.status(401).json({ ok: false, error: "invalid_or_expired" });
    }
    const { admin } = session;
    return res.json({
      ok: true,
      admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
    });
  } catch (e) {
    console.error("admin/verify error:", e?.message || "unknown_error");
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/**
 * ✅ Logout (ابطال توکن جاری)
 * POST /api/admin/logout   (Header: x-admin-token)
 */
router.post("/logout", async (req, res) => {
  try {
    const t = String(req.headers["x-admin-token"] || "");
    if (!t) return res.status(400).json({ ok: false, error: "token_required" });

    await prisma.adminSession
      .update({
        where: { token: t },
        data: { revokedAt: new Date() },
      })
      .catch(() => {});
    return res.json({ ok: true });
  } catch (e) {
    console.error("admin/logout error:", e?.message || "unknown_error");
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

// ===== Cookie helper =====
function parseCookies(cookieHeader = "") {
  const out = {};
  cookieHeader.split(";").forEach((part) => {
    const [k, ...v] = part.trim().split("=");
    if (!k) return;
    out[k] = decodeURIComponent(v.join("=") || "");
  });
  return out;
}

// ===== ✅ میدل‌ور احراز هویت سشن (Header یا Cookie) =====
async function sessionAuth(req, res, next) {
  try {
    const hdr = String(req.headers["x-admin-token"] || "").trim();
    const ck = parseCookies(String(req.headers.cookie || ""));
    const token = hdr || String(ck.admin_token || "").trim();

    if (!token) return res.status(401).json({ ok: false, error: "token_required" });

    const session = await prisma.adminSession.findUnique({
      where: { token },
      include: { admin: true },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      return res.status(401).json({ ok: false, error: "invalid_or_expired" });
    }
    req.admin = session.admin;
    req.adminToken = token;
    next();
  } catch (e) {
    console.error("sessionAuth error:", e?.message || "unknown_error");
    res.status(500).json({ ok: false, error: "internal_error" });
  }
}

// ===== نگهبان نقش‌ها
const allow = (...roles) => (req, res, next) => {
  if (!req.admin) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!roles.includes(req.admin.role)) return res.status(403).json({ ok: false, error: "forbidden" });
  next();
};

// از اینجا به بعد همه مسیرها حفاظت می‌شوند
router.use(sessionAuth);

/* ====================== USERS (Admin Panel) ====================== */

// helper: normalize phone مثل users.js
function normalizePhone(input) {
  const digits = String(input || "").replace(/\D/g, "");
  if (digits.startsWith("989") && digits.length === 12) return "0" + digits.slice(2);
  if (digits.startsWith("09") && digits.length === 11) return digits;
  if (digits.startsWith("9") && digits.length === 10) return "0" + digits;
  return null;
}

// helper: months -> expiresAt
function addMonths(date, months) {
  const d = new Date(date);
  const m = Number(months || 0);
  if (!Number.isFinite(m) || m <= 0) return d;
  d.setMonth(d.getMonth() + m);
  return d;
}

/**
 * ✅ GET /api/admin/users?plan=free|pro|vip|expired&q=...&page=1&limit=30
 * خروجی همون فرمتی که UI الان استفاده می‌کنه:
 * { ok:true, page, limit, total, users }
 */
router.get("/users", allow("agent", "manager", "owner"), async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const plan = typeof req.query.plan === "string" ? req.query.plan.trim() : "";
    const page = Math.max(1, Number(req.query.page || 1) || 1);
    const limitRaw = Number(req.query.limit || 30) || 30;
    const limit = Math.min(100, Math.max(1, limitRaw));
    const skip = (page - 1) * limit;

    const where = { AND: [] };

    if (plan && ["free", "pro", "vip", "expired"].includes(plan)) {
      if (plan === "expired") {
        where.AND.push({
          OR: [
            { plan: "pro", planExpiresAt: { lt: new Date() } },
            { plan: "vip", planExpiresAt: { lt: new Date() } },
          ],
        });
      } else {
        where.AND.push({ plan });
      }
    }

    if (q) {
      const qPhone = normalizePhone(q);
      where.AND.push({
        OR: [
          ...(qPhone ? [{ phone: { contains: qPhone } }] : [{ phone: { contains: q } }]),
          { fullName: { contains: q, mode: "insensitive" } },
          { id: { contains: q, mode: "insensitive" } },
        ],
      });
    }

    if (where.AND.length === 0) delete where.AND;

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        skip,
        take: limit,
        select: {
          id: true,
          phone: true,
          fullName: true,
          gender: true,
          birthDate: true,
          plan: true,
          planExpiresAt: true,
          profileCompleted: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    return res.json({ ok: true, page, limit, total, users });
  } catch (e) {
    console.error("admin/users GET error:", e?.message || "unknown_error");
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/**
 * ✅ Alias قدیمی (اگر جایی هنوز صدا می‌زند)
 * POST /api/admin/users/:id/set-plan  body: { plan:"free"|"pro", days?:number }
 */
router.post("/users/:id/set-plan", allow("manager", "owner"), async (req, res) => {
  try {
    const id = String(req.params.id || "");
    const plan = String(req.body?.plan || "").trim();
    const days = Number(req.body?.days || 0);

    if (!id || (plan !== "free" && plan !== "pro")) {
      return res.status(400).json({ ok: false, error: "bad_request" });
    }

    let planExpiresAt = null;

if (plan === "pro") {
  const addDays = days > 0 ? days : 30;

  // اگر کاربر از قبل PRO و هنوز منقضی نشده بود، به همون تاریخ اضافه کن
  const current = await prisma.user.findUnique({
    where: { id },
    select: { plan: true, planExpiresAt: true },
  });

  const now = new Date();
  const curExp = current?.planExpiresAt ? new Date(current.planExpiresAt) : null;

  const base =
    current?.plan === "pro" && curExp && curExp.getTime() > now.getTime()
      ? curExp
      : now;

  planExpiresAt = new Date(base.getTime() + addDays * 24 * 3600 * 1000);
}

    const user = await prisma.user.update({
      where: { id },
      data: { plan, planExpiresAt },
      select: { id: true, phone: true, fullName: true, plan: true, planExpiresAt: true },
    });

    return res.json({ ok: true, user });
  } catch (e) {
    console.error("admin/set-plan error:", e?.message || "unknown_error");
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/**
 * ✅ Alias قدیمی
 * POST /api/admin/users/:id/cancel-plan
 */
router.post("/users/:id/cancel-plan", allow("manager", "owner"), async (req, res) => {
  try {
    const id = String(req.params.id || "");
    if (!id) return res.status(400).json({ ok: false, error: "bad_request" });

    const user = await prisma.user.update({
      where: { id },
      data: { plan: "free", planExpiresAt: null },
      select: { id: true, phone: true, fullName: true, plan: true, planExpiresAt: true },
    });

    return res.json({ ok: true, user });
  } catch (e) {
    console.error("admin/cancel-plan error:", e?.message || "unknown_error");
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/**
 * ✅ اکشن جدید: pro با days
 * POST /api/admin/users/:id/pro  body:{days?:number}
 */
router.post("/users/:id/pro", allow("manager", "owner"), async (req, res) => {
  try {
    const id = String(req.params.id);
    const daysRaw = Number(req.body?.days ?? 30);
    const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.floor(daysRaw) : 30;
    const planExpiresAt = new Date(Date.now() + days * 24 * 3600 * 1000);

    const updated = await prisma.user.update({
      where: { id },
      data: { plan: "pro", planExpiresAt },
      select: { id: true, phone: true, fullName: true, plan: true, planExpiresAt: true, updatedAt: true },
    });

    return res.json({ ok: true, data: updated });
  } catch (e) {
    if (e?.code === "P2025") return res.status(404).json({ ok: false, error: "not_found" });
    console.error("admin/users pro error:", e?.message || "unknown_error");
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/**
 * ✅ اکشن جدید: تمدید با days (از تاریخ انقضای فعلی اگر هنوز معتبر است، وگرنه از الان)
 * POST /api/admin/users/:id/extend  body:{days:number}
 */
router.post("/users/:id/extend", allow("manager", "owner"), async (req, res) => {
  try {
    const id = String(req.params.id);
    const daysRaw = Number(req.body?.days);
    const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.floor(daysRaw) : null;
    if (!days) return res.status(400).json({ ok: false, error: "invalid_days" });

    const u = await prisma.user.findUnique({
      where: { id },
      select: { plan: true, planExpiresAt: true },
    });
    if (!u) return res.status(404).json({ ok: false, error: "not_found" });

    const base =
      u.planExpiresAt && u.planExpiresAt > new Date() ? u.planExpiresAt : new Date();

    const planExpiresAt = new Date(base.getTime() + days * 24 * 3600 * 1000);

    const updated = await prisma.user.update({
      where: { id },
      data: {
        plan: u.plan === "free" ? "pro" : u.plan,
        planExpiresAt,
      },
      select: { id: true, phone: true, fullName: true, plan: true, planExpiresAt: true, updatedAt: true },
    });

    return res.json({ ok: true, data: updated });
  } catch (e) {
    console.error("admin/users extend error:", e?.message || "unknown_error");
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/**
 * ✅ اکشن جدید: لغو اشتراک
 * POST /api/admin/users/:id/cancel
 */
router.post("/users/:id/cancel", allow("manager", "owner"), async (req, res) => {
  try {
    const id = String(req.params.id);

    const updated = await prisma.user.update({
      where: { id },
      data: { plan: "free", planExpiresAt: null },
      select: { id: true, phone: true, fullName: true, plan: true, planExpiresAt: true, updatedAt: true },
    });

    return res.json({ ok: true, data: updated });
  } catch (e) {
    if (e?.code === "P2025") return res.status(404).json({ ok: false, error: "not_found" });
    console.error("admin/users cancel error:", e?.message || "unknown_error");
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/**
 * ✅ PATCH /api/admin/users/:id/plan
 * body: { plan:"free"|"pro"|"vip", expiresAt?, months? }
 */
router.patch("/users/:id/plan", allow("manager", "owner"), async (req, res) => {
  try {
    const id = String(req.params.id);
    const plan = String(req.body?.plan || "").trim();

    if (!["free", "pro", "vip"].includes(plan)) {
      return res.status(400).json({ ok: false, error: "invalid_plan" });
    }

    let planExpiresAt = null;

    if (plan !== "free") {
      if (req.body?.expiresAt) {
        const d = new Date(req.body.expiresAt);
        if (isNaN(d.getTime())) return res.status(400).json({ ok: false, error: "invalid_expiresAt" });
        planExpiresAt = d;
      } else if (req.body?.months !== undefined) {
        const months = Number(req.body.months);
        if (!Number.isFinite(months) || months <= 0) {
          return res.status(400).json({ ok: false, error: "invalid_months" });
        }
        planExpiresAt = addMonths(new Date(), months);
      } else {
        planExpiresAt = addMonths(new Date(), 1);
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { plan, planExpiresAt },
      select: {
        id: true,
        phone: true,
        fullName: true,
        plan: true,
        planExpiresAt: true,
        updatedAt: true,
      },
    });

    return res.json({ ok: true, data: updated });
  } catch (e) {
    if (e?.code === "P2025") return res.status(404).json({ ok: false, error: "not_found" });
    console.error("admin/users plan PATCH error:", e?.message || "unknown_error");
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/**
 * ✅ DELETE /api/admin/users/:id  (حذف کامل)
 */
router.delete("/users/:id", allow("owner"), async (req, res) => {
  try {
    const id = String(req.params.id);

    await prisma.$transaction([
      prisma.subscription.deleteMany({ where: { userId: id } }),
      prisma.user.delete({ where: { id } }),
    ]);

    return res.json({ ok: true });
  } catch (e) {
    if (e?.code === "P2025") return res.status(404).json({ ok: false, error: "not_found" });
    console.error("admin/users DELETE error:", e?.message || "unknown_error");
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/**
 * ✅ GET /api/admin/stats
 */
router.get("/stats", allow("manager", "owner"), async (_req, res) => {
  try {
    const now = new Date();
    const start24h = new Date(Date.now() - 24 * 3600 * 1000);
    const start7d = new Date(Date.now() - 7 * 24 * 3600 * 1000);

    const [
      totalUsers,
      newUsers24h,
      newUsers7d,
      proActive,
      vipActive,
      proExpired,
      vipExpired,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: start24h } } }),
      prisma.user.count({ where: { createdAt: { gte: start7d } } }),
      prisma.user.count({ where: { plan: "pro", planExpiresAt: { gt: now } } }),
      prisma.user.count({ where: { plan: "vip", planExpiresAt: { gt: now } } }),
      prisma.user.count({ where: { plan: "pro", planExpiresAt: { lt: now } } }),
      prisma.user.count({ where: { plan: "vip", planExpiresAt: { lt: now } } }),
    ]);

    return res.json({
      ok: true,
      data: {
        totalUsers,
        newUsers24h,
        newUsers7d,
        active: { pro: proActive, vip: vipActive },
        expired: { pro: proExpired, vip: vipExpired },
      },
    });
  } catch (e) {
    console.error("admin/stats error:", e?.message || "unknown_error");
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

//* ✅ آنالیتیک پلکان
router.get("/analytics/pelekan", allow("manager", "owner"), async (_req, res) => {
  try {
    const now = new Date();
    const DAY = 24 * 60 * 60 * 1000;

    const [
      baselineInProgress,
      baselineCompleted,
      choosePathUsers,
      reviewInProgress,
      reviewCompleted,
      treatingUsers,
      activeTreatmentUsers,
      waitingForProUsers,
      baselineScores,
      activeStageProgresses,
    ] = await Promise.all([
      Promise.resolve(0),

      prisma.assessmentSession.count({
        where: { status: "completed" },
      }),

      Promise.resolve(0),
      Promise.resolve(0),
      Promise.resolve(0),
      Promise.resolve(0),

      prisma.pelekanDayProgress.findMany({
        where: { status: "active" },
        select: {
          id: true,
          startedAt: true,
          userId: true,
          day: {
            select: {
              stage: {
                select: {
                  code: true,
                  title: true,
                },
              },
            },
          },
        },
      }),

      Promise.resolve(0),

      prisma.assessmentSession.findMany({
        where: { status: "completed" },
        select: {
          id: true,
          totalScore: true,
          createdAt: true,
          userId: true,
        },
      }),

      prisma.pelekanDayProgress.findMany({
        where: { status: "active" },
        select: {
          id: true,
          startedAt: true,
          userId: true,
          day: {
            select: {
              stage: {
                select: {
                  code: true,
                  title: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const stageMap = {};
    let stuckInTreatmentOver7d = 0;

    for (const item of activeStageProgresses) {
      const stageCode = item.day?.stage?.code || "unknown";
      const stageTitle = item.day?.stage?.title || "نامشخص";

      if (!stageMap[stageCode]) {
        stageMap[stageCode] = {
          code: stageCode,
          title: stageTitle,
          count: 0,
          avgDays: 0,
          stuckOver7d: 0,
          _sumDays: 0,
        };
      }

      const days = item.startedAt
        ? (now.getTime() - new Date(item.startedAt).getTime()) / DAY
        : 0;

      stageMap[stageCode].count += 1;
      stageMap[stageCode]._sumDays += days;

      if (days > 7) {
        stageMap[stageCode].stuckOver7d += 1;
        stuckInTreatmentOver7d += 1;
      }
    }

    const stageDistribution = Object.values(stageMap).map((s) => ({
      code: s.code,
      title: s.title,
      count: s.count,
      avgDays: s.count ? Number((s._sumDays / s.count).toFixed(1)) : 0,
      stuckOver7d: s.stuckOver7d,
    }));

    let scoreSum = 0;
    let scorePercentSum = 0;

    const levelDistribution = {
      manageable: 0,
      moderate: 0,
      severe: 0,
      unknown: 0,
    };

    const percentBuckets = {
      "0_30": 0,
      "31_60": 0,
      "61_80": 0,
      "81_100": 0,
    };

    for (const item of baselineScores) {
      const score = Number(item.totalScore || 0);
      const percent = Math.max(0, Math.min(100, (score / 31) * 100));

      scoreSum += score;
      scorePercentSum += percent;

      // فعلاً چون AssessmentSession فیلد level ندارد
      levelDistribution.unknown += 1;

      if (percent <= 30) percentBuckets["0_30"] += 1;
      else if (percent <= 60) percentBuckets["31_60"] += 1;
      else if (percent <= 80) percentBuckets["61_80"] += 1;
      else percentBuckets["81_100"] += 1;
    }

    const baselineAvgScore = baselineScores.length
      ? Number((scoreSum / baselineScores.length).toFixed(1))
      : 0;

    const baselineAvgPercent = baselineScores.length
      ? Number((scorePercentSum / baselineScores.length).toFixed(1))
      : 0;

    const uniqueActiveTreatmentUserIds = new Set(
      activeTreatmentUsers
        .map((item) => item.userId)
        .filter(Boolean)
    );

    return res.json({
      ok: true,
      data: {
        funnel: {
          baselineInProgress,
          baselineCompleted,
          choosePathUsers,
          reviewInProgress,
          reviewCompleted,
          waitingForProUsers,
          treatingUsers,
          activeTreatmentUsers: uniqueActiveTreatmentUserIds.size,
        },

        baseline: {
          completedCount: baselineScores.length,
          avgScore: baselineAvgScore,
          avgPercent: baselineAvgPercent,
          levelDistribution,
          percentBuckets,
        },

        treatment: {
          activeUsers: uniqueActiveTreatmentUserIds.size,
          stageDistribution,
        },

        stuck: {
          treatmentOver7d: stuckInTreatmentOver7d,
        },
      },
    });
  } catch (e) {
    console.error("admin/analytics/pelekan error:", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/* ====================== ✅ ANNOUNCEMENTS ====================== */

function toBool(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }
  return undefined;
}

function parseDateOrNull(v, fieldName) {
  if (v === undefined) return { ok: true, value: undefined }; // یعنی اصلاً آپدیت نکن
  if (v === null || v === "") return { ok: true, value: null }; // یعنی null کن
  const d = new Date(v);
  if (isNaN(d.getTime())) return { ok: false, error: `invalid_${fieldName}` };
  return { ok: true, value: d };
}

function validateTargets(t) {
  return !!(t.targetFree || t.targetPro || t.targetExpiring || t.targetExpired);
}

/**
 * ✅ GET /api/admin/announcements?q=&placement=top_banner&enabled=true|false&page=1&limit=50
 */
router.get("/announcements", allow("agent", "manager", "owner"), async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const placement = typeof req.query.placement === "string" ? req.query.placement.trim() : "";
    const enabledRaw = typeof req.query.enabled === "string" ? req.query.enabled.trim().toLowerCase() : "";

    const page = Math.max(1, Number(req.query.page || 1) || 1);
    const limitRaw = Number(req.query.limit || 50) || 50;
    const limit = Math.min(200, Math.max(10, limitRaw));
    const skip = (page - 1) * limit;

    const where = {};
    const AND = [];

    if (enabledRaw) {
      if (!["true", "false"].includes(enabledRaw)) {
        return res.status(400).json({ ok: false, error: "invalid_enabled" });
      }
      AND.push({ enabled: enabledRaw === "true" });
    }

    if (placement) {
      if (!["top_banner"].includes(placement)) {
        return res.status(400).json({ ok: false, error: "invalid_placement" });
      }
      AND.push({ placement });
    }

    if (q) {
      AND.push({
        OR: [
          { id: { contains: q, mode: "insensitive" } },
          { title: { contains: q, mode: "insensitive" } },
          { message: { contains: q, mode: "insensitive" } },
        ],
      });
    }

    if (AND.length) where.AND = AND;

    const [total, items] = await Promise.all([
      prisma.announcement.count({ where }),
      prisma.announcement.findMany({
        where,
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          message: true,
          level: true,
          placement: true,
          dismissible: true,
          enabled: true,
          startAt: true,
          endAt: true,
          priority: true,
          createdAt: true,
          updatedAt: true,

          // ✅ targets
          targetFree: true,
          targetPro: true,
          targetExpiring: true,
          targetExpired: true,
        },
      }),
    ]);

    return res.json({
      ok: true,
      data: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        items,
      },
    });
  } catch (e) {
    console.error("admin/announcements GET error:", e?.message || "unknown_error");
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/**
 * ✅ POST /api/admin/announcements
 * body: { title?, message, level?, placement?, dismissible?, enabled?, startAt?, endAt?, priority?,
 *         targetFree?, targetPro?, targetExpiring?, targetExpired? }
 */
router.post("/announcements", allow("manager", "owner"), async (req, res) => {
  try {
    const body = req.body || {};
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) return res.status(400).json({ ok: false, error: "message_required" });

    const title = body.title !== undefined ? (body.title ? String(body.title).trim() : null) : undefined;

    const level = body.level !== undefined ? String(body.level).trim() : undefined;
    if (level !== undefined && level !== "" && !["info", "warning", "critical"].includes(level)) {
      return res.status(400).json({ ok: false, error: "invalid_level" });
    }

    const placement = body.placement !== undefined ? String(body.placement).trim() : undefined;
    if (placement !== undefined && placement !== "" && !["top_banner"].includes(placement)) {
      return res.status(400).json({ ok: false, error: "invalid_placement" });
    }

    const dismissible =
      body.dismissible !== undefined ? toBool(body.dismissible) : undefined;
    if (body.dismissible !== undefined && dismissible === undefined) {
      return res.status(400).json({ ok: false, error: "invalid_dismissible" });
    }

    const enabled =
      body.enabled !== undefined ? toBool(body.enabled) : undefined;
    if (body.enabled !== undefined && enabled === undefined) {
      return res.status(400).json({ ok: false, error: "invalid_enabled" });
    }

    const priority = body.priority !== undefined ? Number(body.priority) : undefined;
    if (priority !== undefined && !Number.isFinite(priority)) {
      return res.status(400).json({ ok: false, error: "invalid_priority" });
    }

    const startAtParsed = parseDateOrNull(body.startAt, "startAt");
    if (!startAtParsed.ok) return res.status(400).json({ ok: false, error: startAtParsed.error });

    const endAtParsed = parseDateOrNull(body.endAt, "endAt");
    if (!endAtParsed.ok) return res.status(400).json({ ok: false, error: endAtParsed.error });

    // ✅ targets (پیش‌فرض عمومی)
    const targetFree = body.targetFree !== undefined ? toBool(body.targetFree) : true;
    const targetPro = body.targetPro !== undefined ? toBool(body.targetPro) : true;
    const targetExpiring = body.targetExpiring !== undefined ? toBool(body.targetExpiring) : false;
    const targetExpired = body.targetExpired !== undefined ? toBool(body.targetExpired) : false;

    if ([targetFree, targetPro, targetExpiring, targetExpired].some((x) => x === undefined)) {
      return res.status(400).json({ ok: false, error: "invalid_targets" });
    }
    if (!validateTargets({ targetFree, targetPro, targetExpiring, targetExpired })) {
      return res.status(400).json({ ok: false, error: "target_required" });
    }

    const created = await prisma.announcement.create({
      data: {
        ...(title !== undefined ? { title } : {}),
        message,
        ...(level ? { level } : {}),
        ...(placement ? { placement } : {}),
        ...(dismissible !== undefined ? { dismissible } : {}),
        ...(enabled !== undefined ? { enabled } : {}),
        ...(startAtParsed.value !== undefined ? { startAt: startAtParsed.value } : {}),
        ...(endAtParsed.value !== undefined ? { endAt: endAtParsed.value } : {}),
        ...(priority !== undefined ? { priority } : {}),

        // ✅ targets
        targetFree,
        targetPro,
        targetExpiring,
        targetExpired,
      },
      select: {
        id: true,
        title: true,
        message: true,
        level: true,
        placement: true,
        dismissible: true,
        enabled: true,
        startAt: true,
        endAt: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
        targetFree: true,
        targetPro: true,
        targetExpiring: true,
        targetExpired: true,
      },
    });

    return res.json({ ok: true, item: created });
  } catch (e) {
    if (e?.code === "P2002") return res.status(409).json({ ok: false, error: "unique_violation" });
    console.error("admin/announcements POST error:", e?.message || "unknown_error");
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/**
 * ✅ PATCH /api/admin/announcements/:id
 * body: هر فیلدی از announcement + targets
 */
router.patch("/announcements/:id", allow("manager", "owner"), async (req, res) => {
  try {
    const id = String(req.params.id);
    const body = req.body || {};
    const data = {};

    if (body.title !== undefined) data.title = body.title ? String(body.title).trim() : null;

    if (body.message !== undefined) {
      const m = body.message ? String(body.message).trim() : "";
      if (!m) return res.status(400).json({ ok: false, error: "message_empty" });
      data.message = m;
    }

    if (body.level !== undefined) {
      const level = String(body.level).trim();
      if (!["info", "warning", "critical"].includes(level)) {
        return res.status(400).json({ ok: false, error: "invalid_level" });
      }
      data.level = level;
    }

    if (body.placement !== undefined) {
      const placement = String(body.placement).trim();
      if (!["top_banner"].includes(placement)) {
        return res.status(400).json({ ok: false, error: "invalid_placement" });
      }
      data.placement = placement;
    }

    if (body.dismissible !== undefined) {
      const v = toBool(body.dismissible);
      if (v === undefined) return res.status(400).json({ ok: false, error: "invalid_dismissible" });
      data.dismissible = v;
    }

    if (body.enabled !== undefined) {
      const v = toBool(body.enabled);
      if (v === undefined) return res.status(400).json({ ok: false, error: "invalid_enabled" });
      data.enabled = v;
    }

    if (body.priority !== undefined) {
      const p = Number(body.priority);
      if (!Number.isFinite(p)) return res.status(400).json({ ok: false, error: "invalid_priority" });
      data.priority = p;
    }

    if (body.startAt !== undefined) {
      const parsed = parseDateOrNull(body.startAt, "startAt");
      if (!parsed.ok) return res.status(400).json({ ok: false, error: parsed.error });
      data.startAt = parsed.value;
    }

    if (body.endAt !== undefined) {
      const parsed = parseDateOrNull(body.endAt, "endAt");
      if (!parsed.ok) return res.status(400).json({ ok: false, error: parsed.error });
      data.endAt = parsed.value;
    }

    // ✅ targets
    if (body.targetFree !== undefined) {
      const v = toBool(body.targetFree);
      if (v === undefined) return res.status(400).json({ ok: false, error: "invalid_targetFree" });
      data.targetFree = v;
    }
    if (body.targetPro !== undefined) {
      const v = toBool(body.targetPro);
      if (v === undefined) return res.status(400).json({ ok: false, error: "invalid_targetPro" });
      data.targetPro = v;
    }
    if (body.targetExpiring !== undefined) {
      const v = toBool(body.targetExpiring);
      if (v === undefined) return res.status(400).json({ ok: false, error: "invalid_targetExpiring" });
      data.targetExpiring = v;
    }
    if (body.targetExpired !== undefined) {
      const v = toBool(body.targetExpired);
      if (v === undefined) return res.status(400).json({ ok: false, error: "invalid_targetExpired" });
      data.targetExpired = v;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ ok: false, error: "no_fields_to_update" });
    }

    // ✅ جلوگیری از "همه false"
    const touchedTargets =
      data.targetFree !== undefined ||
      data.targetPro !== undefined ||
      data.targetExpiring !== undefined ||
      data.targetExpired !== undefined;

    if (touchedTargets) {
      const cur = await prisma.announcement.findUnique({
        where: { id },
        select: {
          targetFree: true,
          targetPro: true,
          targetExpiring: true,
          targetExpired: true,
        },
      });
      if (!cur) return res.status(404).json({ ok: false, error: "not_found" });

      const merged = {
        targetFree: data.targetFree ?? cur.targetFree,
        targetPro: data.targetPro ?? cur.targetPro,
        targetExpiring: data.targetExpiring ?? cur.targetExpiring,
        targetExpired: data.targetExpired ?? cur.targetExpired,
      };

      if (!validateTargets(merged)) {
        return res.status(400).json({ ok: false, error: "target_required" });
      }
    }

    const updated = await prisma.announcement.update({
      where: { id },
      data,
      select: {
        id: true,
        title: true,
        message: true,
        level: true,
        placement: true,
        dismissible: true,
        enabled: true,
        startAt: true,
        endAt: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
        targetFree: true,
        targetPro: true,
        targetExpiring: true,
        targetExpired: true,
      },
    });

    return res.json({ ok: true, item: updated });
  } catch (e) {
    if (e?.code === "P2025") return res.status(404).json({ ok: false, error: "not_found" });
    console.error("admin/announcements PATCH error:", e?.message || "unknown_error");
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/**
 * ✅ POST /api/admin/announcements/:id/delete
 */
router.post("/announcements/:id/delete", allow("manager", "owner"), async (req, res) => {
  try {
    const id = String(req.params.id);
    await prisma.announcement.delete({ where: { id } });
    return res.json({ ok: true });
  } catch (e) {
    if (e?.code === "P2025") return res.status(404).json({ ok: false, error: "not_found" });
    console.error("admin/announcements delete error:", e?.message || "unknown_error");
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/* ====================== ✅ profile ====================== */
router.patch("/profile", async (req, res) => {
  try {
    const { name, password } = req.body || {};
    const data = {};
    if (name !== undefined) {
      const n = String(name).trim();
      if (n.length === 0) return res.status(400).json({ ok: false, error: "name_empty" });
      data.name = n;
    }
    if (password !== undefined) {
      const p = String(password);
      if (p.length < 6) return res.status(400).json({ ok: false, error: "password_too_short" });
      data.passwordHash = await bcrypt.hash(p, 10);
    }
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ ok: false, error: "no_fields_to_update" });
    }

    const updated = await prisma.admin.update({
      where: { id: req.admin.id },
      data,
      select: { id: true, email: true, name: true, role: true },
    });

    res.json({ ok: true, admin: updated });
  } catch (e) {
    console.error("admin/profile PATCH error:", e?.message || "unknown_error");
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/* ====================== ✅ tickets ====================== */

router.get("/tickets", async (req, res) => {
  try {
    const { status, type, q } = req.query;
    const where = {};
    if (typeof status === "string" && ["open", "pending", "closed"].includes(status)) {
      where.status = status;
    }
    if (typeof type === "string" && ["tech", "therapy"].includes(type)) {
      where.type = type;
    }
    if (typeof q === "string" && q.trim()) {
      const term = q.trim();
      where.OR = [
        { title: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
        { contact: { contains: term, mode: "insensitive" } },
        { openedByName: { contains: term, mode: "insensitive" } },
        { messages: { some: { text: { contains: term, mode: "insensitive" } } } },
      ];
    }

    const hasContentFilter = {
      messages: {
        some: {
          OR: [{ text: { not: "" } }, { fileUrl: { not: null } }],
        },
      },
    };
    const whereFinal = { ...where, AND: [hasContentFilter] };

  const tickets = await prisma.ticket.findMany({
  where: whereFinal,
  orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
  include: {
    messages: { orderBy: { createdAt: "asc" } },
    assignedAdmin: {
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    },
  },
  take: 200,
});

// جمع‌آوری شماره‌ها و userId ها
const userIds = [];
const phones = [];

for (const t of tickets) {
  const openedByIdRaw = (t.openedById || "").trim();
  const contactRaw = (t.contact || "").trim();

  if (openedByIdRaw && isUuid(openedByIdRaw)) {
    userIds.push(openedByIdRaw);
  }

  const candidates = [
    contactRaw,
    (!isUuid(openedByIdRaw) ? openedByIdRaw : ""),
  ].filter(Boolean);

  for (const p of candidates) {
    const normalized = normalizePhone(p) || String(p).replace(/\D/g, "");
    if (normalized) phones.push(normalized);
    phones.push(p);
  }
}

// یکتا
const uniqUserIds = Array.from(new Set(userIds));
const uniqPhones = Array.from(new Set(phones));

// گرفتن همه کاربران مرتبط
const users = await prisma.user.findMany({
  where: {
    OR: [
      ...(uniqUserIds.length ? [{ id: { in: uniqUserIds } }] : []),
      ...(uniqPhones.length ? [{ phone: { in: uniqPhones } }] : []),
    ],
  },
  select: {
    id: true,
    phone: true,
    fullName: true,
    gender: true,
    birthDate: true,
    plan: true,
    planExpiresAt: true,
  },
});

    const mapped = tickets.map((t) => {
  const openedByIdRaw = (t.openedById || "").trim();
  const contactRaw = (t.contact || "").trim();

  let user = null;

  if (openedByIdRaw && isUuid(openedByIdRaw)) {
    user = users.find((u) => u.id === openedByIdRaw) || null;
  }

  if (!user) {
    const candidates = [
      contactRaw,
      (!isUuid(openedByIdRaw) ? openedByIdRaw : ""),
    ].filter(Boolean);

    const normalizedCandidates = candidates
      .map((p) => normalizePhone(p) || String(p).replace(/\D/g, ""))
      .filter(Boolean);

    user =
      users.find(
        (u) =>
          candidates.includes(u.phone) ||
          normalizedCandidates.includes(u.phone)
      ) || null;
  }

  return {
    ...t,
    title: t.openedByName || t.title,
    displayTitle: t.openedByName || t.title,
    user,
  };
});


    res.json({ ok: true, tickets: mapped });
  } catch (e) {
    console.error("admin/tickets error:", e?.message || "unknown_error");
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || ""));
}

router.get("/tickets/:id", allow("agent", "manager", "owner"), async (req, res) => {
  try {
    let t = await prisma.ticket.findUnique({
  where: { id: String(req.params.id) },
  include: {
    messages: { orderBy: { createdAt: "asc" } },
    assignedAdmin: {
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    },
  },
});
    if (!t) return res.status(404).json({ ok: false, error: "not_found" });

    // اگر هنوز مسئول ندارد، ادمین فعلی مسئول شود
if (!t.assignedAdminId && req.admin?.id) {
  await prisma.ticket.update({
    where: { id: t.id },
    data: {
      assignedAdminId: req.admin.id,
    },
  });

  t = await prisma.ticket.findUnique({
    where: { id: t.id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      assignedAdmin: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });
}


    // ✅ user lookup: openedById اگر UUID بود = userId، وگرنه با phone های ممکن
let user = null;

const openedByIdRaw = (t.openedById || "").trim();
const contactRaw = (t.contact || "").trim();

if (openedByIdRaw && isUuid(openedByIdRaw)) {
  user = await prisma.user.findUnique({
    where: { id: openedByIdRaw },
    select: {
      id: true,
      phone: true,
      fullName: true,
      gender: true,
      birthDate: true,
      plan: true,
      planExpiresAt: true,
    },
  }).catch(() => null);
}

if (!user) {
  // کاندیداهای شماره: contact + openedById (اگر UUID نبود احتمالاً شماره است)
  const candidates = [
    contactRaw,
    (!isUuid(openedByIdRaw) ? openedByIdRaw : ""),
  ].filter(Boolean);

  // نرمال‌سازی (09... / 989... / +98...)
  const normalized = candidates
    .map((p) => normalizePhone(p) || String(p).replace(/\D/g, ""))
    .filter(Boolean);

  // یکتا
  const uniq = Array.from(new Set([...candidates, ...normalized])).filter(Boolean);

  if (uniq.length) {
    user = await prisma.user.findFirst({
      where: { phone: { in: uniq } },
      select: {
        id: true,
        phone: true,
        fullName: true,
        gender: true,
        birthDate: true,
        plan: true,
        planExpiresAt: true,
      },
    }).catch(() => null);
  }
}

    const withDisplay = {
      ...t,
      title: t.openedByName || t.title,
      displayTitle: t.openedByName || t.title,
      user: user || null, // ✅ اینو فرانت لازم داره
    };

    return res.json({ ok: true, ticket: withDisplay });
  } catch (e) {
    console.error("admin/tickets/:id error:", e?.message || "unknown_error");
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

router.post("/tickets/:id/mark-read", allow("agent", "manager", "owner"), async (req, res) => {
  try {
    const id = String(req.params.id);
    const t = await prisma.ticket.update({
      where: { id },
      data: { unread: false },
      select: { id: true, unread: true },
    });
    return res.json({ ok: true, ticket: t });
  } catch (e) {
    if (e?.code === "P2025") return res.status(404).json({ ok: false, error: "not_found" });
    console.error("admin/tickets mark-read error:", e?.message || "unknown_error");
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

router.post("/tickets/:id/mark-unread", allow("agent", "manager", "owner"), async (req, res) => {
  try {
    const id = String(req.params.id);
    const t = await prisma.ticket.update({
      where: { id },
      data: { unread: true },
      select: { id: true, unread: true },
    });
    return res.json({ ok: true, ticket: t });
  } catch (e) {
    if (e?.code === "P2025") return res.status(404).json({ ok: false, error: "not_found" });
    console.error("admin/tickets mark-unread error:", e?.message || "unknown_error");
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

router.patch("/tickets/:id", allow("manager", "owner"), async (req, res) => {
  try {
    const id = String(req.params.id);
    const { status, pinned, unread } = req.body || {};
    const data = {};
    const toBool = (v) =>
      typeof v === "boolean" ? v : typeof v === "string" ? v.toLowerCase() === "true" : undefined;

    if (status !== undefined) {
      if (!["open", "pending", "closed"].includes(status)) {
        return res.status(400).json({ ok: false, error: "invalid_status" });
      }
      data.status = status;
    }

    const p = toBool(pinned);
    if (p !== undefined) data.pinned = p;

    const u = toBool(unread);
    if (u !== undefined) data.unread = u;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ ok: false, error: "no_fields_to_update" });
    }

    const ticket = await prisma.ticket.update({
      where: { id },
      data,
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    res.json({ ok: true, ticket });
  } catch (e) {
    if (e?.code === "P2025") return res.status(404).json({ ok: false, error: "not_found" });
    console.error("admin/tickets PATCH error:", e?.message || "unknown_error");
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

router.post("/tickets/:id/reply", allow("agent", "manager", "owner"), async (req, res) => {
  try {
    const id = String(req.params.id);
    const { text } = req.body || {};

    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ ok: false, error: "text_required" });
    }

    const exists = await prisma.ticket.findUnique({ where: { id } });
    if (!exists) return res.status(404).json({ ok: false, error: "not_found" });

    await prisma.message.create({
      data: { ticketId: id, sender: "admin", text: text.trim() },
    });

    await prisma.ticket.update({ where: { id }, data: { updatedAt: new Date() } });

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    return res.json({ ok: true, ticket });
  } catch (e) {
    console.error("admin/tickets reply error:", e?.message || "unknown_error");
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

router.post("/tickets/:id/delete", allow("manager", "owner"), async (req, res) => {
  try {
    const id = req.params.id;

    await prisma.message.deleteMany({ where: { ticketId: id } });
    const deleted = await prisma.ticket.delete({ where: { id } }).catch(() => null);

    if (!deleted) return res.status(404).json({ ok: false, error: "not_found" });
    return res.json({ ok: true });
  } catch (e) {
    console.error("admin tickets/:id/delete error:", e?.message || "unknown_error");
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

/* ====================== ⬇️ reply-upload ====================== */

const MAX_UPLOAD = 25 * 1024 * 1024;
function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const now = new Date();
    const dir = path.join(
      "uploads",
      String(now.getFullYear()),
      String(now.getMonth() + 1).toString().padStart(2, "0")
    );
    ensureDirSync(dir);
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const base = crypto.randomBytes(16).toString("hex");
    cb(null, `${base}${ext || ""}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD },
});
function mimeToMessageType(mime = "") {
  const m = String(mime).toLowerCase();
  if (m.startsWith("audio/")) return "voice";
  if (m.startsWith("image/")) return "image";
  return "file";
}

router.post(
  "/tickets/:id/reply-upload",
  allow("agent", "manager", "owner"),
  upload.single("file"),
  async (req, res) => {
    try {
      const id = String(req.params.id);
      const exists = await prisma.ticket.findUnique({ where: { id } });
      if (!exists) return res.status(404).json({ ok: false, error: "not_found" });

      if (!req.file) return res.status(400).json({ ok: false, error: "file_required" });

      const { mimetype, size, filename, destination } = req.file;
      const relDir = destination.replace(/\\/g, "/");
      const fileUrl = `/${relDir}/${filename}`;

      const messageType = mimeToMessageType(mimetype);
      const text = req.body?.text ? String(req.body.text).trim() : null;

      let durationSec = null;
      if (req.body?.durationSec !== undefined && req.body.durationSec !== "") {
        const d = Number(req.body.durationSec);
        if (!Number.isNaN(d) && d >= 0) durationSec = Math.floor(d);
      }

      const created = await prisma.message.create({
        data: {
          ticketId: id,
          sender: "admin",
          type: messageType,
          text,
          fileUrl,
          mime: mimetype || null,
          size: size || null,
          durationSec,
        },
      });

      await prisma.ticket.update({ where: { id }, data: { updatedAt: new Date() } });

      const ticket = await prisma.ticket.findUnique({
        where: { id },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });

      return res.json({ ok: true, ticket, message: created });
    } catch (e) {
      console.error("admin/reply-upload error:", e?.message || "unknown_error");
      if (e && e.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ ok: false, error: "file_too_large" });
      }
      return res.status(500).json({ ok: false, error: "internal_error" });
    }
  }
);

/* ====== 👇👇👇 ایجاد ادمین فقط توسط Owner 👇👇👇 ====== */
router.post("/admins", allow("owner"), async (req, res) => {
  try {
    const { email, name, role, password } = req.body || {};

    if (!email || !password || !role) {
      return res.status(400).json({ ok: false, error: "missing_fields" });
    }
    const roleStr = String(role);
    if (!["owner", "manager", "agent"].includes(roleStr)) {
      return res.status(400).json({ ok: false, error: "invalid_role" });
    }

    const emailNorm = String(email).trim().toLowerCase();
    const nameNorm = name ? String(name).trim() : null;
    const passwordHash = await bcrypt.hash(String(password), 10);
    const apiKey = `admin-${crypto.randomBytes(8).toString("hex")}`;

    const created = await prisma.admin.create({
      data: {
        email: emailNorm,
        name: nameNorm,
        role: roleStr,
        passwordHash,
        apiKey,
      },
      select: { id: true, email: true, name: true, role: true, apiKey: true },
    });

    return res.json({ ok: true, admin: created });
  } catch (e) {
    if (e?.code === "P2002") {
      const target = Array.isArray(e?.meta?.target)
        ? e.meta.target.join(",")
        : String(e?.meta?.target || "");
      if (target.includes("email")) return res.status(409).json({ ok: false, error: "email_taken" });
      if (target.includes("apiKey")) return res.status(409).json({ ok: false, error: "api_key_taken" });
      return res.status(409).json({ ok: false, error: "unique_violation" });
    }
    console.error("admin/create-admin error:", e?.message || "unknown_error");
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/* ====== 👇 مدیریت ادمین‌ها (فقط owner) 👇 ====== */

async function ownersCount() {
  return prisma.admin.count({ where: { role: "owner" } });
}

router.get("/admins", allow("owner"), async (_req, res) => {
  try {
    const admins = await prisma.admin.findMany({
      orderBy: [{ role: "asc" }, { createdAt: "desc" }],
      select: { id: true, email: true, name: true, role: true, apiKey: true, createdAt: true },
      take: 500,
    });
    res.json({ ok: true, admins });
  } catch (e) {
    console.error("admin/admins GET error:", e?.message || "unknown_error");
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

router.patch("/admins/:id", allow("owner"), async (req, res) => {
  try {
    const id = String(req.params.id);
    const { role, name } = req.body || {};

    if (role && !["owner", "manager", "agent"].includes(String(role))) {
      return res.status(400).json({ ok: false, error: "invalid_role" });
    }
    if (role && role !== "owner") {
      const target = await prisma.admin.findUnique({ where: { id }, select: { role: true } });
      if (!target) return res.status(404).json({ ok: false, error: "not_found" });
      if (target.role === "owner") {
        const cnt = await ownersCount();
        if (cnt <= 1) return res.status(409).json({ ok: false, error: "last_owner_protected" });
      }
    }

    const updated = await prisma.admin.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name ? String(name).trim() : null } : {}),
        ...(role ? { role: String(role) } : {}),
      },
      select: { id: true, email: true, name: true, role: true, apiKey: true },
    });
    res.json({ ok: true, admin: updated });
  } catch (e) {
    if (e?.code === "P2025") return res.status(404).json({ ok: false, error: "not_found" });
    console.error("admin/admins PATCH error:", e?.message || "unknown_error");
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

router.delete("/admins/:id", allow("owner"), async (req, res) => {
  try {
    const id = String(req.params.id);

    if (req.admin?.id === id) {
      return res.status(409).json({ ok: false, error: "cannot_delete_self" });
    }

    const target = await prisma.admin.findUnique({ where: { id }, select: { role: true } });
    if (!target) return res.status(404).json({ ok: false, error: "not_found" });
    if (target.role === "owner") {
      const cnt = await ownersCount();
      if (cnt <= 1) return res.status(409).json({ ok: false, error: "last_owner_protected" });
    }

    await prisma.admin.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    if (e?.code === "P2025") return res.status(404).json({ ok: false, error: "not_found" });
    console.error("admin/admins DELETE error:", e?.message || "unknown_error");
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

router.post("/admins/:id/reset-password", allow("owner"), async (req, res) => {
  try {
    const id = String(req.params.id);
    const password = String(req.body?.password || "");

    if (!password || password.length < 6) {
      return res.status(400).json({ ok: false, error: "password_too_short" });
    }

    const target = await prisma.admin.findUnique({ where: { id }, select: { id: true } });
    if (!target) return res.status(404).json({ ok: false, error: "not_found" });

    const hash = await bcrypt.hash(password, 10);

    await prisma.$transaction([
      prisma.admin.update({ where: { id }, data: { passwordHash: hash } }),
      prisma.adminSession.deleteMany({ where: { adminId: id } }),
    ]);

    return res.json({ ok: true });
  } catch (e) {
    console.error("admin/admins reset-password error:", e?.message || "unknown_error");
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

export default router;