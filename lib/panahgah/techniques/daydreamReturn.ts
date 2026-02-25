// lib/panahgah/techniques/daydreamReturn.ts
import { AUDIO_KEYS } from "@/constants/media";
import type { ScenarioModule } from "../types";

/* ---------- Seeded pick ---------- */
function hashSeed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const VOICE_KEYS = [
  AUDIO_KEYS.panahgahTechniques.daydreamReturn01,
] as const;

function pickVoiceKey(seed: string): string {
  const h = hashSeed(seed);
  return VOICE_KEYS[h % VOICE_KEYS.length];
}

const module: ScenarioModule = {
  id: "daydream-return",
  title: "الان دارم رویاپردازی میکنم که برمیگرده",

  getPlanForVisit: (visitIndex: number) => {
    const voiceKey = pickVoiceKey(`daydream-return:${visitIndex}`);

    return [
      {
        type: "checkin",
        title: "الان شدت این رویاپردازی و حال بدت چقدره؟",
        hint: "فقط یک عدد انتخاب کن.",
        min: 0,
        max: 10,
      },

      {
        type: "voice",
        title: "این ویس رو گوش بده تا از رویاپردازی ذهنت فاصله بگیری",
        uri: voiceKey, // KEY نه URL
      },

      {
        type: "form",
        title: "رویاپردازی رو تبدیل به واقعیتِ قابل‌دیدن کن",
        fields: [
          {
            key: "movie_scene",
            label:
              "فیلمی که ذهنت ساخته چیه؟ دقیق و کوتاه بنویس (مثلاً: «پیام میده، پشیمونه، میگه برگرد»).",
          },
          {
            key: "body_feel",
            label:
              "وقتی این فیلم رو داخل ذهنت می‌بینی، توی بدنت چه حسی می‌کنی؟",
          },
          {
            key: "urge",
            label:
              "بعد از این رویاپردازی، دلت می‌خواد چه کاری بکنی؟ (مثلا چک کردن، پیام دادن، استوری دیدن، تماس)",
          },
          {
            key: "cost_short",
            label:
              "این رویاپردازی در کوتاه‌مدت چه هزینه‌ای داره؟ (مثلاً: حواس‌پرتی، افت کار، بی‌قراری، گریه)",
          },
          {
            key: "cost_long",
            label:
              "اگه هر روز این رویاپردازی تکرار بشه، در بلندمدت چه چیزی رو ازت می‌گیره؟",
          },
          {
            key: "reality_sentence",
            label:
              "یک جمله واقع‌بینانه بنویس که هم مهربانانه باشه هم توهم رو قطع کنه (مثلاً: «ممکنه برگرده، ممکنه هم نه؛ من امروز باید از خودم مراقبت کنم.»).",
          },
        ],
      },

      // آرام‌سازی با RelaxationPlayer
      { type: "breath" },

      // اقدام از اکشن‌های عمومی (نه سوال «اقدام بعدی چیه»)
      {
        type: "action",
        title: "برای تثبیت حالت، یک اقدام خیلی ساده رو انجام بده",
      },

      {
        type: "done",
        title: "بعد از انجام مراحل بگو الان شدت حالت چقدره؟",
      },
    ] as any;
  },
};

export default module;