import prisma from "../utils/prisma.js";

async function main() {
  const stage = await prisma.pelekanStage.upsert({
    where: { code: "bastan" },
    create: { code: "bastan", titleFa: "بستن", sortOrder: 1 },
    update: { titleFa: "بستن", sortOrder: 1 },
  });

  const day = await prisma.pelekanDay.upsert({
    where: { globalDayNumber: 1 },
    create: {
      stageId: stage.id,
      dayNumberInStage: 1,
      globalDayNumber: 1,
      title: "روز ۱",
      description: "شروع پلکان",
      requiredPercent: 70,
    },
    update: {
      stageId: stage.id,
      dayNumberInStage: 1,
      title: "روز ۱",
      description: "شروع پلکان",
      requiredPercent: 70,
    },
  });

  // برای اینکه id ثابت داشته باشیم و دوباره‌کاری هم نکند
  const TASK_ID = "00000000-0000-0000-0000-000000000001";

  await prisma.pelekanTask.upsert({
    where: { id: TASK_ID },
    create: {
      id: TASK_ID,
      dayId: day.id,
      titleFa: "تسک نمونه",
      description: "این فقط برای تست است",
      sortOrder: 1,
      weightPercent: 100,
      xpReward: 10,
      isRequired: true,
    },
    update: {
      dayId: day.id,
      titleFa: "تسک نمونه",
      description: "این فقط برای تست است",
      sortOrder: 1,
      weightPercent: 100,
      xpReward: 10,
      isRequired: true,
    },
  });

  console.log("seed ok:", { stageId: stage.id, dayId: day.id, taskId: TASK_ID });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error("seed error:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
