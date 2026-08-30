//phoenix-backend/routes/achievements.js
import express from "express";
import authUser from "../middleware/authUser.js";
import { getUserAchievements } from "../services/achievements/achievementService.js";
import prisma from "../utils/prisma.js";

const router = express.Router();

function noStore(res) {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, max-age=0, s-maxage=0",
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
}

/**
 * GET /api/achievements/me
 */
router.get("/me", authUser, async (req, res) => {
  try {
    noStore(res);

    const phone = req.user?.phone;

    if (!phone) {
      return res.status(401).json({
        ok: false,
        error: "UNAUTHORIZED",
      });
    }

    const user = await prisma.user.findUnique({
      where: { phone },
      select: {
        id: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        ok: false,
        error: "USER_NOT_FOUND",
      });
    }

    const achievements = await getUserAchievements(
      user.id,
      {
        /*
         * وضعیت واقعی را دوباره sync کن.
         * backfill تاریخی Push نمی‌فرستد.
         */
        sync: true,
      },
    );

    return res.json({
      ok: true,
      data: {
        summary: {
          total: achievements.totalCount,
          unlocked: achievements.unlockedCount,
          locked: achievements.lockedCount,
        },

        achievements: achievements.items,
      },
    });
  } catch (error) {
    console.error(
      "[achievements.me]",
      error?.message || "unknown_error",
    );

    return res.status(500).json({
      ok: false,
      error: "SERVER_ERROR",
    });
  }
});

export default router;