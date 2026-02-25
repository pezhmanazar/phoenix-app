// lib/panahgah/registry.ts
import type { ScenarioModule } from "./types";

// ✅ Overrides (modules with real plans)
import AngerRevenge from "./techniques/angerRevenge";
import DaydreamReturn from "./techniques/daydreamReturn";
import DeepLoneliness from "./techniques/deepLoneliness";
import ExHurtMe from "./techniques/exHurtMe";
import ExWantsBack from "./techniques/exWantsBack";
import ExWantsToSee from "./techniques/exWantsToSee";
import FeelHopeless from "./techniques/feelHopeless";
import FutureAnxiety from "./techniques/futureAnxiety";
import HeardExIsFine from "./techniques/heardExIsFine";
import IEndedButSad from "./techniques/iEndedButSad";
import IMissEx from "./techniques/iMissEx";
import ImpulsiveAct from "./techniques/impulsiveAct";
import InCrowdFeelAlone from "./techniques/inCrowdFeelAlone";
import MemoryFlash from "./techniques/memoryFlash";
import PaayeshAfkar from "./techniques/paayeshAfkar";
import PMS from "./techniques/pms";
import SawEx from "./techniques/sawEx";
import SawExInDream from "./techniques/sawExInDream";
import SelfBlame from "./techniques/selfBlame";
import SexualMemories from "./techniques/sexualMemories";
import StartFromZero from "./techniques/startFromZero";
import SuddenSadness from "./techniques/suddenSadness";
import TriggeredByCue from "./techniques/triggeredByCue";
import UrgeToCheck from "./techniques/urgeToCheck";
import Waiting from "./techniques/waiting";
import WhatIsExDoing from "./techniques/whatIsExDoing";


/** لیست خام سناریوها (id ثابت و انگلیسی، title فارسی)
 * نکته: فقط سناریوهایی را اینجا نگه دار که «پلن واقعی» دارند (override).
 * سناریوهای تستی/نیمه‌کاره اینجا نمی‌آیند.
 */
const RAW = [
  { id: "paayesh-afkar", title: "الان یک فکر مزاحم دارم" },

  { id: "saw-ex", title: "الان اکسم رو دیدم" },
  { id: "saw-ex-in-dream", title: "الان خوابش رو دیدم" },
  { id: "triggered-by-cue", title: "الان یه چیزی دیدم که منو یاد اون انداخت" },
  { id: "waiting", title: "الان چشم انتظارشم" },
  { id: "future-anxiety", title: "الان استرس دارم و از آینده میترسم" },
  { id: "what-is-ex-doing", title: "الان به این فکر میکنم چیکار داره میکنه" },

  { id: "urge-to-check", title: "الان میخوام برم چکش کنم" },

  { id: "daydream-return", title: "الان دارم رویاپردازی میکنم که برمیگرده" },
  { id: "impulsive-act", title: "الان میخوام یک کار احمقانه بکنم" },
  { id: "ex-hurt-me", title: "الان اکسم یکاری کرده که من اذیت شدم" },
  { id: "self-blame", title: "الان خودمو مقصر میدونم بخاطر تموم شدن رابطه" },
  { id: "pms", title: "الان توو دوران پریود یا پی‌ام‌اس هستم و جدایی بیشتر اذیتم میکنه" },
  { id: "heard-ex-is-fine", title: "الان فهمیدم یا بهم خبر رسید حالش خوبه" },
  { id: "i-miss-ex", title: "الان دلتنگش شدم" },
  { id: "memory-flash", title: "الان یه خاطره از رابطه یادم افتاد" },
  { id: "anger-revenge", title: "الان خیلی ازش عصبانیم و حس انتقام درونم ایجاد شده" },
  { id: "sudden-sadness", title: "الان بی‌دلیل حالم بد شد" },
  { id: "ex-wants-to-see", title: "الان بهم پیام داده یا زنگ زده که میخواد منو ببینه" },
  { id: "ex-wants-back", title: "الان بهم پیام داده که میخواد برگرده" },
  { id: "i-ended-but-sad", title: "الان دارم به این فکر میکنم چرا با اینکه رابطه رو خودم تموم کردم باز ناراحتم" },
  { id: "sexual-memories", title: "الان یاد سکس‌هامون افتادم" },
  { id: "feel-hopeless", title: "الان حس میکنم دیگه هیچوقت حالم خوب نمیشه" },
  { id: "deep-loneliness", title: "الان احساس تنهایی شدید میکنم" },
  { id: "start-from-zero", title: "الان فک میکنم چجوری باز از صفر شروع کنم" },
  { id: "in-crowd-feel-alone", title: "الان توی جمعم و حالم بد شده و احساس تنهایی می‌کنم" },
] as const;

/** ✅ لیست ماژول‌های Override (هرکدوم id یونیک و پلن واقعی دارند) */
const OVERRIDES: ScenarioModule[] = [
  UrgeToCheck,
  PaayeshAfkar,
  SawEx,
  SawExInDream,
  TriggeredByCue,
  Waiting,
  FutureAnxiety,
  WhatIsExDoing,
  DaydreamReturn,
  ImpulsiveAct,
  ExHurtMe,
  SelfBlame,
  PMS,
  HeardExIsFine,
  IMissEx,
  MemoryFlash,
  AngerRevenge,
  SuddenSadness,
  ExWantsToSee,
  ExWantsBack,
  IEndedButSad,
  SexualMemories,
  FeelHopeless,
  DeepLoneliness,
  StartFromZero,
  InCrowdFeelAlone,
];


/**
 * ✅ رجیستر نهایی:
 * فقط آیتم‌هایی از RAW وارد می‌شوند که override واقعی دارند.
 * این یعنی چیزی نیمه‌کاره/تستی اصلاً به کاربر نمایش داده نمی‌شود.
 */
const modules: ScenarioModule[] = RAW.map((r) => {
  const override = OVERRIDES.find((m) => m.id === r.id);
  if (!override) return null;

  // عنوان را از RAW تزریق می‌کنیم تا هم‌راستا با لیست UI باشد
  return {
    ...override,
    title: r.title,
  };
}).filter(Boolean) as ScenarioModule[];

/** دسترسی بر اساس id */
export function byId(id: string | undefined | null): ScenarioModule | null {
  if (!id) return null;
  return modules.find((m) => m.id === id) ?? null;
}

/** اگر جایی لیست کامل خواستی */
export function allScenarios(): ScenarioModule[] {
  return modules;
}