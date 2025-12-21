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

/** tabState resolver v1: align with hasAnyProgressFinal */
function resolveTabStateV1({ hasContent, hasAnyProgressFinal }) {
  if (!hasContent) return "idle";
  if (hasAnyProgressFinal) return "treating";
  return "idle";
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

    const basePlan = getPlanStatus(user.plan, user.planExpiresAt);
    const { planStatusFinal, daysLeftFinal } = applyDebugPlan(req, basePlan.planStatus, basePlan.daysLeft);

    // 1) content (read-only)
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
      const tabState = resolveTabStateV1({ hasContent: false, hasAnyProgressFinal });

      const treatmentAccess = computeTreatmentAccess(planStatusFinal, hasAnyProgressFinal);
      const paywall = computePaywall(planStatusFinal, hasAnyProgressFinal);

      return res.json({
        ok: true,
        data: {
          tabState,
          user: { planStatus: planStatusFinal, daysLeft: daysLeftFinal },
          treatmentAccess,
          ui: { paywall },
          baseline: null,
          path: null,
          review: null,
          bastanIntro: null,
          treatment: null,

          hasContent: false,
          message: "pelekan_content_empty",
          stages: [],
          progress: null,
        },
      });
    }

    // 2) progress (read-only)
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

    // ✅ compute hasAnyProgressFinal FIRST (fix TDZ)
    const hasAnyProgress = Array.isArray(dayProgress) && dayProgress.length > 0;
    const hasAnyProgressFinal = applyDebugProgress(req, hasAnyProgress);

    // ✅ tabState aligned with access (v1)
    const tabState = resolveTabStateV1({ hasContent: true, hasAnyProgressFinal });

    const treatmentAccess = computeTreatmentAccess(planStatusFinal, hasAnyProgressFinal);
    const paywall = computePaywall(planStatusFinal, hasAnyProgressFinal);

    // ✅ treatment payload (can be null if no activeDayId)
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
          title: s.title,
          status: s.id === activeStage?.id ? "active" : "locked",
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

    return res.json({
      ok: true,
      data: {
        tabState,
        user: { planStatus: planStatusFinal, daysLeft: daysLeftFinal },
        treatmentAccess,
        ui: { paywall },
        baseline: null,
        path: null,
        review: null,
        bastanIntro: null,
        treatment,

        // legacy payload
        hasContent: true,
        stages,
        progress: {
          activeDayId,
          dayProgress,
          taskProgress,
          xpTotal,
          streak:
            streak || { currentDays: 0, bestDays: 0, lastCompletedAt: null, yellowCardAt: null },
        },
      },
    });
  } catch (e) {
    console.error("[pelekan.state] error:", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

export default router;