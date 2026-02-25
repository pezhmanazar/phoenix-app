// lib/panahgah/techniques/inCrowdFeelAlone.ts
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
  AUDIO_KEYS.panahgahTechniques.inCrowdFeelAlone01,
] as const;

function pickVoiceKey(seed: string): string {
  const h = hashSeed(seed);
  return VOICE_KEYS[h % VOICE_KEYS.length];
}

const module: ScenarioModule = {
  id: "in-crowd-feel-alone",
  title: "الان توی جمعم و حالم بد شده و احساس تنهایی می‌کنم",

  getPlanForVisit: (visitIndex: number) => {
    const voiceKey = pickVoiceKey(`in-crowd-feel-alone:${visitIndex}`);

    return [
      // 1) checkin
      {
        type: "checkin",
        title: "الان شدتِ این حسِ تنهایی وسط جمع چقدره؟",
        min: 0,
        max: 10,
      },

      // 2) voice
      {
        type: "voice",
        title: "این ویس رو گوش بده تا موج رو کنترل کنی",
        uri: voiceKey,
      },

      // 3) form
      {
        type: "form",
        title: "موج رو دقیق ببین و ازش عبور کن",
        fields: [
          {
            key: "what_happened",
            label:
              "دقیقاً چی شد که موج شروع شد؟ (یک حرف، یک نگاه، یک صحنه، یک یادآوری)",
          },
          {
            key: "intrusive_thought",
            label:
              "همون فکرِ اصلی که تو ذهنت تکرار شد چی بود؟ (مثلاً «من اضافی‌ام»، «هیچ‌کس منو نمی‌فهمه»)",
          },
          {
            key: "body_signal",
            label:
              "الان کجای بدنت فشار، سنگینی یا دلشوره حس می‌کنی؟ (گلو، سینه، شکم)",
          },
          {
            key: "urge",
            label:
              "دوست داری الان چی کار کنی؟ (فرار، ساکت شدن، چک کردن گوشی، پیام دادن، تند شدن با بقیه، گریه کردن، انتقام)",
          },
          {
            key: "safe_micro_connection",
            label:
              "یک اتصال کوچیک و امن همین‌جا چیه؟ (یک سلام، یک سوال ساده، یک لبخند، رفتن کنار یک آدم امن، یا حتی فقط نزدیک‌تر شدن به یک گروه)",
          },
          {
            key: "one_sentence_self_talk",
            label:
              "یک جمله‌ی کوتاه که همین الآن به خودت می‌گی چیه؟ (واقع‌بینانه و مهربانانه، نه شعاری)",
          },
        ],
      },

      // 4) breath
      { type: "breath" },

      // 5) action
      {
        type: "action",
        title: "یک حرکت خیلی کوچک برای اتصال و برگشت به بدن انجام بده",
      },

      // 6) done
      {
        type: "done",
        title: "الان شدت این حس چقدره؟",
      },
    ] as any;
  },
};

export default module;