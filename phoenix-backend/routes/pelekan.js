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

  // فقط دو حالت اصلی را فعلاً می‌سازیم: free / pro / expired
  // اگر خواستی expiring هم داشته باشی (مثلاً <= 7 روز)، همین‌جا اضافه می‌کنیم.
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
      (a, b) =>
        new Date(b.lastActivityAt || 0).getTime() - new Date(a.lastActivityAt || 0).getTime()
    )[0];

  const firstDay = stages?.[0]?.days?.[0];
  return active?.dayId || firstDay?.id || null;
}

/** minimal resolver v0 */
function resolveTabStateV0({ hasContent, dayProgress, activeDayId }) {
  if (!hasContent) return "idle";
  const hasAnyProgress = Array.isArray(dayProgress) && dayProgress.length > 0;
  if (!hasAnyProgress) return "idle";
  if (activeDayId) return "treating";
  return "idle";
}

/** access model for fairness */
function computeTreatmentAccess(planStatus, hasAnyProgress) {
  if (planStatus === "pro" || planStatus === "expiring") return "full";
  if (hasAnyProgress) return "frozen_current"; // قبلاً پیشرفت داشته؛ ادامه قفل، آرشیو باز
  return "archive_only"; // هنوز شروع نکرده؛ برای شروع نیاز به پرو
}

/** paywall model */
function computePaywall(planStatus, hasAnyProgress) {
  if (planStatus !== "pro" && planStatus !== "expiring") {
    return {
      needed: true,
      reason: hasAnyProgress ? "continue_treatment" : "start_treatment",
    };
  }
  return { needed: false, reason: null };
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
    if (!user) return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });

    const { planStatus, daysLeft } = getPlanStatus(user.plan, user.planExpiresAt);

    // 1) content: stages/days/tasks (read-only)
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

    // اگر هنوز seed نکردی
    if (!stages.length) {
      const hasAnyProgress = false;
      const treatmentAccess = computeTreatmentAccess(planStatus, hasAnyProgress);
      const paywall = computePaywall(planStatus, hasAnyProgress);

      return res.json({
        ok: true,
        data: {
          // ✅ قرارداد جدید
          tabState: "idle",
          user: { planStatus, daysLeft },
          treatmentAccess,
          ui: { paywall },
          baseline: null,
          path: null,
          review: null,
          bastanIntro: null,
          treatment: null,

          // ✅ خروجی قبلی
          hasContent: false,
          message: "pelekan_content_empty",
          stages: [],
          progress: null,
        },
      });
    }

    // 2) user progress (read-only)
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

    // xp total
    const xpAgg = await prisma.xpLedger.aggregate({
      where: { userId: user.id },
      _sum: { amount: true },
    });
    const xpTotal = xpAgg?._sum?.amount || 0;

    const activeDayId = computeActiveDayId({ stages, dayProgress });
    const tabState = resolveTabStateV0({ hasContent: true, dayProgress, activeDayId });

    const hasAnyProgress = Array.isArray(dayProgress) && dayProgress.length > 0;
    const treatmentAccess = computeTreatmentAccess(planStatus, hasAnyProgress);
    const paywall = computePaywall(planStatus, hasAnyProgress);

    // ✅ treatment minimal payload
    let treatment = null;
    if (tabState === "treating" && activeDayId) {
      const allDays = stages.flatMap((s) => s.days);
      const activeDay = allDays.find((d) => d.id === activeDayId) || null;
      const activeStage = activeDay ? stages.find((s) => s.id === activeDay.stageId) : null;

      treatment = {
        activeStage: activeStage?.code || null,
        activeDay: activeDay?.dayNumberInStage || null,
        stages: stages.map((s) => ({
          code: s.code,
          title: s.title,
          status: s.id === activeStage?.id ? "active" : "locked", // فعلاً ساده
        })),
        day: activeDay
          ? {
              number: activeDay.dayNumberInStage,
              status: "active",
              minPercent: 70,
              percentDone: dayProgress.find((dp) => dp.dayId === activeDayId)?.completionPercent ?? 0,
              timing: {
                unlockedNextAt: null,
                minDoneAt: null,
                fullDoneAt: null,
              },
            }
          : null,
      };
    }

    // ❌ مهم: نوشتن دیتابیس در GET ممنوع (برای جلوگیری از باگ و load)
    // قبلاً اینجا upsert روی pelekanProgress داشتی. حذف شد.
    // اگر UI قدیمی هنوز به pelekanProgress وابسته است، باید:
    // - یا در فرانت مهاجرت کنیم،
    // - یا فقط در endpointهای تغییر/پیشرفت روز update کنیم (نه در state).

    return res.json({
      ok: true,
      data: {
        // ✅ قرارداد جدید
        tabState,
        user: { planStatus, daysLeft },
        treatmentAccess,
        ui: { paywall },
        baseline: null,
        path: null,
        review: null,
        bastanIntro: null,
        treatment,

        // ✅ خروجی قبلی برای سازگاری
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

export default router;