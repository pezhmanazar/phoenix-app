import 'dotenv/config';
import prisma from '../utils/prisma.js';

async function main() {
  const stages = await prisma.pelekanStage.findMany({
    orderBy: { sortOrder: 'asc' },
    select: { id: true, code: true, titleFa: true, sortOrder: true },
  });

  const maxDay = await prisma.pelekanDay.aggregate({
    _max: { globalDayNumber: true },
  });

  let nextGlobal = (maxDay._max.globalDayNumber || 0) + 1;

  for (const st of stages) {
    let day = await prisma.pelekanDay.findFirst({
      where: { stageId: st.id, dayNumberInStage: 1 },
      select: { id: true },
    });

    if (!day) {
      day = await prisma.pelekanDay.create({
        data: {
          stageId: st.id,
          dayNumberInStage: 1,
          globalDayNumber: nextGlobal++,
          title: 'روز ۱',
          description: `شروع مرحله ${st.titleFa}`,
          requiredPercent: 70,
        },
        select: { id: true },
      });
    }

    const taskCount = await prisma.pelekanTask.count({
      where: { dayId: day.id },
    });

    if (taskCount === 0) {
      await prisma.pelekanTask.create({
        data: {
          dayId: day.id,
          titleFa: 'تسک نمونه',
          description: 'این فقط برای تست است',
          sortOrder: 1,
          weightPercent: 100,
          xpReward: 10,
          isRequired: true,
        },
      });
    }
  }

  const report = await prisma.pelekanDay.findMany({
    orderBy: { globalDayNumber: 'asc' },
    select: {
      globalDayNumber: true,
      dayNumberInStage: true,
      title: true,
      stage: { select: { code: true, titleFa: true } },
    },
  });

  console.log('DAYS NOW:', report);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
