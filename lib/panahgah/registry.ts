// lib/panahgah/registry.ts
import type { Plan, ScenarioModule } from "./types";

/** پلن پیش‌فرضِ قابل‌تست: یک فرم ساده + یک تمرین تنفس */
function defaultPlan(visitIndex: number): Plan {
  // می‌تونی بعداً بر اساس visitIndex (۱، ۲، ۳، …) پلن را تغییر بدهی
  return [
    {
      type: "form",
      title: "یادداشت سریع (۲-۳ خط)",
      fields: [
        { key: "what", label: "الان چه میل/احساسی داری؟" },
        { key: "action", label: "به جای آن، عمل سالم ۲ دقیقه‌ای؟" },
      ],
    },
    {
      type: "breath",
      title: "بازگشت به خط پایه",
      seconds: 90,
      hints: ["دم ۴ ث", "حبس ۲ ث", "بازدم ۶ ث"],
    },
  ];
}

/** لیست خام سناریوها (id ثابت و انگلیسی، title فارسی) */
const RAW = [
  { id: "paayesh-afkar", title: "پایش افکار" },
  { id: "food-meditation", title: "مدیتیشن حین غذا" },
  { id: "now-meditate", title: "الان میخوام مدیتیشن کنم" },
  { id: "saw-ex", title: "الان اکسم رو دیدم" },
  { id: "saw-ex-in-dream", title: "الان خوابش رو دیدم" },
  { id: "triggered-by-cue", title: "الان یه چیزی دیدم که منو یاد اون انداخت" },
  { id: "waiting", title: "الان چشم انتظارشم" },
  { id: "future-anxiety", title: "الان استرس دارم و از آینده میترسم" },
  { id: "what-is-ex-doing", title: "الان به این فکر میکنم چیکار داره میکنه" },
  { id: "urge-to-check", title: "الان میخوام برم چکش کنم" },
  { id: "daydream-return", title: "الان دارم رویاپردازی میکنم که برمیگرده" },
  { id: "impulsive-act", title: "الان میخوام یک کار احمقانه بکنم" },
  { id: "ex-hurt-me", title: "اکسم یکاری کرده که من اذیت شدم" },
  { id: "self-blame", title: "خودمو مقصر میدونم بخاطر تموم شدن رابطه" },
  { id: "pms", title: "الان توو دوران پریود یا پی‌ام‌اس هستم" },
  { id: "heard-ex-is-fine", title: "فهمیدم یا خبر رسید حالش خوبه" },
  { id: "i-miss-ex", title: "الان دلتنگش شدم" },
  { id: "memory-flash", title: "یه خاطره از رابطه یادم افتاد" },
  { id: "anger-revenge", title: "خیلی ازش عصبانیم / حس انتقام درونم ایجاد شد" },
  { id: "sudden-sadness", title: "بی‌دلیل الان حالم بد شد" },
  { id: "ex-wants-to-see", title: "بهم پیام داده یا زنگ زده که میخواد منو ببینه" },
  { id: "ex-wants-back", title: "بهم پیام داده که میخواد برگرده" },
  { id: "i-ended-but-sad", title: "رابطه رو خودم تموم کردم باز ناراحتم" },
  { id: "sexual-memories", title: "یاد سکس‌هامون میفتم" },
  { id: "feel-hopeless", title: "حس میکنم دیگه هیچوقت حالم خوب نمیشه" },
  { id: "deep-loneliness", title: "احساس تنهایی شدید میکنم" },
  { id: "start-from-zero", title: "چجوری از صفر شروع کنم باز" },
  { id: "in-crowd-feel-alone", title: "الان توی جمعم و حالم بد شده و احساس تنهایی میکنم" },
] as const;

/** رجیستر به‌صورت ماژول‌های قابل مصرف در Runner */
const modules: ScenarioModule[] = RAW.map((r) => ({
  id: r.id,
  title: r.title,
  getPlanForVisit: (visitIndex: number) => defaultPlan(visitIndex),
}));

/** دسترسی بر اساس id */
export function byId(id: string | undefined | null): ScenarioModule | null {
  if (!id) return null;
  return modules.find((m) => m.id === id) ?? null;
}

/** اگر جایی لیست کامل خواستی */
export function allScenarios(): ScenarioModule[] {
  return modules;
}