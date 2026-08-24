import prisma from "../../utils/prisma.js";
import { createAndSendNotification } from "./notificationService.js";


export async function sendIncompleteBaselineReminders() {

  const sessions = await prisma.assessmentSession.findMany({
    where: {
      kind: "hb_baseline",
      status: "in_progress",
     
    },
    select: {
      userId: true,
    },
  });


  let sent = 0;


  for (const session of sessions) {

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
            gte: new Date(
              new Date().setHours(0,0,0,0)
            ),
          },
        },
      });


    if (alreadySent) continue;


    await createAndSendNotification({
      userId: session.userId,
      type: "assessment",
      title: "آزمونت هنوز کامل نشده",
      body:
        "تو مسیر شناخت بهتر خودت شروع کردی. فقط چند دقیقه زمان لازم داری تا آزمونت رو ادامه بدی.",
      data: {
        reason: "baseline_incomplete",
      },
    });


    sent++;
  }


  return {
    found: sessions.length,
    sent,
  };
}