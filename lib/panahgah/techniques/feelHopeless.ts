// lib/panahgah/techniques/feelHopeless.ts
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
  AUDIO_KEYS.panahgahTechniques.feelHopeless01,
] as const;

function pickVoiceKey(seed: string): string {
  const h = hashSeed(seed);
  return VOICE_KEYS[h % VOICE_KEYS.length];
}

const module: ScenarioModule = {
  id: "feel-hopeless",
  title: "الان حس میکنم دیگه هیچوقت حالم خوب نمیشه",

  getPlanForVisit: (visitIndex: number) => {
    const voiceKey = pickVoiceKey(`feel-hopeless:${visitIndex}`);

    return [
      // 1) checkin
      {
        type: "checkin",
        title: "الان شدت ناامیدیت چقدره؟",
        min: 0,
        max: 10,
      },

      // 2) voice
      {
        type: "voice",
        title: "این ویس رو گوش بده تا ناامیدی تبدیل به حکم نشه",
        uri: voiceKey, // KEY نه URL
      },

      // 3) form
      {
        type: "form",
        title: "ناامیدی رو تبدیل کن به نقشه‌ی امروز",
        fields: [
          {
            key: "the_thought",
            label:
              "جمله‌ی دقیق ذهنت چیه؟ همون رو دقیق بنویس. (مثلاً: «من دیگه خوب نمی‌شم»)",
          },
          {
            key: "defusion",
            label:
              "همون جمله رو اینطوری بازنویسی کن: «الان ذهنم داره می‌گه که...»",
          },
          {
            key: "what_it_wants",
            label:
              "این فکر می‌خواد تو رو از چی منصرف کنه؟ (درمان؟ خواب؟ غذا؟ ارتباط سالم؟)",
          },
          {
            key: "evidence_today",
            label:
              "امروز چه نشونه‌ی کوچیکی داری که ثابت کنه این فکر واقعی نیست؟ (حتی ۱ مورد)",
          },
          {
            key: "1_percent_goal",
            label:
              "هدف ۱٪ امروز: فقط یک کار خیلی کوچک که حالت رو کمی بهتر کنه چیه؟",
          },
          {
            key: "24h_safe_rule",
            label:
              "قانون ۲۴ ساعته مثلا: امروز با این ناامیدی تصمیم‌های برگشت‌ناپذیر نمی‌گیرم.",
          },
        ],
      },

      // 4) breath
      { type: "breath" },

      // 5) action
      {
        type: "action",
        title: "یک اقدام کوچک برای تثبیت کنترل انجام بده",
      },

      // 6) done
      {
        type: "done",
        title: "الان بعد از تمرین‌ها شدت حالت چقدره؟",
      },
    ] as any;
  },
};

export default module;