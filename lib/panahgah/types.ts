// lib/panahgah/types.ts

// 🎧 مرحله‌های مختلف در هر سناریو
export type Step =
  | { type: "voice"; title: string; uri: number | string } // پخش ویس (expo-av)
  | { type: "form"; title: string; fields: { key: string; label: string }[] } // تکنیک فرم‌محور
  | { type: "breath"; title: string; seconds: number; hints?: string[] }; // مدیتیشن/نفس

// 🧩 مجموعهٔ مرحله‌ها برای هر مراجعه (هر بار مراجعه = یک پلان)
export type Plan = Step[];

// 📘 ماژول سناریو (مثل "الان اکسم رو دیدم")
export type ScenarioModule = {
  id: string;
  title: string;
  getPlanForVisit: (visitIndex: number) => Plan; // visitIndex = 1..n
};

// 🗒️ ساختار ذخیره‌ی یادداشت‌ها و سوابق مرحله دوم
export type HistoryEntry = {
  id: string;          // شناسهٔ منحصربه‌فرد (timestamp + random)
  createdAt: number;   // زمان ثبت (Date.now)
  content: string;     // محتوای ثبت‌شده توسط کاربر
};

// 🧠 تعریف اختیاری برای تکنیک خاص (اگر خواستیم ازش در UI استفاده کنیم)
export type Technique = {
  id: string;          // شناسهٔ تکنیک یا سناریو
  title: string;       // عنوان تکنیک
  step2Label?: string; // نام مرحلهٔ دوم (مثلاً «یادداشت افکار»)
};