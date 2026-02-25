// lib/panahgah/techniques/heardExIsFine.ts
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
  AUDIO_KEYS.panahgahTechniques.heardExIsFine01,
] as const;

function pickVoiceKey(seed: string): string {
  const h = hashSeed(seed);
  return VOICE_KEYS[h % VOICE_KEYS.length];
}

const module: ScenarioModule = {
  id: "heard-ex-is-fine",
  title: "الان فهمیدم یا بهم خبر رسید حالش خوبه",

  getPlanForVisit: (visitIndex: number) => {
    const voiceKey = pickVoiceKey(`heard-ex-is-fine:${visitIndex}`);

    return [
      // 1) checkin
      {
        type: "checkin",
        title: "الان شدت موج ناراحتیت چقدره؟",
        min: 0,
        max: 10,
      },

      // 2) voice
      {
        type: "voice",
        title: "این ویس رو گوش بده تا مغزت این خبر رو درست پردازش کنه",
        uri: voiceKey, // KEY نه URL
      },

      // 3) form
      {
        type: "form",
        title: "این خبر رو از «ارزش خودت» جدا کن",
        fields: [
          {
            key: "how_found_out",
            label:
              "این خبر رو دقیقاً چطور فهمیدی؟ (کی گفت؟ کجا دیدی؟ چی شنیدی؟)",
          },
          {
            key: "instant_story",
            label:
              "ذهنت فوری چه داستانی ساخت؟ (یک جمله دقیق بنویس)",
          },
          {
            key: "pain_point",
            label:
              "این داستان کجای تو رو نشونه گرفت؟ (رهاشدگی، بی‌ارزشی، رقابت، حس بازنده بودن)",
          },
          {
            key: "what_i_know",
            label:
              "«واقعیت‌های قطعی» چی هستن؟ (فقط چیزهایی که مطمئنی رو بنویس)",
          },
          {
            key: "what_i_dont_know",
            label:
              "چه چیزهایی رو «نمی‌دونی» ولی ذهنت داره حدس میزنه؟ (۳ مورد)",
          },
          {
            key: "my_value_sentence",
            label:
              "یک جمله‌ی واقع‌بینانه بنویس که نشون بده ارزش تو به حالِ اون وابسته نیست.",
          },
          {
            key: "no_check_12h",
            label:
              "تعهد ۱۲ ساعته: امروز هیچ چکی انجام نمی‌دم و دنبال اطلاعات جدید نمی‌رم. (یک جمله تأیید بنویس)",
          },
          {
            key: "urge_right_now",
            label:
              "الان دقیقاً دوست داشتی چی کار کنی؟ (چک کردن، پیام دادن، تحلیل کردن، گریه کردن، انتقام گرفتن)",
          },
        ],
      },

      // 4) breath
      { type: "breath" },

      // 5) action
      {
        type: "action",
        title: "برای تثبیت، یک اقدام خیلی ساده انجام بده",
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