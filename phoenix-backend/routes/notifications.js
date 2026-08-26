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

    const { token, platform = "android", deviceName = null } = req.body || {};

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
router.get("/", authUser, async (req, res) => {
  try {
    const userPhone = req.user?.phone;

    if (!userPhone) {
      return res.status(401).json({
        ok: false,
        error: "UNAUTHORIZED",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        phone: userPhone,
      },
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

    const notifications = await prisma.notification.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        data: true,
        campaignId: true,
        readAt: true,
        createdAt: true,
      },
    });

    return res.json({
      ok: true,
      data: {
        items: notifications,
      },
    });
  } catch (e) {
    console.error("[notifications.list]", e?.message || e);

    return res.status(500).json({
      ok: false,
      error: "SERVER_ERROR",
    });
  }
});

router.get("/unread-count", authUser, async (req, res) => {
  try {
    const userPhone = req.user?.phone;

    if (!userPhone) {
      return res.status(401).json({
        ok: false,
        error: "UNAUTHORIZED",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        phone: userPhone,
      },
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

    const count = await prisma.notification.count({
      where: {
        userId: user.id,
        readAt: null,
      },
    });

    return res.json({
      ok: true,
      data: {
        count,
      },
    });
  } catch (e) {
    console.error("[notifications.unread-count]", e?.message || e);

    return res.status(500).json({
      ok: false,
      error: "SERVER_ERROR",
    });
  }
});

router.post("/:id/read", authUser, async (req, res) => {
  try {
    const userPhone = req.user?.phone;
    const notificationId = String(req.params.id || "").trim();

    if (!userPhone) {
      return res.status(401).json({
        ok: false,
        error: "UNAUTHORIZED",
      });
    }

    if (!notificationId) {
      return res.status(400).json({
        ok: false,
        error: "NOTIFICATION_ID_REQUIRED",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        phone: userPhone,
      },
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

    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId: user.id,
      },
      select: {
        id: true,
        readAt: true,
      },
    });

    if (!notification) {
      return res.status(404).json({
        ok: false,
        error: "NOTIFICATION_NOT_FOUND",
      });
    }

    if (!notification.readAt) {
      await prisma.notification.update({
        where: {
          id: notification.id,
        },
        data: {
          readAt: new Date(),
        },
      });
    }

    return res.json({
      ok: true,
      data: {
        read: true,
      },
    });
  } catch (e) {
    console.error("[notifications.mark-read]", e?.message || e);

    return res.status(500).json({
      ok: false,
      error: "SERVER_ERROR",
    });
  }
});

router.post("/debug-send/:userId", async (req, res) => {
  const result = await sendPushToUser(req.params.userId, {
    title: "تست ققنوس",
    body: "اگه این پیام رو دیدی سرویس آماده‌ست",
  });

  return res.json(result);
});

export default router;
