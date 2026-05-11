// routes/public.js
import { PrismaClient } from "@prisma/client";
import { Router } from "express";

const router = Router();
const prisma = new PrismaClient();

// ============================
// AI Chat config
// ============================
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const BASE_SYSTEM = `تو یک همراه درمانی مهربان به نام «پشتیبان ققنوس» هستی.
کوتاه، همدلانه و کاربردی پاسخ بده. از برچسب‌زدن تشخیصی پزشکی خودداری کن.
اگر خطر خودآسیبی دیدی، به کمک فوری و تماس با اورژانس اشاره کن.
وقتی کاربر دوست داره با انسان صحبت کنه یا موضوع بالا گرفت، با لحن مودبانه راهنمایی کن: «از مسیر پناه → پشتیبانی واقعی می‌تونی با درمانگر واقعی حرف بزنی.»`;

/* few-shots برای لحن و ساختار پاسخ */
const FEWSHOTS_FA = [
  {
    role: "user",
    content: "خیلی استرس دارم و تمرکزم رو از دست دادم.",
  },
  {
    role: "assistant",
    content:
      "می‌فهمم فشار زیاده. بیشتر از سمت کاره یا رابطه‌ها؟ یک تمرین ۶۰‌ثانیه‌ای: ۴ ثانیه دم، ۴ نگه‌دار، ۶ بازدم × ۴. بعد ازش از ۱ تا ۱۰ استرست چند می‌شه؟ اگه ترجیح می‌دی با درمانگر واقعی حرف بزنی، مسیر «پناه → پشتیبانی واقعی» رو بزن.",
  },

  {
    role: "user",
    content: "شب‌ها گریه می‌کنم و حوصله هیچ کاری ندارم.",
  },
  {
    role: "assistant",
    content:
      "سخته و خسته‌کننده است. این حالت بیشتر نزدیک خواب میاد یا کل روز همراهته؟ یک قدم کوچک: ۳ کار خیلی کم‌انرژی بنویس (مثل دوش کوتاه، ۵ دقیقه پیاده‌روی، آب خوردن). کدومش امروز شدنی‌تره؟ اگه بخوای با انسان حرف بزنی، «پناه → پشتیبانی واقعی» کمکت می‌کنه.",
  },

  {
    role: "user",
    content: "حرف زیادی ندارم فقط حالم بد است.",
  },
  {
    role: "assistant",
    content:
      "متوجه‌ام که سختته. برای شروع، بیشتر از کدوم سمت اذیت می‌شی: بدن (بی‌خوابی/تپش قلب)، فکرها (نگرانی/خودسرزنشی) یا موقعیت‌ها (کار/رابطه)؟ بیا یک تمرین ۹۰‌ثانیه‌ای تمرکز حسی: ۵ چیز که می‌بینی، ۴ چیزی که لمس می‌کنی، ۳ صدا، ۲ بو، ۱ مزه. بعد حسّت کمی عوض شد؟ اگر ترجیح می‌دی با درمانگر واقعی صحبت کنی، «پناه → پشتیبانی واقعی» هم در دسترسه.",
  },
];

// ============================
// helpers
// ============================
function getUserKey(body = {}, req) {
  return (
    (body.userId && String(body.userId)) ||
    (req.headers["x-user-id"] && String(req.headers["x-user-id"])) ||
    `anon:${req.ip || "0.0.0.0"}`
  );
}

async function chatCompletion(
  messages,
  { model = OPENAI_MODEL, temperature = 0.5 } = {}
) {
  if (!OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      temperature,
      messages,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`OpenAI error ${response.status}: ${text}`);
  }

  const json = await response.json();
  return json.choices?.[0]?.message?.content?.trim() || "";
}

async function buildNewSummary(prevSummary, lastExchange) {
  const summarySystemPrompt = `تو یک خلاصه‌کننده هستی. خلاصه‌ای کوتاه و به‌روز (حداکثر 180 کلمه)
از وضعیت کاربر بساز. لحن بی‌طرف و کاربردی؛ موارد زیر را پوشش بده:
- موضوعات اصلی، محرک‌ها، الگوهای تکرارشونده
- هدف‌ها/توصیه‌های قبلی
- تغییرات جدید مکالمه اخیر
از برچسب تشخیصی پزشکی خودداری کن.`;

  const messages = [
    { role: "system", content: summarySystemPrompt },
    {
      role: "user",
      content:
        `خلاصهٔ قبلی:\n${prevSummary || "(ندارد)"}\n\n` +
        `مکالمهٔ جدید:\n${lastExchange}\n\n` +
        `لطفاً خلاصهٔ به‌روز و فشردهٔ جدید را برگردان.`,
    },
  ];

  return await chatCompletion(messages, {
    model: OPENAI_MODEL,
    temperature: 0.2,
  });
}

// ============================
// POST /api/public/ai/chat
// body: { messages: [{role:"user"|"assistant", content:string}], userId? }
// ============================
router.post("/ai/chat", async (req, res) => {
  try {
    const { messages = [], userId } = req.body || {};
    const key = getUserKey({ userId }, req);

    const safeMessages = Array.isArray(messages) ? messages : [];
    const last10 = safeMessages.slice(-10);

    const memory = await prisma.aiMemory
      .findUnique({ where: { userId: key } })
      .catch(() => null);

    const summary = memory?.summary || "";

    const systemMessages = [{ role: "system", content: BASE_SYSTEM }];

    if (summary) {
      systemMessages.push({
        role: "system",
        content: `یادداشت‌های پیشین دربارهٔ کاربر:\n${summary}`,
      });
    }

    const modelMessages = [
      ...systemMessages,
      ...FEWSHOTS_FA,
      ...last10,
    ];

    const reply = await chatCompletion(modelMessages, {
      model: OPENAI_MODEL,
      temperature: 0.5,
    });

    const lastExchange = [
      ...last10.slice(-2),
      { role: "assistant", content: reply },
    ]
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    const newSummary = await buildNewSummary(summary, lastExchange).catch(
      () => summary
    );

    await prisma.aiMemory.upsert({
      where: { userId: key },
      update: { summary: newSummary },
      create: { userId: key, summary: newSummary },
    });

    return res.json({
      ok: true,
      reply,
    });
  } catch (e) {
    console.error("[public.ai.chat] error:", e?.message || "unknown_error");
    return res.status(500).json({
      ok: false,
      error: "internal_error",
    });
  }
});

// ============================
// POST /api/public/ai/clear-memory
// body: { userId?: string }
// ============================
router.post("/ai/clear-memory", async (req, res) => {
  try {
    const key = getUserKey(req.body || {}, req);

    if (!key) {
      return res.status(400).json({
        ok: false,
        error: "userId_required",
      });
    }

    await prisma.aiMemory.delete({
      where: { userId: key },
    }).catch(() => {});

    return res.json({ ok: true });
  } catch (e) {
    console.error("[public.clearMemory] error:", e?.message || "unknown_error");
    return res.status(500).json({
      ok: false,
      error: "internal_error",
    });
  }
});

export default router;
