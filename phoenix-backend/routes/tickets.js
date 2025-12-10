// routes/tickets.js
import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import path from "path";
import { isUserPro } from "../services/planStatus.js";

const prisma = new PrismaClient();

// ================= helper پلن برای چت درمانگر =================

/**
 * بسته به نوع تیکت اگر therapy باشد، چک می‌کند که کاربر اجازه چت درمانگر دارد یا نه.
 * اگر اجازه نداشته باشد:
 *   - خودش 403 برمی‌گرداند
 *   - true برمی‌گرداند (یعنی روت باید return کند و ادامه ندهد)
 * اگر اجازه داشته باشد یا تیکت فنی باشد:
 *   - false برمی‌گرداند (یعنی روت می‌تواند ادامه بدهد)
 */
async function checkTherapyAccessOrReject({ res, type, openedById, contact }) {
  const t = (type || "").toString().toLowerCase();
  if (t !== "therapy") return false; // تیکت فنی است؛ نیازی به چک پلن نیست

  // سعی می‌کنیم با phone یا id کاربر را پیدا کنیم
  const userKey =
    (openedById && String(openedById)) ||
    (contact && String(contact)) ||
    null;

  if (!userKey) {
    res.status(403).json({
      ok: false,
      error: "therapy_requires_pro", // کاربر مشخص نیست، اجازه نمی‌دیم
    });
    return true;
  }

  try {
    // سعی می‌کنیم هم با phone هم با id پیداش کنیم
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ phone: userKey }, { id: userKey }],
      },
    });

    if (!user || !isUserPro(user)) {
      // یا کاربر پیدا نشد، یا پلن پرو / وی‌آی‌پی فعال ندارد
      res.status(403).json({
        ok: false,
        error: "therapy_requires_pro",
      });
      return true;
    }

    // اوکی؛ اجازه داریم ادامه بدهیم
    return false;
  } catch (err) {
    console.error("[tickets] therapy access check failed:", err);
    res.status(500).json({ ok: false, error: "therapy_check_failed" });
    return true;
  }
}

// ====================== روتر پنل/ادمین (قدیمی) ======================

const router = Router();

/**
 * POST /api/tickets
 * body: { title, description, contact?, type?, openedById?, openedByName? }
 *        type: "tech" | "therapy"
 */
router.post("/", async (req, res) => {
  try {
    const { title, description, contact, type, openedById, openedByName } =
      req.body || {};

    if (!title || !description) {
      return res
        .status(400)
        .json({ ok: false, error: "title and description are required" });
    }

    let ticketType;
    if (typeof type === "string") {
      const t = type.toLowerCase();
      if (t === "tech" || t === "therapy") ticketType = t;
      else return res.status(400).json({ ok: false, error: "invalid_type" });
    }

    const t = await prisma.ticket.create({
      data: {
        title,
        description,
        contact: contact ?? null,
        status: "open",
        ...(ticketType ? { type: ticketType } : {}),
        ...(openedById ? { openedById } : {}),
        ...(openedByName ? { openedByName } : {}),
      },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    const withDisplay = { ...t, displayTitle: t.openedByName || t.title };
    res.json({ ok: true, ticket: withDisplay });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/**
 * GET /api/tickets
 * optional query: ?contact=... & ?type=tech|therapy
 */
router.get("/", async (req, res) => {
  try {
    const { contact, type } = req.query;
    const where = {};
    if (contact) where.contact = String(contact);
    if (type) {
      const t = String(type).toLowerCase();
      if (t !== "tech" && t !== "therapy") {
        return res.status(400).json({ ok: false, error: "invalid_type" });
      }
      where.type = t;
    }

    const list = await prisma.ticket.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    const mapped = list.map((t) => ({
      ...t,
      displayTitle: t.openedByName || t.title,
    }));
    res.json({ ok: true, tickets: mapped });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/**
 * GET /api/tickets/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const t = await prisma.ticket.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!t) return res.status(404).json({ ok: false, error: "not_found" });
    const withDisplay = { ...t, displayTitle: t.openedByName || t.title };
    res.json({ ok: true, ticket: withDisplay });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/**
 * POST /api/tickets/:id/reply
 * body: { text }
 * sender = "admin"
 */
router.post("/:id/reply", async (req, res) => {
  try {
    const id = String(req.params.id);
    const { text } = req.body || {};
    if (!text)
      return res.status(400).json({ ok: false, error: "text required" });

    const exists = await prisma.ticket.findUnique({ where: { id } });
    if (!exists)
      return res.status(404).json({ ok: false, error: "not_found" });

    const message = await prisma.message.create({
      data: { ticketId: id, sender: "admin", text },
    });

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    const withDisplay = ticket
      ? { ...ticket, displayTitle: ticket.openedByName || ticket.title }
      : ticket;
    res.json({ ok: true, ticket: withDisplay, message });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/**
 * PATCH /api/tickets/:id/status
 * body: { status }  -> open | pending | closed
 */
router.patch("/:id/status", async (req, res) => {
  try {
    const id = String(req.params.id);
    const { status } = req.body || {};
    if (!["open", "pending", "closed"].includes(status)) {
      return res.status(400).json({ ok: false, error: "invalid_status" });
    }

    const t = await prisma.ticket.update({
      where: { id },
      data: { status },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    const withDisplay = { ...t, displayTitle: t.openedByName || t.title };
    res.json({ ok: true, ticket: withDisplay });
  } catch (e) {
    if (e?.code === "P2025") {
      return res.status(404).json({ ok: false, error: "not_found" });
    }
    console.error(e);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

// ====================== روتر عمومی کاربر ======================

export const publicTicketsRouter = Router();

publicTicketsRouter.get("/open", async (req, res) => {
  try {
    const { type, openedById, contact } = req.query;

    const tType = String(type || "tech").toLowerCase();
    if (tType !== "tech" && tType !== "therapy") {
      return res.status(400).json({ ok: false, error: "invalid_type" });
    }

    const or = [];
    if (openedById) or.push({ openedById: String(openedById) });
    if (contact) or.push({ contact: String(contact) });

    if (or.length === 0) {
      return res
        .status(400)
        .json({ ok: false, error: "missing_identity" });
    }

    const t = await prisma.ticket.findFirst({
      where: {
        type: tType,
        status: { in: ["open", "pending"] },
        OR: or,
      },
      orderBy: { createdAt: "desc" },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!t) {
      // ⚠️ این‌جا عمداً ۲۰۰ می‌دیم تا WCDN صفحهٔ HTML نده
      return res.json({ ok: false, error: "not_found", ticket: null });
    }

    const withDisplay = {
      ...t,
      displayTitle: t.openedByName || t.title,
    };

    return res.json({ ok: true, ticket: withDisplay });
  } catch (e) {
    console.error("public tickets/open error:", e);
    return res
      .status(500)
      .json({ ok: false, error: "internal_error" });
  }
});

/**
 * POST /api/public/tickets/:id/reply-upload
 * form-data: file? , text? , durationSec?
 */
publicTicketsRouter.post("/:id/reply-upload", async (req, res) => {
  try {
    const id = String(req.params.id);

    const exists = await prisma.ticket.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        openedById: true,
        openedByName: true,
        contact: true,
      },
    });
    if (!exists)
      return res.status(404).json({ ok: false, error: "not_found" });

    const rawText =
      typeof req.body?.text === "string" ? req.body.text.trim() : "";
    const hasText = rawText.length > 0;

    const openedById =
      req.body?.openedById !== undefined && req.body.openedById !== null
        ? String(req.body.openedById)
        : undefined;
    const openedByName =
      req.body?.openedByName !== undefined && req.body.openedByName !== null
        ? String(req.body.openedByName)
        : undefined;

    // 🔒 گارد پلن برای چت درمانگر
    const blocked = await checkTherapyAccessOrReject({
      res,
      type: exists.type,
      openedById: openedById || exists.openedById,
      contact: exists.contact,
    });
    if (blocked) return;

    // آپدیت نام/آیدی اگر لازم بود
    const dataUpdate = {};
    if (
      openedByName &&
      openedByName.trim() &&
      openedByName.trim() !== exists.openedByName
    ) {
      dataUpdate.openedByName = openedByName.trim();
      dataUpdate.title = openedByName.trim();
    }
    if (openedById && openedById !== exists.openedById) {
      dataUpdate.openedById = openedById;
    }
    if (Object.keys(dataUpdate).length > 0) {
      await prisma.ticket.update({ where: { id }, data: dataUpdate });
    }

    const f = req.file;
    let messageType = "text";
    let fileUrl = null;
    let mime = null;
    let size = null;
    let durationSec = null;

    if (f) {
      mime = f.mimetype || null;
      size = typeof f.size === "number" ? f.size : null;
      const filename = path.basename(f.path || f.filename || "");
      fileUrl = filename ? `/uploads/${filename}` : null;
      const mt = (mime || "").toLowerCase();
      if (mt.startsWith("audio/")) messageType = "voice";
      else if (mt.startsWith("image/")) messageType = "image";
      else messageType = "file";
    }

    if (req.body?.durationSec !== undefined) {
      const d = Number(req.body.durationSec);
      if (!Number.isNaN(d) && d >= 0) durationSec = Math.floor(d);
    }

    if (!f && !hasText) {
      return res.status(400).json({ ok: false, error: "no_content" });
    }

    await prisma.message.create({
      data: {
        ticketId: id,
        sender: "user",
        type: f ? messageType : "text",
        text: hasText ? rawText : null,
        fileUrl,
        mime,
        size,
        durationSec,
      },
    });

    await prisma.ticket.update({
      where: { id },
      data: { unread: true, updatedAt: new Date() },
    });

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    const withDisplay = ticket
      ? { ...ticket, displayTitle: ticket.openedByName || ticket.title }
      : ticket;
    res.json({ ok: true, ticket: withDisplay });
  } catch (e) {
    console.error("public tickets/:id/reply-upload error:", e);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

// ====================== اکسپورت‌ها ======================

export { publicTicketsRouter };
export default router;