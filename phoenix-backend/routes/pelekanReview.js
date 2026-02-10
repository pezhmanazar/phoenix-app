// phoenix-backend/routes/pelekanReview.js
import express from "express";
import prisma from "../utils/prisma.js";

const router = express.Router();

/* ------------------------------ helpers ------------------------------ */
function now() {
  return new Date();
}

function isUserPro(user) {
  if (!user) return false;
  if (String(user.plan || "").toLowerCase() !== "pro") return false;
  if (!user.planExpiresAt) return true;
  return new Date(user.planExpiresAt).getTime() > Date.now();
}

async function getUserByPhone(phone) {
  const p = String(phone || "").trim();
  if (!p) return null;
  return prisma.user.findUnique({ where: { phone: p } });
}

function safeJson(obj) {
  try {
    return obj ?? null;
  } catch {
    return null;
  }
}

/**
 * answersJson:
 * {
 *   test1: { answers: number[] }, // بازسنجی رابطه
 *   test2: { answers: number[] }, // آیا برمی‌گرده؟
 * }
 */
function ensureAnswersShape(answersJson) {
  const a = answersJson && typeof answersJson === "object" ? answersJson : {};
  if (!a.test1) a.test1 = { answers: [] };
  if (!a.test2) a.test2 = { answers: [] };
  if (!Array.isArray(a.test1.answers)) a.test1.answers = [];
  if (!Array.isArray(a.test2.answers)) a.test2.answers = [];
  return a;
}

function computeCanEnterPelekan(session) {
  if (!session) return false;
  // شرط: تست 1 باید تمام شده باشد
  if (!session.test1CompletedAt) return false;
  // و تست2 یا تمام شده باشد یا اسکیپ شده باشد
  if (session.test2CompletedAt || session.test2SkippedAt) return true;
  return false;
}

// ✅ PAYWALL REMOVED FROM REVIEW FLOW
function computePaywallRequired(user, session) {
  return false;
}

/* ------------------------- Result building (NEW) ------------------------- */
function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function avg(nums) {
  const arr = (nums || []).filter((x) => Number.isFinite(Number(x)));
  if (!arr.length) return null;
  const s = arr.reduce((a, b) => a + Number(b), 0);
  return s / arr.length;
}

function toPercentFromLikert(avgValue, maxValue) {
  if (avgValue == null) return null;
  const p = (Number(avgValue) / Number(maxValue)) * 100;
  return clamp(Math.round(p), 0, 100);
}

function percentLabel(p) {
  if (p == null) return "نامشخص";
  if (p >= 80) return "بسیار زیاد";
  if (p >= 60) return "زیاد";
  if (p >= 40) return "متوسط";
  if (p >= 20) return "کم";
  return "خیلی کم";
}

/* ------------------------- UI hints for app layout ------------------------- */
/**
 * این بخش فقط «راهنمای UI» برای اپ می‌فرستد.
 * منطق بک‌اند و scoring دست نمی‌خورد.
 *
 * خواسته تو:
 * - 2 گزینه: کنار هم (بله/خیر)
 * - 5 گزینه: 3 بالا + 2 پایین
 * - 6 گزینه: 3 بالا + 3 پایین
 */
function uiHintForOptions(options) {
  const n = Array.isArray(options) ? options.length : 0;

  if (n === 2) {
    return { layout: "row2", columns: 2, rows: 1 };
  }
  if (n === 4) {
    return { layout: "grid2x2", columns: 2, rows: 2 };
  }
  if (n === 5) {
    return { layout: "grid3x2_last2", columns: 3, rows: 2 };
  }
  if (n === 6) {
    return { layout: "grid3x2", columns: 3, rows: 2 };
  }
  return { layout: "stack", columns: 1, rows: n ? n : 0 };
}

/**
 * تولید نمودارها و خلاصه تصمیم‌ساز
 * - TEST1 => 4 نمودار
 * - TEST2 => 4 نمودار (اگر اسکیپ نشده باشد)
 */
function buildDiagramsAndSummary(answersJson, didSkipTest2) {
  const a = ensureAnswersShape(answersJson);
  const t1 = a.test1.answers || [];
  const t2 = a.test2.answers || [];

  // ---------- TEST1 INDEX MAP ----------
  // 0..4   : red flags (yes/no -> 0/1)
  // 5..12  : satisfaction (0..4)
  // 13..17 : attachment anxiety (0..4)
  // 18..22 : attachment avoidance (0..4)
  // 23..28 : conflict (0..3)

  const redFlags = t1.slice(0, 5);
  const satisf = t1.slice(5, 13);
  const anx = t1.slice(13, 18);
  const avd = t1.slice(18, 23);
  const conflict = t1.slice(23, 29);

  const redCount = redFlags.reduce((s, x) => s + (Number(x) === 1 ? 1 : 0), 0); // 0..5
  const redPercent = Math.round((redCount / 5) * 100); // 0..100
  const satisfPercent = toPercentFromLikert(avg(satisf), 4);
  const anxPercent = toPercentFromLikert(avg(anx), 4);
  const avdPercent = toPercentFromLikert(avg(avd), 4);
  const conflictPercent = toPercentFromLikert(avg(conflict), 3);

  const attachMix = avg([anxPercent, avdPercent].filter((x) => x != null));
  const attachPercent = attachMix == null ? null : clamp(Math.round(attachMix), 0, 100);

  const t1Diagrams = [
    { key: "t1_redflags", title: " خط قرمزهای رابطه", percent: redPercent, label: percentLabel(redPercent) },
    {
      key: "t1_satisfaction",
      title: "رضایت و کیفیت رابطه",
      percent: satisfPercent ?? 0,
      label: percentLabel(satisfPercent ?? 0),
    },
    {
      key: "t1_attachment",
      title: "وابستگی",
      percent: attachPercent ?? 0,
      label: percentLabel(attachPercent ?? 0),
    },
    {
      key: "t1_conflict",
      title: "روش‌های حل تعارض و مشکل",
      percent: conflictPercent ?? 0,
      label: percentLabel(conflictPercent ?? 0),
    },
  ];

  // ---------- TEST2 INDEX MAP ----------
  // 0..4   : evidence (0..4)  (high = good)
  // 5..9   : ambiguous (0..4) (high = risk)
  // 10..14 : waiting cost (0..4) (high = bad)
  // 15..19 : maturity (0..4) (high = good)

  const evidence = t2.slice(0, 5);
  const ambiguous = t2.slice(5, 10);
  const cost = t2.slice(10, 15);
  const maturity = t2.slice(15, 20);

  const evidenceP = toPercentFromLikert(avg(evidence), 4);
  const ambiguousP = toPercentFromLikert(avg(ambiguous), 4);
  const costP = toPercentFromLikert(avg(cost), 4);
  const maturityP = toPercentFromLikert(avg(maturity), 4);

  const t2Diagrams = didSkipTest2
    ? []
    : [
        {
          key: "t2_evidence",
          title: "شواهد واقعی بازگشت",
          percent: evidenceP ?? 0,
          label: percentLabel(evidenceP ?? 0),
        },
        {
          key: "t2_ambiguity",
          title: "نشونه‌های مبهم یا امیدوار نگه داشتن واهی",
          percent: ambiguousP ?? 0,
          label: percentLabel(ambiguousP ?? 0),
        },
        {
          key: "t2_cost",
          title: "هزینه روانیِ انتظار",
          percent: costP ?? 0,
          label: percentLabel(costP ?? 0),
        },
        {
          key: "t2_maturity",
          title: "بلوغ عاطفی طرف مقابل",
          percent: maturityP ?? 0,
          label: percentLabel(maturityP ?? 0),
        },
      ];

  // ---------- One-look Summary ----------
  const riskHard = redPercent >= 60 || (conflictPercent != null && conflictPercent >= 70);

  let oneLook = "";
  let nextStep = "";

  // ✅ ساده‌سازی متن تفسیر برای مخاطب عام
  if (riskHard) {
  oneLook =
    "نتیجه کلی: این رابطه برای تو خطرناک بوده. یعنی حتی اگه برگرده، احتمال تکرار همون آسیب‌ها بالاست و مهم‌ترین نکته اینه که مسئله فقط «دلتنگی» نیست؛ مسئله اینه که این رابطه قبلاً به سیستم عصبی و عزت‌نفست آسیب زده و اگه بدون درمان و مرزبندی ازش عبور نکنی، می‌تونه مشکلات بسیار جدی‌تری برات ایجاد کنه یا اگه ایجاد کرده اون‌ها رو تداوم ببخشه.";

  nextStep =
    "قدم بعدی: همین الان درمان رو شروع کن، بدون شک بهترین مسیر برای تو همینه پس حداقل مرحله «بستن» و «گسستن» رو از مراحل درمان ققنوس رو به طور جدی انجام بده تا از حالت اضطرار، حال بد و وابستگی خارج بشی. در ضمن اگه مجبور به ارتباط با پارتنر یا همسر سابقت هستی حتما به شکل کوتاه، رسمی و فقط برای امور ضروری باهاش ارتباط داشته باش و هیچ قول و وعده‌ای رو معیار قرار نده؛ فقط «رفتار پایدار» و «احترام به مرزها» مهمه و همینطور داخل مسیر درمان راهکارهای کاملی وجود داره که بزودی باعث آرامش و حال خوب تو میشه.";
} else if (!didSkipTest2 && evidenceP != null && maturityP != null && ambiguousP != null) {
  const goodReturn = evidenceP >= 60 && maturityP >= 60 && ambiguousP <= 40;

  if (goodReturn) {
    oneLook =
      "نتیجه کلی: چند نشانه‌ی امیدوارکننده برای برگشت وجود داره که از جنس حرف و احساس نیستند بلکه از جنس «امکان واقعی» هستند. با این حال هنوز یک خطر جدی هست: اینکه اگه تو روی برگشتن به رابطه، قفل کنی، دوباره وارد حالت انتظار و اضطراب می‌شی و تصمیم‌هات احساسی می‌شن پس بهترین کار الان اینه که حتی با وجود نشونه‌های خوب، اول خودت رو به ثبات برسونی.";

    nextStep =
      "قدم بعدی: درمان رو شروع کن بدون شک بهترین مسیر برای تو الان همینه. حتی اگه احتمال برگشت هست، مسیر درمان رو حداقل تا پایان مرحله سوم انجام بده چون تجربه نشون می‌ده وقتی تو روی بهبود خودت و قطع وابستگی تمرکز می‌کنی، هم انتخابت شفاف‌تر می‌شه، هم (اگه واقعا قرار باشه برگردد) احتمال برگشتِ واقعی و جدی بیشتر می‌شه. بعد از مرحله سوم اگه اقدام جدی برای برگشت بود، فقط با سه شرط جلو برو: ۱) تعهد روشن و قابل اندازه‌گیری ۲) اقدام واقعی و پیوسته ۳) احترام کامل به مرزهای تو و اگر اقدام جدی نبود رابطه رو به طور کامل پایان یافته بدون و مراحل درمان خودت رو تا پایان مرحله هفتم، ادامه بده تا به طور کامل از این رابطه عبور کنی.";
  } else {
    oneLook =
      "نتیجه کلی: تصویر غالبی که الان وجود داره، ابهامه. یعنی به احتمال زیاد، طرف مقابل تو رو در حالت انتظار نگه داشته و این دقیقاً همون چیزیه که بیشترین فرسایش روانی رو می‌سازه. اگه تو از ابهام تغذیه کنی، ذهنت هر روز دنبال نشونه می‌گرده و زندگیت معلق می‌مونه.";

    nextStep =
      "قدم بعدی: درمان رو شروع کن بهترین مسیر برای تو الان همینه. قانون ساده: «بدون اقدام مشخص، حرف‌ها ارزش نداره.» پس وارد مسیر درمان شو و حداقل تا پایان مرحله سوم رو انجام بده تا از چرخه‌ی انتظار بیرون بیای. اگه در این مدت اقدام واقعی و پایدار دیدی، اون وقت می‌شه درباره ادامه یا بازگشت فکر کرد ولی اگه تا پایان مرحله سوم اقدام جدی اتفاق نیفتاد، این رابطه رو تموم شده بدون و مسیر درمانت رو تا پایان مرحله هفتم ادامه بده تا به طور کامل از این رابطه عبور کنی.";
  }
} else {
  oneLook =
    "نتیجه کلی: داده‌ها برای جمع‌بندی دقیق کافی نیست، اما یک اصل ثابت هست: تصمیم درست روی «واقعیت» ساخته میشه نه روی امید. وقتی فشار عاطفی بالاست، مغز نشونه‌های کوچیک رو بزرگ می‌کنه و خطر اشتباه بالا می‌ره.";

  nextStep =
    "قدم بعدی: درمان رو شروع کن چون بهترین مسیر برای تو الان همینه پس حداقل تا پایان مرحله سوم ادامه بده تا سیستم عصبیت آروم بشه و تصمیم‌گیریت شفاف بشه. توو این مدت خط‌قرمزها، الگوی دعوا، و رفتارهای واقعی طرف مقابل رو ثبت کن؛ بعد با ذهن آروم تصمیم بگیر.";
}

  return {
    diagrams: {
      test1: t1Diagrams,
      test2: t2Diagrams,
    },
    summary: {
      oneLook,
      nextStep,
      meta: {
        test1: { redPercent, satisfPercent, attachPercent, conflictPercent },
        test2: didSkipTest2 ? null : { evidenceP, ambiguousP, costP, maturityP },
      },
    },
  };
}

function buildResultSkeleton({ user, session }) {
  const didSkipTest2 = !!session.test2SkippedAt;

  const { diagrams, summary } = buildDiagramsAndSummary(session.answersJson, didSkipTest2);

  // ✅ PAYWALL REMOVED: always unlocked in review
  return {
    locked: false,
    meta: {
      didSkipTest2,
      note: didSkipTest2
        ? "کاربر آزمون دوم بازسنجی رو انجام نداده و نتیجه بر اساس آزمون اول بازسنجی ارائه میشه."
        : "کاربر هر دو آزمون بازسنجی رو انجام داده.",
    },
    diagrams,
    summary,
    message: "نتیجه آماده‌ست.",
  };
}

/* ----------------------- Question bank defaults ---------------------- */
/**
 * ما سوال‌ها را داخل DB ذخیره می‌کنیم (ReviewQuestionSet / ReviewQuestion / ReviewOption)
 * اگر وجود نداشت: auto-seed می‌کنیم.
 *
 * - testNo در DB: "TEST1" | "TEST2"
 * - order: 0-based (کاملاً هم‌راستا با index اپ)
 */

const OPT_YES_NO = [
  { value: 0, labelFa: "خیر" },
  { value: 1, labelFa: "بله" },
];

const OPT_0_4_REDLINE = [
  { value: 0, labelFa: "هرگز" },
  { value: 1, labelFa: "به‌ندرت" },
  { value: 2, labelFa: "گاهی" },
  { value: 3, labelFa: "اغلب" },
  { value: 4, labelFa: "تقریباً همیشه" },
];

const OPT_0_4_AGREE = [
  { value: 0, labelFa: "اصلاً" },
  { value: 1, labelFa: "کم" },
  { value: 2, labelFa: "متوسط" },
  { value: 3, labelFa: "زیاد" },
  { value: 4, labelFa: "بسیار زیاد" },
];

const OPT_0_3_CONFLICT = [
  { value: 0, labelFa: "هرگز" },
  { value: 1, labelFa: "گاهی" },
  { value: 2, labelFa: "اغلب" },
  { value: 3, labelFa: "تقریباً همیشه" },
];

function buildDefaultQuestions() {
  // TEST1: بازسنجی رابطه
  // بخش 1: خط قرمزها (5)
  const test1_q = [];
  const pushT1 = (textFa, helpFa, options) => {
    test1_q.push({ textFa, helpFa: helpFa || null, options });
  };

  // ✅ ساده‌سازی سوال‌ها + چند مثال محدود
  pushT1("آیا تو این رابطه خشونت بوده؟", "مثلا تهدید کردن، فحاشی شدید یا کتک زدن.", OPT_YES_NO);
  pushT1("آیا تو این رابطه خیانت اتفاق افتاده؟", "یعنی خیانت عاطفی یا جنسی یا هر دو.", OPT_YES_NO);
  pushT1("آیا تو رابطه تحقیر یا کوچیک‌کردن مداوم بوده؟", null, OPT_YES_NO);
  pushT1("آیا تو رابطه اعتیاد فعالی که درمان نشده باشه، بوده؟", "مثل کشیدن مواد، قمار کردن، مصرف الکل زیاد، دیدن پورن بدون رضایت پارتنر به شکل زیاد و غیره.", OPT_YES_NO);
  pushT1("آیا تو رابطه پارتنر یا همسرت برای تغییر کردن جدی نبوده؟", "مثلا قول می‌داد ولی عمل نمی‌کرد.", OPT_YES_NO);

  // بخش 2: رضایت و فرسودگی (8)
  pushT1("از رابطم در کل راضی بودم.", null, OPT_0_4_AGREE);
  pushT1("احساس می‌کردم حرفم شنیده میشه.", null, OPT_0_4_AGREE);
  pushT1("کنار اون آرامش داشتم.", null, OPT_0_4_AGREE);
  pushT1("این رابطه به نظرم سالم بود.", null, OPT_0_4_AGREE);
  pushT1("صمیمیت عاطفی واقعی داشتیم.", null, OPT_0_4_AGREE);
  pushT1("این رابطه بیشتر بهم انرژی می‌داد تا اینکه منو خسته کنه.", null, OPT_0_4_AGREE);
  pushT1("باهاش یک آینده روشن رو تصور می‌کردم.", null, OPT_0_4_AGREE);
  pushT1("با عقل الانم اگه برگردم به عقب، باز هم این رابطه رو انتخاب می‌کنم.", null, OPT_0_4_AGREE);

  // بخش 3: دلبستگی (10) -> اضطراب 5 + اجتناب 5
  // اضطراب
  pushT1("داخل رابطه ترس از رها شدن تو من زیاد بود.", null, OPT_0_4_AGREE);
  pushT1("داخل رابطه برای آروم شدنم، ازش زیاد سوال می‌پرسیدم تا مطمئن بشم.", null, OPT_0_4_AGREE);
  pushT1("داخل رابطه فاصله یا جدایی برام خیلی سخت بود.", null, OPT_0_4_AGREE);
  pushT1("وقتی پارتنر یا همسرم باهام سرد می‌شد، اضطراب و نگرانیم بالا می‌رفت.", null, OPT_0_4_AGREE);
  pushT1("ارزش خودم رو به این رابطه گره می‌زدم یعنی فکر می‌کردی بدون این رابطه بی‌ارزشی.", null, OPT_0_4_AGREE);
  // اجتناب
  pushT1("داخل رابطه صمیمیت خیلی زیاد من رو معذب می‌کرد.", null, OPT_0_4_AGREE);
  pushT1("بعضی وقتا نیاز داشتم از پارتنرم فاصله بگیرم.", null, OPT_0_4_AGREE);
  pushT1("احساساتم رو داخل رابطه پنهون می‌کردم.", null, OPT_0_4_AGREE);
  pushT1("وقتی خیلی بهم نزدیک بود، احساس خفگی می‌کردم.", null, OPT_0_4_AGREE);
  pushT1("تو دعواها از گفت‌وگو کردن فرار می‌کردم.", "مثلا زود قهر می‌کردم یا جوابش رو نمی‌دادم.", OPT_0_4_AGREE);

  // بخش 4: الگوی تعارض (6) - 0..3
  pushT1("وقتی دعوا می‌کردیم هر دومون یا یکیمون همدیگه رو تحقیر یا مسخره می‌کردیم.", null, OPT_0_3_CONFLICT);
  pushT1("به جای تمرکز کردن روی مشکل، به شخصیت همدیگه گیر می‌دادیم.", null, OPT_0_3_CONFLICT);
  pushT1("داخل رابطه قهر کردن یا قطع ارتباط زیاد، اتفاق می‌افتاد.", null, OPT_0_3_CONFLICT);
  pushT1(" موقع اختلاف بیشتر از خودمون دفاع می‌کردیم تا مکشل رو حل کنیم.", null, OPT_0_3_CONFLICT);
  pushT1("داخل رابطه اختلافات و تعارض‌ها معمولاً حل نمی‌شد و نهایتا بی‌خیالش می‌شدیم.", null, OPT_0_3_CONFLICT);
  pushT1("بعد از دعوا کردن، یه مدت رابطمون سرد می‌شد.", null, OPT_0_3_CONFLICT);

  // TEST2: منطقی بودن انتظار برگشت (20)
  const test2_q = [];
  const pushT2 = (textFa, helpFa, options) => {
    test2_q.push({ textFa, helpFa: helpFa || null, options });
  };

  // 1) شواهد واقعی برگشت (5)
  pushT2("بعد از جدایی، برای برگشتن به رابطه اقدام جدی انجام داده.", "نه اینکه فقط حرف بزنه بلکه اقدام واقعی و قابل گفتن.", OPT_0_4_AGREE);
  pushT2("مسئولیت اشتباهات خودش رو داخل رابطه قبول کرده.", "بدون اینکه توجیه کنه و یکی دیگه رو مقصر کنه.", OPT_0_4_AGREE);
  pushT2("رفتارهای بدش واقعاً بهتر شده.", "یعنی یک تغییر پایدار، نه تغییر یکی دو روزه.", OPT_0_4_AGREE);
  pushT2("برای برگشت، برنامه یا تعهد مشخص داده.", null, OPT_0_4_AGREE);
  pushT2("برای ترمیم رابطه هزینه واقعی داده.", "مثلا زمان گذاشته خودش رو تغییر بده یا خودش رو درمان کرده یا به طور مداوم تلاش کرده برگرده.", OPT_0_4_AGREE);

  // 2) سیگنال‌های مبهم و تعلیق‌آور (5)
  pushT2("مدام از دلتنگ بودن حرف می‌زنه ولی تصمیم روشن یا اقدام واقعی برای برگشت نداره.", null, OPT_0_4_AGREE);
  pushT2("ارتباط ما بعد از جدایی، مدام قطع و وصل میشه.", null, OPT_0_4_AGREE);
  pushT2("کاری می‌کنه من در دسترسش باشم ولی تکلیف رو روشن نمی‌کنه.", "مثلا داخل اینستا برام چیزی می‌فرسته یا هر چند وقت یکبار حالم رو می‌پرسه یا تلاش می‌کنه مشکلاتم رو حل کنه.", OPT_0_4_AGREE);
  pushT2("برگشتن رو  می‌اندازه به یک آینده نامشخص.", "مثلا میگه: الان نه، شاید بعداً که وضع بهتر شد.", OPT_0_4_AGREE);
  pushT2("بعد از جدایی سعی میکنه باهام گرم برخورده کنه ولی از اقدام مشخص فرار می‌کنه.", null, OPT_0_4_AGREE);

  // 3) هزینه‌ی روانی انتظار (5)
  pushT2("بیشترِ ذهنم درگیر اینه که بالاخره برمی‌گرده یا نه.", null, OPT_0_4_AGREE);
  pushT2("تصمیم‌های مهم زندگیم رو به اون و برگشتنش گره زدم.", null, OPT_0_4_AGREE);
  pushT2("از شروع جدید می‌ترسم چون احتمال میدم یه روز برگرده.", null, OPT_0_4_AGREE);
  pushT2("این جدایی رو هنوز «موقتی» می‌دونم.", null, OPT_0_4_AGREE);
  pushT2("فکر کردن به برگشتنش بهم آرامش کوتاه مدت می‌ده ولی این آرامش پایدار نیست.", null, OPT_0_4_AGREE);

  // 4) بلوغ رابطه‌ای طرف مقابل (5)
  pushT2("می‌تونه درباره رابطه درست به شکل شفاف حرف بزنه.", null, OPT_0_4_AGREE);
  pushT2("بعد از جدایی کمتر مشکلات رو انکار یا مقصرسازی می‌کنه.", null, OPT_0_4_AGREE);
  pushT2("رفتارهای هیجانی و کودکانش کمتر شده.", null, OPT_0_4_AGREE);
  pushT2("بعد از جدایی هم به مرزهای من احترام می‌ذاره و کاری نمی‌کنه که ناراحت بشم.", null, OPT_0_4_AGREE);
  pushT2("نسبت به قبل، ثبات بیشتری نشون می‌ده.", null, OPT_0_4_AGREE);

  return { test1_q, test2_q };
}

async function getActiveQuestionSet() {
  return prisma.reviewQuestionSet.findFirst({
    where: { code: "review", isActive: true },
    orderBy: [{ version: "desc" }],
  });
}

/**
 * ✅ FIX: جلوگیری از race و ساخت نسخه‌های متعدد (با unique روی (code,isActive) بهتر میشه)
 * اگر دو درخواست همزمان بیاد، ممکنه هر دو تصمیم به ساخت بگیرن.
 * اینجا با try/catch و re-fetch حلش می‌کنیم.
 */
async function ensureQuestionSetSeeded() {
  const existing = await getActiveQuestionSet();

  // ✅ اگر نسخه فعال، قدیمی بود => نسخه جدید بساز
  if (existing && Number(existing.version) >= 4) return existing;

  const version = 4;
  const { test1_q, test2_q } = buildDefaultQuestions();

  try {
    // ✅ نسخه قبلی را غیرفعال کن (اگر بود)
    if (existing) {
      await prisma.reviewQuestionSet.update({
        where: { id: existing.id },
        data: { isActive: false, updatedAt: now() },
      });
    }

    const created = await prisma.reviewQuestionSet.create({
      data: {
        code: "review",
        version,
        titleFa: "بازسنجی رابطه + منطقی بودن انتظار",
        description: "Question bank v2 (TEST1/TEST2)",
        isActive: true,
        questions: {
          create: [
            ...test1_q.map((q, idx) => ({
              testNo: "TEST1",
              order: idx,
              key: `t1_${idx}`,
              textFa: q.textFa,
              helpFa: q.helpFa,
              options: { create: q.options.map((op, j) => ({ order: j, labelFa: op.labelFa, value: op.value })) },
            })),
            ...test2_q.map((q, idx) => ({
              testNo: "TEST2",
              order: idx,
              key: `t2_${idx}`,
              textFa: q.textFa,
              helpFa: q.helpFa,
              options: { create: q.options.map((op, j) => ({ order: j, labelFa: op.labelFa, value: op.value })) },
            })),
          ],
        },
      },
    });

    return created;
  } catch (e) {
    // اگر همزمان یکی دیگه ساخت، دوباره fetch کن و همون رو برگردون
    const fresh = await getActiveQuestionSet();
    if (fresh) return fresh;
    throw e;
  }
}

async function loadQuestionsForSet(questionSetId) {
  const set = await prisma.reviewQuestionSet.findUnique({
    where: { id: questionSetId },
    include: {
      questions: {
        orderBy: [{ testNo: "asc" }, { order: "asc" }],
        include: { options: { orderBy: [{ order: "asc" }] } },
      },
    },
  });
  return set;
}

async function findQuestionInSet(questionSetId, testNoInt, index) {
  const testNo = testNoInt === 1 ? "TEST1" : "TEST2";
  return prisma.reviewQuestion.findFirst({
    where: { questionSetId, testNo, order: index },
    include: { options: { orderBy: [{ order: "asc" }] } },
  });
}

/* ------------------------------ routes ------------------------------ */

/**
 * ✅ PERF FIX: question-set cache (in-memory)
 * چون سوال‌ها ثابت‌اند، هر بار DB رو نکش.
 */
let QS_CACHE = {
  at: 0,
  ttlMs: 10 * 60 * 1000, // 10 min
  setId: null,
  version: null,
  payload: null,
};

function isQsCacheValid() {
  return !!QS_CACHE.payload && Date.now() - QS_CACHE.at < QS_CACHE.ttlMs;
}

/**
 * GET /question-set?phone=...  (اختیاری phone فقط برای ست کردن questionSetId روی session در صورت وجود)
 * خروجی: سوالات + گزینه‌ها
 */
router.get("/question-set", async (req, res) => {
  try {
    const phone = String(req.query.phone || "").trim();

    // ✅ cache headers (این endpoint عملاً ثابت است)
    res.setHeader("Cache-Control", "public, max-age=600");

    // ✅ fast path: cached payload
    if (isQsCacheValid()) {
      return res.json(QS_CACHE.payload);
    }

    const activeSet = await ensureQuestionSetSeeded();

    // اگر session موجود بود و questionSetId نداشت، همینجا ست می‌کنیم (اختیاری)
    if (phone) {
      const user = await getUserByPhone(phone);
      if (user) {
        const session = await prisma.pelekanReviewSession.findUnique({ where: { userId: user.id } });
        if (session && !session.questionSetId) {
          await prisma.pelekanReviewSession.update({
            where: { userId: user.id },
            data: { questionSetId: activeSet.id, updatedAt: now() },
          });
        }
      }
    }

    const full = await loadQuestionsForSet(activeSet.id);
    if (!full) return res.status(500).json({ ok: false, error: "QUESTION_SET_NOT_FOUND" });

    const payload = {
      ok: true,
      data: {
        questionSet: {
          id: full.id,
          code: full.code,
          version: full.version,
          titleFa: full.titleFa,
          description: full.description,
        },
        tests: {
          test1: full.questions
            .filter((q) => q.testNo === "TEST1")
            .map((q) => {
              const options = q.options.map((o) => ({ value: o.value, labelFa: o.labelFa }));
              return {
                index: q.order,
                key: q.key,
                textFa: q.textFa,
                helpFa: q.helpFa,
                options,
                // ✅ NEW: UI hint برای چیدمان گزینه‌ها در اپ
                ui: uiHintForOptions(options),
              };
            }),
          test2: full.questions
            .filter((q) => q.testNo === "TEST2")
            .map((q) => {
              const options = q.options.map((o) => ({ value: o.value, labelFa: o.labelFa }));
              return {
                index: q.order,
                key: q.key,
                textFa: q.textFa,
                helpFa: q.helpFa,
                options,
                // ✅ NEW: UI hint برای چیدمان گزینه‌ها در اپ
                ui: uiHintForOptions(options),
              };
            }),
        },
      },
    };

    // ✅ set cache
    QS_CACHE = {
      ...QS_CACHE,
      at: Date.now(),
      setId: full.id,
      version: full.version,
      payload,
    };

    return res.json(payload);
  } catch (e) {
    console.log("[pelekanReview/question-set] error", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

// GET state (برای اپ)
router.get("/state", async (req, res) => {
  try {
    const phone = String(req.query.phone || "").trim();
    const user = await getUserByPhone(phone);
    if (!user) return res.json({ ok: false, error: "USER_NOT_FOUND" });

    const session = await prisma.pelekanReviewSession.findUnique({
      where: { userId: user.id },
    });

    const canEnterPelekan = computeCanEnterPelekan(session);
    const paywallRequired = false;

    return res.json({
      ok: true,
      data: {
        hasSession: !!session,
        canEnterPelekan,
        paywallRequired,
        session: session
          ? {
              id: session.id,
              status: session.status,
              chosenPath: session.chosenPath,
              currentTest: session.currentTest,
              currentIndex: session.currentIndex,
              test1CompletedAt: session.test1CompletedAt,
              test2CompletedAt: session.test2CompletedAt,
              test2SkippedAt: session.test2SkippedAt,
              paywallShownAt: session.paywallShownAt,
              unlockedAt: session.unlockedAt,
              questionSetId: session.questionSetId,
            }
          : null,
        user: {
          plan: user.plan,
          isPro: isUserPro(user),
        },
      },
    });
  } catch (e) {
    console.log("[pelekanReview/state] error", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

// POST choose path (دو گزینه‌ای که گفتی)
router.post("/choose", async (req, res) => {
  try {
    const { phone, choice } = req.body || {};
    const user = await getUserByPhone(phone);
    if (!user) return res.json({ ok: false, error: "USER_NOT_FOUND" });

    const normalized = String(choice || "").trim();
    // دو گزینه:
    // 1) "skip_review" => میخوام فراموشش کنم
    // 2) "review"      => میخوام احتمال درست شدن رابطه رو بررسی کنم
    if (normalized !== "skip_review" && normalized !== "review") {
      return res.json({ ok: false, error: "INVALID_CHOICE" });
    }

    const activeSet = await ensureQuestionSetSeeded();

    // ✅ FIX: حذف query اضافه داخل upsert (دو بار findUnique می‌زد)
    const existing = await prisma.pelekanReviewSession.findUnique({ where: { userId: user.id } });

    const session = await prisma.pelekanReviewSession.upsert({
      where: { userId: user.id },
      update: {
        chosenPath: normalized,
        // اگر قبلاً set نشده، ستش کن
        questionSetId: existing?.questionSetId ? undefined : activeSet.id,
        updatedAt: now(),
      },
      create: {
        userId: user.id,
        chosenPath: normalized,
        status: "in_progress",
        currentTest: 1,
        currentIndex: 0,
        questionSetId: activeSet.id,
        answersJson: ensureAnswersShape(null),
      },
    });

    // ✅ اگر کاربر بعد از آزمون ۱، skip_review زد: همان‌جا test2 را skip کن و نتیجه را آماده کن
    if (normalized === "skip_review" && (existing?.test1CompletedAt || session.test1CompletedAt)) {
      const updated1 = await prisma.pelekanReviewSession.update({
        where: { userId: user.id },
        data: {
          test2SkippedAt: (existing?.test2SkippedAt || session.test2SkippedAt) ?? now(),
          currentTest: 2,
          currentIndex: 0,
          updatedAt: now(),
        },
      });

      const resultJson = buildResultSkeleton({ user, session: updated1 });

      const updated2 = await prisma.pelekanReviewSession.update({
        where: { userId: user.id },
        data: {
          status: "unlocked",
          completedAt: now(),
          unlockedAt: now(),
          paywallShownAt: null,
          resultJson,
          updatedAt: now(),
        },
      });

      return res.json({
        ok: true,
        data: { sessionId: updated2.id, chosenPath: updated2.chosenPath, status: updated2.status },
      });
    }

    return res.json({ ok: true, data: { sessionId: session.id, chosenPath: session.chosenPath } });
  } catch (e) {
    console.log("[pelekanReview/choose] error", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

// POST start review (شروع آزمون 1)
router.post("/start", async (req, res) => {
  try {
    const { phone, force } = req.body || {};
    const user = await getUserByPhone(phone);
    if (!user) return res.json({ ok: false, error: "USER_NOT_FOUND" });

    const activeSet = await ensureQuestionSetSeeded();

    const existing = await prisma.pelekanReviewSession.findUnique({ where: { userId: user.id } });

    // اگر قبلاً تمام شده و force نیست، اجازه نده دوباره شروع کنه
    if (existing && existing.status !== "in_progress" && !force) {
      return res.json({ ok: false, error: "ALREADY_COMPLETED" });
    }

    const session = await prisma.pelekanReviewSession.upsert({
      where: { userId: user.id },
      update: {
        status: "in_progress",
        currentTest: 1,
        currentIndex: 0,
        startedAt: existing?.startedAt ?? now(),
        completedAt: null,
        paywallShownAt: null,
        unlockedAt: null,
        test1CompletedAt: null,
        test2CompletedAt: null,
        test2SkippedAt: null,
        answersJson: safeJson(ensureAnswersShape(existing?.answersJson)),
        resultJson: null,
        questionSetId: existing?.questionSetId ?? activeSet.id,
        updatedAt: now(),
      },
      create: {
        userId: user.id,
        status: "in_progress",
        currentTest: 1,
        currentIndex: 0,
        questionSetId: activeSet.id,
        answersJson: ensureAnswersShape(null),
      },
    });

    return res.json({
      ok: true,
      data: {
        sessionId: session.id,
        status: session.status,
        currentTest: session.currentTest,
        currentIndex: session.currentIndex,
        questionSetId: session.questionSetId,
      },
    });
  } catch (e) {
    console.log("[pelekanReview/start] error", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

/**
 * POST skip-test2
 * - فقط وقتی test1CompletedAt وجود دارد و test2 هنوز completed نشده
 * - test2SkippedAt ست می‌شود
 * - سپس finish انجام می‌شود (نتیجه آماده می‌شود)
 */
router.post("/skip-test2", async (req, res) => {
  try {
    const { phone } = req.body || {};
    const user = await getUserByPhone(phone);
    if (!user) return res.json({ ok: false, error: "USER_NOT_FOUND" });

    const session = await prisma.pelekanReviewSession.findUnique({ where: { userId: user.id } });
    if (!session) return res.json({ ok: false, error: "NO_SESSION" });

    if (!session.test1CompletedAt) return res.json({ ok: false, error: "TEST1_NOT_COMPLETED" });
    if (session.test2CompletedAt) return res.json({ ok: false, error: "TEST2_ALREADY_COMPLETED" });

    const updated1 = await prisma.pelekanReviewSession.update({
      where: { userId: user.id },
      data: {
        test2SkippedAt: session.test2SkippedAt ?? now(),
        currentTest: 2,
        currentIndex: 0,
        updatedAt: now(),
      },
    });

    const resultJson = buildResultSkeleton({ user, session: updated1 });

    const updated2 = await prisma.pelekanReviewSession.update({
      where: { userId: user.id },
      data: {
        status: "unlocked",
        completedAt: now(),
        unlockedAt: now(),
        paywallShownAt: null,
        resultJson,
        updatedAt: now(),
      },
    });

    return res.json({
      ok: true,
      data: {
        status: updated2.status,
        locked: false,
        canEnterPelekan: computeCanEnterPelekan(updated2),
      },
    });
  } catch (e) {
    console.log("[pelekanReview/skip-test2] error", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

// POST answer (برای هر سوال)
router.post("/answer", async (req, res) => {
  try {
    const { phone, testNo, index, value } = req.body || {};
    const user = await getUserByPhone(phone);
    if (!user) return res.json({ ok: false, error: "USER_NOT_FOUND" });

    const t = Number(testNo);
    const i = Number(index);
    const v = Number(value);

    if (![1, 2].includes(t)) return res.json({ ok: false, error: "INVALID_TEST" });
    if (!Number.isFinite(i) || i < 0) return res.json({ ok: false, error: "INVALID_INDEX" });
    if (!Number.isFinite(v) || v < 0) return res.json({ ok: false, error: "INVALID_VALUE" });

    let session = await prisma.pelekanReviewSession.findUnique({ where: { userId: user.id } });
    if (!session) return res.json({ ok: false, error: "NO_SESSION" });

    // ✅ self-heal: اگر کاربر وارد پاسخ‌دهی شد ولی سشن in_progress نبود، سشن را شروع کن
    if (session.status !== "in_progress") {
      // فقط این حالت‌ها را اجازه بده خودکار وارد in_progress شوند
      const canAutoResume =
        session.status === "unlocked" ||
        session.status === "completed_locked";

      if (!canAutoResume) {
        return res.json({ ok: false, error: "NOT_IN_PROGRESS" });
      }

      // اگر questionSetId نداشت، بساز
      const qSetIdFallback = (await ensureQuestionSetSeeded()).id;
      const qSetId = session.questionSetId || qSetIdFallback;

      session = await prisma.pelekanReviewSession.update({
        where: { userId: user.id },
        data: {
          status: "in_progress",
          startedAt: session.startedAt ?? now(),
          completedAt: null,
          // اگر قبلاً مسیر skip بوده ولی الان کاربر عملاً تست می‌دهد
          chosenPath: session.chosenPath === "skip_review" ? "review" : session.chosenPath,
          currentTest: Number.isFinite(Number(session.currentTest)) ? session.currentTest : 1,
          currentIndex: Number.isFinite(Number(session.currentIndex)) ? session.currentIndex : 0,
          questionSetId: session.questionSetId ?? qSetId,
          updatedAt: now(),
        },
      });
    }

    const qSetId = session.questionSetId || (await ensureQuestionSetSeeded()).id;

    // validate question + options (قفل روی set)
    const q = await findQuestionInSet(qSetId, t, i);
    if (!q) return res.json({ ok: false, error: "QUESTION_NOT_FOUND" });

    const allowed = new Set((q.options || []).map((o) => o.value));
    if (!allowed.has(v)) return res.json({ ok: false, error: "VALUE_NOT_ALLOWED" });

    const answers = ensureAnswersShape(session.answersJson);
    const key = t === 1 ? "test1" : "test2";

    // ثبت پاسخ
    answers[key].answers[i] = v;

    // آپدیت pointer
    const nextIndex = i + 1;

    const updated = await prisma.pelekanReviewSession.update({
      where: { userId: user.id },
      data: {
        answersJson: answers,
        currentTest: t,
        currentIndex: nextIndex,
        questionSetId: session.questionSetId ?? qSetId,
        updatedAt: now(),
      },
    });

    return res.json({
      ok: true,
      data: {
        currentTest: updated.currentTest,
        currentIndex: updated.currentIndex,
      },
    });
  } catch (e) {
    console.log("[pelekanReview/answer] error", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

// POST mark test completed (وقتی آزمون 1 یا 2 تمام شد)
router.post("/complete-test", async (req, res) => {
  try {
    const { phone, testNo } = req.body || {};
    const user = await getUserByPhone(phone);
    if (!user) return res.json({ ok: false, error: "USER_NOT_FOUND" });

    const t = Number(testNo);
    if (![1, 2].includes(t)) return res.json({ ok: false, error: "INVALID_TEST" });

    const session = await prisma.pelekanReviewSession.findUnique({ where: { userId: user.id } });
    if (!session) return res.json({ ok: false, error: "NO_SESSION" });

    // ✅ self-heal: اگر اپ اشتباهی complete-test را بعد از finish صدا زد، بن‌بست نکن
    if (session.status !== "in_progress") {
      // اگر testNo=2 و قبلاً test2CompletedAt یا test2SkippedAt داریم، ok بده
      if (t === 2 && (session.test2CompletedAt || session.test2SkippedAt)) {
        return res.json({
          ok: true,
          data: {
            test1CompletedAt: session.test1CompletedAt,
            test2CompletedAt: session.test2CompletedAt,
            test2SkippedAt: session.test2SkippedAt,
            currentTest: session.currentTest,
            currentIndex: session.currentIndex,
          },
        });
      }
      // اگر testNo=1 و test1CompletedAt داریم، ok بده
      if (t === 1 && session.test1CompletedAt) {
        return res.json({
          ok: true,
          data: {
            test1CompletedAt: session.test1CompletedAt,
            test2CompletedAt: session.test2CompletedAt,
            test2SkippedAt: session.test2SkippedAt,
            currentTest: session.currentTest,
            currentIndex: session.currentIndex,
          },
        });
      }
      return res.json({ ok: false, error: "NOT_IN_PROGRESS" });
    }

    const data = {};
    if (t === 1) {
      data.test1CompletedAt = session.test1CompletedAt ?? now();
      data.currentTest = 2;
      data.currentIndex = 0;
    } else {
      data.test2CompletedAt = session.test2CompletedAt ?? now();
    }

    const updated = await prisma.pelekanReviewSession.update({
      where: { userId: user.id },
      data: { ...data, updatedAt: now() },
    });

    return res.json({
      ok: true,
      data: {
        test1CompletedAt: updated.test1CompletedAt,
        test2CompletedAt: updated.test2CompletedAt,
        test2SkippedAt: updated.test2SkippedAt,
        currentTest: updated.currentTest,
        currentIndex: updated.currentIndex,
      },
    });
  } catch (e) {
    console.log("[pelekanReview/complete-test] error", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

/**
 * POST finish
 * - شرط جدید: test1CompletedAt باید باشد
 * - test2 یا completed باشد یا skipped باشد
 * - خروجی: locked / canEnterPelekan
 */
router.post("/finish", async (req, res) => {
  try {
    const { phone } = req.body || {};
    const user = await getUserByPhone(phone);
    if (!user) return res.json({ ok: false, error: "USER_NOT_FOUND" });

    const session = await prisma.pelekanReviewSession.findUnique({ where: { userId: user.id } });
    if (!session) return res.json({ ok: false, error: "NO_SESSION" });

    // شرط جدید
    if (!session.test1CompletedAt) {
      return res.json({ ok: false, error: "TEST1_NOT_COMPLETED" });
    }
    if (!session.test2CompletedAt && !session.test2SkippedAt) {
      return res.json({ ok: false, error: "TEST2_NOT_COMPLETED_OR_SKIPPED" });
    }

    const resultJson = buildResultSkeleton({ user, session });

    const updated = await prisma.pelekanReviewSession.update({
      where: { userId: user.id },
      data: {
        status: "unlocked",
        completedAt: now(),
        resultJson,
        paywallShownAt: null,
        unlockedAt: now(),
        updatedAt: now(),
      },
    });

    return res.json({
      ok: true,
      data: {
        status: updated.status,
        locked: false,
        canEnterPelekan: computeCanEnterPelekan(updated),
      },
    });
  } catch (e) {
    console.log("[pelekanReview/finish] error", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

// GET result (✅ PAYWALL REMOVED: always return full result)
router.get("/result", async (req, res) => {
  try {
    console.log("[pelekanReview/result] BUILD = 2025-12-23-REV2");

    const phone = String(req.query.phone || "").trim();
    const user = await getUserByPhone(phone);
    if (!user) return res.json({ ok: false, error: "USER_NOT_FOUND" });

    const session = await prisma.pelekanReviewSession.findUnique({ where: { userId: user.id } });
    if (!session) return res.json({ ok: false, error: "NO_SESSION" });

    const rj = session.resultJson || null;
    const lacks = !rj || !rj.summary || !rj.diagrams;

    if (lacks) {
      const fresh = buildResultSkeleton({ user, session });

      const updated = await prisma.pelekanReviewSession.update({
        where: { userId: user.id },
        data: {
          status: session.status === "in_progress" ? session.status : "unlocked",
          resultJson: { ...fresh, locked: false, message: "نتیجه آماده است." },
          updatedAt: now(),
        },
      });

      return res.json({
        ok: true,
        data: {
          status: updated.status,
          canEnterPelekan: computeCanEnterPelekan(updated),
          result: updated.resultJson || null,
        },
      });
    }

    return res.json({
      ok: true,
      data: {
        status: session.status,
        canEnterPelekan: computeCanEnterPelekan(session),
        result: { ...session.resultJson, locked: false, message: "نتیجه آماده است." },
      },
    });
  } catch (e) {
    console.log("[pelekanReview/result] error", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

export default router;