// routes/tickets.js
import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import path from "path";

const prisma = new PrismaClient();

// ====================== روتر پنل/ادمین (قدیمی شما) ======================
const router = Router();

/**
 * POST /api/tickets
 * body: { title, description, contact?, type?, openedById?, openedByName? }
 *        type: "tech" | "therapy"
 */
router.post("/", async (req, res) => {
  try {
    const { title, description, contact, type, openedById, openedByName } = req.body || {};
    if (!title || !description) {
      return res.status(400).json({ ok: false, error: "title and description are required" });
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
    const mapped = list.map((t) => ({ ...t, displayTitle: t.openedByName || t.title }));
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
    if (!text) return res.status(400).json({ ok: false, error: "text required" });
    const exists = await prisma.ticket.findUnique({ where: { id } });
    if (!exists) return res.status(404).json({ ok: false, error: "not_found" });
    const message = await prisma.message.create({
      data: { ticketId: id, sender: "admin", text },
    });
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    const withDisplay = ticket ? { ...ticket, displayTitle: ticket.openedByName || ticket.title } : ticket;
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

/**
 * GET /api/public/tickets/:id
 */
publicTicketsRouter.get("/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const t = await prisma.ticket.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!t) return res.status(404).json({ ok: false, error: "not_found" });
    const withDisplay = { ...t, displayTitle: t.openedByName || t.title };
    res.json({ ok: true, ticket: withDisplay });
  } catch (e) {
    console.error("public tickets/:id error:", e);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/**
 * POST /api/public/tickets/send
 */
publicTicketsRouter.post("/send", async (req, res) => {
  try {
    const { type, text, openedById, openedByName, contact } = req.body || {};
    const msgText = (text || "").trim();
    if (!msgText) return res.status(400).json({ ok: false, error: "text_required" });
    const tType = String(type || "tech").toLowerCase();
    if (tType !== "tech" && tType !== "therapy") {
      return res.status(400).json({ ok: false, error: "invalid_type" });
    }
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
      data: { ticketId: ticket.id, sender: "user", type: "text", text: msgText },
    });
    await prisma.ticket.update({ where: { id: ticket.id }, data: { unread: true, updatedAt: new Date() } });

    const fresh = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    const withDisplay = fresh ? { ...fresh, displayTitle: fresh.openedByName || fresh.title } : fresh;
    return res.json({ ok: true, ticket: withDisplay });
  } catch (e) {
    console.error("public tickets/send error:", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/**
 * POST /api/public/tickets/:id/reply
 */
publicTicketsRouter.post("/:id/reply", async (req, res) => {
  try {
    const id = String(req.params.id);
    const { text, openedByName } = req.body || {};
    const msgText = (text || "").trim();
    if (!msgText) return res.status(400).json({ ok: false, error: "text_required" });

    const exists = await prisma.ticket.findUnique({ where: { id } });
    if (!exists) return res.status(404).json({ ok: false, error: "not_found" });

    const latestName = (openedByName || "").toString().trim();
    if (latestName && latestName !== exists.openedByName) {
      await prisma.ticket.update({ where: { id }, data: { openedByName: latestName, title: latestName } });
    }

    await prisma.message.create({
      data: { ticketId: id, sender: "user", type: "text", text: msgText },
    });
    await prisma.ticket.update({ where: { id }, data: { unread: true, updatedAt: new Date() } });

    const fresh = await prisma.ticket.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } }, // ← اصلاح شد
    });
    const withDisplay = fresh ? { ...fresh, displayTitle: fresh.openedByName || fresh.title } : fresh;
    res.json({ ok: true, ticket: withDisplay });
  } catch (e) {
    console.error("public tickets/:id/reply error:", e);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/**
 * POST /api/public/tickets/:id/reply-upload
 * form-data: file? , text? , durationSec?
 */
publicTicketsRouter.post("/:id/reply-upload", async (req, res) => {
  try {
    const id = String(req.params.id);
    const exists = await prisma.ticket.findUnique({ where: { id } });
    if (!exists) return res.status(404).json({ ok: false, error: "not_found" });

    const rawText = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    const hasText = rawText.length > 0;

    // فایل (بدون تایپ‌اسکریپت)
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

    await prisma.ticket.update({ where: { id }, data: { unread: true, updatedAt: new Date() } });

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    const withDisplay = ticket ? { ...ticket, displayTitle: ticket.openedByName || ticket.title } : ticket;

    res.json({ ok: true, ticket: withDisplay });
  } catch (e) {
    console.error("public tickets/:id/reply-upload error:", e);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

// ====================== اکسپورت‌ها ======================
export default router;