import express from "express";
import { sendIncompleteBaselineReminders } from "../services/notifications/notificationJobs.js";

const router = express.Router();

router.get("/baseline-reminder", async (req, res) => {
  try {
    const result = await sendIncompleteBaselineReminders();

    return res.json({
      ok: true,
      result,
    });

  } catch (e) {
    console.error("[TEST_BASELINE_NOTIFICATION]", e);

    return res.status(500).json({
      ok: false,
      error: e.message,
    });
  }
});

export default router;