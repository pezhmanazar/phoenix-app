// routes/pelekan.js
import express from "express";
import prisma from "../utils/prisma.js";

const router = express.Router();
router.use(express.json());

/* ---------- helpers (copy from users.js for consistency) ---------- */
function normalizePhone(input) {
  const digits = String(input || "").replace(/\D/g, "");
  if (digits.startsWith("989") && digits.length === 12) return "0" + digits.slice(2);
  if (digits.startsWith("09") && digits.length === 11) return digits;
  if (digits.startsWith("9") && digits.length === 10) return "0" + digits;
  return null;
}

function authUser(req, res, next) {
  const fromQuery = normalizePhone(req.query?.phone);
  const fromBody = normalizePhone(req.body?.phone);
  const phone = fromQuery || fromBody;

  // NOTE: for baseline endpoints behind WCDN, 4xx becomes HTML.
  // But authUser is shared across routes; keep 401 here.
  if (!phone) return res.status(401).json({ ok: false, error: "PHONE_REQUIRED" });

  req.userPhone = phone;
  return next();
}

function noStore(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0, s-maxage=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  res.setHeader("Vary", "Origin");
}

/** planStatus + daysLeft */
function getPlanStatus(plan, planExpiresAt) {
  const now = new Date();

  if (plan === "pro") {
    if (!planExpiresAt) return { planStatus: "pro", daysLeft: 0 };

    const exp = new Date(planExpiresAt);
    const msLeft = exp.getTime() - now.getTime();
    const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));

    if (msLeft <= 0) return { planStatus: "expired", daysLeft: 0 };
    return { planStatus: "pro", daysLeft };
  }

  return { planStatus: "free", daysLeft: 0 };
}

/** pick active day */
function computeActiveDayId({ stages, dayProgress }) {
  const active = (dayProgress || [])
    .filter((d) => d.status === "active")
    .sort(
      (a, b) => new Date(b.lastActivityAt || 0).getTime() - new Date(a.lastActivityAt || 0).getTime()
    )[0];

  const firstDay = stages?.[0]?.days?.[0];
  return active?.dayId || firstDay?.id || null;
}

/** access model for fairness */
function computeTreatmentAccess(planStatus, hasAnyProgressFinal) {
  if (planStatus === "pro" || planStatus === "expiring") return "full";
  if (hasAnyProgressFinal) return "frozen_current";
  return "archive_only";
}

/** paywall model */
function computePaywall(planStatus, hasAnyProgressFinal) {
  if (planStatus !== "pro" && planStatus !== "expiring") {
    return {
      needed: true,
      reason: hasAnyProgressFinal ? "continue_treatment" : "start_treatment",
    };
  }
  return { needed: false, reason: null };
}

/** debug overrides */
function applyDebugPlan(req, planStatus, daysLeft) {
  let planStatusFinal = planStatus;
  let daysLeftFinal = daysLeft;

  const debugPlan = String(req.query?.debugPlan || "").toLowerCase().trim();
  if (debugPlan === "pro") planStatusFinal = "pro";
  if (debugPlan === "expired") planStatusFinal = "expired";
  if (debugPlan === "free") planStatusFinal = "free";

  return { planStatusFinal, daysLeftFinal };
}

function applyDebugProgress(req, hasAnyProgress) {
  let hasAnyProgressFinal = hasAnyProgress;
  const debugProgress = String(req.query?.debugProgress || "").toLowerCase().trim();
  if (debugProgress === "has") hasAnyProgressFinal = true;
  if (debugProgress === "none") hasAnyProgressFinal = false;
  return hasAnyProgressFinal;
}

// -------------------- Baseline Assessment (hb_baseline) --------------------

const HB_BASELINE = {
  kind: "hb_baseline",
  consentSteps: [
    {
      id: "quiet_place",
      text: "اين آزمون را بايد در يك مكان ساكت و بدون مزاحمت انجام دهيد",
      optionText: "متوجه شدم",
    },
    {
      id: "read_calmly",
      text:
        "هر سوال رو با دقت و آرامش بخون و بعد از فهم دقيق اون، روي اولين جوابی كه به ذهنت اومد كليك کن",
      optionText: "متوجه شدم",
    },
  ],
  questions: [
    {
      id: "q1_thoughts",
      text:
        "موقعی كه بيداری، چقدر به شكست عشقی که تجربه کردی فكر می‌کنی؟\n( اين فكر كردن شامل تصاوير، افكار، احساسات، خيال پردازی‌ها، يادآوری خاطرات و حسرت‌های مربوط به شكست عشقي ميشه.)",
      options: [
        { label: "اصلا فكر نمی‌كنم", score: 0 },
        { label: "گاهی فكر می‌كنم (كمتر از 25 درصد زمان بيداری)", score: 1 },
        { label: "بعضی وقت‌ها فكر می‌كنم (در حدود 50 درصد از زمان بيداری)", score: 2 },
        { label: "بيشتر وقت‌ها فكر می‌كنم (حداقل 75 درصد از زمان بيداری)", score: 3 },
      ],
    },
    {
      id: "q2_body_sick",
      text:
        "زمانی كه به شكست عشقی خودت فكر می‌كنی تا چه اندازه به لحاظ جسمی، احساس مريض بودن می‌كنی‌؟\nمثل خستگی، عصبانيت، بی‌حالی، حالت تهوع سردرد و غيره",
      options: [
        { label: "اصلا. هيچ احساس جسمی ناخوشايندی مربوط به شكست عشقی در من وجود نداره", score: 0 },
        {
          label:
            "يكم ناخوشم. تا اندازه‌ای احساس جسمی ناخوشايندی درون من وجود داره و معمولا احساس آشفتگی جسمی، عصبانيت و برانگيختگی ناخوشايند به صورت گذرا دارم",
          score: 1,
        },
        {
          label:
            "تا اندازه‌ای ناخوشم. احساس واضح آشفتگی جسمی، عصبانيت و برانگيختگی ناخوشايندی دارم كه در كمتر از ده دقيقه از بين ميره",
          score: 2,
        },
        {
          label:
            "خيلی ناخوشم. احساس عميق آشفتگی جسمی، عصبانيت و برانگيختی ناخوشايند دارم كه بين چند دقيقه تا چند ساعت طول ميكشه",
          score: 3,
        },
      ],
    },
    {
      id: "q3_acceptance",
      text: "تا چه اندازه پذيرش واقعيت و درد شكست عشقی برات راحته؟",
      options: [
        {
          label:
            "پذيرش و قبول كردن شكست عشقی برام خيلی سخته... نمی‌تونم باور كنم كه اين اتفاق افتاده",
          score: 3,
        },
        { label: "تا اندازه‌ای پذيرش شكست عشقی برام سخته... ولی معمولا می‌تونم اون رو تحمل كنم", score: 2 },
        { label: "يكم پذيرش شكست عشقی برام سخته... و می‌تونم اون رو تحمل كنم", score: 1 },
        { label: "پذيرش شكست عشقی اصلا برام سخت نيست... و هميشه می‌تونم ناراحتيش رو تحمل كنم", score: 0 },
      ],
    },
    {
      id: "q4_duration",
      text: "چند وقته درگير شكست عشقی هستی؟",
      options: [
        { label: "كمتر از يك‌ماه", score: 1 },
        { label: "بيشتر از يك‌ماه و كمتر از شش‌ماه", score: 1 },
        { label: "بيشتر از شش‌ماه و كمتر از يك‌سال", score: 2 },
        { label: "بيشتر از يك‌سال و كمتر از سه‌سال", score: 3 },
        { label: "بيشتر از سه‌سال", score: 4 },
      ],
    },
    {
      id: "q5_dreams",
      text:
        "معمولا چقدر خواب مرتبط با اين شكست عشقی رو می‌بينی؟\nاين خواب‌ها بايد مرتبط به شكست عشقی، رابطه قبلی و پارتنر سابقت باشه",
      options: [
        { label: "حداقل هفته‌ای يك‌بار و حداکثر هر شب", score: 3 },
        { label: "حداقل دو هفته يك‌بار", score: 2 },
        { label: "حداقل ماهی یک‌بار", score: 1 },
        { label: "هيچ خوابی مرتبط با شكست عشقی خودم ندارم", score: 0 },
      ],
    },
    {
      id: "q6_resistance",
      text:
        "مقاومت و ايستادگيت در برابر افكار، احساسات و خاطرات مرتبط به رابطه قبلی و شكست عشقيت تا چه اندازه برات آسونه؟\nمنظور از ايستادگي... مثلا ميتونی به طور موفقيت‌آميزی حواس خودت رو با يه كار ديگه يا فكر كردن در مورد يه چيز ديگه پرت كنی؟",
      options: [
        { label: "معمولا نمی‌تونم... و اون‌ها برای چند دقيقه تا چند ساعت ذهنم رو اذيت می‌كنند", score: 3 },
        { label: "بيشتر اوقات نمی‌تونم... و بين 10 تا 20 دقيقه ذهنم رو اذيت می‌كنند", score: 2 },
        { label: "بيشتر اوقات می‌تونم... و فقط چند دقيقه كوتاه من رو اذيت می‌كنند", score: 1 },
        { label: "هميشه می‌تونم... و بيشترين زمانی كه اين افكار تو ذهنم می‌مونند يك دقيقه است", score: 0 },
      ],
    },
    {
      id: "q7_hope",
      text:
        "فكر می‌کنی كه بتونی يه روز بر اين احساس مريضی مرتبط با شكست عشقيت غلبه كنی و برای هميشه فراموشش كني؟\n( آيا اميد به بهبودی كامل داری؟)",
      options: [
        { label: "فكر نمی‌کنم به طور كامل حالم خوب شه", score: 3 },
        { label: "در مورد بهتر شدن حالم، بدبينم", score: 2 },
        { label: "تا حد زيادی در مورد بهتر شدن حالم خوش بينم", score: 1 },
        { label: "در مورد بهتر شدن حالم به طور كامل خوش بينم", score: 0 },
      ],
    },
    {
      id: "q8_avoidance",
      text:
        "تا چه اندازه به منظور دوری از چيزهايی كه شكست عشقيت رو برات يادآوری می‌كنند،مسير خودت رو تغيير ميدی؟\nمثلا تا چه اندازه از جاهايی... يا تا چه اندازه ديدن يادگاری‌ها... برات آزاردهندست",
      options: [
        { label: "من هميشه از چيزها يا نشانه‌هايی كه مرتبط با شكست عشقی هستند دوری می‌كنم", score: 3 },
        { label: "فقط بعضی مواقع از محرك‌ها و نشونه‌های مرتبط با شكست عشقی دوری می‌كنم", score: 2 },
        { label: "خيلی كم از محرك‌ها و نشونه‌های مرتبط با شكست عشقی، دوری می‌کنم", score: 1 },
        { label: "هيچ وقت از محرك‌ها و نشونه‌های مرتبط با شكست عشقی دوری نمی‌كنم", score: 0 },
      ],
    },
    {
      id: "q9_sleep",
      text:
        "آيا به دليل اين شكست عشقی و احساس بيماری و اضطراب ناشی از اون در خوابيدن و بيدار شدن دچار مشكل شدي؟\nمشكلاتی مثل: دير به خواب رفتن... احساس خستگی زياد موقع بيدار شدن و غيره",
      options: [
        { label: "تقريبا هر شب... مشكلات خواب و بيداری دارم", score: 3 },
        { label: "گهگاهی... مشكلات خواب و بيداری دارم", score: 2 },
        { label: "به ندرت... مشكلات خواب و بيداری دارم", score: 1 },
        { label: "اصلا... مشكلات خواب و بيداری ندارم", score: 0 },
      ],
    },
    {
      id: "q10_emotions",
      text:
        "چند وقت یک‌بار احساساتی مثل زير گريه‌زدن، عصبانی شدن يا بی‌قراری بخاطر شکست عشقی که تجربه کردی، بهت دست ميده؟",
      options: [
        { label: "حداقل روزی يك‌بار", score: 3 },
        { label: "حداقل هفته‌ای يك‌بار", score: 2 },
        { label: "حداقل ماهی يك‌بار", score: 1 },
        { label: "هيچ‌وقت چنين احساساتی ندارم", score: 0 },
      ],
    },
  ],
  interpretation: [
    {
      min: 20,
      max: 31,
      level: "severe",
      text:
        "نمره شما نشان‌دهنده تجربه جدی و شديد اختلال شكست عشقی است و بهتر است به‌صورت اورژانسی تحت درمان قرار بگيريد. اين اختلال می‌تواند کیفیت زندگی و عملکرد اجتماعی/تحصیلی/حرفه‌ای شما را به شدت تحت تأثير قرار دهد و خطر افسردگی، اضطراب و وسواس را بالا ببرد.",
    },
    {
      min: 10,
      max: 19,
      level: "moderate",
      text:
        "نمره شما نشان می‌دهد مبتلا به اختلال شكست عشقی هستيد اما شدت آن از حالت شديد کمتر است. بهتر است برای درمان اقدام کنيد تا شدت علائم بیشتر نشود.",
    },
    {
      min: 0,
      max: 9,
      level: "manageable",
      text:
        "نمره شما نشان می‌دهد علائم اختلال شكست عشقی در سطح قابل تحمل و قابل کنترل است و به‌طور جدی زندگی شما را تخریب نمی‌کند.",
    },
  ],
};

function computeHbBaselineScore(answersByQid) {
  let total = 0;

  for (const q of HB_BASELINE.questions) {
    const idx = answersByQid?.[q.id];
    if (typeof idx !== "number") return { ok: false, error: "MISSING_ANSWER", missingQid: q.id };
    const opt = q.options[idx];
    if (!opt) return { ok: false, error: "INVALID_ANSWER", qid: q.id };
    total += opt.score;
  }

  const band = HB_BASELINE.interpretation.find((b) => total >= b.min && total <= b.max) || null;

  return {
    ok: true,
    totalScore: total,
    level: band?.level || null,
    text: band?.text || null,
  };
}

function toBaselineUiContent() {
  return {
    kind: HB_BASELINE.kind,
    consentSteps: HB_BASELINE.consentSteps.map((s) => ({
      id: s.id,
      text: s.text,
      optionText: s.optionText,
    })),
    questions: HB_BASELINE.questions.map((q) => ({
      id: q.id,
      text: q.text,
      options: q.options.map((o) => ({ label: o.label })), // no scores to UI
    })),
  };
}

function buildBaselineStepsLinear() {
  return [
    ...HB_BASELINE.consentSteps.map((s) => ({ type: "consent", ...s })),
    ...HB_BASELINE.questions.map((q) => ({ type: "question", ...q })),
  ];
}

/** Returns ALL missing steps (for review_missing UI) */
function getMissingSteps(answersJson) {
  const aj = answersJson || {};
  const consent = aj?.consent || {};
  const answers = aj?.answers || {};

  const missing = [];

  for (const s of HB_BASELINE.consentSteps) {
    if (consent[s.id] !== true) missing.push({ type: "consent", id: s.id });
  }
  for (const q of HB_BASELINE.questions) {
    const v = answers[q.id];
    if (typeof v !== "number") missing.push({ type: "question", id: q.id });
  }

  return missing;
}

/**
 * Finds the first missing step in a session.
 * - consent: any consentSteps not acknowledged
 * - question: any question without a numeric answer
 */
function getFirstMissingStep(answersJson) {
  const missing = getMissingSteps(answersJson);
  return missing.length ? missing[0] : null;
}

/** WCDN workaround: for baseline endpoints, prefer 200 + {ok:false} instead of 4xx (to avoid HTML error pages) */
function baselineError(res, error, extra = {}) {
  return res.json({ ok: false, error, ...extra });
}

/* ---------- GET /api/pelekan/state ---------- */
router.get("/state", authUser, async (req, res) => {
  try {
    noStore(res);

    const phone = req.userPhone;

    const user = await prisma.user.findUnique({
      where: { phone },
      select: { id: true, plan: true, planExpiresAt: true },
    });

    const review = reviewSession
      ? { hasSession: true, session: reviewSession }
      : { hasSession: false, session: null };

    if (!user) return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });

    // ✅ review session (PelekanReviewSession)
    const reviewSession = await prisma.pelekanReviewSession.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        status: true,
        chosenPath: true,
        currentTest: true,
        currentIndex: true,
        test1CompletedAt: true,
        test2CompletedAt: true,
        paywallShownAt: true,
        unlockedAt: true,
        startedAt: true,
        completedAt: true,
        updatedAt: true,
      },
    });

    const basePlan = getPlanStatus(user.plan, user.planExpiresAt);
    const { planStatusFinal, daysLeftFinal } = applyDebugPlan(req, basePlan.planStatus, basePlan.daysLeft);

    // baseline session (hb_baseline)
    const baselineSession = await prisma.assessmentSession.findUnique({
      where: { userId_kind: { userId: user.id, kind: HB_BASELINE.kind } },
      select: {
        id: true,
        kind: true,
        status: true,
        currentIndex: true,
        totalItems: true,
        startedAt: true,
        completedAt: true,
        totalScore: true,
        scalesJson: true,
      },
    });

    const isBaselineInProgress = baselineSession?.status === "in_progress";
    const isBaselineCompleted = baselineSession?.status === "completed";

    // content
    const stages = await prisma.pelekanStage.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        days: {
          orderBy: { dayNumberInStage: "asc" },
          include: {
            tasks: { orderBy: { sortOrder: "asc" } },
          },
        },
      },
    });

    // no content
    if (!stages.length) {
      const hasAnyProgressFinal = applyDebugProgress(req, false);

      let tabState = "idle";
      if (isBaselineInProgress) tabState = "baseline_assessment";

      // ✅ اگر کاربر مسیر بازسنجی را انتخاب کرده، از choose_path عبور کن
      if (!isBaselineInProgress && reviewSession?.chosenPath === "review") {
        tabState = "review";
      } else if (isBaselineCompleted) {
        tabState = "choose_path";
      }

      const treatmentAccess = computeTreatmentAccess(planStatusFinal, hasAnyProgressFinal);

      const suppressPaywall = tabState === "baseline_assessment";
      const paywall = suppressPaywall
        ? { needed: false, reason: null }
        : computePaywall(planStatusFinal, hasAnyProgressFinal);

      return res.json({
        ok: true,
        data: {
          tabState,
          user: { planStatus: planStatusFinal, daysLeft: daysLeftFinal },
          treatmentAccess,
          ui: {
            paywall,
            flags: { suppressPaywall, isBaselineInProgress, isBaselineCompleted },
          },
          baseline: baselineSession ? { session: baselineSession, content: toBaselineUiContent() } : null,
          path: null,
          review: {
            hasSession: !!reviewSession,
            session: reviewSession,
          },
          bastanIntro: null,
          treatment: null,
          hasContent: false,
          message: "pelekan_content_empty",
          stages: [],
          progress: null,
        },
      });
    }

    // progress
    const dayProgress = await prisma.pelekanDayProgress.findMany({
      where: { userId: user.id },
      select: {
        dayId: true,
        status: true,
        completionPercent: true,
        startedAt: true,
        deadlineAt: true,
        lastActivityAt: true,
        completedAt: true,
        xpEarned: true,
      },
    });

    const taskProgress = await prisma.pelekanTaskProgress.findMany({
      where: { userId: user.id },
      select: { taskId: true, isDone: true, doneAt: true, dayId: true },
    });

    const streak = await prisma.pelekanStreak.findUnique({
      where: { userId: user.id },
      select: { currentDays: true, bestDays: true, lastCompletedAt: true, yellowCardAt: true },
    });

    const xpAgg = await prisma.xpLedger.aggregate({
      where: { userId: user.id },
      _sum: { amount: true },
    });
    const xpTotal = xpAgg?._sum?.amount || 0;

    const activeDayId = computeActiveDayId({ stages, dayProgress });

    const hasAnyProgress = Array.isArray(dayProgress) && dayProgress.length > 0;
    const hasAnyProgressFinal = applyDebugProgress(req, hasAnyProgress);

    let tabState = "idle";

    if (hasAnyProgressFinal) tabState = "treating";
    else if (isBaselineInProgress) tabState = "baseline_assessment";
    else if (reviewSession?.chosenPath === "review") tabState = "review";
    else if (isBaselineCompleted) tabState = "choose_path";

    const treatmentAccess = computeTreatmentAccess(planStatusFinal, hasAnyProgressFinal);

    // ✅ IMPORTANT: do NOT show paywall while baseline is in progress
    const suppressPaywall = tabState === "baseline_assessment";
    const paywall = suppressPaywall
      ? { needed: false, reason: null }
      : computePaywall(planStatusFinal, hasAnyProgressFinal);

    let treatment = null;
    if (tabState === "treating") {
      const allDays = stages.flatMap((s) => s.days);
      const activeDay = activeDayId ? allDays.find((d) => d.id === activeDayId) : null;
      const activeStage = activeDay ? stages.find((s) => s.id === activeDay.stageId) : null;

      treatment = {
        activeStage: activeStage?.code || null,
        activeDay: activeDay?.dayNumberInStage || null,
        stages: stages.map((s) => ({
          code: s.code,
          title: s.titleFa,
          status: s.id === activeStage?.id ? "active" : "locked",
        })),
        day: activeDay
          ? {
              number: activeDay.dayNumberInStage,
              status: "active",
              minPercent: 70,
              percentDone: dayProgress.find((dp) => dp.dayId === activeDayId)?.completionPercent ?? 0,
              timing: { unlockedNextAt: null, minDoneAt: null, fullDoneAt: null },
            }
          : null,
      };
    }

    return res.json({
      ok: true,
      data: {
        tabState,
        user: { planStatus: planStatusFinal, daysLeft: daysLeftFinal },
        treatmentAccess,
        ui: {
          paywall,
          flags: { suppressPaywall, isBaselineInProgress, isBaselineCompleted },
        },
        baseline: baselineSession ? { session: baselineSession, content: toBaselineUiContent() } : null,
        path: null,
        review: {
          hasSession: !!reviewSession,
          session: reviewSession,
        },
        bastanIntro: null,
        treatment,
        hasContent: true,
        stages,
        progress: {
          activeDayId,
          dayProgress,
          taskProgress,
          xpTotal,
          streak: streak || { currentDays: 0, bestDays: 0, lastCompletedAt: null, yellowCardAt: null },
        },
      },
    });
  } catch (e) {
    console.error("[pelekan.state] error:", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

// POST /api/pelekan/baseline/start
router.post("/baseline/start", authUser, async (req, res) => {
  try {
    const phone = req.userPhone;
    const user = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
    if (!user) return baselineError(res, "USER_NOT_FOUND");

    const existing = await prisma.assessmentSession.findUnique({
      where: { userId_kind: { userId: user.id, kind: HB_BASELINE.kind } },
      select: { id: true, status: true, currentIndex: true, totalItems: true, completedAt: true, startedAt: true },
    });

    if (existing) {
      return res.json({
        ok: true,
        data: {
          sessionId: existing.id,
          status: existing.status,
          currentIndex: existing.currentIndex,
          totalItems: existing.totalItems,
          startedAt: existing.startedAt,
          completedAt: existing.completedAt,
        },
      });
    }

    const steps = buildBaselineStepsLinear();

    const created = await prisma.assessmentSession.create({
      data: {
        userId: user.id,
        kind: HB_BASELINE.kind,
        status: "in_progress",
        currentIndex: 0,
        totalItems: steps.length,
        answersJson: { consent: {}, answers: {} },
      },
      select: { id: true, status: true, currentIndex: true, totalItems: true, startedAt: true },
    });

    return res.json({
      ok: true,
      data: {
        sessionId: created.id,
        status: created.status,
        currentIndex: created.currentIndex,
        totalItems: created.totalItems,
        startedAt: created.startedAt,
      },
    });
  } catch (e) {
    console.error("[pelekan.baseline.start] error:", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

// POST /api/pelekan/baseline/answer
router.post("/baseline/answer", authUser, async (req, res) => {
  try {
    const phone = req.userPhone;
    const { stepType, stepId, optionIndex, acknowledged } = req.body || {};

    const user = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
    if (!user) return baselineError(res, "USER_NOT_FOUND");

    const session = await prisma.assessmentSession.findUnique({
      where: { userId_kind: { userId: user.id, kind: HB_BASELINE.kind } },
      select: { id: true, status: true, answersJson: true, currentIndex: true, totalItems: true },
    });
    if (!session) return baselineError(res, "SESSION_NOT_FOUND");
    if (session.status !== "in_progress") return baselineError(res, "SESSION_NOT_IN_PROGRESS");

    const steps = buildBaselineStepsLinear();
    const total = steps.length;

    const indexRaw = session.currentIndex || 0;

    // ✅ If user is at end but answers missing -> force reset (NO back/repair here)
    if (indexRaw >= total) {
      const missingAll = getMissingSteps(session.answersJson);
      if (missingAll.length > 0) {
        return baselineError(res, "NEEDS_RESET", {
          message: "Session reached end but some answers are missing. Reset required.",
          missing: missingAll,
        });
      }
      return baselineError(res, "ALREADY_COMPLETE");
    }

    // Normal one-way: only answer CURRENT step
    const index = Math.max(0, Math.min(total - 1, indexRaw));
    const expected = steps[index];
    if (!expected) return baselineError(res, "INVALID_INDEX");

    if (expected.type !== stepType || expected.id !== stepId) {
      return baselineError(res, "STEP_MISMATCH", {
        expected: { type: expected.type, id: expected.id, index },
      });
    }

    const aj = session.answersJson || { consent: {}, answers: {} };
    const next = { ...aj, consent: { ...(aj.consent || {}) }, answers: { ...(aj.answers || {}) } };

    if (stepType === "consent") {
      if (acknowledged !== true) return baselineError(res, "ACK_REQUIRED");
      next.consent[stepId] = true;
    } else if (stepType === "question") {
      const q = HB_BASELINE.questions.find((qq) => qq.id === stepId);
      if (!q) return baselineError(res, "INVALID_STEP");
      if (typeof optionIndex !== "number") return baselineError(res, "OPTION_REQUIRED");
      if (!q.options[optionIndex]) return baselineError(res, "OPTION_INVALID");
      next.answers[stepId] = optionIndex;
    } else {
      return baselineError(res, "INVALID_STEP_TYPE");
    }

    // Move forward by 1
    const newIndex = Math.min(total, index + 1);

    const updated = await prisma.assessmentSession.update({
      where: { id: session.id },
      data: { answersJson: next, currentIndex: newIndex, totalItems: total },
      select: { id: true, currentIndex: true, totalItems: true },
    });

    return res.json({ ok: true, data: updated });
  } catch (e) {
    console.error("[pelekan.baseline.answer] error:", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

// POST /api/pelekan/baseline/submit
router.post("/baseline/submit", authUser, async (req, res) => {
  try {
    const phone = req.userPhone;
    const user = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
    if (!user) return baselineError(res, "USER_NOT_FOUND");

    const session = await prisma.assessmentSession.findUnique({
      where: { userId_kind: { userId: user.id, kind: HB_BASELINE.kind } },
      select: { id: true, status: true, answersJson: true },
    });
    if (!session) return baselineError(res, "SESSION_NOT_FOUND");
    if (session.status !== "in_progress") return baselineError(res, "SESSION_NOT_IN_PROGRESS");

    const aj = session.answersJson || {};
    const consent = aj.consent || {};
    const answers = aj.answers || {};

    for (const s of HB_BASELINE.consentSteps) {
      if (consent[s.id] !== true) {
        return baselineError(res, "CONSENT_REQUIRED", { stepId: s.id });
      }
    }

    const calc = computeHbBaselineScore(answers);
    if (!calc.ok) {
      return baselineError(res, calc.error, { missingQid: calc.missingQid, qid: calc.qid });
    }

    const updated = await prisma.assessmentSession.update({
      where: { id: session.id },
      data: {
        status: "completed",
        completedAt: new Date(),
        totalScore: calc.totalScore,
        scalesJson: { level: calc.level, interpretationText: calc.text },
      },
      select: { id: true, status: true, totalScore: true, scalesJson: true, completedAt: true },
    });

    await prisma.assessmentResult.upsert({
      where: { userId_kind_wave: { userId: user.id, kind: HB_BASELINE.kind, wave: 1 } },
      create: {
        userId: user.id,
        kind: HB_BASELINE.kind,
        totalScore: calc.totalScore,
        scales: { level: calc.level, interpretationText: calc.text },
        wave: 1,
        proLocked: false,
      },
      update: {
        totalScore: calc.totalScore,
        scales: { level: calc.level, interpretationText: calc.text },
        takenAt: new Date(),
        proLocked: false,
      },
    });

    return res.json({
      ok: true,
      data: {
        session: updated,
        interpretation: { level: calc.level, text: calc.text, score: calc.totalScore },
      },
    });
  } catch (e) {
    console.error("[pelekan.baseline.submit] error:", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

// GET /api/pelekan/baseline/state
router.get("/baseline/state", authUser, async (req, res) => {
  try {
    noStore(res);

    const phone = req.userPhone;
    const user = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
    if (!user) return baselineError(res, "USER_NOT_FOUND");

    const session = await prisma.assessmentSession.findUnique({
      where: { userId_kind: { userId: user.id, kind: HB_BASELINE.kind } },
      select: {
        id: true,
        status: true,
        currentIndex: true,
        totalItems: true,
        answersJson: true,
        totalScore: true,
        scalesJson: true,
        startedAt: true,
        completedAt: true,
      },
    });

    const steps = buildBaselineStepsLinear();
    const total = steps.length;

    if (!session) {
      return res.json({
        ok: true,
        data: {
          started: false,
          kind: HB_BASELINE.kind,
          totalItems: total,
        },
      });
    }

    if (session.status === "completed") {
      return res.json({
        ok: true,
        data: {
          started: true,
          sessionId: session.id,
          status: session.status,
          kind: HB_BASELINE.kind,
          result: {
            totalScore: session.totalScore,
            level: session.scalesJson?.level || null,
            interpretationText: session.scalesJson?.interpretationText || null,
            completedAt: session.completedAt,
          },
        },
      });
    }

    const aj = session.answersJson || {};
    const consent = aj.consent || {};
    const answers = aj.answers || {};

    const missingAll = getMissingSteps(session.answersJson);

    let indexRaw = session.currentIndex || 0;

    // ✅ CRITICAL FIX:
    // If index is at end (>=total) but something missing -> return review_missing (NO step:null)
    if (indexRaw >= total && missingAll.length > 0) {
      return res.json({
        ok: true,
        data: {
          started: true,
          sessionId: session.id,
          status: session.status,
          kind: HB_BASELINE.kind,
          nav: {
            index: total,
            total,
            canPrev: false,
            canNext: false,
            canSubmit: false,
          },
          step: {
            type: "review_missing",
            message: "چند پاسخ ثبت نشده. لطفاً آزمون را از ابتدا دوباره انجام بده.",
            missing: missingAll,
          },
        },
      });
    }

    // Normal index clamp
    const index = Math.max(0, Math.min(total - 1, indexRaw));
    const step = steps[index] || null;

    // compute selectedIndex for UI
    let selectedIndex = null;
    if (step?.type === "question") {
      const v = answers?.[step.id];
      selectedIndex = typeof v === "number" ? v : null;
    }

    // forced-answer navigation flags (NO back)
    let canNext = false;
    if (step?.type === "consent") canNext = consent?.[step.id] === true;
    else if (step?.type === "question") canNext = selectedIndex !== null;

    // submit allowed only when nothing missing AND we are at last step and it is answered
    const isLast = index >= total - 1;
    const canSubmit = missingAll.length === 0 && isLast && canNext;

    const nav = {
      index,
      total,
      canPrev: false,
      canNext,
      canSubmit,
    };

    let uiStep = null;
    if (step) {
      if (step.type === "consent") {
        uiStep = {
          type: "consent",
          id: step.id,
          text: step.text,
          optionText: step.optionText || "متوجه شدم",
          acknowledged: consent?.[step.id] === true,
        };
      } else {
        uiStep = {
          type: "question",
          id: step.id,
          text: step.text,
          options: (step.options || []).map((o, i) => ({ index: i, label: o.label })),
          selectedIndex,
        };
      }
    }

    return res.json({
      ok: true,
      data: {
        started: true,
        sessionId: session.id,
        status: session.status,
        kind: HB_BASELINE.kind,
        nav,
        step: uiStep,
      },
    });
  } catch (e) {
    console.error("[pelekan.baseline.state] error:", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

// GET /api/pelekan/_debug/400  => must return JSON 400 (no HTML)
router.get("/_debug/400", (req, res) => {
  res.status(400).json({ ok: false, error: "DEBUG_400", ts: new Date().toISOString() });
});

// POST /api/pelekan/baseline/reset
router.post("/baseline/reset", authUser, async (req, res) => {
  try {
    const phone = req.userPhone;
    const force = req.body?.force === true;

    const user = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
    if (!user) return baselineError(res, "USER_NOT_FOUND");

    const session = await prisma.assessmentSession.findUnique({
      where: { userId_kind: { userId: user.id, kind: HB_BASELINE.kind } },
      select: { id: true, status: true },
    });

    if (!session) {
      return res.json({ ok: true, data: { reset: true, note: "NO_SESSION" } });
    }

    // اگر completed بود و force ندادی، ریست نکن
    if (session.status === "completed" && !force) {
      return baselineError(res, "SESSION_ALREADY_COMPLETED");
    }

    // پاک کردن نتیجه و سشن (clean slate)
    await prisma.assessmentResult.deleteMany({
      where: { userId: user.id, kind: HB_BASELINE.kind, wave: 1 },
    });

    await prisma.assessmentSession.deleteMany({
      where: { userId: user.id, kind: HB_BASELINE.kind },
    });

    return res.json({ ok: true, data: { reset: true, forced: force } });
  } catch (e) {
    console.error("[pelekan.baseline.reset] error:", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

export default router;