// lib/panahgah/techniques/waiting.ts
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
  AUDIO_KEYS.panahgahTechniques.waiting01,
] as const;

function pickVoiceKey(seed: string): string {
  const h = hashSeed(seed);
  return VOICE_KEYS[h % VOICE_KEYS.length];
}

const module: ScenarioModule = {
  id: "waiting",
  title: "الان چشم انتظارشم",

  getPlanForVisit: (visitIndex: number) => {
    const voiceKey = pickVoiceKey(`waiting:${visitIndex}`);

    return [
      {
        type: "checkin",
        title: "الان شدت انتظارت چقدره؟",
        hint: "فقط یک عدد انتخاب کن.",
        min: 0,
        max: 10,
      },

      {
        type: "voice",
        title: "این ویس رو گوش بده تا از حالت تعلیق خارج شی",
        uri: voiceKey,
      },

      {
        type: "form",
        title: "انتظار رو با پر کردن موارد زیر، از حالت ابهام خارج کن",
        fields: [
          {
            key: "what_waiting_for",
            label: "دقیقاً منتظر چی هستی؟ (مثلا پیام، تماس، جواب خاص)",
          },
          {
            key: "prediction",
            label: "مغزت چه پیش‌بینی‌ای داره؟ (مثلاً می‌دونم پیام نمیده یا می‌‍دونم براش مهم نیست)",
          },
          {
            key: "worst_case",
            label: "اگه بدترین حالت اتفاق بیفته، چی میشه؟.",
          },
          {
            key: "body",
            label: "بدنت الان چه حسی داره؟ (مثل سنگینی سینه، بی‌قراری، دل‌آشوبه)",
          },
          {
            key: "urge_check",
            label: "چند دقیقه یک‌بار دلت می‌خواد گوشی رو چک کنی؟ صادقانه بنویس.",
          },
          {
            key: "pause_sentence",
            label:
              "یک جمله توقف بنویس: «تا ۱۵ دقیقه آینده اون رو چک نمی‌کنم و فقط مرحله بعد رو انجام میدم.»",
          },
        ],
      },

      {
        type: "breath",
      },

      {
        type: "action",
        title: "برای قطع چرخه انتظار، یک اقدام ساده انجام بده",
      },

      {
        type: "done",
        title: "بعد از انجام مراحل بگو الان حالت چطوره؟",
      },
    ] as any;
  },
};

export default module;