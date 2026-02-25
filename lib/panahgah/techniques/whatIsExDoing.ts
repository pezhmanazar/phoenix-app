// lib/panahgah/techniques/whatIsExDoing.ts
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
  AUDIO_KEYS.panahgahTechniques.whatIsExDoing01,
] as const;

function pickVoiceKey(seed: string): string {
  const h = hashSeed(seed);
  return VOICE_KEYS[h % VOICE_KEYS.length];
}

const module: ScenarioModule = {
  id: "what-is-ex-doing",
  title: "الان به این فکر میکنم چیکار داره میکنه",

  getPlanForVisit: (visitIndex: number) => {
    const voiceKey = pickVoiceKey(`what-is-ex-doing:${visitIndex}`);

    return [
      {
        type: "checkin",
        title: "الان شدت این فکر و اضطرابش چقدره؟",
        hint: "فقط یک عدد انتخاب کن.",
        min: 0,
        max: 10,
      },

      {
        type: "voice",
        title: "این ویس رو گوش بده تا از داستان‌سازی ذهن، فاصله بگیری",
        uri: voiceKey,
      },

      {
        type: "form",
        title: "داستان ذهنت رو با پر کردن موارد زیر، شفاف کن",
        fields: [
          {
            key: "imagined_scene",
            label:
              "الان ذهنت چه صحنه‌ای ساخته؟ دقیق بنویس که فکر می‌کنی داره چیکار می‌کنه.",
          },
          {
            key: "emotion",
            label:
              "این تصویر چه احساسی در تو فعال می‌کنه؟ (مثلا حسادت، خشم، بی‌ارزشی، دلتنگی)",
          },
          {
            key: "comparison",
            label:
              "الان ناخودآگاه خودت رو با چی مقایسه می‌کنی؟ (مثلاً: «حتماً اون از من بهتره»)",
          },
          {
            key: "evidence",
            label:
              "چه مدرک واقعی داری که این داستان درسته؟ اگه هیچ مدرک واقعی نداری، صادقانه بنویس.",
          },
          {
            key: "urge",
            label:
              "الان میل داری چه کاری بکنی؟ (مثلا چک کردن، پیام دادن، دیدن استوری، پرس‌وجو)",
          },
          {
            key: "return_focus",
            label:
              "یک جمله بنویس که تمرکزت رو برگردونه: «من الان مسئول زندگی خودمم، نه داستان ذهنم.»",
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
        title: "بعد از انجام مراحل بگو الان شدت فکرت چقدره؟",
      },
    ] as any;
  },
};

export default module;