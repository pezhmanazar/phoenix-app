// routes/pelekan.js
import express from "express";
import engineModule from "../services/pelekan/engine.cjs";
import prisma from "../utils/prisma.js";

const pelekanEngine = engineModule.default ?? engineModule;

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
    .sort((a, b) => new Date(b.lastActivityAt || 0).getTime() - new Date(a.lastActivityAt || 0).getTime())[0];

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

function isDebugAllowed(req) {
  const isProd = process.env.NODE_ENV === "production";
  return !isProd;
}

async function updateStreakOnDayComplete(tx, userId, completedAt) {
  const now = new Date();
  const today = new Date(completedAt);
  today.setHours(0, 0, 0, 0);

  const streak = await tx.pelekanStreak.findUnique({ where: { userId } });

  if (!streak) {
    await tx.pelekanStreak.create({
      data: {
        userId,
        currentDays: 1,
        bestDays: 1,
        lastCompletedAt: completedAt,
        yellowCardAt: null,
        updatedAt: now, // ✅ مهم
      },
    });
    return;
  }

  const last = streak.lastCompletedAt ? new Date(streak.lastCompletedAt) : null;
  if (last) last.setHours(0, 0, 0, 0);

  const diffDays = last ? Math.round((today - last) / 86400000) : null;

  let currentDays = streak.currentDays;
  if (diffDays === 1) currentDays += 1;
  else if (diffDays > 1) currentDays = 1; // diffDays === 0 → همون روز، تغییر نده

  await tx.pelekanStreak.update({
    where: { userId },
    data: {
      currentDays,
      bestDays: Math.max(streak.bestDays, currentDays),
      lastCompletedAt: completedAt,
      updatedAt: now, // ✅ مهم
    },
  });
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
    { id: "quiet_place", text: "این سنجش را در یک جای آرام و بدون مزاحمت انجام بده.", optionText: "متوجه شدم" },
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
        { label: "کمی ناخوشم؛ گاهی آشفتگی جسمی یا تحریک‌پذیری گذرا دارم", score: 1 },
        { label: "تا حدی ناخوشم؛ آشفتگی جسمی واضحی دارم که معمولاً در کمتر از ده دقیقه کم می‌شود", score: 2 },
        { label: "خیلی ناخوشم؛ آشفتگی جسمی عمیق دارم که می‌تواند از چند دقیقه تا چند ساعت طول بکشد", score: 3 },
      ],
    },
    {
      id: "q3_acceptance",
      text: "پذیرش واقعیت و دردِ شکست عاطفی یا جدایی برایت چقدر آسان است؟",
      options: [
        { label: "خیلی سخت است؛ نمی‌توانم باور کنم این اتفاق افتاده", score: 3 },
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
    consentSteps: HB_BASELINE.consentSteps.map((s) => ({ id: s.id, text: s.text, optionText: s.optionText })),
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

/** ✅ WCDN workaround: for bastan endpoints (and any endpoint behind WCDN that must never HTML), prefer 200 + {ok:false} */
function wcdnOkError(res, error, extra = {}) {
  return res.json({ ok: false, error, ...extra });
}

function canUnlockGosastanGate({
  actionsProgress,
  contractSignedAt,
  lastSafetyCheckAt,
  lastSafetyCheckResult,
  gosastanUnlockedAt,
}) {
  if (gosastanUnlockedAt) return true;

  const actionsOk =
    Array.isArray(actionsProgress) &&
    actionsProgress.length > 0 &&
    actionsProgress.every((a) => (a?.completed || 0) >= (a?.minRequired || 0));
  if (!actionsOk) return false;

  if (!contractSignedAt) return false;
  if (!lastSafetyCheckAt) return false;

  // enum values: none | role_based | emotional  => only "none" is safe
  if (lastSafetyCheckResult !== "none") return false;

  return true;
}

/* ------------------ ✅ helper: Bastan actions -> PelekanDayProgress ------------------ */
/**
 * مهم:
 * - وضعیت enum فقط: active | completed | failed
 * - این sync فقط برای روزهای bastan است.
 * - اگر همه actionها done باشند، این تابع هیچ کاری نمی‌کند (گذار به گسستن باید توسط gate/engine انجام شود).
 */
async function syncBastanActionsToPelekanDays(prismaClient, userId) {
  const now = new Date();

  // 1) bastan days
  const bastanDays = await prismaClient.pelekanDay.findMany({
    where: { stage: { code: "bastan" } },
    orderBy: { dayNumberInStage: "asc" },
    select: { id: true, dayNumberInStage: true },
  });
  if (!bastanDays.length) return;

  // 2) actions + done counts
  const actions = await prismaClient.bastanActionDefinition.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, sortOrder: true, minRequiredSubtasks: true },
  });
  if (!actions.length) return;

  const doneAgg = await prismaClient.bastanSubtaskProgress.groupBy({
    by: ["actionId"],
    where: { userId, isDone: true },
    _count: { _all: true },
  });

  const doneByActionId = {};
  for (const r of doneAgg) doneByActionId[r.actionId] = r._count._all || 0;

  // ✅ اگر همه actionها done هستند => اینجا دخالت نکن (گذار به gosastan با gate/engine)
  const allDone = actions.every((a) => (doneByActionId[a.id] || 0) >= (a.minRequiredSubtasks || 0));
  if (allDone) return;

  // 3) تعیین index اقدام فعال (اولین اقدامِ ناقص)
  let activeIndex = 0; // 0-based
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i];
    const done = doneByActionId[a.id] || 0;
    const minReq = a.minRequiredSubtasks || 0;
    if (done < minReq) {
      activeIndex = i;
      break;
    }
  }

  // clamp نسبت به تعداد dayها (اگر mismatch شد)
  if (activeIndex < 0) activeIndex = 0;
  if (activeIndex >= bastanDays.length) activeIndex = bastanDays.length - 1;

  // 4) فقط در bastan:
  //    dayهای قبل completed، روز active -> active
  for (let i = 0; i < bastanDays.length; i++) {
    const dayId = bastanDays[i].id;

    if (i < activeIndex) {
      await prismaClient.pelekanDayProgress.upsert({
        where: { userId_dayId: { userId, dayId } },
        create: {
          userId,
          dayId,
          status: "completed",
          completionPercent: 100,
          startedAt: now,
          lastActivityAt: now,
          completedAt: now,
          xpEarned: 0,
        },
        update: {
          status: "completed",
          completionPercent: 100,
          lastActivityAt: now,
          completedAt: now,
        },
      });
      continue;
    }

    if (i === activeIndex) {
      await prismaClient.pelekanDayProgress.upsert({
        where: { userId_dayId: { userId, dayId } },
        create: {
          userId,
          dayId,
          status: "active",
          completionPercent: 0,
          startedAt: now,
          lastActivityAt: now,
          xpEarned: 0,
        },
        update: {
          status: "active",
          lastActivityAt: now,
          completedAt: null,
        },
      });
      continue;
    }

    // ✅ روزهای بعد از active را دست نمی‌زنیم.
    // چون enum "idle" نداریم و نمی‌خواهیم رکوردهای آینده را خراب کنیم.
  }
}

/* ---------- GET /api/pelekan/state ---------- */
router.get("/state", authUser, async (req, res) => {
  try {
    noStore(res);

    const phone = req.userPhone;

    // 1) user first
    const user = await prisma.user.findUnique({
      where: { phone },
      select: { id: true, plan: true, planExpiresAt: true },
    });
    if (!user) return res.json({ ok: false, error: "USER_NOT_FOUND" });

    // ensure PelekanProgress exists (self-heal)
    await prisma.pelekanProgress.upsert({
      where: { userId: user.id },
      update: { lastActiveAt: new Date() },
      create: { userId: user.id, lastActiveAt: new Date() },
    });

    // ✅ engine signature: (prisma, userId)
    await pelekanEngine.refresh(prisma, user.id);

    // 2) reviewSession AFTER user
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

    // 3) review object safely
    const review = reviewSession ? { hasSession: true, session: reviewSession } : { hasSession: false, session: null };

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
    const seenAt = baselineSession?.scalesJson?.baselineResultSeenAt || null;

    const baselineNeedsResultScreen = isBaselineCompleted && !!baselineSession?.totalScore && !seenAt;

    // content
    const stages = await prisma.pelekanStage.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        days: {
          orderBy: { dayNumberInStage: "asc" },
          include: { tasks: { orderBy: { sortOrder: "asc" } } },
        },
      },
    });

    // no content
    if (!stages.length) {
      const hasAnyProgressFinal = applyDebugProgress(req, false);

      let tabState = "idle";
      if (isBaselineInProgress) tabState = "baseline_assessment";

      // اگر مسیر بازسنجی انتخاب شده، از choose_path عبور کن
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
          ui: { paywall, flags: { suppressPaywall, isBaselineInProgress, isBaselineCompleted } },
          baseline: baselineSession
            ? {
                session: {
                  id: baselineSession.id,
                  status: baselineSession.status,
                  totalScore: baselineSession.totalScore,
                  level: baselineSession.scalesJson?.level || null,
                  interpretationText: baselineSession.scalesJson?.interpretationTextSafe || null,
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

    // اگر بازسنجی کامل یا اسکیپ شده باشد، باید بتواند وارد پلکان شود حتی بدون dayProgress
    const reviewDoneOrSkipped = !!reviewSession?.completedAt || !!reviewSession?.test2SkippedAt;

    // معیار واقعی "شروع درمان" برای تب پلکان
    const hasStartedTreatment = hasAnyProgressFinal || reviewDoneOrSkipped;

    let tabState = "idle";

    if (hasStartedTreatment) tabState = "treating";
    else if (isBaselineInProgress) tabState = "baseline_assessment";
    else if (baselineNeedsResultScreen) tabState = "baseline_result";
    else if (reviewSession?.chosenPath === "review") tabState = "review";
    else if (isBaselineCompleted) tabState = "choose_path";

    const treatmentAccess = computeTreatmentAccess(planStatusFinal, hasStartedTreatment);

    // do NOT show paywall while baseline is in progress
    const suppressPaywall = tabState === "baseline_assessment";
    const paywall = suppressPaywall ? { needed: false, reason: null } : computePaywall(planStatusFinal, hasStartedTreatment);

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
        ui: { paywall, flags: { suppressPaywall, isBaselineInProgress, isBaselineCompleted } },
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

    const user = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
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
      select: { id: true, status: true, chosenPath: true, completedAt: true, test2SkippedAt: true, updatedAt: true },
    });

    // 2) اگر کاربر skip_review زد -> روز 1 bastan را active کن + نتایج دو آزمون آخر را ریست کن
    if (choice === "skip_review") {
      // A) ورود به treating با ساختن progress واقعی
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
          update: { lastActivityAt: now, status: "active" },
        });
      }

      // B) ریست دو آزمون آخر
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
    // ✅ به جای 404 (که پشت WCDN ممکن است HTML شود) 200+ok:false
    if (!user) return wcdnOkError(res, "USER_NOT_FOUND");

    const basePlan = getPlanStatus(user.plan, user.planExpiresAt);
    const { planStatusFinal, daysLeftFinal } = applyDebugPlan(req, basePlan.planStatus, basePlan.daysLeft);
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
        include: { subtasks: { orderBy: { sortOrder: "asc" } } },
      }),
    ]);

    // progress by actionId
    const doneAgg = await prisma.bastanSubtaskProgress.groupBy({
      by: ["actionId"],
      where: { userId: user.id, isDone: true },
      _count: { _all: true },
    });

    const doneByActionId = {};
    for (const r of doneAgg) doneByActionId[r.actionId] = r._count._all || 0;

    // done map by subtask key
    const doneRows = await prisma.bastanSubtaskProgress.findMany({
      where: { userId: user.id, isDone: true },
      select: { doneAt: true, subtask: { select: { key: true } } },
    });

    const doneMap = new Map();
    for (const r of doneRows) {
      const k = String(r?.subtask?.key || "").trim();
      if (!k) continue;
      const iso = r?.doneAt ? r.doneAt.toISOString() : new Date().toISOString();
      doneMap.set(k, iso);
    }

    // intro state
    const introDone = !!state.introAudioCompletedAt;
    const paywallNeededAfterIntro = introDone && !isProLike;

    // Build actions UI
    const actionsUi = [];
    let prevUnlockedByProgress = true;

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
        subtasks: (a.subtasks || []).map((s) => {
          const key = String(s.key || "").trim();
          const doneAt = key ? doneMap.get(key) || null : null;
          return {
            key: s.key,
            kind: s.kind,
            titleFa: s.titleFa,
            helpFa: s.helpFa,
            isRequired: s.isRequired,
            isFree: s.isFree,
            sortOrder: s.sortOrder,
            xpReward: s.xpReward,
            done: !!doneAt,
            completedAt: doneAt,
          };
        }),
      });

      prevUnlockedByProgress = prevUnlockedByProgress && isComplete;
    }

    // Hard gate: intro required
    if (!introDone) {
      for (const a of actionsUi) {
        a.locked = true;
        a.lockReason = "intro_required";
        a.status = "locked";
      }
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

    // ✅ Ensure transition to gosastan day1 happens even if unlockedAt was set earlier
if (canUnlock && gosastanUnlockedAtFinal) {
  const now = new Date();

  const gosDay1 = await prisma.pelekanDay.findFirst({
    where: { stage: { code: "gosastan" }, dayNumberInStage: 1 },
    select: { id: true },
  });

  if (gosDay1?.id) {
    await prisma.$transaction(async (tx) => {
      // --- A) Backfill bastan days to completed (even if already in gosastan) ---
      const bastanDays = await tx.pelekanDay.findMany({
        where: { stage: { code: "bastan" } },
        orderBy: { dayNumberInStage: "asc" },
        select: { id: true },
      });

      const bastanDayIds = bastanDays.map((d) => d.id);

      const bastanCompletedCount = await tx.pelekanDayProgress.count({
        where: {
          userId: user.id,
          dayId: { in: bastanDayIds },
          status: "completed",
        },
      });

      // اگر همه ۸ روز completed نیستند، بک‌فیل کن
      if (bastanCompletedCount !== bastanDayIds.length) {
        for (const d of bastanDays) {
          await tx.pelekanDayProgress.upsert({
            where: { userId_dayId: { userId: user.id, dayId: d.id } },
            create: {
              userId: user.id,
              dayId: d.id,
              status: "completed",
              completionPercent: 100,
              startedAt: now,
              lastActivityAt: now,
              completedAt: now,
              xpEarned: 0,
            },
            update: {
              status: "completed",
              completionPercent: 100,
              lastActivityAt: now,
              completedAt: now,
            },
          });
        }
      }

      // --- B) Ensure gosastan day1 is active (only if not already active) ---
      const gosActive = await tx.pelekanDayProgress.findFirst({
        where: { userId: user.id, dayId: gosDay1.id, status: "active" },
        select: { dayId: true },
      });

      if (!gosActive) {
        await tx.pelekanDayProgress.upsert({
          where: { userId_dayId: { userId: user.id, dayId: gosDay1.id } },
          create: {
            userId: user.id,
            dayId: gosDay1.id,
            status: "active",
            completionPercent: 0,
            startedAt: now,
            lastActivityAt: now,
          },
          update: {
            status: "active",
            lastActivityAt: now,
            completedAt: null,
          },
        });
      }
    });
  }
}

    // Response
    return res.json({
      ok: true,
      data: {
        user: { planStatus: planStatusFinal, daysLeft: daysLeftFinal },
        intro: {
          completedAt: state.introAudioCompletedAt,
          paywallNeededAfterIntro,
        },
        start: {
          completedAt: state.introAudioCompletedAt,
          locked: !state.introAudioCompletedAt,
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
    return wcdnOkError(res, "SERVER_ERROR");
  }
});

/* ---------- POST /api/pelekan/bastan/subtask/complete ---------- */
router.post("/bastan/subtask/complete", authUser, async (req, res) => {
  try {
    noStore(res);

    const phone = req.userPhone;
    const { subtaskKey, payload } = req.body || {};
    if (!subtaskKey || typeof subtaskKey !== "string") {
      return wcdnOkError(res, "SUBTASK_KEY_REQUIRED");
    }

    const user = await prisma.user.findUnique({
      where: { phone },
      select: { id: true, plan: true, planExpiresAt: true },
    });
    if (!user) return wcdnOkError(res, "USER_NOT_FOUND");

    const basePlan = getPlanStatus(user.plan, user.planExpiresAt);
    const { planStatusFinal } = applyDebugPlan(req, basePlan.planStatus, basePlan.daysLeft);
    const isProLike = planStatusFinal === "pro" || planStatusFinal === "expiring";

    // find subtask
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
            sortOrder: true, // ✅ لازم برای day mapping
            isProLocked: true,
            minRequiredSubtasks: true,
            totalSubtasks: true,
            xpOnComplete: true,
          },
        },
      },
    });
    if (!subtask) return wcdnOkError(res, "SUBTASK_NOT_FOUND");

    // pro gate
    if ((subtask.action?.isProLocked || subtask.isFree === false) && !isProLike) {
      return wcdnOkError(res, "PRO_REQUIRED");
    }

    // sequential gate
    const actions = await prisma.bastanActionDefinition.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, sortOrder: true, minRequiredSubtasks: true },
    });

    const doneAgg = await prisma.bastanSubtaskProgress.groupBy({
      by: ["actionId"],
      where: { userId: user.id, isDone: true },
      _count: { _all: true },
    });

    const doneByActionId = {};
    for (const r of doneAgg) doneByActionId[r.actionId] = r._count._all || 0;

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
      return wcdnOkError(res, "ACTION_LOCKED", { reason: "previous_action_incomplete" });
    }

    // already done?
    const existing = await prisma.bastanSubtaskProgress.findFirst({
      where: { userId: user.id, subtaskId: subtask.id },
      select: { id: true, isDone: true },
    });
    if (existing?.isDone) return wcdnOkError(res, "ALREADY_DONE");

    const beforeDone = doneByActionId[subtask.actionId] || 0;
    const minReq = subtask.action?.minRequiredSubtasks || 0;

    // ✅ day mapping: bastan dayNumberInStage === action.sortOrder
    const dayNumber = Number(subtask.action?.sortOrder || 0);
    if (!dayNumber) return wcdnOkError(res, "SERVER_ERROR"); // اکشن خراب است

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      // 1) find the bastan dayId for this action
      const dayRow = await tx.pelekanDay.findFirst({
        where: { stage: { code: "bastan" }, dayNumberInStage: dayNumber },
        select: { id: true },
      });
      if (!dayRow?.id) throw new Error(`DAY_NOT_FOUND_for_action_sortOrder_${dayNumber}`);
      const dayId = dayRow.id;

      // 2) ensure a dayProgress row exists at least as active
      await tx.pelekanDayProgress.upsert({
        where: { userId_dayId: { userId: user.id, dayId } },
        create: {
          userId: user.id,
          dayId,
          status: "active",
          completionPercent: 0,
          startedAt: now,
          lastActivityAt: now,
        },
        update: {
          lastActivityAt: now,
        },
      });

      // 3) mark subtask done (one-way)
      await tx.bastanSubtaskProgress
        .upsert({
          where: existing?.id ? { id: existing.id } : { id: "__nope__" },
          create: {
            userId: user.id,
            actionId: subtask.actionId,
            subtaskId: subtask.id,
            isDone: true,
            doneAt: now,
            payloadJson: payload ?? null,
          },
          update: {
            isDone: true,
            doneAt: now,
            payloadJson: payload ?? null,
          },
        })
        .catch(async (e) => {
          if (!existing?.id) {
            await tx.bastanSubtaskProgress.create({
              data: {
                userId: user.id,
                actionId: subtask.actionId,
                subtaskId: subtask.id,
                isDone: true,
                doneAt: now,
                payloadJson: payload ?? null,
              },
            });
            return;
          }
          throw e;
        });

      // 4) persist contract/safety to BastanState
      if (subtaskKey === "CC_2_signature") {
        const sig = payload?.signature || null;
        const typedName = sig?.name ? String(sig.name).slice(0, 80) : null;
        await tx.bastanState.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            contractNameTyped: typedName,
            contractSignatureJson: sig,
            contractSignedAt: now,
            updatedAt: now,
          },
          update: {
            contractNameTyped: typedName,
            contractSignatureJson: sig,
            contractSignedAt: now,
            updatedAt: now,
          },
        });
      }

      if (subtaskKey === "CC_3_24h_safety_check") {
        const choiceRaw = String(payload?.choice || "").trim();
        let result = "none";
        if (choiceRaw.includes("نقش")) result = "role_based";
        if (choiceRaw.includes("هیجانی")) result = "emotional";

        await tx.bastanState.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            lastSafetyCheckAt: now,
            lastSafetyCheckResult: result,
            safetyWindowStartsAt: now,
            updatedAt: now,
          },
          update: {
            lastSafetyCheckAt: now,
            lastSafetyCheckResult: result,
            ...(result !== "none" ? { safetyWindowStartsAt: now } : {}),
            updatedAt: now,
          },
        });
      }

      // 5) XP for subtask
      const subtaskXp = Number.isFinite(subtask.xpReward) ? subtask.xpReward : 0;
      if (subtaskXp > 0) {
        await tx.xpLedger.create({
          data: {
            userId: user.id,
            amount: subtaskXp,
            reason: "bastan_subtask_done",
            refType: "bastan_subtask",
            refId: subtask.id,
          },
        });
      }

      // 6) update action progress
      const afterDone = beforeDone + 1;
      const crossedToDone = beforeDone < minReq && afterDone >= minReq;
      const shouldBeDone = afterDone >= minReq;

      await tx.bastanActionProgress.upsert({
        where: { userId_actionId: { userId: user.id, actionId: subtask.actionId } },
        create: {
          userId: user.id,
          actionId: subtask.actionId,
          status: shouldBeDone ? "done" : "active",
          startedAt: now,
          completedAt: shouldBeDone ? now : null,
          doneSubtasksCount: afterDone,
          minRequiredSubtasks: minReq,
          totalSubtasks: subtask.action?.totalSubtasks || 0,
          xpEarned: 0,
        },
        update: {
          status: shouldBeDone ? "done" : "active",
          ...(shouldBeDone ? { completedAt: now } : {}),
          doneSubtasksCount: afterDone,
        },
      });

      // 7) if crossed threshold => complete the day + streak + activate next day
      if (crossedToDone) {
        await tx.pelekanDayProgress.update({
          where: { userId_dayId: { userId: user.id, dayId } },
          data: {
            status: "completed",
            completionPercent: 100,
            lastActivityAt: now,
            completedAt: now,
          },
        });

        await updateStreakOnDayComplete(tx, user.id, now);

        // activate next day (if exists)
        const nextDayRow = await tx.pelekanDay.findFirst({
          where: { stage: { code: "bastan" }, dayNumberInStage: dayNumber + 1 },
          select: { id: true },
        });

        if (nextDayRow?.id) {
          // only if next day has no progress row or is not active/completed
          const existingNext = await tx.pelekanDayProgress.findUnique({
            where: { userId_dayId: { userId: user.id, dayId: nextDayRow.id } },
            select: { status: true },
          });

          if (!existingNext) {
            await tx.pelekanDayProgress.create({
              data: {
                userId: user.id,
                dayId: nextDayRow.id,
                status: "active",
                completionPercent: 0,
                startedAt: now,
                lastActivityAt: now,
              },
            });
          }
        }
      }

      // 8) optional: keep engine/sync if you want, but now you don't depend on them
      // await syncBastanActionsToPelekanDays(tx, user.id);
      // await pelekanEngine.refresh(tx, user.id);

      return {
        subtaskXp,
        crossedToDone,
        afterDone,
        minReq,
        actionCode: subtask.action?.code || null,
      };
    });

    return res.json({
      ok: true,
      data: {
        subtaskKey: subtask.key,
        actionCode: result.actionCode,
        done: true,
        xpAwarded: { subtask: result.subtaskXp, actionBonus: 0 },
        actionReachedMinRequired: result.crossedToDone,
        actionProgress: { before: beforeDone, after: result.afterDone, minRequired: result.minReq },
      },
    });
  } catch (e) {
    console.error("[pelekan.bastan.subtask.complete] error:", e);
    return wcdnOkError(res, "SERVER_ERROR");
  }
});

/* ---------- POST /api/pelekan/bastan/intro/complete ---------- */
router.post("/bastan/intro/complete", authUser, async (req, res) => {
  try {
    noStore(res);

    const phone = req.userPhone;

    const user = await prisma.user.findUnique({
      where: { phone },
      select: { id: true },
    });

    // ✅ به جای 404
    if (!user) return wcdnOkError(res, "USER_NOT_FOUND");

    const now = new Date();

    const st = await prisma.$transaction(async (tx) => {
      const s = await tx.bastanState.upsert({
        where: { userId: user.id },
        create: { userId: user.id, introAudioCompletedAt: now },
        update: { introAudioCompletedAt: now },
        select: { introAudioCompletedAt: true },
      });

      await tx.pelekanProgress.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          bastanIntroAudioStartedAt: now,
          bastanIntroAudioCompletedAt: now,
        },
        update: {
          bastanIntroAudioStartedAt: now,
          bastanIntroAudioCompletedAt: now,
        },
      });

      return s;
    });

    return res.json({ ok: true, data: { completedAt: st.introAudioCompletedAt } });
  } catch (e) {
    console.error("[pelekan.bastan.intro.complete] error:", e);
    return wcdnOkError(res, "SERVER_ERROR");
  }
});

// -------------------- Baseline Endpoints --------------------

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
        data: { started: false, kind: HB_BASELINE.kind, totalItems: total },
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

    if (indexRaw >= total && missingAll.length > 0) {
      return res.json({
        ok: true,
        data: {
          started: true,
          sessionId: session.id,
          status: session.status,
          kind: HB_BASELINE.kind,
          nav: { index: total, total, canPrev: false, canNext: false, canSubmit: false },
          step: {
            type: "review_missing",
            message: "چند پاسخ ثبت نشده. لطفاً آزمون را از ابتدا دوباره انجام بده.",
            missing: missingAll,
          },
        },
      });
    }

    const index = Math.max(0, Math.min(total - 1, indexRaw));
    const step = steps[index] || null;

    let selectedIndex = null;
    if (step?.type === "question") {
      const v = answers?.[step.id];
      selectedIndex = typeof v === "number" ? v : null;
    }

    let canNext = false;
    if (step?.type === "consent") canNext = consent?.[step.id] === true;
    else if (step?.type === "question") canNext = selectedIndex !== null;

    const isLast = index >= total - 1;
    const canSubmit = missingAll.length === 0 && isLast && canNext;

    const nav = { index, total, canPrev: false, canNext, canSubmit };

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

    if (session.status === "completed" && !force) {
      return baselineError(res, "SESSION_ALREADY_COMPLETED");
    }

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

// -------------------- Debug Endpoints --------------------

// GET /api/pelekan/_debug/400  => must return JSON (no HTML behind WCDN)
// ✅ تغییر: به جای status(400)، 200 می‌دهیم و داخل body ok:false می‌گذاریم
router.get("/_debug/400", (req, res) => {
  if (!isDebugAllowed(req)) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  return res.json({ ok: false, error: "DEBUG_400", ts: new Date().toISOString() });
});

/* ---------- POST /api/pelekan/_debug/force-active-day ---------- */
/*
  body:
  {
    "phone": "09xxxxxxxxx",
    "stageCode": "bastan" | "gosastan" | ...,
    "dayNumber": 1
  }
*/
router.post("/_debug/force-active-day", async (req, res) => {
  if (!isDebugAllowed(req)) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

  try {
    noStore(res);

    const { phone, stageCode, dayNumber } = req.body || {};

    if (!phone || !stageCode || !dayNumber) {
      return res.status(400).json({
        ok: false,
        error: "REQUIRED_FIELDS",
        required: ["phone", "stageCode", "dayNumber"],
      });
    }

    const user = await prisma.user.findUnique({
      where: { phone },
      select: { id: true },
    });
    if (!user) return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });

    const day = await prisma.pelekanDay.findFirst({
      where: { dayNumberInStage: Number(dayNumber), stage: { code: stageCode } },
      select: { id: true },
    });
    if (!day) return res.status(404).json({ ok: false, error: "DAY_NOT_FOUND" });

    // Fail any currently active day
    await prisma.pelekanDayProgress.updateMany({
      where: { userId: user.id, status: "active" },
      data: { status: "failed", lastActivityAt: new Date() },
    });

    // Activate target day
    await prisma.pelekanDayProgress.upsert({
      where: { userId_dayId: { userId: user.id, dayId: day.id } },
      create: {
        userId: user.id,
        dayId: day.id,
        status: "active",
        completionPercent: 0,
        startedAt: new Date(),
        lastActivityAt: new Date(),
      },
      update: { status: "active", lastActivityAt: new Date() },
    });

    return res.json({ ok: true, data: { forced: true, stageCode, dayNumber } });
  } catch (e) {
    console.error("[pelekan._debug.force-active-day] error:", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

export default router;