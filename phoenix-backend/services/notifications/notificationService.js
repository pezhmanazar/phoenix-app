//services/notifications/notificationService.js
import prisma from "../../utils/prisma.js";
import { sendPushToUser } from "./pushService.js";

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


  const pushResult = await sendPushToUser(userId, {
    title,
    body,
    data: {
      ...data,
      type,
    },
  });


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