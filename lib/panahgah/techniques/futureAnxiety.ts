// lib/panahgah/techniques/futureAnxiety.ts
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
  AUDIO_KEYS.panahgahTechniques.futureAnxiety01,
] as const;

function pickVoiceKey(seed: string): string {
  const h = hashSeed(seed);
  return VOICE_KEYS[h % VOICE_KEYS.length];
}

const module: ScenarioModule = {
  id: "future-anxiety",
  title: "الان استرس دارم و از آینده می‌ترسم",

  getPlanForVisit: (visitIndex: number) => {
    const voiceKey = pickVoiceKey(`future-anxiety:${visitIndex}`);

    return [
      {
        type: "checkin",
        title: "الان شدت اضطرابت چقدره؟",
        min: 0,
        max: 10,
      },

      {
        type: "voice",
        title: "این ویس رو گوش بده تا اضطراب آینده از «تصویر» تبدیل به «برنامه» بشه",
        uri: voiceKey,
      },

      {
        type: "form",
        title: "اضطراب آینده رو تبدیل به چند جمله قابل مدیریت کن",
        fields: [
          {
            key: "worst_story",
            label:
              "بدترین سناریویی که ذهنت می‌سازه دقیقاً چیه؟",
          },
          {
            key: "probability",
            label:
              "منطقی فکر کن، احتمال واقعی این سناریو از ۰ تا ۱۰۰ چند درصده؟ چرا؟",
          },
          {
            key: "what_i_control",
            label:
              "سه چیزی که واقعاً همین امروز کنترلش دست توئه چیه؟ (مثلاً خواب، غذا، کار، تماس نگرفتن)",
          },
          {
            key: "what_i_dont_control",
            label:
              "سه چیزی که کنترلش دست تو نیست چیه؟ که قراره فعلاً ولش کنی",
          },
          {
            key: "next_24h_plan",
            label:
              "فقط برای ۲۴ ساعت آینده: سه کار کوچیک و قابل انجام بنویس که تو رو روی ریل نگه داره.",
          },
          {
            key: "anchor_sentence",
            label:
              "یک جمله لنگر بنویس که وقتی ذهنت رفت سمت آینده، به خودت بگی. (مثلاً: «امروز قدم‌های کوچیک بعدی رو انجام میدم چون قدم‌های کوچیک من، آیندم رو می‌سازه.»)",
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
        title: "بعد از انجام مراحل بگو الان شدت اضطرابت چقدره؟",
      },
    ] as any;
  },
};

export default module;