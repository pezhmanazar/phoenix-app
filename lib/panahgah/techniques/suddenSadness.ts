// lib/panahgah/techniques/suddenSadness.ts
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
  AUDIO_KEYS.panahgahTechniques.suddenSadness01,
] as const;

function pickVoiceKey(seed: string): string {
  const h = hashSeed(seed);
  return VOICE_KEYS[h % VOICE_KEYS.length];
}

const module: ScenarioModule = {
  id: "sudden-sadness",
  title: "الان بی‌دلیل حالم بد شد",

  getPlanForVisit: (visitIndex: number) => {
    const voiceKey = pickVoiceKey(`sudden-sadness:${visitIndex}`);

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
        title: "این ویس رو گوش بده تا موجِ حال بدت آروم‌تر بشه",
        uri: voiceKey, // KEY نه URL
      },

      // 3) form
      {
        type: "form",
        title: "موج ناراحتیت رو نام‌گذاری کن",
        fields: [
          {
            key: "emotion_label",
            label:
              "الان دقیقاً چه احساسی داری؟ (غم؟ اضطراب؟ پوچی؟ بی‌قراری؟ دلتنگی؟)",
          },
          {
            key: "body_spot",
            label:
              "این حس رو کجای بدنت بیشتر حس می‌کنی؟ (گلو؟ سینه؟ شکم؟ سر؟)",
          },
          {
            key: "urge",
            label:
              "الان ذهنت می‌خواد چه کاری بکنی؟ (مثلاً چکش کنی؟ بهش پیام بدی؟ گریه کنی؟ خودت رو جمع کنی؟ از ناراحتی فرار کنی؟)",
          },
          {
            key: "likely_causes",
            label:
              "اگه فقط بخوای حدس بزنی، ۲ دلیل احتمالی بد شدن حالت چی می‌تونه باشه؟ (خستگی، کم‌خوابی، گرسنگی، تنهایی، محرک ریز)",
          },
          {
            key: "kind_sentence",
            label:
              "یک جمله‌ی مهربانانه برای خودت بنویس که یعنی «الان این یک موج ناراحتیه و می‌گذره».",
          },
          {
            key: "two_min_plan",
            label:
              "تا ۲ دقیقه‌ی بعد از این تکنیک دقیقاً چی کار می‌کنی؟ (یک کار خیلی کوچک و قابل انجام)",
          },
        ],
      },

      // 4) breath
      { type: "breath" },

      // 5) action
      {
        type: "action",
        title: "برای تثبیت حالت، یک اقدام خیلی ساده انجام بده",
      },

      // 6) done
      {
        type: "done",
        title: "الان حالت چطوره؟",
      },
    ] as any;
  },
};

export default module;