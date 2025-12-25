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

const HB_BASELINE_MAX_SCORE = 31;

const HB_BASELINE = {
  kind: "hb_baseline",
  meta: {
    titleFa: "سنجش آسیب شکست عاطفی یا جدایی",
    maxScore: HB_BASELINE_MAX_SCORE,
    scoreHintFa: `نمره از ${HB_BASELINE_MAX_SCORE}`,
    descriptionFa:
      "این سنجش کمک می‌کند شدت فشار روانی و جسمیِ مرتبط با شکست عاطفی یا جدایی را بهتر بشناسی. این یک ابزار خودآگاهی است و جایگزین ارزیابی تخصصی نیست.",
  },
  consentSteps: [
    {
      id: "quiet_place",
      text: "این سنجش را در یک جای آرام و بدون مزاحمت انجام بده.",
      optionText: "متوجه شدم",
    },
    {
      id: "read_calmly",
      text: "هر سؤال را با دقت بخوان و بعد از فهم دقیق، روی اولین پاسخی که به ذهنت می‌آید کلیک کن.",
      optionText: "متوجه شدم",
    },
  ],
  questions: [
    {
      id: "q1_thoughts",
      text:
        "وقتی بیدار هستی، چقدر به شکست عاطفی یا جدایی‌ای که تجربه کردی فکر می‌کنی؟\n(این فکر کردن شامل تصاویر، افکار، احساسات، خیال‌پردازی‌ها، یادآوری خاطرات و حسرت‌های مربوط می‌شود.)",
      options: [
        { label: "اصلاً فکر نمی‌کنم", score: 0 },
        { label: "گاهی فکر می‌کنم (کمتر از ۲۵٪ زمان بیداری)", score: 1 },
        { label: "بعضی وقت‌ها فکر می‌کنم (حدود ۵۰٪ زمان بیداری)", score: 2 },
        { label: "بیشتر وقت‌ها فکر می‌کنم (حداقل ۷۵٪ زمان بیداری)", score: 3 },
      ],
    },
    {
      id: "q2_body_sick",
      text:
        "وقتی به شکست عاطفی یا جدایی فکر می‌کنی، تا چه اندازه از نظر جسمی احساس ناخوشی می‌کنی؟\nمثل خستگی، عصبانیت، بی‌حالی، حالت تهوع، سردرد و غیره",
      options: [
        { label: "اصلاً؛ هیچ احساس جسمی ناخوشایندی در من نیست", score: 0 },
        {
          label:
            "کمی ناخوشم؛ گاهی آشفتگی جسمی یا تحریک‌پذیری گذرا دارم",
          score: 1,
        },
        {
          label:
            "تا حدی ناخوشم؛ آشفتگی جسمی واضحی دارم که معمولاً در کمتر از ده دقیقه کم می‌شود",
          score: 2,
        },
        {
          label:
            "خیلی ناخوشم؛ آشفتگی جسمی عمیق دارم که می‌تواند از چند دقیقه تا چند ساعت طول بکشد",
          score: 3,
        },
      ],
    },
    {
      id: "q3_acceptance",
      text: "پذیرش واقعیت و دردِ شکست عاطفی یا جدایی برایت چقدر آسان است؟",
      options: [
        {
          label: "خیلی سخت است؛ نمی‌توانم باور کنم این اتفاق افتاده",
          score: 3,
        },
        { label: "تا حدی سخت است؛ اما معمولاً می‌توانم تحملش کنم", score: 2 },
        { label: "کمی سخت است؛ و می‌توانم تحملش کنم", score: 1 },
        { label: "اصلاً سخت نیست؛ و می‌توانم ناراحتی‌اش را مدیریت کنم", score: 0 },
      ],
    },
    {
      id: "q4_duration",
      text: "چند وقت است درگیر این شکست عاطفی یا جدایی هستی؟",
      options: [
        { label: "کمتر از یک ماه", score: 1 },
        { label: "بیشتر از یک ماه و کمتر از شش ماه", score: 1 },
        { label: "بیشتر از شش ماه و کمتر از یک سال", score: 2 },
        { label: "بیشتر از یک سال و کمتر از سه سال", score: 3 },
        { label: "بیشتر از سه سال", score: 4 },
      ],
    },
    {
      id: "q5_dreams",
      text:
        "معمولاً چقدر خوابِ مرتبط با این شکست عاطفی یا جدایی را می‌بینی؟\nاین خواب‌ها باید مرتبط با رابطه قبلی یا فردِ سابق باشد.",
      options: [
        { label: "حداقل هفته‌ای یک‌بار تا هر شب", score: 3 },
        { label: "حداقل دو هفته یک‌بار", score: 2 },
        { label: "حداقل ماهی یک‌بار", score: 1 },
        { label: "هیچ خواب مرتبطی ندارم", score: 0 },
      ],
    },
    {
      id: "q6_resistance",
      text:
        "مقاومت و ایستادگی‌ات در برابر افکار، احساسات و خاطرات مرتبط با رابطه قبلی چقدر برایت آسان است؟\nمثلاً آیا می‌توانی با یک کار دیگر یا فکر کردن به چیز دیگری حواس خودت را پرت کنی؟",
      options: [
        { label: "معمولاً نمی‌توانم؛ و چند دقیقه تا چند ساعت درگیرم", score: 3 },
        { label: "بیشتر اوقات نمی‌توانم؛ و حدود ۱۰ تا ۲۰ دقیقه درگیرم", score: 2 },
        { label: "بیشتر اوقات می‌توانم؛ و فقط چند دقیقه کوتاه درگیرم", score: 1 },
        { label: "همیشه می‌توانم؛ و معمولاً کمتر از یک دقیقه درگیر می‌مانم", score: 0 },
      ],
    },
    {
      id: "q7_hope",
      text:
        "فکر می‌کنی یک روز بتوانی از این فشار مرتبط با شکست عاطفی یا جدایی عبور کنی و سبک‌تر شوی؟\n(آیا امید به بهتر شدنِ پایدار داری؟)",
      options: [
        { label: "فکر نمی‌کنم حالِ من واقعاً بهتر شود", score: 3 },
        { label: "نسبت به بهتر شدن بدبینم", score: 2 },
        { label: "تا حد زیادی امیدوارم بهتر شوم", score: 1 },
        { label: "کاملاً امیدوارم بهتر شوم", score: 0 },
      ],
    },
    {
      id: "q8_avoidance",
      text:
        "چقدر برای دوری از چیزهایی که شکست عاطفی یا جدایی را یادآوری می‌کنند مسیرت را تغییر می‌دهی؟\nمثلاً دوری از مکان‌ها، دیدن یادگاری‌ها، یا محرک‌های مشابه.",
      options: [
        { label: "تقریباً همیشه دوری می‌کنم", score: 3 },
        { label: "گاهی دوری می‌کنم", score: 2 },
        { label: "خیلی کم دوری می‌کنم", score: 1 },
        { label: "اصلاً دوری نمی‌کنم", score: 0 },
      ],
    },
    {
      id: "q9_sleep",
      text:
        "آیا به خاطر این شکست عاطفی یا جدایی، در خوابیدن یا بیدار شدن مشکل پیدا کرده‌ای؟\nمثل دیر خواب رفتن، بیدار شدن‌های مکرر، یا خستگی زیاد هنگام بیدار شدن.",
      options: [
        { label: "تقریباً هر شب مشکل دارم", score: 3 },
        { label: "گاهی مشکل دارم", score: 2 },
        { label: "به ندرت مشکل دارم", score: 1 },
        { label: "اصلاً مشکل ندارم", score: 0 },
      ],
    },
    {
      id: "q10_emotions",
      text:
        "چند وقت یک‌بار احساساتی مثل زیر گریه زدن، عصبانی شدن یا بی‌قراری به خاطر شکست عاطفی یا جدایی به سراغت می‌آید؟",
      options: [
        { label: "حداقل روزی یک‌بار", score: 3 },
        { label: "حداقل هفته‌ای یک‌بار", score: 2 },
        { label: "حداقل ماهی یک‌بار", score: 1 },
        { label: "هیچ‌وقت چنین احساساتی ندارم", score: 0 },
      ],
    },
  ],
  interpretation: [
    {
      min: 20,
      max: 31,
      level: "severe",
      text:
        "نمره تو نشان می‌دهد فشارِ ناشی از شکست عاطفی یا جدایی در سطح بالایی قرار دارد. بهتر است با یک متخصص صحبت کنی و یک برنامه حمایتی منظم داشته باشی تا این فشار روی خواب، تمرکز، کارکرد روزانه و تصمیم‌گیری‌ات اثر فرساینده نگذارد.",
    },
    {
      min: 10,
      max: 19,
      level: "moderate",
      text:
        "نمره تو نشان می‌دهد فشارِ ناشی از شکست عاطفی یا جدایی در سطح متوسط است. اگر همین‌طور رها شود ممکن است شدت بگیرد، اما با یک مسیر منظمِ مراقبت و تمرین، قابل مدیریت و رو به بهبود است.",
    },
    {
      min: 0,
      max: 9,
      level: "manageable",
      text:
        "نمره تو نشان می‌دهد فشارِ ناشی از شکست عاطفی یا جدایی در سطح قابل مدیریت است. با چند اقدام ساده و استمرار، می‌توانی این روند را بهتر هم بکنی.",
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

  const maxScore = HB_BASELINE_MAX_SCORE;
  const percent = Math.max(0, Math.min(100, Math.round((total / maxScore) * 100)));

  return {
    ok: true,
    totalScore: total,
    maxScore,
    percent,
    level: band?.level || null,
    safeText: band?.text || null,
  };
}

function toBaselineUiContent() {
  return {
    kind: HB_BASELINE.kind,
    meta: {
      titleFa: HB_BASELINE.meta.titleFa,
      maxScore: HB_BASELINE.meta.maxScore,
      scoreHintFa: HB_BASELINE.meta.scoreHintFa,
      descriptionFa: HB_BASELINE.meta.descriptionFa,
    },
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

/** WCDN workaround: for baseline endpoints, prefer 200 + {ok:false} instead of 4xx (to avoid HTML error pages) */
function baselineError(res, error, extra = {}) {
  return res.json({ ok: false, error, ...extra });
}

function canUnlockGosastanGate({
  actionsProgress,
  contractSignedAt,
  lastSafetyCheckAt,
  lastSafetyCheckResult,
  gosastanUnlockedAt,
}) {
  // already unlocked => keep true
  if (gosastanUnlockedAt) return true;

  // 1) actions gate: all bastan actions must meet minRequired
  const actionsOk =
    Array.isArray(actionsProgress) &&
    actionsProgress.length > 0 &&
    actionsProgress.every((a) => (a?.completed || 0) >= (a?.minRequired || 0));

  if (!actionsOk) return false;

  // 2) contract must be signed
  if (!contractSignedAt) return false;

  // 3) safety check must be done and be "ok"
  // (تو بعداً هر مقدار واقعی که ذخیره می‌کنی رو همینجا هماهنگ می‌کنیم)
  if (!lastSafetyCheckAt) return false;
  if (lastSafetyCheckResult !== "ok") return false;

  return true;
}

/* ---------- GET /api/pelekan/state ---------- */
router.get("/state", authUser, async (req, res) => {
  try {
    noStore(res);

    const phone = req.userPhone;

    // ✅ 1) user first
    const user = await prisma.user.findUnique({
      where: { phone },
      select: { id: true, plan: true, planExpiresAt: true },
    });
    if (!user) return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });
    
    // ✅ ensure PelekanProgress exists (self-heal)
    await prisma.pelekanProgress.upsert({
      where: { userId: user.id },
      update: { lastActiveAt: new Date() },
      create: {
        userId: user.id,
        lastActiveAt: new Date(),
      },
    });

    // ✅ 2) reviewSession AFTER user
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
  test2SkippedAt: true, 
  paywallShownAt: true,
  unlockedAt: true,
  startedAt: true,
  completedAt: true,
  updatedAt: true,
},
    });

    // ✅ 3) review object safely
    const review = reviewSession
      ? { hasSession: true, session: reviewSession }
      : { hasSession: false, session: null };

    const basePlan = getPlanStatus(user.plan, user.planExpiresAt);
    const { planStatusFinal, daysLeftFinal } = applyDebugPlan(
      req,
      basePlan.planStatus,
      basePlan.daysLeft
    );

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
    const seenAt = baselineSession?.scalesJson?.baselineResultSeenAt || null;

    const baselineNeedsResultScreen =
   isBaselineCompleted && !!baselineSession?.totalScore && !seenAt;
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

      // ✅ اگر مسیر بازسنجی انتخاب شده، از choose_path عبور کن
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
          baseline: baselineSession
  ? {
      session: {
        id: baselineSession.id,
        status: baselineSession.status,
        totalScore: baselineSession.totalScore,
        level: baselineSession.scalesJson?.level || null,
        interpretationText:
          baselineSession.scalesJson?.interpretationTextSafe || null,
        completedAt: baselineSession.completedAt,
      },
      content: toBaselineUiContent(),
    }
  : null,
          path: null,
          review,
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

// ✅ اگر بازسنجی کامل یا اسکیپ شده باشد، باید بتواند وارد پلکان شود حتی بدون dayProgress
const reviewDoneOrSkipped = !!reviewSession?.completedAt || !!reviewSession?.test2SkippedAt;

// ✅ معیار واقعی "شروع درمان" برای تب پلکان
const hasStartedTreatment = hasAnyProgressFinal || reviewDoneOrSkipped;

let tabState = "idle";

if (hasStartedTreatment) tabState = "treating";
else if (isBaselineInProgress) tabState = "baseline_assessment";
else if (baselineNeedsResultScreen) tabState = "baseline_result"; // ✅ جدید
else if (reviewSession?.chosenPath === "review") tabState = "review";
else if (isBaselineCompleted) tabState = "choose_path";

// ⬅️ این دو تا هم باید از hasStartedTreatment استفاده کنند وگرنه باز paywall/archive_only خراب می‌شود
const treatmentAccess = computeTreatmentAccess(planStatusFinal, hasStartedTreatment);

// ✅ IMPORTANT: do NOT show paywall while baseline is in progress
const suppressPaywall = tabState === "baseline_assessment";
const paywall = suppressPaywall
  ? { needed: false, reason: null }
  : computePaywall(planStatusFinal, hasStartedTreatment);
  
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
        review,
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

// -------------------- Review Choose Path --------------------
// POST /api/pelekan/review/choose  body: { phone, choice: "skip_review" | "review" }

router.post("/review/choose", authUser, async (req, res) => {
  try {
    noStore(res);

    const phone = req.userPhone;
    const choice = String(req.body?.choice || "").trim();

    if (choice !== "skip_review" && choice !== "review") {
      return res.status(400).json({ ok: false, error: "CHOICE_REQUIRED" });
    }

    const user = await prisma.user.findUnique({
      where: { phone },
      select: { id: true },
    });
    if (!user) return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });

    const now = new Date();

    // 1) upsert review session
const session = await prisma.pelekanReviewSession.upsert({
  where: { userId: user.id },
  create: {
    userId: user.id,
    chosenPath: choice,
    status: choice === "review" ? "in_progress" : "completed_locked",
    startedAt: now,
    completedAt: null,
    test2SkippedAt: null,
    updatedAt: now,
  },
  update: {
    chosenPath: choice,
    status: choice === "review" ? "in_progress" : "completed_locked",
    completedAt: null,
    test2SkippedAt: null,
    updatedAt: now,
  },
  select: {
    id: true,
    status: true,
    chosenPath: true,
    completedAt: true,
    test2SkippedAt: true,
    updatedAt: true,
  },
});

// 2) اگر کاربر skip_review زد -> روز 1 bastan را active کن + نتایج دو آزمون آخر را ریست کن
if (choice === "skip_review") {
  // ✅ A) ورود به treating با ساختن progress واقعی
  const firstDay = await prisma.pelekanDay.findFirst({
    where: { stage: { code: "bastan" }, dayNumberInStage: 1 },
    select: { id: true },
  });

  if (firstDay?.id) {
    await prisma.pelekanDayProgress.upsert({
      where: { userId_dayId: { userId: user.id, dayId: firstDay.id } },
      create: {
        userId: user.id,
        dayId: firstDay.id,
        status: "active",
        completionPercent: 0,
        startedAt: now,
        lastActivityAt: now,
      },
      update: { lastActivityAt: now },
    });
  }

  // ✅ B) ریست دو آزمون آخر (تا UI نتیجه صفر نشان ندهد و اجازه انجام بدهد)
  // اگر اسم دو آزمون شما همین‌هاست:
  const RESET_KINDS = ["relationship_rescan", "ex_returns"];

  await prisma.assessmentResult.deleteMany({
    where: { userId: user.id, kind: { in: RESET_KINDS } },
  });

  await prisma.assessmentSession.deleteMany({
    where: { userId: user.id, kind: { in: RESET_KINDS } },
  });
}

    return res.json({ ok: true, data: { session } });
  } catch (e) {
    console.error("[pelekan.review.choose] error:", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});



/* ---------- GET /api/pelekan/bastan/state ---------- */
router.get("/bastan/state", authUser, async (req, res) => {
  try {
    noStore(res);

    const phone = req.userPhone;

    const user = await prisma.user.findUnique({
      where: { phone },
      select: { id: true, plan: true, planExpiresAt: true },
    });
    if (!user) return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });

    const basePlan = getPlanStatus(user.plan, user.planExpiresAt);
    const { planStatusFinal, daysLeftFinal } = applyDebugPlan(
      req,
      basePlan.planStatus,
      basePlan.daysLeft
    );

    const isProLike = planStatusFinal === "pro" || planStatusFinal === "expiring";

    const [state, actions] = await Promise.all([
      prisma.bastanState.upsert({
        where: { userId: user.id },
        create: { userId: user.id },
        update: {},
        select: {
          introAudioCompletedAt: true,
          contractNameTyped: true,
          contractSignatureJson: true,
          contractSignedAt: true,
          lastSafetyCheckAt: true,
          lastSafetyCheckResult: true,
          safetyWindowStartsAt: true,
          gosastanUnlockedAt: true,
        },
      }),
      prisma.bastanActionDefinition.findMany({
        orderBy: { sortOrder: "asc" },
        include: {
          subtasks: { orderBy: { sortOrder: "asc" } },
        },
      }),
    ]);

    // progress: count done subtasks grouped by actionId
    const doneAgg = await prisma.bastanSubtaskProgress.groupBy({
      by: ["actionId"],
      where: { userId: user.id, isDone: true },
      _count: { _all: true },
    });

    const doneByActionId = {};
    for (const r of doneAgg) doneByActionId[r.actionId] = r._count._all || 0;

    // Build actions UI with sequential unlock + pro locks
    const actionsUi = [];
    let prevUnlockedByProgress = true; // first action available
    for (const a of actions) {
      const completed = doneByActionId[a.id] || 0;
      const minReq = a.minRequiredSubtasks;
      const total = a.totalSubtasks;

      const isComplete = completed >= minReq;

      let locked = false;
      let lockReason = null;

      if (!prevUnlockedByProgress) {
        locked = true;
        lockReason = "previous_action_incomplete";
      }

      if (!locked && a.isProLocked && !isProLike) {
        locked = true;
        lockReason = "pro_required";
      }

      // if intro audio not completed, we still allow showing list, but can gate interaction in UI
      // (UI rule: intro audio free -> then paywall; backend returns intro status)
      const status = locked ? "locked" : isComplete ? "done" : "active";

      actionsUi.push({
        code: a.code,
        titleFa: a.titleFa,
        sortOrder: a.sortOrder,
        medalCode: a.medalCode,
        badgeCode: a.badgeCode,
        isProLocked: a.isProLocked,
        totalSubtasks: total,
        minRequiredSubtasks: minReq,
        progress: { done: completed, required: minReq, total },
        status,
        locked,
        lockReason,
        subtasks: (a.subtasks || []).map((s) => ({
          key: s.key,
          kind: s.kind,
          titleFa: s.titleFa,
          helpFa: s.helpFa,
          isRequired: s.isRequired,
          isFree: s.isFree,
          sortOrder: s.sortOrder,
          xpReward: s.xpReward,
        })),
      });

      // next action can unlock only if current action has met requirement
      prevUnlockedByProgress = prevUnlockedByProgress && isComplete;
    }

    // Gate logic for gosastan
    const actionsProgressForGate = actionsUi.map((a) => ({
      completed: a.progress.done,
      minRequired: a.minRequiredSubtasks,
    }));

    const canUnlock = canUnlockGosastanGate({
      actionsProgress: actionsProgressForGate,
      contractSignedAt: state.contractSignedAt,
      lastSafetyCheckAt: state.lastSafetyCheckAt,
      lastSafetyCheckResult: state.lastSafetyCheckResult,
      gosastanUnlockedAt: state.gosastanUnlockedAt,
    });

    let gosastanUnlockedAtFinal = state.gosastanUnlockedAt;

    if (canUnlock && !gosastanUnlockedAtFinal) {
      const updated = await prisma.bastanState.update({
        where: { userId: user.id },
        data: { gosastanUnlockedAt: new Date() },
        select: { gosastanUnlockedAt: true },
      });
      gosastanUnlockedAtFinal = updated.gosastanUnlockedAt;
    }

    // UI paywall hint: after intro audio, user should hit paywall if not pro-like
    const introDone = !!state.introAudioCompletedAt;
    const paywallNeededAfterIntro = introDone && !isProLike;

    return res.json({
      ok: true,
      data: {
        user: { planStatus: planStatusFinal, daysLeft: daysLeftFinal },
        intro: {
          completedAt: state.introAudioCompletedAt,
          paywallNeededAfterIntro,
        },
        contract: {
          nameTyped: state.contractNameTyped,
          signatureJson: state.contractSignatureJson,
          signedAt: state.contractSignedAt,
        },
        safety: {
          lastAt: state.lastSafetyCheckAt,
          lastResult: state.lastSafetyCheckResult,
          windowStartsAt: state.safetyWindowStartsAt,
        },
        gosastan: {
          canUnlockNow: canUnlock,
          unlockedAt: gosastanUnlockedAtFinal,
        },
        actions: actionsUi,
      },
    });
  } catch (e) {
    console.error("[pelekan.bastan.state] error:", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

/* ---------- POST /api/pelekan/bastan/subtask/complete ---------- */
router.post("/bastan/subtask/complete", authUser, async (req, res) => {
  try {
    noStore(res);

    const phone = req.userPhone;
    const { subtaskKey, payload } = req.body || {};

    if (!subtaskKey || typeof subtaskKey !== "string") {
      return res.status(400).json({ ok: false, error: "SUBTASK_KEY_REQUIRED" });
    }

    const user = await prisma.user.findUnique({
      where: { phone },
      select: { id: true, plan: true, planExpiresAt: true },
    });
    if (!user) return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });

    const basePlan = getPlanStatus(user.plan, user.planExpiresAt);
    const { planStatusFinal } = applyDebugPlan(req, basePlan.planStatus, basePlan.daysLeft);
    const isProLike = planStatusFinal === "pro" || planStatusFinal === "expiring";

    // find subtask by key (we assume keys are globally unique by convention)
    const subtask = await prisma.bastanSubtaskDefinition.findFirst({
      where: { key: subtaskKey },
      select: {
        id: true,
        key: true,
        kind: true,
        isFree: true,
        isRequired: true,
        xpReward: true,
        actionId: true,
        action: {
          select: {
            id: true,
            code: true,
            sortOrder: true,
            isProLocked: true,
            minRequiredSubtasks: true,
            totalSubtasks: true,
            xpOnComplete: true,
          },
        },
      },
    });

    if (!subtask) return res.status(404).json({ ok: false, error: "SUBTASK_NOT_FOUND" });

    // gate: pro requirement (either action-level or subtask-level)
    if ((subtask.action?.isProLocked || subtask.isFree === false) && !isProLike) {
      return res.status(403).json({ ok: false, error: "PRO_REQUIRED" });
    }

    // gate: sequential unlock (must not be blocked by previous action)
    const actions = await prisma.bastanActionDefinition.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, sortOrder: true, minRequiredSubtasks: true },
    });

    // done subtasks count per action
    const doneAgg = await prisma.bastanSubtaskProgress.groupBy({
      by: ["actionId"],
      where: { userId: user.id, isDone: true },
      _count: { _all: true },
    });

    const doneByActionId = {};
    for (const r of doneAgg) doneByActionId[r.actionId] = r._count._all || 0;

    // find if target action is locked by previous action
    let prevOk = true;
    let targetLockedByPrev = false;

    for (const a of actions) {
      const completed = doneByActionId[a.id] || 0;
      const isComplete = completed >= a.minRequiredSubtasks;

      if (a.id === subtask.actionId) {
        targetLockedByPrev = !prevOk;
        break;
      }
      prevOk = prevOk && isComplete;
    }

    if (targetLockedByPrev) {
      return res.status(403).json({ ok: false, error: "ACTION_LOCKED", reason: "previous_action_incomplete" });
    }

    // already done? (one-way)
    const existing = await prisma.bastanSubtaskProgress.findFirst({
      where: { userId: user.id, subtaskId: subtask.id },
      select: { id: true, isDone: true },
    });

    if (existing?.isDone) {
      return res.status(409).json({ ok: false, error: "ALREADY_DONE" });
    }

    // compute before/after for action completion bonus
    const beforeDone = doneByActionId[subtask.actionId] || 0;

    // upsert progress (one-way)
    await prisma.bastanSubtaskProgress.upsert({
      where: existing?.id
        ? { id: existing.id }
        : { id: "__nope__" }, // will force create below when no existing
      create: {
        userId: user.id,
        actionId: subtask.actionId,
        subtaskId: subtask.id,
        isDone: true,
        doneAt: new Date(),
        payloadJson: payload ?? null,
      },
      update: {
        isDone: true,
        doneAt: new Date(),
        payloadJson: payload ?? null,
      },
    }).catch(async (e) => {
      // if the fake where id caused error, do a straight create
      if (!existing?.id) {
        await prisma.bastanSubtaskProgress.create({
          data: {
            userId: user.id,
            actionId: subtask.actionId,
            subtaskId: subtask.id,
            isDone: true,
            doneAt: new Date(),
            payloadJson: payload ?? null,
          },
        });
        return;
      }
      throw e;
    });

    // after count
    const afterDone = beforeDone + 1;
    const minReq = subtask.action?.minRequiredSubtasks || 0;

    const crossedToDone = beforeDone < minReq && afterDone >= minReq;

    // XP for subtask (always)
    const subtaskXp = Number.isFinite(subtask.xpReward) ? subtask.xpReward : 0;
    if (subtaskXp > 0) {
      await prisma.xpLedger.create({
        data: {
          userId: user.id,
          amount: subtaskXp,
          reason: "bastan_subtask_done",
          refType: "bastan_subtask",
          refId: subtask.id,
        },
      });
    }

    // XP bonus for action completion (only once, when crossing threshold)
    let actionBonusXp = 0;
    if (crossedToDone) {
      actionBonusXp = Number.isFinite(subtask.action?.xpOnComplete) ? subtask.action.xpOnComplete : 0;
      if (actionBonusXp > 0) {
        await prisma.xpLedger.create({
          data: {
            userId: user.id,
            amount: actionBonusXp,
            reason: "bastan_action_done",
            refType: "bastan_action",
            refId: subtask.actionId,
          },
        });
      }

      // optional: record action progress row (future use)
      await prisma.bastanActionProgress.upsert({
        where: { userId_actionId: { userId: user.id, actionId: subtask.actionId } },
        create: {
          userId: user.id,
          actionId: subtask.actionId,
          status: "done",
          startedAt: new Date(),
          completedAt: new Date(),
          doneSubtasksCount: afterDone,
          minRequiredSubtasks: minReq,
          totalSubtasks: subtask.action?.totalSubtasks || 0,
          xpEarned: actionBonusXp,
        },
        update: {
          status: "done",
          completedAt: new Date(),
          doneSubtasksCount: afterDone,
          xpEarned: actionBonusXp,
        },
      });
    } else {
      // keep/update action progress basic row (optional)
      await prisma.bastanActionProgress.upsert({
        where: { userId_actionId: { userId: user.id, actionId: subtask.actionId } },
        create: {
          userId: user.id,
          actionId: subtask.actionId,
          status: "active",
          startedAt: new Date(),
          doneSubtasksCount: afterDone,
          minRequiredSubtasks: minReq,
          totalSubtasks: subtask.action?.totalSubtasks || 0,
          xpEarned: 0,
        },
        update: {
          status: "active",
          doneSubtasksCount: afterDone,
        },
      });
    }

    return res.json({
      ok: true,
      data: {
        subtaskKey: subtask.key,
        actionCode: subtask.action?.code || null,
        done: true,
        xpAwarded: { subtask: subtaskXp, actionBonus: actionBonusXp },
        actionReachedMinRequired: crossedToDone,
        actionProgress: { before: beforeDone, after: afterDone, minRequired: minReq },
      },
    });
  } catch (e) {
    console.error("[pelekan.bastan.subtask.complete] error:", e);
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
        // ✅ فقط متن امن ذخیره می‌شود
        scalesJson: {
          level: calc.level,
          interpretationTextSafe: calc.safeText,
          maxScore: calc.maxScore,
        },
      },
      select: { id: true, status: true, totalScore: true, scalesJson: true, completedAt: true },
    });

    await prisma.assessmentResult.upsert({
      where: { userId_kind_wave: { userId: user.id, kind: HB_BASELINE.kind, wave: 1 } },
      create: {
        userId: user.id,
        kind: HB_BASELINE.kind,
        totalScore: calc.totalScore,
        scales: {
          level: calc.level,
          interpretationTextSafe: calc.safeText,
          maxScore: calc.maxScore,
        },
        wave: 1,
        proLocked: false,
      },
      update: {
        totalScore: calc.totalScore,
        scales: {
          level: calc.level,
          interpretationTextSafe: calc.safeText,
          maxScore: calc.maxScore,
        },
        takenAt: new Date(),
        proLocked: false,
      },
    });

    return res.json({
      ok: true,
      data: {
        session: updated,
        interpretation: {
          level: calc.level,
          textSafe: calc.safeText,
          score: calc.totalScore,
          maxScore: calc.maxScore,
        },
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
            interpretationText: session.scalesJson?.interpretationTextSafe || null,
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

// POST /api/pelekan/baseline/seen
router.post("/baseline/seen", authUser, async (req, res) => {
  try {
    noStore(res);

    const phone = req.userPhone;
    const user = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
    if (!user) return baselineError(res, "USER_NOT_FOUND");

    const session = await prisma.assessmentSession.findUnique({
      where: { userId_kind: { userId: user.id, kind: HB_BASELINE.kind } },
      select: { id: true, status: true, scalesJson: true },
    });
    if (!session) return baselineError(res, "SESSION_NOT_FOUND");
    if (session.status !== "completed") return baselineError(res, "SESSION_NOT_COMPLETED");

    const nextScales = { ...(session.scalesJson || {}) };
    if (!nextScales.baselineResultSeenAt) nextScales.baselineResultSeenAt = new Date().toISOString();

    await prisma.assessmentSession.update({
      where: { id: session.id },
      data: { scalesJson: nextScales },
      select: { id: true },
    });

    return res.json({ ok: true, data: { seenAt: nextScales.baselineResultSeenAt } });
  } catch (e) {
    console.error("[pelekan.baseline.seen] error:", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

export default router;