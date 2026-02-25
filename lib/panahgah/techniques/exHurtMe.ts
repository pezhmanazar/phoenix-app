// lib/panahgah/techniques/exHurtMe.ts
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
  AUDIO_KEYS.panahgahTechniques.exHurtMe01,
] as const;

function pickVoiceKey(seed: string): string {
  const h = hashSeed(seed);
  return VOICE_KEYS[h % VOICE_KEYS.length];
}

const module: ScenarioModule = {
  id: "ex-hurt-me",
  title: "الان اکسم یکاری کرده که من اذیت شدم",

  getPlanForVisit: (visitIndex: number) => {
    const voiceKey = pickVoiceKey(`ex-hurt-me:${visitIndex}`);

    return [
      // 1) checkin
      {
        type: "checkin",
        title: "الان شدت اذیت شدنت چقدره؟",
        min: 0,
        max: 10,
      },

      // 2) voice
      {
        type: "voice",
        title: "این ویس رو گوش بده تا موج ناراحتیت بخوابه و عجولانه واکنش ندی",
        uri: voiceKey, // KEY نه URL
      },

      // 3) form
      {
        type: "form",
        title: "اتفاق رو دقیق بنویس تا مغزت آروم‌تر تصمیم بگیره",
        fields: [
          {
            key: "what_happened",
            label:
              "دقیقاً چی شد؟ فقط واقعیتِ قابل‌مشاهده رو بنویس (بدون تحلیل و حدس)",
          },
          {
            key: "meaning_story",
            label:
              "مغزت از این کار، چه داستانی ساخته؟ (مثلاً: «بی‌ارزش شدم»، «عمداً خواست خردم کنه»، «دیگه دوستم نداره»)",
          },
          {
            key: "emotion",
            label:
              "الان بیشتر کدوم حس رو داری؟ (خشم، غم، تحقیر، ترس، حس رهاشدگی، حس بی‌عدالتی) و چرا؟",
          },
          {
            key: "body",
            label:
              "توی بدنت کجاها واکنش می‌بینی؟ (گلو، سینه، شکم، سر، دست‌ها) دقیق بنویس.",
          },
          {
            key: "urge",
            label:
              "الان دلت می‌خواد دقیقاً چیکار کنی؟ (پیام بدی؟ تماس بگیری؟ دعوا کنی؟ استوری بذاری؟ چکش کنی؟ انتقام بگیری؟) واضح و صادقانه بنویس.",
          },
          {
            key: "message_draft",
            label:
              "اگه قرار بود همین الان یک جمله بگی یا بنویسی، دقیقاً چی می‌گفتی؟",
          },
          {
            key: "cost_if_send",
            label:
              "اگه همین الان واکنش نشون بدی، ۲ ساعت بعد چه هزینه‌ای می‌دی؟ (شرم، پشیمونی، بدتر شدن رابطه، دور شدن)",
          },
          {
            key: "boundary_24h",
            label:
              "مرز حفاظتی بنویس: مثلا «من تا ۲۴ ساعت آینده هیچ پیامی نمیدم، تماس نمی‌گیرم و چکش نمی‌کنم.»",
          },
        ],
      },

      // 4) breath (پخش RelaxationPlayer)
      { type: "breath" },

      // 5) action
      {
        type: "action",
        title: "برای تخلیه فشار، یک اقدام ساده انجام بده",
      },

      // 6) done
      {
        type: "done",
        title: "بعد از انجام مراحل بگو الان شدت حال بدت چقدره؟",
      },
    ] as any;
  },
};

export default module;