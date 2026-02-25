// lib/panahgah/techniques/exWantsToSee.ts
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
  AUDIO_KEYS.panahgahTechniques.exWantsToSee01,
] as const;

function pickVoiceKey(seed: string): string {
  const h = hashSeed(seed);
  return VOICE_KEYS[h % VOICE_KEYS.length];
}

const module: ScenarioModule = {
  id: "ex-wants-to-see",
  title: "الان بهم پیام داده یا زنگ زده که میخواد منو ببینه",

  getPlanForVisit: (visitIndex: number) => {
    const voiceKey = pickVoiceKey(`ex-wants-to-see:${visitIndex}`);

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
        title: "این ویس رو گوش بده تا قبل از هر تصمیمی آروم‌تر بشی",
        uri: voiceKey, // KEY نه URL
      },

      // 3) form (بدون «اقدام بعدیت چیه؟» چون action مرحله جداست)
      {
        type: "form",
        title: "قبل از انجام دادن کاری، وضعیت رو روشن کن",
        fields: [
          {
            key: "what_happened",
            label:
              "دقیقاً چی گفت یا چی نوشت؟",
          },
          {
            key: "my_urge",
            label:
              "دوست داری چی کار کنی؟ (جواب فوری بدی؟ بری ببینیش؟ بی‌خیال باشی؟ فحش بدی؟ گریه کنی؟)",
          },
          {
            key: "my_need",
            label:
              "الان واقعاً به چی نیاز داری؟ (مثلا امنیت، شفافیت، احترام، پایان محترمانه، اطمینان)",
          },
          {
            key: "risk_if_yes",
            label:
              "اگه همین الان «آره» بگی و ببینیش، بدترین ریسک برای تو چیه؟ (واقع‌بینانه)",
          },
          {
            key: "minimum_boundary",
            label:
              "اگه قرار باشه دیدار انجام بشه، حداقلی‌ترین مرزهای تو چیه؟ (زمان؟ مکان؟ مدت؟ هدف؟ بدون تماس بدنی؟ بدون بحث؟)",
          },
          {
            key: "delay_sentence",
            label:
              "یک جمله‌ی کوتاه برای «تعویق هوشمندانه» بنویس (مثلاً: الان شرایطش رو ندارم، فردا فلان ساعت جوابش رو می‌دم یا اون از این کارها زیاد کرده، پس این‌بار جوابش رو نمی‌دم.).",
          },
        ],
      },

      // 4) breath
      { type: "breath" },

      // 5) action
      {
        type: "action",
        title: "حالا یک اقدام خیلی ساده برای کنترل شرایط انجام بده",
      },

      // 6) done
      {
        type: "done",
        title: "الان شدت حالت چقدره؟",
      },
    ] as any;
  },
};

export default module;