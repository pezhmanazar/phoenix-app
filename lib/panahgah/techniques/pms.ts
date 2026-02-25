// lib/panahgah/techniques/pms.ts
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
  AUDIO_KEYS.panahgahTechniques.pms01,
] as const;

function pickVoiceKey(seed: string): string {
  const h = hashSeed(seed);
  return VOICE_KEYS[h % VOICE_KEYS.length];
}

const module: ScenarioModule = {
  id: "pms",
  title: "الان توو دوران پریود یا پی‌ام‌اس هستم و جدایی بیشتر اذیتم میکنه",

  getPlanForVisit: (visitIndex: number) => {
    const voiceKey = pickVoiceKey(`pms:${visitIndex}`);

    return [
      // 1) checkin
      {
        type: "checkin",
        title: "الان شدت فشار و حساسیتت چقدره؟",
        min: 0,
        max: 10,
      },

      // 2) voice
      {
        type: "voice",
        title: "این ویس رو گوش بده تا بدونی چرا توی این بازه همه‌چیز سنگین‌تره",
        uri: voiceKey, // KEY نه URL
      },

      // 3) form
      {
        type: "form",
        title: "امروز «بدن و ذهن» رو همزمان مدیریت کن",
        fields: [
          {
            key: "cycle_state",
            label:
              "الان دقیقاً کجای چرخه‌ای؟ (یعنی پریودی؟  نزدیک پریودی؟  یا مطمئن نیستی)",
          },
          {
            key: "body_signals",
            label:
              "بدنت الان چه سیگنال‌هایی می‌ده؟ (مثل درد، بی‌خوابی، بی‌قراری، خستگی، ولع، سردرد)",
          },
          {
            key: "emotions",
            label:
              "سه هیجان غالب الانت چیه؟ (مثلاً غم، خشم، اضطراب، دلتنگی، شرم)",
          },
          {
            key: "mind_pull",
            label:
              "ذهنت الان بیشتر می‌خواد چی کار کنه؟ (مثلا پیام دادن، چک کردن، گریه بی‌وقفه، دعوا، انزوا)",
          },
          {
            key: "freeze_24h",
            label:
              "تعهد ۲۴ ساعته: بنویس امروز هیچ تصمیم مهمی نمی‌گیرم و هیچ پیام یا چکی انجام نمی‌دم.",
          },
          {
            key: "care_plan",
            label:
              "سه مراقبتِ کم‌فشار برای امروز بذار که بعد از این تکنیک‌ها انجام بدی؟ (مثلاً دوش آب گرم یا قدم زدن کوتاه یا خوردن غذای مورد علاقه یا دیدن فیلم و سریال مورد علاقت)",
          },
          {
            key: "one_small_task",
            label:
              "یک کار خیلی کوچک که امروز بعد از این تکنیک‌ انجامش میدی که احساس خوب بهت بده، چیه؟",
          },
          {
            key: "safe_person",
            label:
              "اگه موج ناراحتی خیلی زیاد شد، به چه کسی می‌تونی زنگ بزنی؟ (یک نفر امن)",
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