import express from "express";
import authUser from "../middleware/authUser.js";
import { sendPushToUser } from "../services/notifications/pushService.js";
import prisma from "../utils/prisma.js";

const router = express.Router();

router.post("/register-device", authUser, async (req, res) => {
  try {
    const userPhone = req.user?.phone;

    if (!userPhone) {
      return res.status(401).json({
        ok: false,
        error: "UNAUTHORIZED",
      });
    }

    const {
      token,
      platform = "android",
      deviceName = null,
    } = req.body || {};

    if (!token) {
      return res.status(400).json({
        ok: false,
        error: "TOKEN_REQUIRED",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        phone: userPhone,
      },
    });

    if (!user) {
      return res.status(404).json({
        ok: false,
        error: "USER_NOT_FOUND",
      });
    }

    const deviceToken = await prisma.deviceToken.upsert({
      where: {
        token,
      },
      update: {
        userId: user.id,
        platform,
        deviceName,
        isActive: true,
        lastUsedAt: new Date(),
      },
      create: {
        userId: user.id,
        token,
        platform,
        deviceName,
      },
    });

    return res.json({
      ok: true,
      data: deviceToken,
    });

  } catch (e) {
    console.error("[notifications.register-device]", e?.message || e);

    return res.status(500).json({
      ok: false,
      error: "SERVER_ERROR",
    });
  }
});
router.post("/debug-send/:userId", async (req, res) => {
  const result = await sendPushToUser(
    req.params.userId,
    {
      title: "تست ققنوس",
      body: "اگه این پیام رو دیدی سرویس آماده‌ست",
    }
  );

  return res.json(result);
});

export default router;