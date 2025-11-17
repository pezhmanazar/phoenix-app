// lib/panahgah/techniques/sawEx.ts
import type { ScenarioModule, Plan } from "../types";

// سه طرحِ مرحله برای مراجعه‌های 1، 2، 3
const plan1: Plan = [
  { type: "voice", title: "اول گوش بده", uri: require("../../../assets/audio/voice.mp3") },
  {
    type: "form",
    title: "پایش افکار (نسخه کوتاه)",
    fields: [
      { key: "situation", label: "چه دیدی/چه شد؟" },
      { key: "autoThought", label: "فکر خودکار چی بود؟" },
      { key: "evidence", label: "شواهد موافق/مخالف؟ (کوتاه)" },
    ],
  },
  { type: "breath", title: "بازگشت به خط پایه", seconds: 90, hints: ["دم ۴ث", "حبس 2ث", "بازدم ۶ث"] },
];

const plan2: Plan = [
  { type: "voice", title: "گوش بده (نوبت دوم)", uri: require("../../../assets/audio/voice.mp3") },
  {
    type: "form",
    title: "بازسازی شناختی (خلاصه)",
    fields: [
      { key: "distortion", label: "خطای شناختی محتمل؟" },
      { key: "reframe", label: "بازقالب‌بندی سالم‌تر چیست؟" },
    ],
  },
  { type: "breath", title: "تنفس جعبه‌ای", seconds: 120, hints: ["۴-۴-۴-۴"] },
];

const plan3: Plan = [
  { type: "voice", title: "گوش بده (نوبت سوم)", uri: require("../../../assets/audio/voice.mp3") },
  {
    type: "form",
    title: "پلان عمل کوچک",
    fields: [
      { key: "urge", label: "الان چه میلی داری؟" },
      { key: "alt", label: "جایگزین سالم ۲ دقیقه‌ای؟" },
    ],
  },
  { type: "breath", title: "مدیتیشن هدایت‌شده کوتاه", seconds: 150 },
];

const module: ScenarioModule = {
  id: "saw-ex",
  title: "الان اکسم رو دیدم",
  getPlanForVisit: (visitIndex: number) => {
    if (visitIndex <= 0) return plan1;
    if (visitIndex === 1) return plan2;
    if (visitIndex === 2) return plan3;
    // 3 به بعد → رندوم از بین سه‌تای بالا
    const arr = [plan1, plan2, plan3];
    return arr[Math.floor(Math.random() * arr.length)];
  },
};

export default module;