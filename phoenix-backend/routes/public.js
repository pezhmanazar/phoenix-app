// routes/public.js
import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import path from "path";

const router = Router();
const prisma = new PrismaClient();

// همان منطق server.js برای روت آپلودها
const UPLOAD_ROOT =
  process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

/* helper: type detection for file messages */
const detectType = (mimetype = "", filename = "") => {
  const mm = (mimetype || "").toLowerCase();
  const fn = (filename || "").toLowerCase();
  if (mm.startsWith("image/")) return "image";
  if (mm.startsWith("audio/")) return "voice";
  if (mm) return "file";
  if (fn.endsWith(".png") || fn.endsWith(".jpg") || fn.endsWith(".jpeg") || fn.endsWith(".webp")) return "image";
  if (fn.endsWith(".mp3") || fn.endsWith(".wav") || fn.endsWith(".m4a") || fn.endsWith(".ogg")) return "voice";
  if (fn) return "file";
  return "text";
};

// ============================
// ⬇️ افزوده‌ها برای AI Chat
// ============================
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const BASE_SYSTEM = `تو یک همراه درمانی مهربان به نام «پشتیبان ققنوس» هستی.
کوتاه، همدلانه و کاربردی پاسخ بده. از برچسب‌زدن تشخیصی پزشکی خودداری کن.
اگر خطر خودآسیبی دیدی، به کمک فوری و تماس با اورژانس اشاره کن.
وقتی کاربر دوست داره با انسان صحبت کنه یا موضوع بالا گرفت، با لحن مودبانه راهنمایی کن: «از مسیر پناه → پشتیبانی واقعی می‌تونی با درمانگر واقعی حرف بزنی.»`;

/* ✅ افزوده: چند شات نمونه (few-shots) برای لحن و ساختار پاسخ‌ها */
const FEWSHOTS_FA = [
  { role: "user", content: "خیلی استرس دارم و تمرکزم رو از دست دادم." },
  { role: "assistant", content: "می‌فهمم فشار زیاده. بیشتر از سمت کاره یا رابطه‌ها؟ یک تمرین ۶۰‌ثانیه‌ای: ۴ ثانیه دم، ۴ نگه‌دار، ۶ بازدم × ۴. بعد ازش از ۱ تا ۱۰ استرست چند می‌شه؟ اگه ترجیح می‌دی با درمانگر واقعی حرف بزنی، مسیر «پناه → پشتیبانی واقعی» رو بزن." },

  { role: "user", content: "شب‌ها گریه می‌کنم و حوصله هیچ کاری ندارم." },
  { role: "assistant", content: "سخته و خسته‌کننده است. این حالت بیشتر نزدیک خواب میاد یا کل روز همراهته؟ یک قدم کوچک: ۳ کار خیلی کم‌انرژی بنویس (مثل دوش کوتاه، ۵ دقیقه پیاده‌روی، آب خوردن). کدومش امروز شدنی‌تره؟ اگه بخوای با انسان حرف بزنی، «پناه → پشتیبانی واقعی» کمکت می‌کنه." },

  { role: "user", content: "حرف زیادی ندارم فقط حالم بد است." },
  { role: "assistant", content: "متوجه‌ام که سختته. برای شروع، بیشتر از کدوم سمت اذیت می‌شی: بدن (بی‌خوابی/‌تپش قلب)، فکرها (نگرانی/خودسرزنشی) یا موقعیت‌ها (کار/رابطه)؟ بیا یک تمرین ۹۰‌ثانیه‌ای تمرکز حسی: ۵ چیز که می‌بینی، ۴ چیزی که لمس می‌کنی، ۳ صدا، ۲ بو، ۱ مزه. بعد حسّت کمی عوض شد؟ اگر ترجیح می‌دی با درمانگر واقعی صحبت کنی، «پناه → پشتیبانی واقعی» هم در دسترسه." },
];

// کلید یکتای کاربر برای حافظه (بهتر است از userId کلاینت استفاده شود)
function getUserKey(body = {}, req) {
  return (
    (body.userId && String(body.userId)) ||
    (req.headers["x-user-id"] && String(req.headers["x-user-id"])) ||
    `anon:${req.ip || "0.0.0.0"}`
  );
}

// فراخوانی ساده‌ی Chat Completions
async function chatCompletion(messages, { model = OPENAI_MODEL, temperature = 0.5 } = {}) {
  if (!OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model, temperature, messages }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`OpenAI error ${res.status}: ${t}`);
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content?.trim() || "";
}

// ساخت/به‌روزرسانی خلاصه‌ی حافظه
async function buildNewSummary(prevSummary, lastExchange) {
  const sys = `تو یک خلاصه‌کننده هستی. خلاصه‌ای کوتاه و به‌روز (حداکثر 180 کلمه)
از وضعیت کاربر بساز. لحن بی‌طرف و کاربردی؛ موارد زیر را پوشش بده:
- موضوعات اصلی، محرک‌ها، الگوهای تکرارشونده
- هدف‌ها/توصیه‌های قبلی
- تغییرات جدید مکالمه اخیر
از برچسب تشخیصی پزشکی خودداری کن.`;
  const messages = [
    { role: "system", content: sys },
    {
      role: "user",
      content:
        `خلاصهٔ قبلی:\n${prevSummary || "(ندارد)"}\n\n` +
        `مکالمهٔ جدید:\n${lastExchange}\n\n` +
        `لطفاً خلاصهٔ به‌روز و فشردهٔ جدید را برگردان.`,
    },
  ];
  return await chatCompletion(messages, { model: OPENAI_MODEL, temperature: 0.2 });
}

// ─────────────────────────────────────────────
// ❗ GETs here never create tickets
// ─────────────────────────────────────────────
/**
 * GET /api/public/tickets/open
 * query: ?type=tech|therapy & openedById=... &/or contact=...
 *
 * اگر تیکتی پیدا نشود → ۲۰۰ با { ok:false, error:"not_found", ticket:null }
 */
router.get("/tickets/open", async (req, res) => {
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
    console.error("public tickets/open error:", e);
    return res
      .status(500)
      .json({ ok: false, error: "internal_error" });
  }
});

/**
 * GET /api/public/tickets/open-batch
 * query: openedById? &/or contact?
 *
 * هر دو تیکت باز tech و therapy را یکجا برمی‌گرداند
 */
router.get("/tickets/open-batch", async (req, res) => {
  try {
    console.log("[public/open-batch] hit", {
      openedById: req.query?.openedById,
      contact: req.query?.contact,
      at: new Date().toISOString(),
    });

    const { openedById, contact } = req.query || {};

    const or = [];
    if (openedById) or.push({ openedById: String(openedById) });
    if (contact) or.push({ contact: String(contact) });

    if (or.length === 0) {
      return res.json({
        ok: false,
        error: "missing_identity",
        tickets: {
          tech: null,
          therapy: null,
        },
      });
    }

    const [tech, therapy] = await Promise.all([
      prisma.ticket.findFirst({
        where: {
          type: "tech",
          status: { in: ["open", "pending"] },
          OR: or,
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
          OR: or,
        },
        orderBy: { createdAt: "desc" },
        include: {
          messages: { orderBy: { createdAt: "asc" } },
        },
      }),
    ]);

    const withDisplay = (t) =>
      t
        ? {
            ...t,
            displayTitle: t.openedByName || t.title,
          }
        : null;

    return res.json({
      ok: true,
      tickets: {
        tech: withDisplay(tech),
        therapy: withDisplay(therapy),
      },
    });
  } catch (e) {
    console.error("public /tickets/open-batch error:", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});


/** GET /api/public/tickets/:id */
router.get("/tickets/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const t = await prisma.ticket.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!t) return res.status(404).json({ ok: false, error: "not_found" });
    return res.json({ ok: true, ticket: t, displayTitle: t.openedByName || t.title });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});
/**
 * GET /api/public/tickets/open
 * query: ?type=tech|therapy & openedById=... &/or contact=...
 *
 * اگر تیکتی پیدا نشود → ۲۰۰ با { ok:false, error:"not_found", ticket:null }
 */
router.get("/tickets/open", async (req, res) => {
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
    console.error("public /tickets/open error:", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/** GET /api/public/tickets
 *  optional filters: openedById, contact, type
 */
router.get("/tickets", async (req, res) => {
  try {
    const { openedById, contact, type } = req.query || {};
    const where = {};
    if (openedById) where.openedById = String(openedById);
    if (contact) where.contact = String(contact);
    if (type && (type === "tech" || type === "therapy")) where.type = String(type);
    const list = await prisma.ticket.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    return res.json({ ok: true, tickets: list });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});
/**
 * GET /api/public/tickets/open
 * query: type=tech|therapy, openedById?, contact?
 * پیدا کردن تیکت باز (open/pending) برای این کاربر
 */
router.get("/tickets/open", async (req, res) => {
  try {
    const { type, openedById, contact } = req.query || {};
    const tType = String(type || "tech").toLowerCase();

    if (tType !== "tech" && tType !== "therapy") {
      return res.status(400).json({ ok: false, error: "invalid_type" });
    }

    if (!openedById && !contact) {
      // اگر هیچ شناسه‌ای نداریم، منطقی نیست چیزی برگردونیم
      return res.json({ ok: true, ticket: null });
    }

    const where = {
      type: tType,
      status: { in: ["open", "pending"] },
      OR: [
        openedById ? { openedById: String(openedById) } : undefined,
        contact ? { contact: String(contact) } : undefined,
      ].filter(Boolean),
    };

    const ticket = await prisma.ticket.findFirst({
      where,
      orderBy: { updatedAt: "desc" },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    return res.json({ ok: true, ticket });
  } catch (e) {
    console.error("public /tickets/open error:", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

// ─────────────────────────────────────────────
// ✅ create ticket only on first message
// ─────────────────────────────────────────────

/**
 * POST /api/public/tickets/send
 * body: { type: "tech"|"therapy", text: string, openedById?, openedByName?, contact? }
 */
router.post("/tickets/send", async (req, res) => {
  try {
    const { type, text, openedById, openedByName, contact } = req.body || {};
    const tType = String(type || "tech").toLowerCase();
    const msgText = (text || "").trim();
    if (!msgText) return res.status(400).json({ ok: false, error: "text_required" });
    if (tType !== "tech" && tType !== "therapy") {
      return res.status(400).json({ ok: false, error: "invalid_type" });
    }

    const latestName =
      (req.body?.openedByName ||
        req.body?.name ||
        req.body?.fullName ||
        "کاربر").toString().trim();
    const latestId = (req.body?.openedById || req.body?.userId || req.body?.uid || "").toString().trim();

    let ticket = null;
    if (latestId || contact) {
      ticket = await prisma.ticket.findFirst({
        where: {
          type: tType,
          status: { in: ["open", "pending"] },
          OR: [
            latestId ? { openedById: latestId } : undefined,
            contact ? { contact: String(contact) } : undefined,
          ].filter(Boolean),
        },
        select: { id: true, openedByName: true, openedById: true, title: true },
      });
    }

    if (!ticket) {
      ticket = await prisma.ticket.create({
        data: {
          type: tType,
          status: "open",
          title: latestName,
          description: msgText.slice(0, 500),
          contact: contact ?? null,
          ...(latestId ? { openedById: latestId } : {}),
          openedByName: latestName,
          unread: true,
        },
        select: { id: true, openedByName: true, openedById: true, title: true, type: true, createdAt: true, updatedAt: true },
      });
    } else {
      const data = {};
      if (latestName && ticket.openedByName !== latestName) {
        data.openedByName = latestName;
        data.title = latestName;
      }
      if (latestId && !ticket.openedById) {
        data.openedById = latestId;
      }
      if (Object.keys(data).length) {
        await prisma.ticket.update({ where: { id: ticket.id }, data });
      }
    }

    await prisma.message.create({
      data: { ticketId: ticket.id, sender: "user", type: "text", text: msgText },
    });

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { unread: true, updatedAt: new Date() },
    });

    const fresh = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    return res.json({ ok: true, ticket: fresh, displayTitle: fresh?.openedByName || fresh?.title });
  } catch (e) {
    console.error("public /tickets/send error:", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/**
 * POST /api/public/tickets/:id/reply
 * JSON or multipart (handled in server.js), no ticket creation here.
 */
router.post("/tickets/:id/reply", async (req, res) => {
  try {
    const id = String(req.params.id);
    const exists = await prisma.ticket.findUnique({ where: { id } });
    if (!exists) return res.status(404).json({ ok: false, error: "not_found" });

    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!text) return res.status(400).json({ ok: false, error: "text_required" });

    const updates = {};
    const openedByName =
      (req.body?.openedByName || req.body?.name || req.body?.fullName || "").toString().trim();
    const openedById =
      (req.body?.openedById || req.body?.userId || req.body?.uid || "").toString().trim();

    if (openedByName && openedByName !== exists.openedByName) {
      updates.openedByName = openedByName;
      updates.title = openedByName;
    }
    if (openedById && !exists.openedById) {
      updates.openedById = openedById;
    }
    if (Object.keys(updates).length) {
      await prisma.ticket.update({ where: { id }, data: updates });
    }

    await prisma.message.create({ data: { ticketId: id, sender: "user", type: "text", text } });

    const updated = await prisma.ticket.update({
      where: { id },
      data: { unread: true, updatedAt: new Date() },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    return res.json({ ok: true, ticket: updated });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/**
 * POST /api/public/tickets/:id/reply-upload
 * file already parsed by server.js middleware (req.file / req.files)
 * no ticket creation here.
 */
router.post("/tickets/:id/reply-upload", async (req, res) => {
  try {
    const id = String(req.params.id);
    const exists = await prisma.ticket.findUnique({ where: { id } });
    if (!exists) return res.status(404).json({ ok: false, error: "not_found" });

    const updates = {};
    const openedByName =
      (req.body?.openedByName || req.body?.name || req.body?.fullName || "").toString().trim();
    const openedById =
      (req.body?.openedById || req.body?.userId || req.body?.uid || "").toString().trim();

    if (openedByName && openedByName !== exists.openedByName) {
      updates.openedByName = openedByName;
      updates.title = openedByName;
    }
    if (openedById && !exists.openedById) {
      updates.openedById = openedById;
    }
    if (Object.keys(updates).length) {
      await prisma.ticket.update({ where: { id }, data: updates });
    }

    const f = req.file;
  let messageType = "text";
  let fileUrl = null;
  let mime = null;
  let durationSec = null;

  if (f) {
    // مسیر نسبی فایل نسبت به ریشه‌ی uploads
    const relPath = path
      .relative(UPLOAD_ROOT, f.path)
      .replace(/\\/g, "/"); // برای ویندوز هم امن باشد
    fileUrl = `/uploads/${relPath}`;

    mime = f.mimetype || null;
    messageType = detectType(f.mimetype, f.originalname);
    if (typeof req.body?.durationSec === "string") {
      const n = Number(req.body.durationSec);
      if (Number.isFinite(n) && n >= 0) durationSec = Math.round(n);
    }
  }

    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!f && !text) return res.status(400).json({ ok: false, error: "no_content" });

    await prisma.message.create({
      data: {
        ticketId: id,
        sender: "user",
        type: f ? (messageType === "voice" ? "voice" : messageType === "image" ? "image" : "file") : "text",
        text: text || null,
        fileUrl,
        mime,
        durationSec,
      },
    });

    const updated = await prisma.ticket.update({
      where: { id },
      data: { unread: true, updatedAt: new Date() },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    return res.json({ ok: true, ticket: updated });
  } catch (e) {
    console.error("public /reply-upload error:", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

// ============================
// ✅ افزوده: چت هوش مصنوعی با حافظه و few-shots
// POST /api/public/ai/chat
// body: { messages: [{role:"user"|"assistant", content:string}], userId? }
// ============================
router.post("/ai/chat", async (req, res) => {
  try {
    const { messages = [], userId } = req.body || {};
    const key = getUserKey({ userId }, req);

    // 1) خواندن حافظه‌ی قبلی
    const memory = await prisma.aiMemory.findUnique({ where: { userId: key } }).catch(() => null);
    const summary = memory?.summary || "";

    // 2) ساخت پیام‌ها برای مدل (system + memory + few-shots + آخرین ۱۰ پیام کاربر)
    const last10 = Array.isArray(messages) ? messages.slice(-10) : [];
    const sysBlocks = [{ role: "system", content: BASE_SYSTEM }];
    if (summary) {
      sysBlocks.push({
        role: "system",
        content: `یادداشت‌های پیشین دربارهٔ کاربر:\n${summary}`,
      });
    }

    const modelMessages = [
      ...sysBlocks,
      ...FEWSHOTS_FA,   // ⬅️ تزریق few-shots
      ...last10,
    ];

    // 3) پاسخ اصلی
    const reply = await chatCompletion(modelMessages, {
      model: OPENAI_MODEL,
      temperature: 0.5,
    });

    // 4) خلاصه‌سازی به‌روزشده از تبادل اخیر
    const lastExchange = [
      ...(last10.slice(-2) || []),
      { role: "assistant", content: reply },
    ]
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    const newSummary = await buildNewSummary(summary, lastExchange).catch(() => summary);

    // 5) ذخیره/آپدیت حافظه
    await prisma.aiMemory.upsert({
      where: { userId: key },
      update: { summary: newSummary },
      create: { userId: key, summary: newSummary },
    });

    return res.json({ ok: true, reply });
  } catch (e) {
    console.error("public /ai/chat error:", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

// ============================
// 🔄 پاک‌کردن حافظه‌ی کاربر
// POST /api/public/ai/clear-memory
// body: { userId?: string }
// ============================
router.post("/ai/clear-memory", async (req, res) => {
  try {
    const key = getUserKey(req.body || {}, req);
    if (!key) return res.status(400).json({ ok: false, error: "userId_required" });

    await prisma.aiMemory.delete({ where: { userId: key } }).catch(() => {});
    return res.json({ ok: true });
  } catch (e) {
    console.error("clear-memory error:", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

export default router;