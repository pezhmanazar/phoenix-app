// lib/panahgah/techniques/urgeToCheck.ts
import { AUDIO_KEYS } from "@/constants/media";
import type { ScenarioModule } from "../types";

/**
 * سناریو: urge-to-check
 * هدف: جلوگیری از تخریب لحظه‌ای
 *
 * ساختار ثابت ۶ مرحله‌ای (طبق Runner جدید):
 * 1) checkin: شدت حال بد (۰..۱۰) قبل از هر چیز
 * 2) voice: ویس آگاهی‌بخش (هر بار یکی رندوم)
 * 3) form: ادغام Urge Surfing + خاموش کردن توهم کنترل (یک مرحله)
 * 4) breath: آرام‌سازی (در Runner به RelaxationPlayer رندر می‌شود)
 * 5) action: اقدام اجرایی (ActionStepCard / یا نسخه inline اگر Runner آن را رندر کند)
 * 6) done: تمام (ثبت شدت بعد + تصمیم ادامه/اتمام در Runner)
 */

/* ---------- Seeded pick (رندوم پایدار) ---------- */
function hashSeed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

// ✅ ویس‌های اختصاصی «چک نکردن» (Seeded Random)
const VOICE_KEYS = [
  AUDIO_KEYS.panahgahNoCheck.awarenessLoop,
  AUDIO_KEYS.panahgahNoCheck.dopamineExplain,
  AUDIO_KEYS.panahgahNoCheck.fearOfReplacement,
  AUDIO_KEYS.panahgahNoCheck.urgeNotCommand,
] as const;

function pickVoiceKey(seed: string): (typeof VOICE_KEYS)[number] {
  const h = hashSeed(seed);
  return VOICE_KEYS[h % VOICE_KEYS.length];
}
const module: ScenarioModule = {
  id: "urge-to-check",
  title: "الان میخوام برم چکش کنم",

  getPlanForVisit: (visitIndex: number) => {
    const voiceKey = pickVoiceKey(`urge-to-check:${visitIndex}`);

    const plan = [
      // ✅ 1) checkin
      {
        type: "checkin",
        title: "الان شدت حال بدت چقدره؟",
        hint: "فقط یک عدد انتخاب کن. قرار نیست دقیق باشه.",
        min: 0,
        max: 10,
      },

      // ✅ 2) voice
      {
        type: "voice",
        title: "برای قطع موج وسوسه، این  فایل رو گوش بده",
        // ⚠️ KEY نه URL
        uri: voiceKey,
      },

      // ✅ 3) form (ادغام دو نوشتن)
      {
        type: "form",
        title: "برای شکستن موج و گذشتن از توهم کنترل، سوالات پایین رو با دقت و حوصله جواب بده",
        fields: [
          // --- Urge Surfing ---
          { key: "us_body", label: "الان کجای بدنت احساس فشار و ناراحتی می‌کنی؟" },
          { key: "us_name", label: "الان چه هیجانی داری؟ (مثلا ترس، خشم، دلتنگی، انتظار یا هر چیز دیگه)" },
          { key: "us_peak", label: "حدس می‌زنی چند دقیقه دیگه شدت موج ناراحتیت کمتر می‌شه؟" },
          { key: "us_promise", label: " تا ۱۰ دقیقه آینده چه تعهدی می‌دی که انجامش بدی؟" },

          // --- Illusion of Control ---
          { key: "ic_thought", label: "فکر غالبت قبل از  ایجاد وسوسه چک کردن چی بود؟" },
          { key: "ic_lie", label: "این فکر چه دروغی بهت می‌گه؟" },
          { key: "ic_truth", label: "نسخه‌ی واقع‌بینانه‌ این فکر چیه؟" },
          { key: "ic_micro", label: "الان چکش کنی چه فایده‌ای برای تو داره؟" },
        ],
      },

      // ✅ 4) breath (۳ دقیقه box breathing)
      {
        type: "breath",
      },

      // ✅ 5) action
      {
        type: "action",
        title: "برای تثبیت حالت یک اقدام خیلی ساده رو انجام بده",
        // اگر خواستی بعداً لیست اختصاصی همین سناریو رو هم از همینجا پاس بده:
        // items: [{ key:"walk2", label:"۲ دقیقه قدم بزن", seconds:120 }, ...]
      },

      // ✅ 6) done
      {
        type: "done",
        title: "بعد از انجام تکنیک‌ها بگو الان حالت چطوره؟",
      },
    ];

    return plan as any;
  },
};

export default module;