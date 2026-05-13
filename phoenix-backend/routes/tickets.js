// routes/tickets.js
import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import multer from "multer";
import path from "path";
import { allowAdmin, authAdmin } from "../middleware/authAdmin.js";
import authUser from "../middleware/authUser.js";
import { isUserPro } from "../services/planStatus.js";
import {
  requireTicketIdentity,
  ticketMatchesIdentity,
} from "./_ticketIdentity.js";

const prisma = new PrismaClient();

const UPLOAD_ROOT =
  process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

const upload = multer({
  dest: path.join(UPLOAD_ROOT, "tickets"),
});

/* ================= helper پلن برای چت درمانگر ================= */
/**
 * اگر type = "therapy" باشد، چک می‌کند کاربر واقعا PRO/VIP هست یا نه.
 * - اگر اجازه نداشته باشد → خودش 403 می‌دهد و true برمی‌گرداند.
 * - اگر اجازه داشته باشد یا تیکت فنی باشد → false برمی‌گرداند.
 */
async function checkTherapyAccessOrReject({ res, type, openedById, contact }) {
  const t = (type || "").toString().toLowerCase();
  if (t !== "therapy") return false;

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
    console.error(
      "[tickets.therapyAccess] error:",
      err?.message || "unknown_error"
    );
    res.status(500).json({ ok: false, error: "therapy_check_failed" });
    return true;
  }
}

function sendPublicRouteError(res, e, extra = {}) {
  if (e?.publicCode === "UNAUTHORIZED") {
    return res.status(401).json({
      ok: false,
      error: "UNAUTHORIZED",
      ...extra,
    });
  }

  if (e?.publicCode === "TICKET_MISSING_IDENTITY") {
    return res.status(400).json({
      ok: false,
      error: "TICKET_MISSING_IDENTITY",
      ...extra,
    });
  }

  return res.status(e?.statusCode || 500).json({
    ok: false,
    error: e?.publicCode || "SERVER_ERROR",
    ...extra,
  });
}

function withDisplayTitle(ticket) {
  if (!ticket) return ticket;
  return {
    ...ticket,
    displayTitle: ticket.openedByName || ticket.title,
  };
}

function buildIdentityOrWhere(identity) {
  return [
    identity?.openedById ? { openedById: identity.openedById } : null,
    identity?.contact ? { contact: identity.contact } : null,
  ].filter(Boolean);
}

/* ====================== روتر پنل/ادمین (قدیمی) ====================== */

const router = Router();
router.use(authAdmin);

/**
 * POST /api/tickets
 * body: { title, description, contact?, type?, openedById?, openedByName? }
 *        type: "tech" | "therapy"
 */
router.post("/", allowAdmin("agent", "manager", "owner"), async (req, res) => {
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

    const withDisplay = withDisplayTitle(t);
    return res.json({ ok: true, ticket: withDisplay });
  } catch (e) {
    console.error("[tickets.admin.create] error:", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/**
 * GET /api/tickets
 * optional query: ?contact=... & ?type=tech|therapy
 */
router.get("/", allowAdmin("agent", "manager", "owner"), async (req, res) => {
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

    const mapped = list.map(withDisplayTitle);
    return res.json({ ok: true, tickets: mapped });
  } catch (e) {
    console.error("[tickets.admin.list] error:", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/**
 * GET /api/tickets/:id
 */
router.get("/:id", allowAdmin("agent", "manager", "owner"), async (req, res) => {
  try {
    const id = String(req.params.id);

    const t = await prisma.ticket.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!t) {
      return res.status(404).json({ ok: false, error: "not_found" });
    }

    return res.json({ ok: true, ticket: withDisplayTitle(t) });
  } catch (e) {
    console.error("[tickets.admin.detail] error:", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/**
 * POST /api/tickets/:id/reply
 * body: { text }
 * sender = "admin"
 */
router.post("/:id/reply", allowAdmin("agent", "manager", "owner"), async (req, res) => {
  try {
    const id = String(req.params.id);
    const rawText = typeof req.body?.text === "string" ? req.body.text : "";
    const text = rawText.trim();

    if (!text) {
      return res.status(400).json({ ok: false, error: "text required" });
    }

    const exists = await prisma.ticket.findUnique({ where: { id } });
    if (!exists) {
      return res.status(404).json({ ok: false, error: "not_found" });
    }

    const message = await prisma.message.create({
      data: { ticketId: id, sender: "admin", text },
    });

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    return res.json({
      ok: true,
      ticket: withDisplayTitle(ticket),
      message,
    });
  } catch (e) {
    console.error("[tickets.admin.reply] error:", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/**
 * PATCH /api/tickets/:id/status
 * body: { status }  -> open | pending | closed
 */
router.patch("/:id/status", allowAdmin("manager", "owner"), async (req, res) => {
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

    return res.json({ ok: true, ticket: withDisplayTitle(t) });
  } catch (e) {
    if (e?.code === "P2025") {
      return res.status(404).json({ ok: false, error: "not_found" });
    }

    console.error("[tickets.admin.status] error:", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/* ====================== روتر عمومی کاربر ====================== */

export const publicTicketsRouter = Router();
publicTicketsRouter.use(authUser);

/**
 * GET /api/public/tickets
 * optional query: ?type=tech|therapy
 * identity required
 */
publicTicketsRouter.get("/", async (req, res) => {
  try {
    const identity = requireTicketIdentity(req);
    const { type } = req.query || {};

    const orWhere = buildIdentityOrWhere(identity);

    const where = {
      OR: orWhere,
    };

    if (type) {
      const t = String(type).toLowerCase();
      if (t !== "tech" && t !== "therapy") {
        return res.status(400).json({
          ok: false,
          error: "TICKET_INVALID_TYPE",
        });
      }
      where.type = t;
    }

    const list = await prisma.ticket.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    return res.json({
      ok: true,
      tickets: list.map(withDisplayTitle),
    });
  } catch (e) {
    console.error("[tickets.public.list] error:", e?.message || "unknown_error");
    return sendPublicRouteError(res, e);
  }
});

/**
 * GET /api/public/tickets/open
 * query: ?type=tech|therapy
 */
publicTicketsRouter.get("/open", async (req, res) => {
  try {
    const identity = requireTicketIdentity(req);
    const { type } = req.query || {};

    const tType = String(type || "tech").toLowerCase();
    if (tType !== "tech" && tType !== "therapy") {
      return res.status(400).json({
        ok: false,
        error: "TICKET_INVALID_TYPE",
      });
    }

    const orWhere = buildIdentityOrWhere(identity);

    const t = await prisma.ticket.findFirst({
      where: {
        type: tType,
        status: { in: ["open", "pending"] },
        OR: orWhere,
      },
      orderBy: { createdAt: "desc" },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!t) {
      return res.json({
        ok: false,
        error: "TICKET_NOT_FOUND",
        ticket: null,
      });
    }

    return res.json({
      ok: true,
      ticket: withDisplayTitle(t),
    });
  } catch (e) {
    console.error("[tickets.public.open] error:", e?.message || "unknown_error");
    return sendPublicRouteError(res, e, { ticket: null });
  }
});

/**
 * GET /api/public/tickets/open-batch
 * هر دو تیکت باز tech و therapy را یکجا برمی‌گرداند
 */
publicTicketsRouter.get("/open-batch", async (req, res) => {
  try {
    const identity = requireTicketIdentity(req);
    const orWhere = buildIdentityOrWhere(identity);

    const [tech, therapy] = await Promise.all([
      prisma.ticket.findFirst({
        where: {
          type: "tech",
          status: { in: ["open", "pending"] },
          OR: orWhere,
        },
        orderBy: { createdAt: "desc" },
        include: {
          messages: { orderBy: { createdAt: "asc" } },
        },
      }),
      prisma.ticket.findFirst({
        where: {
          type: "therapy",
          status: { in: ["open", "pending"] },
          OR: orWhere,
        },
        orderBy: { createdAt: "desc" },
        include: {
          messages: { orderBy: { createdAt: "asc" } },
        },
      }),
    ]);

    return res.json({
      ok: true,
      tickets: {
        tech: withDisplayTitle(tech),
        therapy: withDisplayTitle(therapy),
      },
    });
  } catch (e) {
    console.error(
      "[tickets.public.openBatch] error:",
      e?.message || "unknown_error"
    );
    return sendPublicRouteError(res, e, {
      tickets: { tech: null, therapy: null },
    });
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
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!t) {
      return res.status(404).json({
        ok: false,
        error: "TICKET_NOT_FOUND",
      });
    }

    if (!ticketMatchesIdentity(t, identity)) {
      return res.status(403).json({
        ok: false,
        error: "TICKET_FORBIDDEN",
      });
    }

    return res.json({
      ok: true,
      ticket: withDisplayTitle(t),
    });
  } catch (e) {
    console.error("[tickets.public.detail] error:", e?.message || "unknown_error");
    return sendPublicRouteError(res, e);
  }
});

/**
 * POST /api/public/tickets/send
 * body: { type?, text, openedByName? }
 * identity is derived only from req.user
 */

publicTicketsRouter.post("/send", async (req, res) => {
  try {
    const identity = requireTicketIdentity(req);
    const { type, text, openedByName } = req.body || {};

    const msgText = typeof text === "string" ? text.trim() : "";
    if (!msgText) {
      return res.status(400).json({
        ok: false,
        error: "TEXT_REQUIRED",
      });
    }

    const tType = String(type || "tech").toLowerCase();
    if (tType !== "tech" && tType !== "therapy") {
      return res.status(400).json({
        ok: false,
        error: "TICKET_INVALID_TYPE",
      });
    }

    const blocked = await checkTherapyAccessOrReject({
      res,
      type: tType,
      openedById: identity.openedById,
      contact: identity.contact,
    });
    if (blocked) return;

    const latestName = (openedByName || "کاربر").toString().trim() || "کاربر";

    let ticket = await prisma.ticket.findFirst({
      where: {
        type: tType,
        status: { in: ["open", "pending"] },
        OR: buildIdentityOrWhere(identity),
      },
      select: {
        id: true,
        openedByName: true,
        title: true,
      },
    });

    if (!ticket) {
      ticket = await prisma.ticket.create({
        data: {
          type: tType,
          status: "open",
          title: latestName,
          description: msgText.slice(0, 500),
          contact: identity.contact ?? null,
          ...(identity.openedById
            ? { openedById: String(identity.openedById) }
            : {}),
          openedByName: latestName,
          unread: true,
        },
        select: {
          id: true,
          openedByName: true,
          title: true,
        },
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

    return res.json({
      ok: true,
      ticket: withDisplayTitle(fresh),
    });
  } catch (e) {
    console.error("[tickets.public.send] error:", e?.message || "unknown_error");
    return sendPublicRouteError(res, e);
  }
});

/**
 * POST /api/public/tickets/:id/reply
 * body: { text, openedByName? }
 */
publicTicketsRouter.post("/:id/reply", async (req, res) => {
  try {
    const identity = requireTicketIdentity(req);
    const id = String(req.params.id);
    const { text, openedByName } = req.body || {};

    const msgText = typeof text === "string" ? text.trim() : "";
    if (!msgText) {
      return res.status(400).json({
        ok: false,
        error: "TEXT_REQUIRED",
      });
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
      return res.status(404).json({
        ok: false,
        error: "TICKET_NOT_FOUND",
      });
    }

    if (!ticketMatchesIdentity(exists, identity)) {
      return res.status(403).json({
        ok: false,
        error: "TICKET_FORBIDDEN",
      });
    }

    const blocked = await checkTherapyAccessOrReject({
      res,
      type: exists.type,
      openedById: exists.openedById,
      contact: exists.contact,
    });
    if (blocked) return;

    const latestName = (openedByName || exists.openedByName || "کاربر")
      .toString()
      .trim();

    if (latestName && latestName !== exists.openedByName) {
      await prisma.ticket.update({
        where: { id },
        data: {
          openedByName: latestName,
          title: latestName,
        },
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

    return res.json({
      ok: true,
      ticket: withDisplayTitle(ticket),
    });
  } catch (e) {
    console.error("[tickets.public.reply] error:", e?.message || "unknown_error");
    return sendPublicRouteError(res, e);
  }
});

/**
 * POST /api/public/tickets/:id/reply-upload
 * form-data: file? , text? , durationSec? , openedByName?
 */
const replyUploadMiddleware = upload.single("file");

publicTicketsRouter.post(
  "/:id/reply-upload",

  (req, res, next) => {
    replyUploadMiddleware(req, res, (err) => {
      if (err) {
        console.error("[reply-upload multer error]", {
          name: err.name,
          message: err.message,
          code: err.code,
          field: err.field,
        });

        return res.status(400).json({
          ok: false,
          error: "UPLOAD_ERROR",
          multer: {
            name: err.name,
            message: err.message,
            code: err.code,
            field: err.field,
          },
        });
      }

      console.log("[reply-upload multer success]", {
        body: req.body,
        file: req.file
          ? {
              fieldname: req.file.fieldname,
              originalname: req.file.originalname,
              mimetype: req.file.mimetype,
              size: req.file.size,
              path: req.file.path,
            }
          : null,
      });

      next();
    });
  },

  async (req, res) => {
    try {
      const identity = requireTicketIdentity(req);
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

      if (!exists) {
        return res.status(404).json({
          ok: false,
          error: "TICKET_NOT_FOUND",
        });
      }

      if (!ticketMatchesIdentity(exists, identity)) {
        return res.status(403).json({
          ok: false,
          error: "TICKET_FORBIDDEN",
        });
      }

      const rawText =
        typeof req.body?.text === "string"
          ? req.body.text.trim()
          : "";

      const hasText = rawText.length > 0;

      const f = req.file;

      console.log("[reply-upload handler]", {
        hasFile: !!f,
        hasText,
        body: req.body,
      });

      if (!f && !hasText) {
        return res.status(400).json({
          ok: false,
          error: "NO_CONTENT",
        });
      }

      return res.json({
        ok: true,
        debug: {
          hasFile: !!f,
          fieldname: f?.fieldname || null,
          mimetype: f?.mimetype || null,
          originalname: f?.originalname || null,
          size: f?.size || null,
          body: req.body,
        },
      });
    } catch (e) {
      console.error("[reply-upload route error]", e);

      return res.status(500).json({
        ok: false,
        error: "internal_error",
        message: e?.message || "unknown_error",
      });
    }
  }
);


// ====================== اکسپورت‌ها ======================
export default router;
