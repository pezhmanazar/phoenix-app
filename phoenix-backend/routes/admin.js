// routes/admin.js
import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";

// ⬇️ افزوده‌های مرحله ویس/فایل
import multer from "multer";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();
const router = Router();

// Helper: ساعت به جلو
const inHours = (h) => new Date(Date.now() + h * 3600 * 1000);

// فقط در حالت dev این روت فعال باشه
if (process.env.NODE_ENV !== "production") {
  router.get("/_debug/admins", async (req, res) => {
    const admins = await prisma.admin.findMany({
      select: {
        email: true,
        role: true,
        apiKey: true,
        passwordHash: true,
      },
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
      admin = await prisma.admin.findUnique({ where: { email: String(email).trim() } });
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
    });
  } catch (e) {
    console.error("admin/login error:", e);
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
    console.error("admin/verify error:", e);
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
    console.error("admin/logout error:", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

// ===== میدل‌ور احراز هویت سشن
async function sessionAuth(req, res, next) {
  try {
    const token = String(req.headers["x-admin-token"] || "");
    if (!token) return res.status(401).json({ ok: false, error: "token_required" });

    const session = await prisma.adminSession.findUnique({
      where: { token },
      include: { admin: true },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      return res.status(401).json({ ok: false, error: "invalid_or_expired" });
    }
    req.admin = session.admin;
    next();
  } catch (e) {
    console.error("sessionAuth error:", e);
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

/* ====================== ✅ profile (افزودنی جدید) ====================== */
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
    console.error("admin/profile PATCH error:", e);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});
/* ==================== پایان بخش profile (افزودنی) ===================== */

/**
 * ✅ لیست تیکت‌ها + فیلتر/جستجو (سنجاق‌شده‌ها اول)
 * GET /api/admin/tickets?status=open|pending|closed&type=tech|therapy&q=...
 * دسترسی: agent/manager/owner
 */
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
      include: { messages: { orderBy: { createdAt: "asc" } } },
      take: 200,
    });

    const mapped = tickets.map((t) => ({
      ...t,
      title: t.openedByName || t.title,
      displayTitle: t.openedByName || t.title,
    }));

    res.json({ ok: true, tickets: mapped });
  } catch (e) {
    console.error("admin/tickets error:", e);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/**
 * ✅ جزئیات یک تیکت
 * GET /api/admin/tickets/:id
 * دسترسی: agent/manager/owner
 */
router.get("/tickets/:id", async (req, res) => {
  try {
    const t = await prisma.ticket.findUnique({
      where: { id: String(req.params.id) },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!t) return res.status(404).json({ ok: false, error: "not_found" });

    const withDisplay = {
      ...t,
      title: t.openedByName || t.title,
      displayTitle: t.openedByName || t.title,
    };

    res.json({ ok: true, ticket: withDisplay });
  } catch (e) {
    console.error("admin/tickets/:id error:", e);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/* ===== ✅ جدید: علامت‌گذاری خوانده/نخوانده (چراغ قرمز) ===== */
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
    console.error("admin/tickets mark-read error:", e);
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
    console.error("admin/tickets mark-unread error:", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});
/* ===== پایان بخش جدید ===== */

/**
 * ✅ بروزرسانی وضعیت/سنجاق/خوانده‌نشده
 * PATCH /api/admin/tickets/:id
 * body: { status?: "open"|"pending"|"closed", pinned?: boolean|string, unread?: boolean|string }
 * دسترسی: manager/owner
 */
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
    console.error("admin/tickets PATCH error:", e);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/**
 * ✅ ارسال پاسخ ادمین (متنی)
 * POST /api/admin/tickets/:id/reply
 * body: { text: string }
 * دسترسی: agent/manager/owner
 */
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

    // (پوش موقتاً حذف شد)

    return res.json({ ok: true, ticket });
  } catch (e) {
    console.error("admin/tickets reply error:", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/* ====================== ⬇️ پاسخ ادمین با فایل/ویس/عکس ⬇️ ====================== */

const MAX_UPLOAD = 25 * 1024 * 1024;
function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const now = new Date();
    const dir = path.join("uploads", String(now.getFullYear()), String(now.getMonth() + 1).toString().padStart(2, "0"));
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

/**
 * ✅ ارسال پاسخ ادمین با فایل (ویس/عکس/فایل)
 * POST /api/admin/tickets/:id/reply-upload
 * headers: x-admin-token
 * form-data:
 *   - file: (required)
 *   - text: (optional)
 *   - durationSec: (optional)
 * دسترسی: agent/manager/owner
 */
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

      // (پوش موقتاً حذف شد)

      return res.json({ ok: true, ticket, message: created });
    } catch (e) {
      console.error("admin/reply-upload error:", e);
      if (e && e.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ ok: false, error: "file_too_large" });
      }
      return res.status(500).json({ ok: false, error: "internal_error" });
    }
  }
);

/* ====== 👇👇👇 ایجاد ادمین فقط توسط Owner (نسخه‌ی Postgres) 👇👇👇 ====== */
router.post("/admins", allow("owner"), async (req, res) => {
  try {
    const { email, name, role, password } = req.body || {};

    // اعتبارسنجی اولیه
    if (!email || !password || !role) {
      return res.status(400).json({ ok: false, error: "missing_fields" });
    }
    if (!["owner", "manager", "agent"].includes(String(role))) {
      return res.status(400).json({ ok: false, error: "invalid_role" });
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const trimmedPassword = String(password);
    if (trimmedPassword.length < 6) {
      return res.status(400).json({ ok: false, error: "password_too_short" });
    }

    const hash = await bcrypt.hash(trimmedPassword, 10);

    const data = {
      email: trimmedEmail,
      name: name ? String(name).trim() : null,
      role: String(role),
      passwordHash: hash,
      // اگر apiKey می‌خواهی برای لاگین API، می‌توانی این خط را فعال کنی:
      // apiKey: `admin-${crypto.randomBytes(8).toString("hex")}`,
    };

    const created = await prisma.admin.create({
      data,
      select: { id: true, email: true, name: true, role: true, apiKey: true },
    });

    return res.json({ ok: true, admin: created });
  } catch (e) {
    if (e?.code === "P2002") {
      const target = Array.isArray(e?.meta?.target)
        ? e.meta.target.join(",")
        : String(e?.meta?.target || "");
      if (target.includes("email")) {
        return res.status(409).json({ ok: false, error: "email_taken" });
      }
      if (target.includes("apiKey")) {
        return res.status(409).json({ ok: false, error: "api_key_taken" });
      }
      return res.status(409).json({ ok: false, error: "unique_violation" });
    }
    console.error("admin/create-admin error:", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});
/* ====== 👆👆👆 پایان نسخه‌ی جدید 👆👆👆 ====== */

/* ====== 👇 مدیریت ادمین‌ها (فقط owner) 👇 ====== */

async function ownersCount() {
  return prisma.admin.count({ where: { role: "owner" } });
}
function onlyOwner(res, admin) {
  if (admin.role !== "owner") {
    res.status(403).json({ ok: false, error: "forbidden" });
    return false;
  }
  return true;
}

router.get("/admins", allow("owner"), async (_req, res) => {
  try {
    const admins = await prisma.admin.findMany({
      orderBy: [{ role: "asc" }, { createdAt: "desc" } ],
      select: { id: true, email: true, name: true, role: true, apiKey: true, createdAt: true },
      take: 500,
    });
    res.json({ ok: true, admins });
  } catch (e) {
    console.error("admin/admins GET error:", e);
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
    console.error("admin/admins PATCH error:", e);
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
    console.error("admin/admins DELETE error:", e);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/* ====== ✅ افزوده جدید: ریست رمز توسط مالک ====== */
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
    console.error("admin/admins reset-password error:", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});
/* ====== پایان افزوده جدید ====== */

export default router;