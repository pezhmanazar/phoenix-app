// lib/panahgah/techniques/impulsiveAct.ts
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
  AUDIO_KEYS.panahgahTechniques.impulsiveAct01,
] as const;

function pickVoiceKey(seed: string): string {
  const h = hashSeed(seed);
  return VOICE_KEYS[h % VOICE_KEYS.length];
}

const module: ScenarioModule = {
  id: "impulsive-act",
  title: "الان میخوام یک کار احمقانه بکنم",

  getPlanForVisit: (visitIndex: number) => {
    const voiceKey = pickVoiceKey(`impulsive-act:${visitIndex}`);

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
        title: "این ویس رو گوش بده تا قبل از هر کاری عقلت بیدار شه",
        uri: voiceKey, // KEY نه URL
      },

      // 3) form
      {
        type: "form",
        title: "قبل از هر اقدامی، افکارت رو با پر کردن موارد زیر، خالی کن",
        fields: [
          {
            key: "impulse_action",
            label:
              "دقیقاً می‌خوای چه کاری بکنی؟ (پیام بدی؟ تماس بگیری؟ بری ببینیش؟ استوری تیکه‌دار بذاری؟ تهدیدش کنی؟ التماسش کنی؟ هرچی هست واضح بنویس)",
          },
          {
            key: "impulse_message",
            label:
              "اگه قرار بود همین الان یک جمله بگی یا بنویسی، دقیقاً چی می‌گفتی؟ (همون جمله واقعی رو، بدون سانسور بنویس)",
          },
          {
            key: "emotion_name",
            label:
              "الان دقیقاً چه هیجانی داری؟ (خشم، ترس، حس رهاشدگی، حس بی‌ارزشی، دلتنگی)",
          },
          {
            key: "body_signal",
            label:
              "توی بدنت چی حس می‌کنی؟ (گرگرفتگی، تپش قلب، فشار گلو، سنگینی سینه)",
          },
          {
            key: "worst_case",
            label:
              "بدترین نتیجه‌ای که ممکنه از این اقدام بگیری چیه؟ (واقع‌بینانه، نه فاجعه‌سازی)",
          },
          {
            key: "after_2_hours",
            label:
              "اگه این کار رو بکنی، دو ساعت بعد احتمالاً چه حسی داری؟ (شرم، پشیمونی، سبک شدن، یا بدتر شدن)",
          },
          {
            key: "pause_contract",
            label:
              "یک تعهد توقف بنویس: «من تا ۲۰ دقیقه دیگه، هیچ اقدامی نمی‌کنم و فقط مراحل تکنیک رو انجام می‌دم.»",
          },
        ],
      },

      // 4) breath
      { type: "breath" },

      // 5) action (اقدام‌های عمومی ActionStepCard)
      {
        type: "action",
        title: "برای تخلیه فشار بدن، یک اقدام خیلی ساده رو انجام بده",
      },

      // 6) done
      {
        type: "done",
        title: "بعد از انجام مراحل بگو الان شدت موجت چقدره؟",
      },
    ] as any;
  },
};

export default module;