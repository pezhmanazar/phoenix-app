import prisma from "../../utils/prisma.js";
import { createAndSendNotification } from "./notificationService.js";


export async function sendIncompleteBaselineReminders() {

  const users = await prisma.assessmentSession.findMany({
    where: {
      kind: "hb_baseline",
      status: "in_progress",
      updatedAt: {
        lt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    },
    select: {
      userId: true,
    },
  });


  for (const session of users) {

    await createAndSendNotification({
      userId: session.userId,
      type: "assessment",
      title: "ارزیابی اولیه‌ات کامل نشده",
      body: "چند دقیقه زمان بگذار و ارزیابی اولیه رو ادامه بده تا مسیر مناسب تو مشخص بشه.",
      data: {
        screen: "baseline",
      },
    });

  }

}