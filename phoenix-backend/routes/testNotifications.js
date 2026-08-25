import express from "express";
import {
  sendIncompleteBaselineReminders,
} from "../services/notifications/notificationJobs.js";
import { createAndSendNotification } from "../services/notifications/notificationService.js";
import prisma from "../utils/prisma.js";

const router = express.Router();

router.get("/baseline-check", async (req, res) => {
  try {

    const users = await prisma.assessmentSession.findMany({
      where: {
        kind: "hb_baseline",
        status: "in_progress",
      },
      select: {
        id: true,
        userId: true,
        currentIndex: true,
        totalItems: true,
        updatedAt: true,
      },
    });


    return res.json({
      ok: true,
      count: users.length,
      users,
    });


  } catch (e) {
    console.error(e);

    return res.status(500).json({
      ok:false,
      error:e.message,
    });
  }
});

router.get("/pelekan-intro-check", async (req, res) => {
  try {
    const oneDayAgo = new Date(
      Date.now() - 24 * 60 * 60 * 1000
    );

    const users = await prisma.pelekanProgress.findMany({
      where: {
        bastanIntroAudioStartedAt: null,
        bastanIntroAudioCompletedAt: null,
        lastActiveAt: {
          lt: oneDayAgo,
        },
        user: {
          assessmentSessions: {
            some: {
              kind: "hb_baseline",
              status: "completed",
            },
          },
        },
      },
      select: {
        userId: true,
        startedAt: true,
        lastActiveAt: true,
        user: {
          select: {
            phone: true,
          },
        },
      },
    });

    return res.json({
      ok: true,
      count: users.length,
      users,
    });
  } catch (e) {
    console.error("[PELEKAN_INTRO_CHECK]", e);

    return res.status(500).json({
      ok: false,
      error: e.message,
    });
  }
});

router.get("/treatment-start-check", async (req, res) => {
  try {
    const oneDayAgo = new Date(
      Date.now() - 24 * 60 * 60 * 1000
    );

    const now = new Date();

    const users = await prisma.pelekanProgress.findMany({
      where: {
        bastanIntroAudioCompletedAt: {
          not: null,
          lt: oneDayAgo,
        },

        bastanUnlockedAt: null,

        user: {
          deviceTokens: {
            some: {
              isActive: true,
            },
          },

          OR: [
            {
              plan: {
                not: "pro",
              },
            },
            {
              plan: "pro",
              planExpiresAt: {
                lte: now,
              },
            },
          ],
        },
      },

      select: {
        userId: true,
        bastanIntroAudioCompletedAt: true,
        bastanUnlockedAt: true,

        user: {
          select: {
            phone: true,
            plan: true,
            planExpiresAt: true,
          },
        },
      },
    });

    return res.json({
      ok: true,
      count: users.length,
      users,
    });
  } catch (e) {
    console.error("[TREATMENT_START_CHECK]", e);

    return res.status(500).json({
      ok: false,
      error: e?.message || "internal_error",
    });
  }
});

router.get("/baseline-send-test", async (req, res) => {
  try {
    const result = await sendIncompleteBaselineReminders();

    return res.json({
      ok: true,
      result,
    });

  } catch (e) {
    console.error("[BASELINE_SEND_TEST]", e);

    return res.status(500).json({
      ok: false,
      error: e.message,
    });
  }
});

router.get("/pelekan-intro-send-test/:userId", async (req, res) => {
  try {
    const userId = String(req.params.userId || "").trim();

    if (!userId) {
      return res.status(400).json({
        ok: false,
        error: "userId_required",
      });
    }

    const result = await createAndSendNotification({
      userId,
      type: "pelekan",
      title: "مسیر درمانت منتظرته",
      body:
        "آزمون شکست عاطفی رو کامل کردی، اما هنوز معرفی مسیر درمان رو گوش ندادی. چند دقیقه وقت بذار و ببین ققنوس قراره چطور قدم‌به‌قدم همراهت باشه.",
      data: {
        reason: "pelekan_intro_not_started",
      },
    });

    return res.json({
      ok: true,
      result,
    });
  } catch (e) {
    console.error("[PELEKAN_INTRO_SINGLE_TEST]", e);

    return res.status(500).json({
      ok: false,
      error: e?.message || "internal_error",
    });
  }
});

router.get("/treatment-start-send-test/:userId", async (req, res) => {
  try {
    const userId = String(req.params.userId || "").trim();

    if (!userId) {
      return res.status(400).json({
        ok: false,
        error: "userId_required",
      });
    }

    const result = await createAndSendNotification({
      userId,
      type: "pelekan",
      title: "وقتشه درمانت رو شروع کنی",
      body:
        "با فعال کردن اشتراک، مسیر درمان قدم‌به‌قدم ققنوس برات باز میشه؛ در «پناه» بدون محدودیت با درمانگر در ارتباطی و «پناهگاه» هم برای لحظه‌های سخت و اورژانسی کنارت خواهد بود.",
      data: {
        reason: "treatment_not_started",
      },
    });

    return res.json({
      ok: true,
      result,
    });
  } catch (e) {
    console.error("[TREATMENT_START_SINGLE_TEST]", e);

    return res.status(500).json({
      ok: false,
      error: e?.message || "internal_error",
    });
  }
});

export default router;