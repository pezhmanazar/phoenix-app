// lib/panahgah/techniques/iEndedButSad.ts
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
  AUDIO_KEYS.panahgahTechniques.iEndedButSad01,
] as const;

function pickVoiceKey(seed: string): string {
  const h = hashSeed(seed);
  return VOICE_KEYS[h % VOICE_KEYS.length];
}

const module: ScenarioModule = {
  id: "i-ended-but-sad",
  title:
    "الان دارم به این فکر میکنم چرا با اینکه رابطه رو خودم تموم کردم باز ناراحتم",

  getPlanForVisit: (visitIndex: number) => {
    const voiceKey = pickVoiceKey(`i-ended-but-sad:${visitIndex}`);

    return [
      // 1) checkin
      {
        type: "checkin",
        title: "الان شدت ناراحتیت چقدره؟",
        min: 0,
        max: 10,
      },

      // 2) voice
      {
        type: "voice",
        title: "قبل از نتیجه‌گیری، این ویس رو گوش بده",
        uri: voiceKey,
      },

      // 3) form: جداسازی منطقی
      {
        type: "form",
        title: "ناراحتی رو از پشیمونی با پر کردن این موارد جدا کن",
        fields: [
          {
            key: "why_i_ended",
            label:
              "سه دلیل مشخص و واقعی که چرا رابطه رو تموم کردی چی بود؟",
          },
          {
            key: "what_was_not_working",
            label:
              "چه چیزهایی در رابطه به طور پایدار کار نمی‌کرد؟ (رفتارش، ارزش‌هات، مرزهات، امنیت روانیت)",
          },
          {
            key: "has_anything_changed",
            label:
              "از زمان جدایی تا حالا چه چیز قابل مشاهده‌ای تغییر کرده؟ (واقعی، نه وعده)",
          },
          {
            key: "what_i_miss_now",
            label:
              "الان دقیقاً چی رو از دست دادی که ناراحتت کرده؟",
          },
          {
            key: "fear_underneath",
            label:
              "زیر این ناراحتی، چه ترسی پنهونه؟ (تنهایی؟ اشتباه بودن تصمیم؟ از دست دادن فرصت؟)",
          },
          {
            key: "if_i_go_back",
            label:
              "اگه همین الان فقط برای کم شدن دردت بهش برگردی، چه ریسکی وجود داره؟",
          },
          {
            key: "anchor_sentence",
            label:
              "یک جمله‌ی لنگر بنویس: مثلا «درد من لزوماً به معنی اشتباه بودن تصمیمم نیست.»",
          },
        ],
      },

      // 4) breath
      { type: "breath" },

      // 5) action
      {
        type: "action",
        title: "یک اقدام کوچک برای تثبیت تصمیم امروز انجام بده",
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