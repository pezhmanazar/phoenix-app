// lib/panahgah/techniques/sexualMemories.ts
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
  AUDIO_KEYS.panahgahTechniques.sexualMemories01,
] as const;

function pickVoiceKey(seed: string): string {
  const h = hashSeed(seed);
  return VOICE_KEYS[h % VOICE_KEYS.length];
}

const module: ScenarioModule = {
  id: "sexual-memories",
  title: "الان یاد سکس‌هامون افتادم",

  getPlanForVisit: (visitIndex: number) => {
    const voiceKey = pickVoiceKey(`sexual-memories:${visitIndex}`);

    return [
      // 1) checkin
      {
        type: "checkin",
        title: "الان شدت حال بدت چقدره؟",
        min: 0,
        max: 10,
      },

      // 2) voice
      {
        type: "voice",
        title: "این ویس رو گوش بده تا میل تبدیل به تصمیم نشه",
        uri: voiceKey,
      },

      // 3) form
      {
        type: "form",
        title: "کشش بدنی رو از تصمیم رابطه‌ای جدا کن",
        fields: [
          {
            key: "what_exactly_miss",
            label:
              "دقیقاً دلت برای چی تنگ شده؟ (لمس؟ صمیمیت؟ حس امنیت؟ تایید شدن؟)",
          },
          {
            key: "trigger",
            label:
              "الان چه چیزی این خاطره رو فعال کرد؟ (تنهایی؟ شب؟ دیدن عکس؟ خیال‌پردازی؟ خالی نشدن طولانی مدت از لحاظ جنسی؟)",
          },
          {
            key: "body_reaction",
            label:
              "بدنت الان چه واکنشی داره؟ (گرمی، بی‌قراری، تنش، اشتیاق)",
          },
          {
            key: "impulse_action",
            label:
              "الان دوست داری دقیقاً چه کاری انجام بدی؟ (مثلا پیام بدم، باهاش تماس بگیرم، برم ببینمش، خیال‌پردازی ادامه‌دار در موردش انجامش بدم)",
          },
          {
            key: "relationship_reality",
            label:
              "غیر از بخش جنسی، رابطه چه مشکلات جدی‌ای داشت؟ (حداقل ۳ مورد واقعی)",
          },
          {
            key: "cost_of_contact",
            label:
              "اگه فقط از روی میل تماس بگیری، چه هزینه‌ای ممکنه بدی؟",
          },
          {
            key: "24h_commitment",
            label:
              "تعهد ۲۴ ساعته بده مثلا: من امروز هیچ تماس یا اقدام جنسی از روی موج ناراحتیم، انجام نمی‌دم.",
          },
          {
            key: "healthy_release",
            label:
              "یک راه سالم برای تخلیه انرژی بدنی خودت انتخاب کن (ورزش کوتاه، دوش، تنفس، نوشتن)",
          },
        ],
      },

      // 4) breath
      { type: "breath" },

      // 5) action
      {
        type: "action",
        title: "یک اقدام ساده برای تثبیت کنترل انجام بده",
      },

      // 6) done
      {
        type: "done",
        title: "الان شدت حالت چقدره؟",
      },
    ] as any;
  },
};

export default module;