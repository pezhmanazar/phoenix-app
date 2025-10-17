// routes/ai.js
import { Router } from "express";
import fs from "fs";
import path from "path";
const router = Router();

// ✳️ پیکربندی ساده
const MODEL = "gpt-4o-mini";
const MAX_INPUT_CHARS = 4000;      // سقف ورودی
const MAX_OUTPUT_TOKENS = 600;     // سقف خروجی
const WINDOW_MS = 60 * 1000;       // پنجره رِیت‌لیمیت (۱ دقیقه)
const MAX_REQ_PER_WINDOW = 5;      // حداکثر ۵ درخواست در دقیقه برای هر آی‌پی/کلاینت

// ✳️ رِیت‌لیمیت خیلی سبکِ درون‌حافظه‌ای (کافی برای dev/اولیه)
const hits = new Map(); // key => { count, ts }
function allowRequest(key) {
  const now = Date.now();
  const rec = hits.get(key);
  if (!rec || now - rec.ts > WINDOW_MS) {
    hits.set(key, { count: 1, ts: now });
    return true;
  }
  if (rec.count < MAX_REQ_PER_WINDOW) {
    rec.count++;
    return true;
  }
  return false;
}

// ✳️ مسیر فایل پرامپت سیستم (prompts/therapy.fa.txt)
const PROMPT_PATH = path.join(process.cwd(), "prompts", "therapy.fa.txt");

// ✳️ پرامپت سیستم (لود از فایل؛ در صورت نبودن فایل، fallback به متن پیش‌فرض)
function loadSystemPrompt() {
  const FALLBACK = [
    "تو یک دستیار همدل و مسئول هستی.",
    "نقش تو: همراهی و راهنمایی عمومی سلامت روان، نه تشخیص یا درمان پزشکی.",
    "اگر کاربر موضوع اورژانسی گفت (آسیب به خود/دیگران)، او را به کمک فوری از مسير پشتيباني واقعي اپ ارجاع بده.",
    "زبان پاسخ: فارسی روشن، کوتاه، عملی.",
    "وقتی کاربر دوست داره با انسان صحبت کنه یا موضوع بالا گرفت، مودبانه راهنمایی کن: «از مسیر پناه → پشتیبانی واقعی می‌تونی با درمانگر واقعی حرف بزنی.»",
    // 🔽 قوانین دقیق‌تر لحن/ایموجی
    "از بازگویی جملات منفی کاربر با اول‌شخص خودداری کن (هرگز نگو «حالم خوب نیست»). وضعیت را با دوم‌شخص بگو: «متوجهم حالت خوب نیست».",
    "پاسخ را با یک جملهٔ همدلانه شروع کن و حداکثر یک سؤال باز برای فهم زمینه بپرس.",
    "ایموجی در صورت نیاز، حداکثر یکی از مجموعهٔ مجاز {🌿, ❤️‍🩹, 🙂, ✨, 💬}. با ایموجی شروع نکن و از 🤗 استفاده نکن."
  ].join("\n");
  try {
    if (fs.existsSync(PROMPT_PATH)) {
      const txt = fs.readFileSync(PROMPT_PATH, "utf8").trim();
      if (txt.length > 0) return txt;
    }
  } catch (e) {
    console.warn("SYSTEM_PROMPT load warning:", e);
  }
  return FALLBACK;
}
const SYSTEM_PROMPT = loadSystemPrompt();

/* ────────────── پس‌پردازش محافظه‌کارانهٔ فارسی ────────────── */
function postProcessFa(text = "") {
  let out = String(text || "").trim();

  // 1) اگر مدل اشتباهاً اول‌شخص گفت، به دوم‌شخص اصلاح شود.
  //   ابتدای جمله: «حالم / حال من ...» -> «حالت ...»
  out = out.replace(/^(?:\s*)(?:حالم|حال من)\s+/gm, "حالت ");

  // 2) حذف ایموجی‌های نامجاز (فعلاً 🤗) و جلوگیری از شروع با ایموجی
  out = out.replace(/🤗/g, "");
  out = out.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}]+/u, "").trimStart();

  // 3) اگر چند ایموجی در متن بود، به یک ایموجی مجاز تقلیل بده (ساده‌سازی)
  const allowed = ["🌿","❤️‍🩹","🙂","✨","💬"];
  let picked = null;
  for (const a of allowed) {
    if (out.includes(a)) { picked = a; break; }
  }
  const withoutEmojis = out.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "");
  out = picked ? (withoutEmojis.trim() + " " + picked).trim() : withoutEmojis.trim();

  return out;
}

// ✳️ Route: /api/public/ai/chat
router.post("/chat", async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ ok: false, error: "missing_api_key" });

    // بدنهٔ ورودی
    const { messages, persona } = req.body || {};

    // ریت‌لیمیت بر اساس آی‌پی (می‌تونی deviceId هم اضافه کنی)
    const key =
      (req.ip || req.headers["x-forwarded-for"] || "ip") +
      ":" +
      (req.headers["x-device-id"] || "");
    if (!allowRequest(key)) return res.status(429).json({ ok: false, error: "rate_limited" });

    // اعتبارسنجی سریع
    if (!Array.isArray(messages) || !messages.length) {
      return res.status(400).json({ ok: false, error: "messages_required" });
    }
    const totalLen = messages.map((m) => m?.content || "").join("\n").length;
    if (totalLen > MAX_INPUT_CHARS) {
      return res.status(413).json({ ok: false, error: "input_too_long" });
    }

    // امکان افزودن اطلاعات شخصی‌سازی (دانش‌های من/پرسونا) به سیستم‌پرامپت
    const system =
      SYSTEM_PROMPT +
      (persona ? "\n\nاطلاعات تکمیلی درمانگر:\n" + String(persona).slice(0, 1500) : "");

    // فراخوانی OpenAI (بدون استریم برای سادگیِ قدم ۱)
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          // امن‌سازی رُل‌ها: فقط user/assistant بپذیر
          ...messages.map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: String(m.content || "").slice(0, 2000),
          })),
        ],
        temperature: 0.6,
        max_tokens: MAX_OUTPUT_TOKENS,
      }),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      // لاگ سبک برای دیباگ
      console.error("OpenAI error", r.status, data);
      return res
        .status(502)
        .json({ ok: false, error: "llm_upstream_error", detail: data?.error || r.statusText });
    }

    // پاسخ خام مدل
    const raw = data?.choices?.[0]?.message?.content || "";
    // ✅ اعمال اصلاحات سبک فارسی
    const reply = postProcessFa(raw);

    return res.json({ ok: true, reply });
  } catch (e) {
    console.error("AI chat error:", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

export default router;