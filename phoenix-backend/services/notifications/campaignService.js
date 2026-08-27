//services/notifications/campaignService.js
import prisma from "../../utils/prisma.js";
import { createAndSendNotification } from "./notificationService.js";

export function buildCampaignTargetWhere(rule = {}) {
  const now = new Date();

  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const where = {
    deviceTokens: {
      some: {
        isActive: true,
      },
    },
  };

  if (rule.plan === "free") {
    where.plan = "free";
  }

  if (rule.plan === "pro") {
    where.plan = "pro";
    where.planExpiresAt = {
      gt: now,
    };
  }

  if (rule.plan === "expiring") {
    where.plan = "pro";
    where.planExpiresAt = {
      gt: now,
      lte: sevenDaysFromNow,
    };
  }

  if (rule.plan === "expired") {
    where.plan = "pro";
    where.planExpiresAt = {
      lte: now,
    };
  }

  if (rule.appProvider === "bazaar" || rule.appProvider === "direct") {
    where.appProvider = rule.appProvider;
  }

    /*
   * Journey segment
   *
   * baseline_incomplete:
   * کاربر Baseline را شروع کرده ولی کامل نکرده.
   *
   * pelekan_intro_not_started:
   * Baseline کامل شده ولی Intro مرحله بستن را هنوز شروع نکرده.
   *
   * treatment_not_started:
   * Intro را کامل کرده ولی درمان را شروع نکرده
   * و اشتراک فعال هم ندارد.
   */

  if (rule.journey === "baseline_incomplete") {
    where.assessmentSessions = {
      some: {
        kind: "hb_baseline",
        status: "in_progress",
      },
    };
  }

  if (rule.journey === "pelekan_intro_not_started") {
    where.assessmentSessions = {
      some: {
        kind: "hb_baseline",
        status: "completed",
      },
    };

    where.pelekanProgress = {
      is: {
        bastanIntroAudioStartedAt: null,
        bastanIntroAudioCompletedAt: null,
      },
    };
  }

  if (rule.journey === "treatment_not_started") {
    where.pelekanProgress = {
      is: {
        bastanIntroAudioCompletedAt: {
          not: null,
        },
        bastanUnlockedAt: null,
      },
    };

    where.OR = [
      {
        plan: {
          not: "pro",
        },
      },
      {
        plan: "pro",
        planExpiresAt: {
          lte: now,
        },
      },
    ];
  }

  return where;
}

export async function sendCampaignById(campaignId, options = {}) {
  const campaign = await prisma.notificationCampaign.findUnique({
    where: {
      id: campaignId,
    },
  });

  if (!campaign) {
    throw new Error("campaign_not_found");
  }

  if (campaign.status !== "draft" && campaign.status !== "scheduled") {
    throw new Error("campaign_already_processed");
  }

  const rule = campaign.targetRule || {};
  const testUserId =
    typeof options.testUserId === "string" ? options.testUserId.trim() : "";

  let users = [];

  if (testUserId) {
    users = await prisma.user.findMany({
      where: {
        id: testUserId,
        deviceTokens: {
          some: {
            isActive: true,
          },
        },
      },
      select: {
        id: true,
      },
    });
  } else {
    const where = buildCampaignTargetWhere(rule);

    users = await prisma.user.findMany({
      where,
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
      const result = await createAndSendNotification({
        userId: user.id,
        type: campaign.notificationType || "marketing",
        title: campaign.pushTitle,
        body: campaign.pushBody,
        data: {
          ...(campaign.data &&
          typeof campaign.data === "object" &&
          !Array.isArray(campaign.data)
            ? campaign.data
            : {}),

          campaignId: campaign.id,
        },
        campaignId: campaign.id,
      });

      if (result.pushResult?.ok && result.pushResult.successCount > 0) {
        sent++;
      } else {
        failed++;
      }
    } catch (error) {
      failed++;
      console.error("[CAMPAIGN_SEND_USER_FAILED]", {
        campaignId,
        userId: user.id,
        error: error?.message || error,
      });
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

export async function getCampaignStats(campaignId) {
  const campaign = await prisma.notificationCampaign.findUnique({
    where: {
      id: campaignId,
    },
    select: {
      id: true,
      targetCount: true,
      status: true,
      sentAt: true,
    },
  });

  if (!campaign) {
    throw new Error("campaign_not_found");
  }

  const successStatuses = ["sent", "delivered", "opened"];

  const [
    attemptedUsers,
    successfulUsers,
    readUsers,
    openedPushUsers,
    successfulDevices,
    failedDevices,
  ] = await Promise.all([
    prisma.notification.count({
      where: {
        campaignId,
      },
    }),

    prisma.notification.count({
      where: {
        campaignId,
        deliveries: {
          some: {
            status: {
              in: successStatuses,
            },
          },
        },
      },
    }),

    // تعداد کاربران/نوتیفیکیشن‌هایی که داخل اپ خوانده شده‌اند
    prisma.notification.count({
      where: {
        campaignId,
        readAt: {
          not: null,
        },
      },
    }),

    // تعداد کاربران/نوتیفیکیشن‌هایی که خود Push را باز کرده‌اند
    // چون هر Campaign برای هر User یک Notification می‌سازد،
    // count روی Notification باعث دوباره‌شماری deviceها نمی‌شود.
    prisma.notification.count({
      where: {
        campaignId,
        deliveries: {
          some: {
            openedAt: {
              not: null,
            },
          },
        },
      },
    }),

    prisma.notificationDelivery.count({
      where: {
        notification: {
          campaignId,
        },
        status: {
          in: successStatuses,
        },
      },
    }),

    prisma.notificationDelivery.count({
      where: {
        notification: {
          campaignId,
        },
        status: "failed",
      },
    }),
  ]);

  const failedUsers = attemptedUsers - successfulUsers;

  const successRate =
    attemptedUsers > 0
      ? Math.round((successfulUsers / attemptedUsers) * 10000) / 100
      : 0;

  const readRate =
    successfulUsers > 0
      ? Math.round((readUsers / successfulUsers) * 10000) / 100
      : 0;

  const pushOpenRate =
    successfulUsers > 0
      ? Math.round((openedPushUsers / successfulUsers) * 10000) / 100
      : 0;

  return {
    campaignId,
    status: campaign.status,

    targetUsers: campaign.targetCount ?? 0,

    attemptedUsers,
    successfulUsers,
    failedUsers,

    readUsers,
    openedPushUsers,

    successRate,
    readRate,
    pushOpenRate,

    successfulDevices,
    failedDevices,

    sentAt: campaign.sentAt,
  };
}
