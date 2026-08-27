import prisma from "../../utils/prisma.js";
import { createAndSendNotification } from "./notificationService.js";
import { sendCampaignById } from "./campaignService.js";

export async function sendIncompleteBaselineReminders() {
  const oneDayAgo = new Date(
    Date.now() - 24 * 60 * 60 * 1000,
  );

  const sessions =
    await prisma.assessmentSession.findMany({
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

  const reminderMessages = [
    {
      title: "آزمون شکست عاطفیت ناتموم مونده",
      body:
        "چند دقیقه دیگه وقت بذار و آزمونت رو کامل کن تا تصویر دقیق‌تری از وضعیتت داشته باشیم و مسیر مناسب‌تری برات مشخص بشه.",
    },
    {
      title: "برگرد و آزمونت رو کامل کن",
      body:
        "بخشی از آزمون اولیه‌ات باقی مونده. نتیجه نهایی وقتی دقیق‌تره که سؤال‌ها رو تا آخر ادامه بدی.",
    },
    {
      title: "یه قدم نیمه‌کاره داری",
      body:
        "آزمون اولیه‌ات هنوز کامل نشده. اگه هنوز می‌خوای مسیر ققنوس رو ادامه بدی، از همون جایی که موندی برگرد.",
    },
  ];

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const session of sessions) {
    try {
      /*
       * تعداد کل Reminderهایی که قبلاً
       * برای همین وضعیت به کاربر ارسال شده.
       *
       * بعد از 3 بار دیگر مزاحمش نمی‌شویم.
       */
      const previousReminderCount =
        await prisma.notification.count({
          where: {
            userId: session.userId,
            type: "assessment",
            data: {
              path: ["reason"],
              equals: "baseline_incomplete",
            },
          },
        });

      if (
        previousReminderCount >=
        reminderMessages.length
      ) {
        skipped++;
        continue;
      }

      /*
       * حتی اگر هنوز به سقف 3 نرسیده،
       * در هر 24 ساعت بیشتر از یک بار
       * Reminder ارسال نکن.
       */
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

      const message =
        reminderMessages[
          Math.min(
            previousReminderCount,
            reminderMessages.length - 1,
          )
        ];

      const result =
        await createAndSendNotification({
          userId: session.userId,
          type: "assessment",
          title: message.title,
          body: message.body,
          data: {
            reason: "baseline_incomplete",

            /*
             * Notification Center و Push
             * هر دو کاربر را مستقیم
             * به ادامه Baseline می‌برند.
             */
            route:
              "/(tabs)/Pelekan?autoStart=baseline",

            /*
             * برای Analytics و Debug آینده.
             * 1 / 2 / 3
             */
            reminderNumber:
              previousReminderCount + 1,
          },
        });

      if (
        result.pushResult?.ok &&
        result.pushResult.successCount > 0
      ) {
        sent++;
      } else {
        failed++;

        console.log(
          "[BASELINE_REMINDER_FAILED]",
          {
            userId: session.userId,
            reminderNumber:
              previousReminderCount + 1,
            pushResult: result.pushResult,
          },
        );
      }
    } catch (error) {
      failed++;

      console.error(
        "[BASELINE_REMINDER_ERROR]",
        {
          userId: session.userId,
          error: error?.message || error,
        },
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
    Date.now() - 24 * 60 * 60 * 1000,
  );

  const progressRows =
    await prisma.pelekanProgress.findMany({
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

  const reminderMessages = [
    {
      title: "مسیر درمانت منتظرته",
      body:
        "آزمونت رو کامل کردی. حالا چند دقیقه وقت بذار و مقدمه مسیر درمان رو گوش بده تا بدونی قدم‌های بعدی ققنوس چطور پیش میره.",
    },
    {
      title: "قبل از شروع درمان اینو گوش بده",
      body:
        "مقدمه مسیر هنوز باقی مونده. این بخش کمک می‌کنه بدونی قراره در ققنوس دقیقاً چه مسیری رو طی کنی.",
    },
    {
      title: "آماده‌ای وارد مسیر درمان بشی؟",
      body:
        "فقط مقدمه مسیرت باقی مونده. گوشش بده تا مرحله بعدی ققنوس برات روشن بشه.",
    },
  ];

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const progress of progressRows) {
    try {
      const previousReminderCount =
        await prisma.notification.count({
          where: {
            userId: progress.userId,
            type: "pelekan",
            data: {
              path: ["reason"],
              equals:
                "pelekan_intro_not_started",
            },
          },
        });

      if (
        previousReminderCount >=
        reminderMessages.length
      ) {
        skipped++;
        continue;
      }

      const alreadySent =
        await prisma.notification.findFirst({
          where: {
            userId: progress.userId,
            type: "pelekan",
            data: {
              path: ["reason"],
              equals:
                "pelekan_intro_not_started",
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

      const message =
        reminderMessages[
          Math.min(
            previousReminderCount,
            reminderMessages.length - 1,
          )
        ];

      const result =
        await createAndSendNotification({
          userId: progress.userId,
          type: "pelekan",
          title: message.title,
          body: message.body,
          data: {
            reason:
              "pelekan_intro_not_started",
            route:
              "/pelekan/bastan/intro",
            reminderNumber:
              previousReminderCount + 1,
          },
        });

      if (
        result.pushResult?.ok &&
        result.pushResult.successCount > 0
      ) {
        sent++;
      } else {
        failed++;

        console.log(
          "[PELEKAN_INTRO_REMINDER_FAILED]",
          {
            userId: progress.userId,
            reminderNumber:
              previousReminderCount + 1,
            pushResult:
              result.pushResult,
          },
        );
      }
    } catch (error) {
      failed++;

      console.error(
        "[PELEKAN_INTRO_REMINDER_ERROR]",
        {
          userId: progress.userId,
          error: error?.message || error,
        },
      );
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
    Date.now() - 24 * 60 * 60 * 1000,
  );

  const now = new Date();

  const progressRows =
    await prisma.pelekanProgress.findMany({
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

  const reminderMessages = [
    {
      title: "وقتشه درمانت رو شروع کنی",
      body:
        "آزمون و مقدمه رو پشت سر گذاشتی. با فعال کردن اشتراک می‌تونی وارد مسیر درمان قدم‌به‌قدم ققنوس بشی.",
    },
    {
      title: "مسیر درمانت آماده‌ست",
      body:
        "قدم‌های اولیه رو انجام دادی اما هنوز درمان رو شروع نکردی. با فعال کردن اشتراک، پلکان درمان و امکانات همراهت باز میشن.",
    },
    {
      title: "اگه می‌خوای ادامه بدی، از اینجا شروع کن",
      body:
        "مسیر درمانت آماده‌ست. اشتراک رو فعال کن تا ادامه راه ققنوس برات باز بشه.",
    },
  ];

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const progress of progressRows) {
    try {
      const previousReminderCount =
        await prisma.notification.count({
          where: {
            userId: progress.userId,
            type: "pelekan",
            data: {
              path: ["reason"],
              equals: "treatment_not_started",
            },
          },
        });

      if (
        previousReminderCount >=
        reminderMessages.length
      ) {
        skipped++;
        continue;
      }

      const alreadySent =
        await prisma.notification.findFirst({
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

      const message =
        reminderMessages[
          Math.min(
            previousReminderCount,
            reminderMessages.length - 1,
          )
        ];

      const result =
        await createAndSendNotification({
          userId: progress.userId,
          type: "pelekan",
          title: message.title,
          body: message.body,
          data: {
            reason: "treatment_not_started",
            route: "/(tabs)/Subscription",
            reminderNumber:
              previousReminderCount + 1,
          },
        });

      if (
        result.pushResult?.ok &&
        result.pushResult.successCount > 0
      ) {
        sent++;
      } else {
        failed++;

        console.log(
          "[TREATMENT_START_REMINDER_FAILED]",
          {
            userId: progress.userId,
            reminderNumber:
              previousReminderCount + 1,
            pushResult:
              result.pushResult,
          },
        );
      }
    } catch (error) {
      failed++;

      console.error(
        "[TREATMENT_START_REMINDER_ERROR]",
        {
          userId: progress.userId,
          error: error?.message || error,
        },
      );
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