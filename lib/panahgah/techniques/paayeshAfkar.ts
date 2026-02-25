import { AUDIO_KEYS } from "@/constants/media";
import type { ScenarioModule } from "../types";

/* ---------- Seeded pick (رندوم پایدار) ---------- */
function hashSeed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const VOICE_KEYS = [
  AUDIO_KEYS.panahgahTechniques.paayeshAfkar01,
] as const;

function pickVoiceKey(seed: string): string {
  const h = hashSeed(seed);
  return VOICE_KEYS[h % VOICE_KEYS.length];
}

const module: ScenarioModule = {
  id: "paayesh-afkar",
  title: "الان یک فکر مزاحم دارم",

  getPlanForVisit: (visitIndex: number) => {
    const voiceKey = pickVoiceKey(`paayesh-afkar:${visitIndex}`);

    return [
      {
        type: "checkin",
        title: "الان شدت حال بدت چقدره؟",
        hint: "فقط یک عدد انتخاب کن. قرار نیست دقیق باشه.",
        min: 0,
        max: 10,
      },

      {
        type: "voice",
        title: "این ویس رو گوش بده تا بدونی با فکر مزاحم چطور برخورد کنی",
        uri: voiceKey, // KEY نه URL
      },

      // ✅ فرم جدولی (ولی با ستون‌های ساده و جمله‌محور)
      {
        type: "form",
        title: "فکر مزاحم رو بیرون بریز و اون رو مرتب کن",
        variant: "table",
        table: {
          columns: [
            {
              key: "situation",
              label:
                "الان دقیقاً چی شد که این فکر پرید تو ذهنت؟ (یعنی کجا بودی؟ چی دیدی؟ چی شنیدی؟)",
            },
            {
              key: "thought_exact",
              label:
                "فکر مزاحم رو دقیقاً مثل یک جمله بنویس (یعنی همون چیزی که تو ذهنت تکرار میشه رو بنویس)",
            },
            {
              key: "fear_story",
              label:
                "اگه این فکر بخواد «بدترین سناریو» رو بسازه، داستانش چیه؟ (یعنی بدترین حالت ممکن رو بنویس)",
            },
            {
              key: "emotion_body",
              label:
                "الان چه احساسی داری و کجای بدنت حسش می‌کنی؟ (مثلاً ترس در سینه یا فشار در گلو)",
            },
            {
              key: "intensity_0_10",
              label: "شدت این حس از ۰ تا ۱۰ چنده؟ (فقط عدد بنویس)",
            },

            {
              key: "mind_trap",
              label:
                "این فکر چه پیامی برای تو داره؟",
            },

            {
              key: "evidence_for",
              label:
                "چه چیزهایی باعث میشه این فکر «به نظر واقعی» بیاد؟ (شواهد منطقی خودت، برای این فکر رو بنویس که نشون میده این فکر واقعیه)",
            },
            {
              key: "evidence_against",
              label:
                "چه چیزهایی نشون میده این فکر همه‌ی حقیقت نیست؟ (نقطه‌های مخالفی که ثابت میکنه این فکر واقعی نیست رو بنویس)",
            },
            {
              key: "balanced_sentence",
              label:
                "یک جمله‌ی واقع‌بینانه‌تر در مورد فکرت بنویس که حس همدلی داخلش داشته باشه (یعنی فکر کن اگه این فکر رو دوستت بهت می‌گفت چی بهش می‌گفتی؟)",
            },

            // ✅ جایگزین «اقدام ۲ دقیقه‌ای» (چون action step داریم)
            {
              key: "ten_min_commit",
              label:
                "یک تعهد کوتاه تا ۱۰ دقیقه آینده بده (مثلاً: «چکش نمی‌کنم و فقط مرحله‌ی بعد رو انجام میدم»)",
            },
          ],
          rows: [{ id: "r1" }],
        },

        // ✅ ولیدیشن حداقلی: چیزهایی که واقعاً برای خروج از نشخوار لازمه
        required: [
          "situation",
          "thought_exact",
          "emotion_body",
          "intensity_0_10",
          "balanced_sentence",
          "ten_min_commit",
        ],
      },

      {
        type: "breath",
      },

      {
        type: "action",
        title: "برای قطع نشخوار، یک اقدام خیلی ساده رو انجام بده",
      },

      {
        type: "done",
        title: "بعد از انجام تمرین‌ها بگو الان حالت چطوره؟",
      },
    ] as any;
  },
};

export default module;