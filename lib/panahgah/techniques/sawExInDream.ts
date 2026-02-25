// lib/panahgah/techniques/sawExInDream.ts
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
  AUDIO_KEYS.panahgahTechniques.sawExInDream01,
] as const;

function pickVoiceKey(seed: string): string {
  const h = hashSeed(seed);
  return VOICE_KEYS[h % VOICE_KEYS.length];
}

const module: ScenarioModule = {
  id: "saw-ex-in-dream",
  title: "الان خوابش رو دیدم",

  getPlanForVisit: (visitIndex: number) => {
    const voiceKey = pickVoiceKey(`saw-ex-in-dream:${visitIndex}`);

    return [
      {
        type: "checkin",
        title: "الان شدت حال بدت بعد از بیدار شدن چقدره؟",
        hint: "فقط یک عدد انتخاب کن.",
        min: 0,
        max: 10,
      },

      {
        type: "voice",
        title: "این ویس رو گوش بده تا بفهمی چرا با دیدن خوابش، اذیت  شدی",
        uri: voiceKey,
      },

      {
        type: "form",
        title: "خواب رو تعبیر نکن، فقط تخلیه و ثبتش کن و موارد پایین رو پر کن",
        fields: [
          {
            key: "dream_scene",
            label: "در خواب دقیقاً چه اتفاقی افتاد؟ (خیلی کوتاه و واقعی بنویس)",
          },
          {
            key: "emotion_after_wake",
            label: "بعد از بیدار شدن چه احساسی داشتی؟ (دلتنگی، ترس، امید، خشم و غیره)",
          },
          {
            key: "body_signal",
            label: "بدنت چه واکنشی داشت؟ (سنگینی سینه، تپش قلب، بغض و غیره)",
          },
          {
            key: "dream_thought",
            label: "چه فکری بعد از خواب تو ذهنت فعال شد؟ (مثلاً «یعنی برمیگرده؟»)",
          },
          {
            key: "urge_after_dream",
            label: "الان وسوسه داری چه کاری بکنی؟ (چک کردن، پیام دادن، خیال‌پردازی)",
          },
          {
            key: "reality_sentence",
            label: "یک جمله واقع‌بینانه بنویس: «مثلا خواب مساوی واقعیت نیست، فقط ذهنم در حال پردازشه»",
          },
        ],
      },

      {
        type: "breath",
      },

      {
        type: "action",
        title: "برای تثبیت حالت، یک اقدام خیلی ساده رو انجام بده",
      },

      {
        type: "done",
        title: "بعد از انجام مراحل بگو الان حالت چطوره؟",
      },
    ] as any;
  },
};

export default module;