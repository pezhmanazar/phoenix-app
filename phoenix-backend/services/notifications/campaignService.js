//services/notifications/campaignService.js
import prisma from "../../utils/prisma.js";
import { createAndSendNotification } from "./notificationService.js";


export async function sendCampaignById(campaignId) {
  const campaign =
    await prisma.notificationCampaign.findUnique({
      where: {
        id: campaignId,
      },
    });

  if (!campaign) {
    throw new Error("campaign_not_found");
  }


  if (
    campaign.status !== "draft" &&
    campaign.status !== "scheduled"
  ) {
    throw new Error("campaign_already_processed");
  }


  const rule = campaign.targetRule || {};
  const testUserId =
  typeof options.testUserId === "string"
    ? options.testUserId.trim()
    : "";

  let users = [];


  if (testUserId) {
  users = await prisma.user.findMany({
    where: {
      id: testUserId,
    },
    select: {
      id: true,
    },
  });

} else if (rule.plan === "free") {
    users = await prisma.user.findMany({
      where: {
        plan: "free",
      },
      select: {
        id: true,
      },
    });

  } else if (rule.plan === "pro") {

    users = await prisma.user.findMany({
      where: {
        plan: "pro",
      },
      select: {
        id: true,
      },
    });

  } else {

    users = await prisma.user.findMany({
      select: {
        id: true,
      },
    });

  }


  await prisma.notificationCampaign.update({
    where: {
      id: campaignId,
    },
    data: {
      status: "sending",
      targetCount: users.length,
    },
  });


  let sent = 0;
  let failed = 0;


  for (const user of users) {

    try {

      const result =
        await createAndSendNotification({
          userId: user.id,

          type:
            campaign.notificationType ||
            "marketing",

          title: campaign.pushTitle,

          body: campaign.pushBody,

          data: {
            campaignId: campaign.id,
          },

          campaignId: campaign.id,
        });


      if (
        result.pushResult?.ok &&
        result.pushResult.successCount > 0
      ) {
        sent++;
      } else {
        failed++;
      }


    } catch (error) {

      failed++;

      console.error(
        "[CAMPAIGN_SEND_USER_FAILED]",
        {
          campaignId,
          userId: user.id,
          error:
            error?.message || error,
        }
      );

    }
  }


  await prisma.notificationCampaign.update({
    where: {
      id: campaignId,
    },
    data: {
      status: "completed",
      sentAt: new Date(),
    },
  });


  return {
    campaignId,
    targetCount: users.length,
    sent,
    failed,
  };
}