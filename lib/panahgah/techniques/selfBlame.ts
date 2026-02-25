// lib/panahgah/techniques/selfBlame.ts
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
  AUDIO_KEYS.panahgahTechniques.selfBlame01,
] as const;

function pickVoiceKey(seed: string): string {
  const h = hashSeed(seed);
  return VOICE_KEYS[h % VOICE_KEYS.length];
}

const module: ScenarioModule = {
  id: "self-blame",
  title: "الان خودمو مقصر میدونم بخاطر تموم شدن رابطه",

  getPlanForVisit: (visitIndex: number) => {
    const voiceKey = pickVoiceKey(`self-blame:${visitIndex}`);

    return [
      // 1) checkin
      {
        type: "checkin",
        title: "الان شدت احساس گناه یا شرمت چقدره؟",
        min: 0,
        max: 10,
      },

      // 2) voice
      {
        type: "voice",
        title: "این ویس رو گوش بده تا «مسئولیت» رو از «خودزنی» جدا کنی و خودت رو بی‌رحمانه قضاوت نکنی",
        uri: voiceKey, // KEY نه URL
      },

      // 3) form
      {
        type: "form",
        title: "گزارش واقع‌بینانه بنویس (بدون بردن خودت به دادگاه و محکوم کردن خودت)",
        fields: [
          {
            key: "event",
            label:
              "اگه بخوای خیلی ساده بگی، چی شد که رابطه تموم شد؟ (فقط واقعیت‌ها رو بگو)",
          },
          {
            key: "my_share_3",
            label:
              "سه سهم واقعیِ تو در تموم شدن رابطه چی بود؟ ( کلی‌گویی کن؛ دقیق و قابل‌تعبیر بنویس)",
          },
          {
            key: "not_in_my_control",
            label:
              "کدوم بخش‌ها دست تو نبود؟ (سهم اون آدم چیه؟ شرایط چطوری بود؟ ارزش‌هاتون تفاوت داشت؟ چه محدودیت‌هایی داشتید؟)",
          },
          {
            key: "good_intent",
            label:
              " نیتِ خوبت چی بود که بد اجرا شد؟ (مثلاً: می‌خواستم صمیمیت بسازم ولی کنترلگر شدم)",
          },
          {
            key: "one_lesson",
            label:
              "یک درس اصلی که اگه زودتر می‌فهمیدی، بهتر می‌شد چیه؟ (یک جمله)",
          },
          {
            key: "repair_without_contact",
            label:
              "الان بدون تماس با اون آدم، چطور می‌تونی این درس رو در خودت تمرین کنی؟",
          },
          {
            key: "self_talk",
            label:
              "حرفی که به یک دوستِ عزیز در همین شرایط می‌زدی رو به خودت بگو ",
          },
          {
            key: "boundary_today",
            label:
              " مرز امروز خودت رو بنویس: مثلا «من امروز خودم رو تحقیر نمی‌کنم؛ فقط یاد می‌گیرم.»",
          },
        ],
      },

      // 4) breath
      { type: "breath" },

      // 5) action
      {
        type: "action",
        title: "برای تثبیت، یک اقدام ساده انجام بده",
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