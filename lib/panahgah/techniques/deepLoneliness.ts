// lib/panahgah/techniques/deepLoneliness.ts
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
  AUDIO_KEYS.panahgahTechniques.deepLoneliness01,
] as const;

function pickVoiceKey(seed: string): string {
  const h = hashSeed(seed);
  return VOICE_KEYS[h % VOICE_KEYS.length];
}

const module: ScenarioModule = {
  id: "deep-loneliness",
  title: "الان احساس تنهایی شدید میکنم",

  getPlanForVisit: (visitIndex: number) => {
    const voiceKey = pickVoiceKey(`deep-loneliness:${visitIndex}`);

    return [
      // 1) checkin
      {
        type: "checkin",
        title: "الان شدت تنهایی چقدره؟",
        min: 0,
        max: 10,
      },

      // 2) voice
      {
        type: "voice",
        title: "این ویس رو گوش بده تا تنهایی تبدیل به هویت نشه",
        uri: voiceKey,
      },

      // 3) form
      {
        type: "form",
        title: "تنهایی رو دقیق بشناس",
        fields: [
          {
            key: "type_of_loneliness",
            label:
              "الان بیشتر تنهایی فیزیکی داری یا عاطفی؟ (کدوم یکی غالب‌تره؟)",
          },
          {
            key: "trigger_now",
            label:
              "چه چیزی دقیقاً این حس رو فعال کرد؟ (سکوت خونه؟ شب؟ دیدن جمع‌ها؟ شبکه اجتماعی؟)",
          },
          {
            key: "core_belief",
            label:
              "الان ذهنت درباره‌ی خودت چه باوری می‌سازه؟ (مثلاً: «من دوست‌داشتنی نیستم»)",
          },
          {
            key: "evidence_against_belief",
            label:
              "چه شواهد واقعی‌ای داری که این باور کاملاً درست نیست؟ (حداقل یک مورد)",
          },
          {
            key: "healthy_connection",
            label:
              "امروز چه اتصال سالم کوچیکی می‌تونی ایجاد کنی؟ (پیام به دوست، تماس کوتاه، حضور در جمع)",
          },
          {
            key: "self_connection",
            label:
              "الان چه کاری می‌تونی انجام بدی که حس مراقبت از خودت رو فعال کنه؟",
          },
        ],
      },

      // 4) breath
      { type: "breath" },

      // 5) action
      {
        type: "action",
        title: "یک اقدام کوچیک برای ایجاد اتصال انجام بده",
      },

      // 6) done
      {
        type: "done",
        title: "الان شدت تنهاییت چقدره؟",
      },
    ] as any;
  },
};

export default module;