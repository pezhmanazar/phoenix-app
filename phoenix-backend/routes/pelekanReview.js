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

function computePaywallRequired(user, session) {
  // اگر نتیجه کامل قفل باشد => paywall لازم است
  // (ولی این به معنی "بلاک شدن" ورود به پلکان نیست)
  if (!session) return false;
  const pro = isUserPro(user);
  if (pro) return false;
  // اگر کاربر به پایان مسیر review رسیده باشد (test1 done و test2 done/skip)
  return computeCanEnterPelekan(session);
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
    { key: "t1_redflags", title: "ریسک خط قرمزها", percent: redPercent, label: percentLabel(redPercent) },
    {
      key: "t1_satisfaction",
      title: "رضایت و کیفیت رابطه",
      percent: satisfPercent ?? 0,
      label: percentLabel(satisfPercent ?? 0),
    },
    {
      key: "t1_attachment",
      title: "تنش دلبستگی (اضطراب/اجتناب)",
      percent: attachPercent ?? 0,
      label: percentLabel(attachPercent ?? 0),
    },
    {
      key: "t1_conflict",
      title: "مسمومیت تعارض و دعوا",
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
          title: "شواهد واقعیِ بازگشت",
          percent: evidenceP ?? 0,
          label: percentLabel(evidenceP ?? 0),
        },
        {
          key: "t2_ambiguity",
          title: "سیگنال‌های مبهم/تعلیق",
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
          title: "بلوغ رابطه‌ای طرف مقابل",
          percent: maturityP ?? 0,
          label: percentLabel(maturityP ?? 0),
        },
      ];

  // ---------- One-look Summary ----------
  const riskHard = redPercent >= 60 || (conflictPercent != null && conflictPercent >= 70);

  let oneLook = "";
  let nextStep = "";

  if (riskHard) {
    oneLook =
      "پرریسک: احتمالاً این رابطه «قابل برگشتِ سالم» نیست؛ حتی اگر برگردد، احتمال تکرار الگو بالاست.";
    nextStep =
      "تمرکز اصلی را بگذار روی «بستن» و بازسازی خودت؛ اگر قرار شد ارتباطی باشد، فقط با مرزهای سخت + تغییر قابل مشاهده.";
  } else if (!didSkipTest2 && evidenceP != null && maturityP != null && ambiguousP != null) {
    const goodReturn = evidenceP >= 60 && maturityP >= 60 && ambiguousP <= 40;
    if (goodReturn) {
      oneLook =
        "مشروطاً امیدوارکننده: نشانه‌هایی از بازگشت واقعی هست، ولی فقط اگر «تعهد + برنامه + ثبات» داشته باشد.";
      nextStep =
        "قبل از هر تصمیم: سه شرط بگذار (تعهد روشن، اقدام پایدار، مرزها) و وارد مذاکره‌ی بدون ابهام شو.";
    } else {
      oneLook =
        "تعلیق‌محور: احتمالاً چیزی که داری تجربه می‌کنی بیشتر «ابهام» است تا بازگشت واقعی.";
      nextStep =
        "قانون طلایی: «بدون اقدام مشخص، هیچ معنایی ندارد.» تمرکز را از علامت‌های مبهم بردار و مسیر درمان را جلو ببر.";
    }
  } else {
    oneLook =
      "نتیجه بر اساس آزمون بازسنجی: وضعیت کلی رابطه باید با واقعیت‌های سخت سنجیده شود، نه امید.";
    nextStep =
      "اگر وسوسه‌ی برگشت داری، اول خط‌قرمزها و الگوی تعارض را اصلاح‌پذیر کن؛ بعد تصمیم.";
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
  const locked = !isUserPro(user);
  const didSkipTest2 = !!session.test2SkippedAt;

  const { diagrams, summary } = buildDiagramsAndSummary(session.answersJson, didSkipTest2);

  return {
    locked,
    meta: {
      didSkipTest2,
      note: didSkipTest2
        ? "کاربر آزمون دوم را اسکیپ کرده است. نتیجه بر اساس آزمون ۱ ارائه می‌شود."
        : "کاربر هر دو آزمون را داده است.",
    },
    diagrams,
    summary,
    message: locked
      ? "برای دیدن نتیجه‌ی کامل (نمودارها + جمع‌بندی درمان‌محور) باید اشتراک پرو رو فعال کنی."
      : "نتیجه آماده است.",
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

  pushT1("در این رابطه خشونت روانی، کلامی یا جسمی وجود داشته است.", null, OPT_YES_NO);
  pushT1("خیانت (عاطفی یا جنسی) رخ داده و بدون پذیرش مسئولیت رها شده است.", null, OPT_YES_NO);
  pushT1("تحقیر، تمسخر یا بی‌ارزش‌سازی مداوم وجود داشته است.", null, OPT_YES_NO);
  pushT1("اعتیاد فعال بدون درمان جدی (مواد، الکل، قمار، پورن) وجود داشته است.", null, OPT_YES_NO);
  pushT1("طرف مقابل تمایلی به تغییر یا کار روی رابطه نشان نداده است.", null, OPT_YES_NO);

  // بخش 2: رضایت و فرسودگی (8)
  pushT1("از رابطه‌ام رضایت کلی داشتم.", null, OPT_0_4_AGREE);
  pushT1("احساس می‌کردم دیده و شنیده می‌شوم.", null, OPT_0_4_AGREE);
  pushT1("بودن کنار او آرامش‌بخش بود.", null, OPT_0_4_AGREE);
  pushT1("رابطه با تصورم از رابطه سالم هم‌خوان بود.", null, OPT_0_4_AGREE);
  pushT1("صمیمیت عاطفی واقعی وجود داشت.", null, OPT_0_4_AGREE);
  pushT1("رابطه بیشتر انرژی‌بخش بود تا فرساینده.", null, OPT_0_4_AGREE);
  pushT1("آینده‌ای قابل تصور با او می‌دیدم.", null, OPT_0_4_AGREE);
  pushT1("اگر به عقب برگردم، باز هم این رابطه را انتخاب می‌کنم.", null, OPT_0_4_AGREE);

  // بخش 3: دلبستگی (10) -> اضطراب 5 + اجتناب 5
  // اضطراب
  pushT1("ترس از رها شدن در این رابطه در من فعال بود.", null, OPT_0_4_AGREE);
  pushT1("برای آرام شدن، نیاز مداوم به اطمینان گرفتن داشتم.", null, OPT_0_4_AGREE);
  pushT1("جدایی یا فاصله عاطفی برایم وحشت‌آور بود.", null, OPT_0_4_AGREE);
  pushT1("وقتی فاصله عاطفی ایجاد می‌شد، اضطرابم بالا می‌رفت.", null, OPT_0_4_AGREE);
  pushT1("ارزش خودم را به بودن در این رابطه گره می‌زدم.", null, OPT_0_4_AGREE);
  // اجتناب
  pushT1("از صمیمیت خیلی نزدیک معذب می‌شدم.", null, OPT_0_4_AGREE);
  pushT1("نیاز داشتم مدام فاصله بگیرم یا عقب‌نشینی کنم.", null, OPT_0_4_AGREE);
  pushT1("احساسات واقعی‌ام را پنهان می‌کردم.", null, OPT_0_4_AGREE);
  pushT1("در وابستگی/نزدیکی، احساس خفگی می‌کردم.", null, OPT_0_4_AGREE);
  pushT1("در تعارض‌ها عقب‌نشینی می‌کردم و از گفت‌وگو فرار می‌کردم.", null, OPT_0_4_AGREE);

  // بخش 4: الگوی تعارض (6) - 0..3
  pushT1("در دعواها تحقیر یا تمسخر وجود داشت.", null, OPT_0_3_CONFLICT);
  pushT1("به جای موضوع، شخصیت طرف مقابل را نقد می‌کردیم.", null, OPT_0_3_CONFLICT);
  pushT1("سکوت یا قطع ارتباط (قهر/بلاک) اتفاق می‌افتاد.", null, OPT_0_3_CONFLICT);
  pushT1("حالت دفاعی به جای گفت‌وگو غالب بود.", null, OPT_0_3_CONFLICT);
  pushT1("تعارض‌ها معمولاً حل نمی‌شدند.", null, OPT_0_3_CONFLICT);
  pushT1("بعد از دعوا، دوری عاطفی طولانی ایجاد می‌شد.", null, OPT_0_3_CONFLICT);

  // TEST2: منطقی بودن انتظار برگشت (20)
  const test2_q = [];
  const pushT2 = (textFa, helpFa, options) => {
    test2_q.push({ textFa, helpFa: helpFa || null, options });
  };

  // 1) شواهد واقعی برگشت (5)
  pushT2("بعد از جدایی، او به‌طور مستقیم و شفاف برای بازگشت اقدام کرده است.", null, OPT_0_4_AGREE);
  pushT2("او مسئولیت سهم خود در مشکلات رابطه را بدون توجیه یا مقصرسازی پذیرفته است.", null, OPT_0_4_AGREE);
  pushT2("در رفتارهای مسئله‌دار او تغییر پایدار و قابل مشاهده ایجاد شده است.", null, OPT_0_4_AGREE);
  pushT2("درخواست بازگشت او همراه با برنامه، تعهد یا پیشنهاد مشخص بوده است.", null, OPT_0_4_AGREE);
  pushT2("او برای ترمیم رابطه هزینه‌ی واقعی (زمان، درمان، تلاش مستمر) پرداخت کرده است.", null, OPT_0_4_AGREE);

  // 2) سیگنال‌های مبهم و تعلیق‌آور (5)
  pushT2("او پس از جدایی پیام‌هایی ابراز دلتنگی یا احساس می‌فرستد بدون اینکه تصمیم یا تعهد روشنی ارائه دهد.", null, OPT_0_4_AGREE);
  pushT2("الگوی ارتباط ما قطع و وصل می‌شود؛ مدتی نزدیک است و ناگهان فاصله می‌گیرد.", null, OPT_0_4_AGREE);
  pushT2("او با رفتارش کاری می‌کند که من در دسترس بمانم، بدون اینکه تکلیف رابطه را مشخص کند.", null, OPT_0_4_AGREE);
  pushT2("از جملاتی استفاده می‌کند که بازگشت را به آینده‌ای نامشخص موکول می‌کند (مثل «الان نه، شاید بعداً»).", null, OPT_0_4_AGREE);
  pushT2("رفتار عاطفی گرم نشان می‌دهد، اما از تصمیم‌گیری یا اقدام مشخص طفره می‌رود.", null, OPT_0_4_AGREE);

  // 3) هزینه‌ی روانی انتظار (5)
  pushT2("بخش زیادی از فکر و انرژی ذهنی‌ام صرف این می‌شود که آیا او برمی‌گردد یا نه.", null, OPT_0_4_AGREE);
  pushT2("تصمیم‌های مهم زندگی‌ام را به احتمال بازگشت او وابسته کرده‌ام.", null, OPT_0_4_AGREE);
  pushT2("از شروع مسیر یا رابطه‌ی جدید می‌ترسم چون احتمال برگشت او را در نظر دارم.", null, OPT_0_4_AGREE);
  pushT2("هنوز این جدایی را در ذهنم موقتی تلقی می‌کنم.", null, OPT_0_4_AGREE);
  pushT2("فکر کردن به بازگشت او به من آرامش کوتاه‌مدت اما ناپایدار می‌دهد.", null, OPT_0_4_AGREE);

  // 4) بلوغ رابطه‌ای طرف مقابل (5)
  pushT2("او می‌تواند درباره رابطه بالغانه، شفاف و بدون فرار گفت‌وگو کند.", null, OPT_0_4_AGREE);
  pushT2("از انکار، مقصرسازی یا بازی‌های قدرت فاصله گرفته است.", null, OPT_0_4_AGREE);
  pushT2("رفتارهای هیجانی ناپایدار یا کودکانه‌ی او کاهش یافته است.", null, OPT_0_4_AGREE);
  pushT2("مرزهای من را حتی بعد از جدایی محترم می‌شمارد.", null, OPT_0_4_AGREE);
  pushT2("نسبت به گذشته، ثبات هیجانی و رفتاری بیشتری نشان می‌دهد.", null, OPT_0_4_AGREE);

  return { test1_q, test2_q };
}

async function getActiveQuestionSet() {
  return prisma.reviewQuestionSet.findFirst({
    where: { code: "review", isActive: true },
    orderBy: [{ version: "desc" }],
  });
}

async function ensureQuestionSetSeeded() {
  const existing = await getActiveQuestionSet();
  if (existing) return existing;

  const version = 1;
  const { test1_q, test2_q } = buildDefaultQuestions();

  const created = await prisma.reviewQuestionSet.create({
    data: {
      code: "review",
      version,
      titleFa: "بازسنجی رابطه + منطقی بودن انتظار",
      description: "Question bank v1 (TEST1/TEST2)",
      isActive: true,
      questions: {
        create: [
          // TEST1
          ...test1_q.map((q, idx) => ({
            testNo: "TEST1",
            order: idx,
            key: `t1_${idx}`,
            textFa: q.textFa,
            helpFa: q.helpFa,
            options: { create: q.options.map((op, j) => ({ order: j, labelFa: op.labelFa, value: op.value })) },
          })),
          // TEST2
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
 * GET /question-set?phone=...  (اختیاری phone فقط برای ست کردن questionSetId روی session در صورت وجود)
 * خروجی: سوالات + گزینه‌ها
 */
router.get("/question-set", async (req, res) => {
  try {
    const phone = String(req.query.phone || "").trim();

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

    return res.json({
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
            .map((q) => ({
              index: q.order,
              key: q.key,
              textFa: q.textFa,
              helpFa: q.helpFa,
              options: q.options.map((o) => ({ value: o.value, labelFa: o.labelFa })),
            })),
          test2: full.questions
            .filter((q) => q.testNo === "TEST2")
            .map((q) => ({
              index: q.order,
              key: q.key,
              textFa: q.textFa,
              helpFa: q.helpFa,
              options: q.options.map((o) => ({ value: o.value, labelFa: o.labelFa })),
            })),
        },
      },
    });
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
    const paywallRequired = computePaywallRequired(user, session);

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

    const session = await prisma.pelekanReviewSession.upsert({
      where: { userId: user.id },
      update: {
        chosenPath: normalized,
        // اگر قبلاً set نشده، ستش کن
        questionSetId: (await prisma.pelekanReviewSession.findUnique({ where: { userId: user.id } }))?.questionSetId
          ? undefined
          : activeSet.id,
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
 * - سپس finish انجام می‌شود (نتیجه قفل/باز می‌شود)
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

    // finish (با شرط جدید)
    const locked = !isUserPro(user);
    const resultJson = buildResultSkeleton({ user, session: updated1 });
    const status = locked ? "completed_locked" : "unlocked";

    const updated2 = await prisma.pelekanReviewSession.update({
      where: { userId: user.id },
      data: {
        status,
        completedAt: now(),
        resultJson,
        paywallShownAt: locked ? (updated1.paywallShownAt ?? now()) : null,
        unlockedAt: locked ? null : now(),
        updatedAt: now(),
      },
    });

    return res.json({
      ok: true,
      data: {
        status: updated2.status,
        locked,
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
  const canAutoResume = session.status === "unlocked" || session.status === "completed_locked";

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
    if (session.status !== "in_progress") return res.json({ ok: false, error: "NOT_IN_PROGRESS" });

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

    const locked = !isUserPro(user);
    const resultJson = buildResultSkeleton({ user, session });

    const status = locked ? "completed_locked" : "unlocked";

    const updated = await prisma.pelekanReviewSession.update({
      where: { userId: user.id },
      data: {
        status,
        completedAt: now(),
        resultJson,
        paywallShownAt: locked ? (session.paywallShownAt ?? now()) : null,
        unlockedAt: locked ? null : now(),
        updatedAt: now(),
      },
    });

    return res.json({
      ok: true,
      data: {
        status: updated.status,
        locked,
        canEnterPelekan: computeCanEnterPelekan(updated),
      },
    });
  } catch (e) {
    console.log("[pelekanReview/finish] error", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

// GET result (اگر قفل بود فقط پیام paywall بده)
router.get("/result", async (req, res) => {
  try {
    console.log("[pelekanReview/result] BUILD = 2025-12-23-REV2");
    
    const phone = String(req.query.phone || "").trim();
    const user = await getUserByPhone(phone);
    if (!user) return res.json({ ok: false, error: "USER_NOT_FOUND" });

    const session = await prisma.pelekanReviewSession.findUnique({ where: { userId: user.id } });
    if (!session) return res.json({ ok: false, error: "NO_SESSION" });

    const pro = isUserPro(user);

    // ✅ اگر session قفل است ولی کاربر پرو شده: بازش کن + نتیجه کامل بساز (self-heal)
    if (session.status === "completed_locked" && pro) {
      const fresh = buildResultSkeleton({ user, session: { ...session, status: "unlocked" } });

      const updated = await prisma.pelekanReviewSession.update({
        where: { userId: user.id },
        data: {
          status: "unlocked",
          unlockedAt: now(),
          paywallShownAt: session.paywallShownAt ?? now(),
          updatedAt: now(),
          resultJson: { ...fresh, locked: false, message: "نتیجه آماده است." },
        },
      });

      return res.json({
        ok: true,
        data: {
          status: updated.status,
          canEnterPelekan: computeCanEnterPelekan(updated),
          result: updated.resultJson,
        },
      });
    }

    // ✅ حالت قفل (FREE) -> فقط پیام paywall برگردان (ولی ورود به پلکان آزاد)
    if (session.status === "completed_locked" && !pro) {
      // ثبت اینکه paywall دیده شد
      if (!session.paywallShownAt) {
        await prisma.pelekanReviewSession.update({
          where: { userId: user.id },
          data: { paywallShownAt: now(), updatedAt: now() },
        });
      }

      return res.json({
        ok: true,
        data: {
          status: session.status,
          canEnterPelekan: computeCanEnterPelekan(session), // ✅ مهم: قفل ≠ بن‌بست
          result: {
            locked: true,
            message: "برای دیدن نتیجه‌ی کامل و کارهایی که در ادامه باید انجام بدی، اشتراک پرو رو فعال کن.",
          },
        },
      });
    }

    // ✅ اگر unlocked است و pro است ولی نتیجه ناقص/خالی است => self-heal
    if (pro && session.status === "unlocked") {
      const rj = session.resultJson || null;
      const lacks = !rj || !rj.summary || !rj.diagrams;
      if (lacks) {
        const fresh = buildResultSkeleton({ user, session });

        const updated = await prisma.pelekanReviewSession.update({
          where: { userId: user.id },
          data: {
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
    }

    // unlocked یا in_progress
    return res.json({
      ok: true,
      data: {
        status: session.status,
        canEnterPelekan: computeCanEnterPelekan(session),
        result: session.resultJson || null,
      },
    });
  } catch (e) {
    console.log("[pelekanReview/result] error", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

export default router;