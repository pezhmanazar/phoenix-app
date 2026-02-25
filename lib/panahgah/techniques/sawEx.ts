// lib/panahgah/techniques/sawEx.ts
import { AUDIO_KEYS } from "@/constants/media";
import type { ScenarioModule } from "../types";

/* ---------- Seeded pick (رندوم پایدار) ---------- */
function hashSeed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const VOICE_KEYS = [
  AUDIO_KEYS.panahgahTechniques.sawEx01,
] as const;

function pickVoiceKey(seed: string): string {
  const h = hashSeed(seed);
  return VOICE_KEYS[h % VOICE_KEYS.length];
}

const module: ScenarioModule = {
  id: "saw-ex",
  title: "الان اکسم رو دیدم",

  getPlanForVisit: (visitIndex: number) => {
    const voiceKey = pickVoiceKey(`saw-ex:${visitIndex}`);

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
        title: "این ویس رو گوش بده تا شوکِ دیدن اکست فروکش کنه و تصمیم اشتباه نگیری",
        uri: voiceKey, // KEY نه URL
      },

      // 3) form
      {
        type: "form",
        title: "این موارد رو پر کن تا ذهنت خالی بشه",
        fields: [
          {
            key: "where_how",
            label: "کجا و چطور دیدیش؟",
          },
          {
            key: "body_signal",
            label: "بدنت دقیقاً چه واکنشی نشون داد؟ (تپش قلب، گلو درد، معده درد، لرزش بدن، گرگرفتگی، تنگی نفس و غیره)",
          },
          {
            key: "first_thought",
            label: "اولین جمله‌ای که تو ذهنت اومد چی بود؟ همون فکر رو بنویس.",
          },
          {
            key: "worst_story",
            label: "بدترین سناریویی که ذهنت سریع ساخت چی بود؟ (مثلاً «منو فراموش کرده؟»)",
          },
          {
            key: "urge",
            label: "الان وسوسه یا میلِ فوری‌ت چیه؟ ( مثل چک کردن، پیام دادن، رفتن سمتش، فرار کردن)",
          },
          {
            key: "if_i_do_it",
            label: "اگه همین الآن اون کار رو انجام بدی، احتمالاً بعدش چه حسی پیدا می‌کنی؟ (پشیمونی، سبک شدن یا بدتر شدن…)",
          },
          {
            key: "pause_sentence",
            label: "اگه می‌خواستی باهاش حرف بزنی موقعی که دیدیش، دوست داشتی بهش چی بگی؟",
          },
        ],
      },

      // 4) breath
      {
        type: "breath",
      },

      // 5) action
      {
        type: "action",
        title: "برای تثبیت حالت، یک اقدام خیلی ساده رو انجام بده",
      },

      // 6) done
      {
        type: "done",
        title: "بعد از انجام تکنیک‌ها بگو الان حالت چطوره؟",
      },
    ] as any;
  },
};

export default module;