//services/notifications/notificationService.js
import prisma from "../../utils/prisma.js";
import {
  sendPushToUser,
} from "./pushService.js";

export async function createAndSendNotification({
  userId,
  type = "system",
  title,
  body,
  data = {},
  campaignId = null,
}) {

  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      body,
      data,
      campaignId,
    },
  });


  let pushResult;

try {
  pushResult = await sendPushToUser(userId, {
  title,
  body,
  data: {
    ...data,
    type,
    notificationId: notification.id,
  },
});
} catch (error) {
  console.error("[NOTIFICATION_PUSH_ERROR]", error?.message || error);

  pushResult = {
    ok: false,
    error: "PUSH_FAILED",
  };
}


  if (pushResult.ok && pushResult.devices) {

    await prisma.notificationDelivery.createMany({
      data: pushResult.devices.map((device, index) => ({
        notificationId: notification.id,
        deviceTokenId: device.id,
        status:
          pushResult.responses[index]?.success
            ? "sent"
            : "failed",
        providerMessageId:
          pushResult.responses[index]?.messageId || null,
        errorMessage:
          pushResult.responses[index]?.error?.message || null,
        sentAt:
          pushResult.responses[index]?.success
            ? new Date()
            : null,
      })),
    });

  }


  console.log("[NOTIFICATION_RESULT]", {
    notificationId: notification.id,
    userId,
    pushResult,
  });


  return {
    notification,
    pushResult,
  };
}
export async function sendNotificationToUsers({
  userIds,
  type = "system",
  title,
  body,
  data = {},
}) {
  const notifications = [];

  for (const userId of userIds) {
    const result = await createAndSendNotification({
      userId,
      type,
      title,
      body,
      data,
    });

    notifications.push(result);
  }

  return notifications;
}


export async function sendNotificationToSegment({
  where,
  type = "system",
  title,
  body,
  data = {},
}) {
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

  return sendNotificationToUsers({
    userIds: users.map((u) => u.id),
    type,
    title,
    body,
    data,
  });
}