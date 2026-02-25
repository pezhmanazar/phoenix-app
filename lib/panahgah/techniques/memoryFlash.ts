// lib/panahgah/techniques/memoryFlash.ts
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
  AUDIO_KEYS.panahgahTechniques.memoryFlash01,
] as const;

function pickVoiceKey(seed: string): string {
  const h = hashSeed(seed);
  return VOICE_KEYS[h % VOICE_KEYS.length];
}

const module: ScenarioModule = {
  id: "memory-flash",
  title: "الان یه خاطره از رابطه یادم افتاد",

  getPlanForVisit: (visitIndex: number) => {
    const voiceKey = pickVoiceKey(`memory-flash:${visitIndex}`);

    return [
      // 1) checkin
      {
        type: "checkin",
        title: "الان شدت اثر این خاطره روی حالت چقدره؟",
        min: 0,
        max: 10,
      },

      // 2) voice
      {
        type: "voice",
        title: "این ویس رو گوش بده تا خاطره تبدیل به اقدام تکانشی نشه",
        uri: voiceKey, // KEY نه URL
      },

      // 3) form
      {
        type: "form",
        title: "خاطره رو کامل تحلیل کن",
        fields: [
          {
            key: "memory_scene",
            label:
              "خاطره دقیقاً چی بود؟ (کجا بودید؟، چی گفت؟، چی شد؟)",
          },
          {
            key: "why_now",
            label:
              "به نظرت چرا همین الان این خاطره فعال شد؟ (تنهایی؟ آهنگ؟ شب؟ شبکه اجتماعی؟)",
          },
          {
            key: "body_reaction",
            label:
              "الان این خاطره توی بدنت کجا اثر گذاشته؟ (گلو، سینه، شکم، بی‌قراری کلی بدن)",
          },
          {
            key: "impulse",
            label:
              "این خاطره تو رو به انجام چه کاری هل می‌ده؟ (پیام دادن؟ چک کردن؟ زنگ زدن؟ رفتن سراغ عکس‌ها؟)",
          },
          {
            key: "full_reality",
            label:
              "واقعیت کامل رابطه رو کنار این خاطره بنویس: ۳ چیز سخت، آزاردهنده و هزینه‌دار که در رابطه بود رو بنویس",
          },
          {
            key: "today_cost",
            label:
              "اگه الان از روی این خاطره اقدام تکانشی کنی، امروز چه هزینه‌ای می‌دی؟",
          },
          {
            key: "anchor_sentence",
            label:
              "یک جمله لنگر بنویس که به خودت بگی: مثلا «این فقط یک خاطره‌ست، نه نشونه‌ی برگشت.»",
          },
        ],
      },

      // 4) breath
      { type: "breath" },

      // 5) action
      {
        type: "action",
        title: "برای تثبیت حالت، یک اقدام ساده انجام بده",
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