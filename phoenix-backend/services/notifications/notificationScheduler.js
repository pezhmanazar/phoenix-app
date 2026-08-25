import { schedule } from "node-cron";
import { sendIncompleteBaselineReminders } from "./notificationJobs.js";

export function startNotificationScheduler() {
  // هر ساعت، دقیقه 5 اجرا می‌شود
  schedule("5 * * * *", async () => {
    console.log(
      "[NOTIFICATION_SCHEDULER] baseline reminder job started"
    );

    try {
      const result = await sendIncompleteBaselineReminders();

      console.log(
        "[NOTIFICATION_SCHEDULER] baseline reminder job finished",
        {
          found: result.found,
          sent: result.sent,
          skipped: result.skipped,
          failed: result.failed,
        }
      );
    } catch (error) {
      console.error(
        "[NOTIFICATION_SCHEDULER] baseline reminder job error:",
        error?.message || error
      );
    }
  });

  console.log("[NOTIFICATION_SCHEDULER] started");
}