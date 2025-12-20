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

/* ---------- GET /api/pelekan/state ---------- */
router.get("/state", authUser, async (req, res) => {
  try {
    //noStore(res);

    const phone = req.userPhone;

    const user = await prisma.user.findUnique({
      where: { phone },
      select: { id: true, plan: true, planExpiresAt: true },
    });
    if (!user) return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });

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
      return res.json({
        ok: true,
        data: {
          hasContent: false,
          message: "pelekan_content_empty",
          stages: [],
          progress: null,
        },
      });
    }

    // 2) user progress
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

    // active day selection:
    // rule: اگر dayProgress با status=active داریم، همون active day است.
    // اگر نداریم، اولین روز (globalDayNumber کم‌تر) را active می‌گیریم (تا وقتی start/day logic را نوشتیم)
    const active = dayProgress
      .filter((d) => d.status === "active")
      .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime())[0];

    const firstDay = stages[0]?.days?.[0];
    const activeDayId = active?.dayId || firstDay?.id || null;

    // ✅ mirror into legacy pelekanProgress (بدون اینکه منطق فعلی بشکند)
    // stepIndex/dayIndex فعلاً فقط best-effort است تا UI قدیمی خراب نشود.
    // dayIndex را بر اساس globalDayNumber-1 می‌گذاریم (0-based).
    if (activeDayId) {
      const activeDay = stages.flatMap((s) => s.days).find((d) => d.id === activeDayId);
      const dayIndex0 = activeDay ? Math.max(0, (activeDay.globalDayNumber || 1) - 1) : 0;

      // stepIndex = stage.sortOrder (به شرطی که از 1 شروع کنی)
      const stageIndex = activeDay ? (stages.find((s) => s.id === activeDay.stageId)?.sortOrder || 1) : 1;

      await prisma.pelekanProgress.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          stepIndex: stageIndex,
          dayIndex: dayIndex0,
          gems: 0,
          streak: streak?.currentDays || 0,
        },
        update: {
          stepIndex: stageIndex,
          dayIndex: dayIndex0,
          streak: streak?.currentDays || 0,
          lastActiveAt: new Date(),
          version: { increment: 1 },
        },
      });
    }

    return res.json({
      ok: true,
      data: {
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