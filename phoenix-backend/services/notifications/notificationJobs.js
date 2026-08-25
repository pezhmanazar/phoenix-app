import prisma from "../../utils/prisma.js";
import { createAndSendNotification } from "./notificationService.js";
import { sendCampaignById } from "./campaignService.js";

export async function sendIncompleteBaselineReminders() {

  const oneDayAgo = new Date(
    Date.now() - 24 * 60 * 60 * 1000
  );


  const sessions = await prisma.assessmentSession.findMany({
  where: {
    kind: "hb_baseline",
    status: "in_progress",
    updatedAt: {
      lt: oneDayAgo,
    },
    user: {
      deviceTokens: {
        some: {
          isActive: true,
        },
      },
    },
  },
    select: {
      userId: true,
    },
  });


  let sent = 0;
  let skipped = 0;
  let failed = 0;


  for (const session of sessions) {

    try {

      const alreadySent =
        await prisma.notification.findFirst({
          where: {
            userId: session.userId,
            type: "assessment",
            data: {
              path: ["reason"],
              equals: "baseline_incomplete",
            },
            createdAt: {
            gte: oneDayAgo,
            },
          },
        });


      if (alreadySent) {
        skipped++;
        continue;
      }


      const result = await createAndSendNotification({
        userId: session.userId,
        type: "assessment",
        title: "آزمون شکست عاطفیت ناتموم مونده",
        body:
        "این آزمون رو شروع کردی اما کاملش نکردی. چند دقیقه وقت بذار تا بفهمی جدایی چه اثری روی تو گذاشته و قدم بعدی مناسب رو پیدا کنی.\n\nدر ضمن اگه میخوای از اول شروع کنی، از بخش پروفایل و ویرایش پروفایل می‌تونی از صفر شروع کنی.",
        data: {
          reason: "baseline_incomplete",
        },
      });


      if (
        result.pushResult?.ok &&
        result.pushResult.successCount > 0
      ) {
        sent++;
      } else {
        failed++;

        console.log("[BASELINE_REMINDER_FAILED]", {
          userId: session.userId,
          pushResult: result.pushResult,
        });
      }


    } catch (error) {

      failed++;

      console.error(
        "[BASELINE_REMINDER_ERROR]",
        {
          userId: session.userId,
          error: error?.message || error,
        }
      );

    }

  }


  return {
    found: sessions.length,
    sent,
    skipped,
    failed,
  };
}

export async function sendPelekanIntroReminders() {
  const oneDayAgo = new Date(
    Date.now() - 24 * 60 * 60 * 1000
  );

  const progressRows = await prisma.pelekanProgress.findMany({
    where: {
      bastanIntroAudioStartedAt: null,
      bastanIntroAudioCompletedAt: null,
      lastActiveAt: {
        lt: oneDayAgo,
      },
      user: {
  assessmentSessions: {
    some: {
      kind: "hb_baseline",
      status: "completed",
    },
  },
  deviceTokens: {
    some: {
      isActive: true,
    },
  },
},
    },
    select: {
      userId: true,
    },
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const progress of progressRows) {
    try {
      const alreadySent = await prisma.notification.findFirst({
        where: {
          userId: progress.userId,
          type: "pelekan",
          data: {
            path: ["reason"],
            equals: "pelekan_intro_not_started",
          },
          createdAt: {
            gte: oneDayAgo,
          },
        },
      });

      if (alreadySent) {
        skipped++;
        continue;
      }

      const result = await createAndSendNotification({
        userId: progress.userId,
        type: "pelekan",
        title: "مسیر درمانت منتظرته",
        body:
          "آزمون شکست عاطفی رو کامل کردی، اما هنوز معرفی مسیر درمان رو گوش ندادی. چند دقیقه وقت بذار و ببین ققنوس قراره چطور قدم‌به‌قدم همراهت باشه.",
        data: {
          reason: "pelekan_intro_not_started",
        },
      });

      if (
        result.pushResult?.ok &&
        result.pushResult.successCount > 0
      ) {
        sent++;
      } else {
        failed++;

        console.log("[PELEKAN_INTRO_REMINDER_FAILED]", {
          userId: progress.userId,
          pushResult: result.pushResult,
        });
      }
    } catch (error) {
      failed++;

      console.error("[PELEKAN_INTRO_REMINDER_ERROR]", {
        userId: progress.userId,
        error: error?.message || error,
      });
    }
  }

  return {
    found: progressRows.length,
    sent,
    skipped,
    failed,
  };
}

export async function sendTreatmentStartReminders() {
  const oneDayAgo = new Date(
    Date.now() - 24 * 60 * 60 * 1000
  );

  const now = new Date();

  const progressRows = await prisma.pelekanProgress.findMany({
    where: {
      bastanIntroAudioCompletedAt: {
        not: null,
        lt: oneDayAgo,
      },

      bastanUnlockedAt: null,

      user: {
        deviceTokens: {
          some: {
            isActive: true,
          },
        },

        OR: [
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
        ],
      },
    },

    select: {
      userId: true,
      bastanIntroAudioCompletedAt: true,
    },
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const progress of progressRows) {
    try {
      const alreadySent = await prisma.notification.findFirst({
        where: {
          userId: progress.userId,
          type: "pelekan",
          data: {
            path: ["reason"],
            equals: "treatment_not_started",
          },
          createdAt: {
            gte: oneDayAgo,
          },
        },
      });

      if (alreadySent) {
        skipped++;
        continue;
      }

      const result = await createAndSendNotification({
        userId: progress.userId,
        type: "pelekan",
        title: "وقتشه درمانت رو شروع کنی",
        body:
        "با فعال کردن اشتراک، مسیر درمان قدم‌به‌قدم ققنوس برات باز میشه؛ در «پناه» بدون محدودیت با درمانگر در ارتباطی و «پناهگاه» هم برای لحظه‌های سخت و اورژانسی کنارت خواهد بود.",
        data: {
          reason: "treatment_not_started",
        },
      });

      if (
        result.pushResult?.ok &&
        result.pushResult.successCount > 0
      ) {
        sent++;
      } else {
        failed++;

        console.log("[TREATMENT_START_REMINDER_FAILED]", {
          userId: progress.userId,
          pushResult: result.pushResult,
        });
      }
    } catch (error) {
      failed++;

      console.error("[TREATMENT_START_REMINDER_ERROR]", {
        userId: progress.userId,
        error: error?.message || error,
      });
    }
  }

  return {
    found: progressRows.length,
    sent,
    skipped,
    failed,
  };
}

export async function sendScheduledCampaigns() {
  const now = new Date();

  const campaigns =
    await prisma.notificationCampaign.findMany({
      where: {
        status: "scheduled",
        scheduledAt: {
          lte: now,
        },
      },
      select: {
        id: true,
      },
    });


  let sent = 0;
  let failed = 0;


  for (const campaign of campaigns) {
    try {

      const result =
        await sendCampaignById(campaign.id);


      if (
        result.sent > 0 ||
        result.targetCount === 0
      ) {
        sent++;
      } else {
        failed++;
      }


      console.log(
        "[SCHEDULED_CAMPAIGN_SENT]",
        {
          campaignId: campaign.id,
          result,
        }
      );


    } catch (error) {

      failed++;

      console.error(
        "[SCHEDULED_CAMPAIGN_FAILED]",
        {
          campaignId: campaign.id,
          error:
            error?.message || error,
        }
      );

    }
  }


  return {
    found: campaigns.length,
    sent,
    failed,
  };
}