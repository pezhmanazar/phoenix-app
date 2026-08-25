import express from "express";
import {
  sendIncompleteBaselineReminders,
  sendPelekanIntroReminders,
} from "../services/notifications/notificationJobs.js";
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

router.get("/pelekan-intro-send-test", async (req, res) => {
  try {
    const result = await sendPelekanIntroReminders();

    return res.json({
      ok: true,
      result,
    });
  } catch (e) {
    console.error("[PELEKAN_INTRO_SEND_TEST]", e);

    return res.status(500).json({
      ok: false,
      error: e.message,
    });
  }
});

export default router;