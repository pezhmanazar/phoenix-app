import prisma from "../../utils/prisma.js";
import { getFirebaseAdmin } from "../firebase/firebaseAdmin.js";

export async function sendPushToUser(userId, payload) {
  try {
    const devices = await prisma.deviceToken.findMany({
      where: {
        userId,
        isActive: true,
      },
    });

    if (!devices.length) {
      return {
        ok: false,
        error: "NO_ACTIVE_DEVICES",
      };
    }

    // ثبت Notification
    const notification = await prisma.notification.create({
      data: {
        userId,
        type: payload.type || "system",
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
      },
    });

    // ساخت Delivery برای هر دستگاه
    await prisma.notificationDelivery.createMany({
  data: devices.map((device) => ({
    notificationId: notification.id,
    deviceTokenId: device.id,
    status: "pending",
  })),
});

    const admin = getFirebaseAdmin();
    const messaging = admin.messaging();

    const tokens = devices.map((device) => device.token);

    const message = {
      tokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
    };

    const response = await messaging.sendEachForMulticast(message);

    // ذخیره نتیجه ارسال
    for (let i = 0; i < response.responses.length; i++) {
      const item = response.responses[i];

      await prisma.notificationDelivery.updateMany({
        where: {
          notificationId: notification.id,
          deviceTokenId: devices[i].id,
        },
        data: {
          status: item.success ? "sent" : "failed",
          providerMessageId: item.messageId || null,
          errorMessage: item.error?.message || null,
          sentAt: item.success ? new Date() : null,
        },
      });
    }

    console.log("[PUSH_RESULT]", {
      userId,
      notificationId: notification.id,
      successCount: response.successCount,
      failureCount: response.failureCount,
    });


    // غیرفعال کردن توکن‌های خراب
    if (response.failureCount > 0) {
      const invalidTokens = [];

      response.responses.forEach((item, index) => {
        if (!item.success) {
          const errorCode = item.error?.code;

          if (
            errorCode === "messaging/registration-token-not-registered" ||
            errorCode === "messaging/invalid-registration-token"
          ) {
            invalidTokens.push(tokens[index]);
          }
        }
      });

      if (invalidTokens.length) {
        await prisma.deviceToken.updateMany({
          where: {
            token: {
              in: invalidTokens,
            },
          },
          data: {
            isActive: false,
          },
        });
      }
    }

    return {
      ok: true,
      notificationId: notification.id,
      successCount: response.successCount,
      failureCount: response.failureCount,
    };

  } catch (error) {
    console.error(
      "[pushService.sendPushToUser]",
      error?.message || error
    );

    return {
      ok: false,
      error: "PUSH_SERVICE_ERROR",
      message: error?.message || String(error),
    };
  }
}