// lib/panahgah/techniques/startFromZero.ts
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
  AUDIO_KEYS.panahgahTechniques.startFromZero01,
] as const;

function pickVoiceKey(seed: string): string {
  const h = hashSeed(seed);
  return VOICE_KEYS[h % VOICE_KEYS.length];
}

const module: ScenarioModule = {
  id: "start-from-zero",
  title: "الان فک میکنم چجوری باز از صفر شروع کنم",

  getPlanForVisit: (visitIndex: number) => {
    const voiceKey = pickVoiceKey(`start-from-zero:${visitIndex}`);

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
        title: "این ویس رو گوش بده تا ذهنت از حالت تهدید بیاد بیرون",
        uri: voiceKey,
      },

      // 3) form
      {
        type: "form",
        title: "صفرِ واقعی رو دقیق تعریف کن",
        fields: [
          {
            key: "what_is_zero",
            label:
              "وقتی می‌گی «از صفر»، دقیقاً منظورت چیه؟ (تنهایی؟ بی‌هدف بودن؟ بی‌ارزش شدن؟ بی‌پولی؟)",
          },
          {
            key: "lost_or_left_behind",
            label:
              "چه چیزهایی رو در این رابطه از خودت جا گذاشتی؟ (سلامت، دوستان، انگیزه، عزت‌نفس، برنامه) حداقل ۳ مورد",
          },
          {
            key: "still_have",
            label:
              "سه چیزی که هنوز داری و می‌تونه پایه‌ی شروع باشه چیه؟ (مهارت، آدم‌ها، پول، زمان، تجربه، بدن)",
          },
          {
            key: "one_week_goal",
            label:
              "اگه فقط برای ۷ روز آینده یک هدف خیلی کوچک و واقعی انتخاب کنی، اون چیه؟",
          },
          {
            key: "first_brick_today",
            label:
              "امروز «اولین آجر» رسیدن به اون هدف چیه؟ دقیق و قابل انجام: (مثلاً ۱۰ دقیقه پیاده‌روی یا یک تماس یا یک کار عقب افتاده)",
          },
          {
            key: "obstacle_and_plan",
            label:
              "احتمالاً چی جلوت رو می‌گیره؟ و اگه اون اتفاق افتاد، نقشه جایگزین چیه؟",
          },
        ],
      },

      // 4) breath
      { type: "breath" },

      // 5) action
      {
        type: "action",
        title: "همون «اولین آجرِ امروز» رو انجام بده",
      },

      // 6) done
      {
        type: "done",
        title: "الان حالت چطوره؟",
      },
    ] as any;
  },
};

export default module;