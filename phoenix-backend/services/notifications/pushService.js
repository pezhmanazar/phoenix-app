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

    console.log("[PUSH_RESULT]", {
      userId,
      successCount: response.successCount,
      failureCount: response.failureCount,
    });

    // اگر توکن‌هایی دیگر معتبر نیستند، غیرفعال کنیم
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