// routes/tickets.js
import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import path from "path";
import { isUserPro } from "../services/planStatus.js";
import { requireTicketIdentity } from "./_ticketIdentity.js";

const prisma = new PrismaClient();

const UPLOAD_ROOT =
  process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

/* ================= helper پلن برای چت درمانگر ================= */
/**
 * اگر type = "therapy" باشد، چک می‌کند کاربر واقعا PRO/VIP هست یا نه.
 * - اگر اجازه نداشته باشد → خودش 403 می‌دهد و true برمی‌گرداند (یعنی روت باید return کند).
 * - اگر اجازه داشته باشد یا تیکت فنی باشد → false برمی‌گرداند.
 */
async function checkTherapyAccessOrReject({ res, type, openedById, contact }) {
  const t = (type || "").toString().toLowerCase();
  if (t !== "therapy") return false; // تیکت فنی؛ نیازی به چک پلن نیست

  const userKey =
    (openedById && String(openedById)) ||
    (contact && String(contact)) ||
    null;

  if (!userKey) {
    res.status(403).json({
      ok: false,
      error: "therapy_requires_pro",
    });
    return true;
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ phone: userKey }, { id: userKey }],
      },
    });

    if (!user || !isUserPro(user)) {
      res.status(403).json({
        ok: false,
        error: "therapy_requires_pro",
      });
      return true;
    }

    return false;
  } catch (err) {
    console.error("[tickets.therapyAccess] error:", err?.message || "unknown_error");
    res.status(500).json({ ok: false, error: "therapy_check_failed" });
    return true;
  }
}

/* ====================== روتر پنل/ادمین (قدیمی) ====================== */

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

/* ====================== روتر عمومی کاربر ====================== */

export const publicTicketsRouter = Router();

/**
 * GET /api/public/tickets/open
 * query: ?type=tech|therapy & openedById=... &/or contact=...
 *
 * اگر تیکتی پیدا نشود → ۲۰۰ با { ok:false, error:"not_found", ticket:null }
 */
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
      return res.json({
        ok: false,
        error: "missing_identity",
        ticket: null,
      });
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
      return res.json({ ok: false, error: "not_found", ticket: null });
    }

    const withDisplay = {
      ...t,
      displayTitle: t.openedByName || t.title,
    };

    return res.json({ ok: true, ticket: withDisplay });
  } catch (e) {
    console.error("[tickets.public.open] error:", e?.message || "unknown_error");
    return res
      .status(500)
      .json({ ok: false, error: "internal_error" });
  }
});

/**
 * GET /api/public/tickets/:id
 */
publicTicketsRouter.get("/:id", async (req, res) => {
  try {
    const identity = requireTicketIdentity(req);

    const id = String(req.params.id);
    const t = await prisma.ticket.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!t) return res.status(404).json({ ok: false, error: "not_found" });
    const withDisplay = { ...t, displayTitle: t.openedByName || t.title };
    res.json({ ok: true, ticket: withDisplay });
  } catch (e) {
  console.error("[tickets.public.detail] error:", e?.message || "unknown_error");
  res.status(e?.statusCode || 500).json({ ok: false, error: e?.message || "internal_error" });
}
});


/**
 * POST /api/public/tickets/send
 * body: { type, text, openedById, openedByName, contact }
 */
publicTicketsRouter.post("/send", async (req, res) => {
  try {
    const { type, text, openedById, openedByName, contact } = req.body || {};
    const msgText = (text || "").trim();
    if (!msgText)
      return res.status(400).json({ ok: false, error: "text_required" });

    const tType = String(type || "tech").toLowerCase();
    if (tType !== "tech" && tType !== "therapy") {
      return res.status(400).json({ ok: false, error: "invalid_type" });
    }

    // 🔒 گارد پلن برای چت درمانگر
    const blocked = await checkTherapyAccessOrReject({
      res,
      type: tType,
      openedById,
      contact,
    });
    if (blocked) return;

    const latestName = (openedByName || "کاربر").toString().trim();

    let ticket = await prisma.ticket.findFirst({
      where: {
        type: tType,
        status: { in: ["open", "pending"] },
        OR: [
          openedById ? { openedById: String(openedById) } : null,
          contact ? { contact: String(contact) } : null,
        ].filter(Boolean),
      },
      select: { id: true, openedByName: true, title: true },
    });

    if (!ticket) {
      ticket = await prisma.ticket.create({
        data: {
          type: tType,
          status: "open",
          title: latestName,
          description: msgText.slice(0, 500),
          contact: contact ?? null,
          ...(openedById ? { openedById: String(openedById) } : {}),
          openedByName: latestName,
          unread: true,
        },
        select: { id: true, openedByName: true, title: true },
      });
    } else if (ticket.openedByName !== latestName) {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { openedByName: latestName, title: latestName },
      });
    }

    await prisma.message.create({
      data: {
        ticketId: ticket.id,
        sender: "user",
        type: "text",
        text: msgText,
      },
    });

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { unread: true, updatedAt: new Date() },
    });

    const fresh = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    const withDisplay = fresh
      ? { ...fresh, displayTitle: fresh.openedByName || fresh.title }
      : fresh;
    return res.json({ ok: true, ticket: withDisplay });
  } catch (e) {
    console.error("[tickets.public.send] error:", e?.message || "unknown_error");
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/**
 * POST /api/public/tickets/:id/reply
 * body: { text, openedById?, openedByName? }
 *
 * این روت قبلا اشتباهی دوباره /open بود؛ همین باعث می‌شد پیام جدید ذخیره نشود.
 */
publicTicketsRouter.post("/:id/reply", async (req, res) => {
  try {
    const id = String(req.params.id);
    const { text, openedById, openedByName } = req.body || {};

    const msgText = (text || "").trim();
    if (!msgText) {
      return res.status(400).json({ ok: false, error: "text_required" });
    }

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

    if (!exists) {
      return res.status(404).json({ ok: false, error: "not_found" });
    }

    // 🔒 گارد پلن برای چت درمانگر
    const blocked = await checkTherapyAccessOrReject({
      res,
      type: exists.type,
      openedById: openedById || exists.openedById,
      contact: exists.contact,
    });
    if (blocked) return;

    const latestName = (openedByName || exists.openedByName || "کاربر")
      .toString()
      .trim();

    const updateData = {};
    if (latestName && latestName !== exists.openedByName) {
      updateData.openedByName = latestName;
      updateData.title = latestName;
    }
    if (openedById && openedById !== exists.openedById) {
      updateData.openedById = String(openedById);
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.ticket.update({
        where: { id },
        data: updateData,
      });
    }

    await prisma.message.create({
      data: {
        ticketId: id,
        sender: "user",
        type: "text",
        text: msgText,
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

    return res.json({ ok: true, ticket: withDisplay });
  } catch (e) {
    console.error("[tickets.public.reply] error:", e?.message || "unknown_error");
    return res.status(500).json({ ok: false, error: "internal_error" });
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

    const openedByIdBody =
      req.body?.openedById !== undefined && req.body.openedById !== null
        ? String(req.body.openedById)
        : undefined;
    const openedByNameBody =
      req.body?.openedByName !== undefined && req.body.openedByName !== null
        ? String(req.body.openedByName)
        : undefined;

    // 🔒 گارد پلن برای چت درمانگر
    const blocked = await checkTherapyAccessOrReject({
      res,
      type: exists.type,
      openedById: openedByIdBody || exists.openedById,
      contact: exists.contact,
    });
    if (blocked) return;

    const dataUpdate = {};
    if (
      openedByNameBody &&
      openedByNameBody.trim() &&
      openedByNameBody.trim() !== exists.openedByName
    ) {
      dataUpdate.openedByName = openedByNameBody.trim();
      dataUpdate.title = openedByNameBody.trim();
    }
    if (openedByIdBody && openedByIdBody !== exists.openedById) {
      dataUpdate.openedById = openedByIdBody;
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

      // مسیر نسبی فایل نسبت به ریشه‌ی uploads، مثل "2025/xxxxx.m4a"
      const relPath = path
        .relative(UPLOAD_ROOT, f.path || "")
        .replace(/\\/g, "/");

      fileUrl = relPath ? `/uploads/${relPath}` : null;

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
    console.error("[tickets.public.replyUpload] error:", e?.message || "unknown_error");
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

// ====================== اکسپورت‌ها ======================
export default router;