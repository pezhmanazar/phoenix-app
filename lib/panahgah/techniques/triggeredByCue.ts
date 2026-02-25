// lib/panahgah/techniques/triggeredByCue.ts
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
  AUDIO_KEYS.panahgahTechniques.triggeredByCue01,
] as const;

function pickVoiceKey(seed: string): string {
  const h = hashSeed(seed);
  return VOICE_KEYS[h % VOICE_KEYS.length];
}

const module: ScenarioModule = {
  id: "triggered-by-cue",
  title: "الان یه چیزی دیدم که منو یاد اون انداخت",

  getPlanForVisit: (visitIndex: number) => {
    const voiceKey = pickVoiceKey(`triggered-by-cue:${visitIndex}`);

    return [
      // 1) checkin
      {
        type: "checkin",
        title: "الان شدت حال بدت چقدره؟",
        hint: "فقط یک عدد انتخاب کن. قرار نیست دقیق باشه.",
        min: 0,
        max: 10,
      },

      // 2) voice
      {
        type: "voice",
        title: "این ویس رو گوش بده تا بفهمی چرا محرک‌ها این‌قدر اثر میذارن",
        uri: voiceKey, // KEY نه URL
      },

      // 3) form
      {
        type: "form",
        title: "این تداعی رو درست ثبت کن تا موج بخوابه",
        fields: [
          {
            key: "cue",
            label: "چی دیدی؟ یا شنیدی؟ یا بو کردی که اون رو یادت انداخت؟",
          },
          {
            key: "first_thought",
            label: "اولین فکری که همون لحظه اومد توو ذهنت چی بود؟",
          },
          {
            key: "emotion",
            label: "الان دقیقاً چه هیجانی داری؟ (مثلا دلتنگی، ترس، خشم، حسرت، شرم)",
          },
          {
            key: "body",
            label: "کجای بدنت واکنش نشون داد؟ (مثلا سینه، گلو، معده)",
          },
          {
            key: "urge",
            label: "الان میل داری چه کاری بکنی؟ (مثلا چک کردن، پیام دادن، نگاه کردن به عکس)",
          },
          {
            key: "reality",
            label:
              "یک جمله واقع‌بینانه بنویس: مثلا «این فقط تداعیِ یک محرکه، نه پیام از واقعیت. این موج میاد و میره و من نباید اشتباه کنم و خودم رو داخل افکارم غرق کنم.»",
          },
        ],
      },

      // 4) relaxation/breath (Runner خودش RelaxationPlayer رو میاره)
      {
        type: "breath",
      },

      // 5) action (مرحله اقدام جداست، توی فرم نپرس)
      {
        type: "action",
        title: "برای تثبیت حالت، یک اقدام خیلی ساده رو انجام بده",
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