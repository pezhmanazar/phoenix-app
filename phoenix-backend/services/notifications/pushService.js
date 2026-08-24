//phoenix-app\phoenix-backend\services\notifications\pushService.js
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

    console.log("[PUSH_RESULT]", {
      userId,
      successCount: response.successCount,
      failureCount: response.failureCount,
    });

    return {
      ok: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      responses: response.responses,
      devices,
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
export async function sendPushToUsers(userIds, payload) {
  const results = [];

  for (const userId of userIds) {
    const result = await sendPushToUser(userId, payload);
    results.push({
      userId,
      result,
    });
  }

  return results;
}
export async function sendPushToSegment(where, payload) {
  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
    },
  });

  if (!users.length) {
    return {
      ok: false,
      error: "NO_USERS_FOUND",
    };
  }

  const results = await sendPushToUsers(
    users.map((u) => u.id),
    payload
  );

  return {
    ok: true,
    count: users.length,
    results,
  };
}