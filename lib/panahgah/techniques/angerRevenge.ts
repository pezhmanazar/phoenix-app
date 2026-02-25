// lib/panahgah/techniques/angerRevenge.ts
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
  AUDIO_KEYS.panahgahTechniques.angerRevenge01,
] as const;

function pickVoiceKey(seed: string): string {
  const h = hashSeed(seed);
  return VOICE_KEYS[h % VOICE_KEYS.length];
}

const module: ScenarioModule = {
  id: "anger-revenge",
  title: "الان خیلی ازش عصبانیم و حس انتقام درونم ایجاد شده",

  getPlanForVisit: (visitIndex: number) => {
    const voiceKey = pickVoiceKey(`anger-revenge:${visitIndex}`);

    return [
      // 1) checkin
      {
        type: "checkin",
        title: "الان شدت خشم و آشفتگی‌ات چقدره؟",
        min: 0,
        max: 10,
      },

      // 2) voice
      {
        type: "voice",
        title: "این ویس رو گوش بده تا خشم تبدیل به حرکت تکانشی نشه",
        uri: voiceKey, // KEY نه URL
      },

      // 3) form (جمله‌محور + قابل فهم)
      {
        type: "form",
        title: "خشم رو با نوشتن موارد زیر، تبدیل به کنترل کن",
        fields: [
          {
            key: "what_happened",
            label:
              "چی دقیقاً باعث شد اینقدر عصبانی بشی؟",
          },
          {
            key: "what_it_means",
            label:
              "این اتفاق برای تو چه معنی‌ای داشت؟ (بی‌ارزشی؟ بی‌عدالتی؟ تحقیر؟ خیانت؟)",
          },
          {
            key: "revenge_urge",
            label:
              "الان دقیقاً دلت می‌خواد چه انتقامی بگیری؟ (فقط بنویس؛ قرار نیست انجام بدی)",
          },
          {
            key: "cost_if_do",
            label:
              "اگه این انتقام رو انجام بدی، ۳ هزینه‌ی فوری و واقعی‌اش برای تو چیه؟ (مثلا آبروت میره؟ پیامد قانونی داره؟ شاید پشیمون بشی؟ درگیری ذهنی برات ایجاد بشه؟)",
          },
          {
            key: "who_controls",
            label:
              "اگه انتقام بگیری، عملاً کنترل دست کی می‌افته؟ تو یا اون؟ چرا؟",
          },
          {
            key: "stronger_move",
            label:
              "قوی‌ترین حرکتِ تو که هم خودتو حفظ کنه هم شأن تو رو بالا نگه داره چیه؟ (مثلا مرزبندی،قطع دسترسی، سکوت، فاصله)",
          },
          {
            key: "boundary_sentence",
            label:
              "یک جمله بنویس که اگه لازم شد بهش بگی (کوتاه، محترمانه و محکم).",
          },
          {
            key: "self_promise",
            label:
              "یک تعهد یک‌خطی بده: مثلا تا ۲۴ ساعت آینده چه کاری رو انجام نمی‌دی؟ (مثلاً پیام نمیدم، چکش نمی‌کنم، افشاگری نمی‌کنم، پست و استوری تیکه‌دار نمی‌ذارم)",
          },
        ],
      },

      // 4) breath
      { type: "breath" },

      // 5) action
      {
        type: "action",
        title: "برای تخلیه انرژی خشم، یک اقدام خیلی ساده انجام بده",
      },

      // 6) done
      {
        type: "done",
        title: "بعد از انجام مراحل بگو الان حالت چطوره؟",
      },
    ] as any;
  },
};

export default module;