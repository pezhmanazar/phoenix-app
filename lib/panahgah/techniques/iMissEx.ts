// lib/panahgah/techniques/iMissEx.ts
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
  AUDIO_KEYS.panahgahTechniques.iMissEx01,
] as const;

function pickVoiceKey(seed: string): string {
  const h = hashSeed(seed);
  return VOICE_KEYS[h % VOICE_KEYS.length];
}

const module: ScenarioModule = {
  id: "i-miss-ex",
  title: "الان دلتنگش شدم",

  getPlanForVisit: (visitIndex: number) => {
    const voiceKey = pickVoiceKey(`i-miss-ex:${visitIndex}`);

    return [
      // 1) checkin
      {
        type: "checkin",
        title: "الان شدت دلتنگیت چقدره؟",
        min: 0,
        max: 10,
      },

      // 2) voice
      {
        type: "voice",
        title: "این ویس رو گوش بده تا دلتنگی رو از اقدام جدا کنی",
        uri: voiceKey, // KEY نه URL
      },

      // 3) form
      {
        type: "form",
        title: "دلتنگی رو تحلیل کن",
        fields: [
          {
            key: "what_i_miss",
            label:
              "دقیقاً دلت برای چی تنگ شده؟ (خودِ اون آدم؟ بودن توو رابطه؟ یک حس خاص؟ یک عادت؟ یک نقش؟ یک خاطره؟)",
          },
          {
            key: "moment_trigger",
            label:
              "الان چه چیزی این دلتنگی رو فعال کرد؟ (تنهایی، آهنگ، شب، جمع، یادآوری خاطره)",
          },
          {
            key: "message_i_want_to_send",
            label:
              "اگه قرار بود همین الان بهش پیام بدی، دقیقاً بهش چی می‌گفتی؟",
          },
          {
            key: "unsaid_words",
            label:
              "سه جمله که توی رابطه نگفتی ولی دلت می‌خواست بگی چی بود؟",
          },
          {
            key: "why_we_had_to_end",
            label:
              "واقع‌بینانه بنویس: چه دلایلی محکمی داری که این رابطه باید تموم می‌شد؟ (حداقل ۳ مورد)",
          },
          {
            key: "cost_of_contact",
            label:
              "اگه الان از روی دلتنگی تماس بگیری یا پیام بدی، چه هزینه‌ای ممکنه بدی؟",
          },
          {
            key: "self_support_sentence",
            label:
              "یک جمله حمایتی برای خودت بنویس که نشون بده دلتنگی طبیعیه ولی تو قوی‌تر از موج دلتنگی هستی.",
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