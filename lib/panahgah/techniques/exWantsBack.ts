// lib/panahgah/techniques/exWantsBack.ts
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
  AUDIO_KEYS.panahgahTechniques.exWantsBack01,
] as const;

function pickVoiceKey(seed: string): string {
  const h = hashSeed(seed);
  return VOICE_KEYS[h % VOICE_KEYS.length];
}

const module: ScenarioModule = {
  id: "ex-wants-back",
  title: "الان بهم پیام داده که میخواد برگرده",

  getPlanForVisit: (visitIndex: number) => {
    const voiceKey = pickVoiceKey(`ex-wants-back:${visitIndex}`);

    return [
      // 1) checkin
      {
        type: "checkin",
        title: "الان شدت هیجان یا اضطرابت چقدره؟",
        min: 0,
        max: 10,
      },

      // 2) voice
      {
        type: "voice",
        title: "قبل از هر جواب، این ویس رو گوش بده",
        uri: voiceKey,
      },

      // 3) form: واقعیت‌نگاری + جلوگیری از پاسخ عجولانه
      {
        type: "form",
        title: "واقعیت رو برای نوشتن، ثبت کن",
        fields: [
          {
            key: "msg_exact",
            label: "دقیقاً چی گفته یا نوشته؟",
          },
          {
            key: "what_i_want_to_do",
            label: "الان دلت می‌خواد دقیقاً چی کار کنی؟ (زنگ بزنی؟ برم ببینیش؟ یه پیام طولانی بهش بدی؟)",
          },
          {
            key: "why_relationship_ended",
            label: "سه دلیل واقعی و مشخص که رابطه قبلاً چرا تموم شد رو بنویس",
          },
          {
            key: "my_need_underneath",
            label: "زیر این هیجان الان تو، نیاز اصلیت چیه؟ (امنیت، تایید، فرار از تنهایی، وابستگی، جبران)",
          },
          {
            key: "delay_reply_text",
            label:
              "یک پیام کوتاه برای خودت بخاطر جواب ندادن و یا دیر جواب دادن بهش بنویس:",
          },
        ],
      },

     {
  type: "form",
  title: "میزان اینکه چقدر میشه بهش اعتماد کرد رو محاسبه کن",
  fields: [
    {
      key: "rs_repeat_pattern",
      kind: "score02",
      label: "۱) احتمال اینکه همون رفتارهای قبلی رو تکرار کنه چقدره؟",
      optionsLine: "۰ خیلی کم | ۱ نمی‌دونم | ۲ زیاد",
    },
    {
      key: "rs_accountability",
      kind: "score02",
      label: "۲) بعد از جدایی مسئولیت‌پذیری واقعی نشون داده؟",
      optionsLine: "۰ زیاد | ۱ یکم | ۲ اصلاً",
    },
    {
      key: "rs_behavior_change",
      kind: "score02",
      label: "۳) تغییر رفتاری قابل مشاهده داره؟",
      optionsLine: "۰ آره خیلی | ۱ یکم | ۲ اصلاً",
    },
    {
      key: "rs_trust_damage",
      kind: "score02",
      label: "۴) دفعه قبلی که بهش اعتماد کردی دوباره بهت آسیب زد؟",
      optionsLine: "۰ نه | ۱ یکم | ۲ آره",
    },
    {
      key: "rs_boundaries",
      kind: "score02",
      label: "۵) اگر برگرده، مرزهای تو مشخص و محکم هست؟",
      optionsLine: "۰ آره | ۱ یکم | ۲ مرزی ندارم",
    },
    {
      key: "rs_pressure",
      kind: "score02",
      label: "۶) الان برای جواب فوری بهت فشار میاره؟",
      optionsLine: "۰ نه | ۱ یکم | ۲ زیاد",
    },
    {
      key: "rs_third_party",
      kind: "score02",
      label: "۷) احتمال حضور نفر سوم چقدره؟",
      optionsLine: "۰ داخل رابطه نیست | ۱ مشکوکه | ۲ احتمالاً داخل رابطه‌ست",
    },
    {
      key: "rs_my_state",
      kind: "score02",
      label: "۸) وضعیت روانی خودت الان چقدره؟",
      optionsLine: "۰ حالم خوبه | ۱ ناپایدارم | ۲ خیلی شکننده‌ام",
    },

    // ✅ اتوماتیک
    {
      key: "rs_total",
      kind: "readonly",
      label: "جمع امتیاز",
    },
    {
      key: "rule_from_score",
      kind: "readonly",
      label: "نتیجه",
    },
  ],

  // ✅ ولیدیشن: فقط همین ۸ تا باید انتخاب بشن
  required: [
    "rs_repeat_pattern",
    "rs_accountability",
    "rs_behavior_change",
    "rs_trust_damage",
    "rs_boundaries",
    "rs_pressure",
    "rs_third_party",
    "rs_my_state",
  ],
},

      // 5) breath
      { type: "breath" },

      // 6) action
      {
        type: "action",
        title: "یک اقدام ساده برای تثبیت حالت انجام بده",
      },

      // 7) done
      {
        type: "done",
        title: "الان شدت حالت چقدره؟",
      },
    ] as any;
  },
};

export default module;