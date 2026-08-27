import {
  sendIncompleteBaselineReminders,
  sendPelekanIntroReminders,
  sendTreatmentStartReminders,
  sendScheduledCampaigns,
} from "./notificationJobs.js";

const ONE_HOUR_MS = 60 * 60 * 1000;
const CAMPAIGN_INTERVAL_MS = 5 * 60 * 1000;

let schedulerTimer = null;
let campaignTimer = null;
let isRunning = false;

async function runNotificationJobs() {
  if (isRunning) {
    console.log(
      "[NOTIFICATION_SCHEDULER] skipped because previous run is still active",
    );
    return;
  }

  isRunning = true;

  console.log("[NOTIFICATION_SCHEDULER] baseline reminder job started");

  try {
    const result = await sendIncompleteBaselineReminders();

    console.log("[NOTIFICATION_SCHEDULER] baseline reminder job finished", {
      found: result.found,
      sent: result.sent,
      skipped: result.skipped,
      failed: result.failed,
    });
    console.log("[NOTIFICATION_SCHEDULER] pelekan intro reminder job started");

    const pelekanIntroResult = await sendPelekanIntroReminders();

    console.log(
      "[NOTIFICATION_SCHEDULER] pelekan intro reminder job finished",
      {
        found: pelekanIntroResult.found,
        sent: pelekanIntroResult.sent,
        skipped: pelekanIntroResult.skipped,
        failed: pelekanIntroResult.failed,
      },
    );
    console.log(
      "[NOTIFICATION_SCHEDULER] treatment start reminder job started",
    );

    const treatmentStartResult = await sendTreatmentStartReminders();

    console.log(
      "[NOTIFICATION_SCHEDULER] treatment start reminder job finished",
      {
        found: treatmentStartResult.found,
        sent: treatmentStartResult.sent,
        skipped: treatmentStartResult.skipped,
        failed: treatmentStartResult.failed,
      },
    );
  } catch (error) {
    console.error(
      "[NOTIFICATION_SCHEDULER] reminder jobs error:",
      error?.message || error,
    );
  } finally {
    isRunning = false;
  }
}

export function startNotificationScheduler() {
  if (schedulerTimer) {
    console.log("[NOTIFICATION_SCHEDULER] already started");
    return;
  }

  console.log("[NOTIFICATION_SCHEDULER] started");

  // یک بار هنگام بالا آمدن سرور بررسی می‌کند.
  runNotificationJobs().catch((error) => {
    console.error(
      "[NOTIFICATION_SCHEDULER] initial run error:",
      error?.message || error,
    );
  });

  // سپس هر یک ساعت دوباره شرایط کاربران را بررسی می‌کند.
  schedulerTimer = setInterval(() => {
    runNotificationJobs().catch((error) => {
      console.error(
        "[NOTIFICATION_SCHEDULER] interval run error:",
        error?.message || error,
      );
    });
  }, ONE_HOUR_MS);

  campaignTimer = setInterval(async () => {
    try {
      console.log("[NOTIFICATION_SCHEDULER] scheduled campaign check started");

      const result = await sendScheduledCampaigns();

      console.log(
        "[NOTIFICATION_SCHEDULER] scheduled campaign check finished",
        result,
      );
    } catch (error) {
      console.error(
        "[NOTIFICATION_SCHEDULER] scheduled campaign error:",
        error?.message || error,
      );
    }
  }, CAMPAIGN_INTERVAL_MS);
}
