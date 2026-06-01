const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedGosastanTasksDay3() {
  const day = await prisma.pelekanDay.findUnique({
    where: { globalDayNumber: 11 },
  });

  if (!day) {
    throw new Error('Gosastan day 3 not found. Please run seed-gosastan-days first.');
  }

  const tasks = [
    {
      code: 'gosastan_day3_feelings_log',
      titleFa: 'ثبت حال و هیجانات روز',
      sortOrder: 1,
      weightPercent: 15,
      xpReward: 10,
      isRequired: true,
    },
    {
      code: 'gosastan_day3_morning_routine',
      titleFa: 'روتین صبحگاهی',
      sortOrder: 2,
      weightPercent: 15,
      xpReward: 10,
      isRequired: true,
    },
    {
      code: 'gosastan_day3_daily_commitment',
      titleFa: 'تعهد روزانه',
      sortOrder: 3,
      weightPercent: 14,
      xpReward: 10,
      isRequired: true,
    },
    {
      code: 'gosastan_day3_safe_place',
      titleFa: 'پناهگاه',
      sortOrder: 4,
      weightPercent: 0,
      xpReward: 5,
      isRequired: false,
    },
    {
      code: 'gosastan_day3_daily_meditation',
      titleFa: 'مراقبه اختصاصی روز',
      sortOrder: 5,
      weightPercent: 14,
      xpReward: 10,
      isRequired: true,
    },
    {
      code: 'gosastan_day3_feel_good_task',
      titleFa: 'کار حال خوب کن',
      sortOrder: 6,
      weightPercent: 0,
      xpReward: 5,
      isRequired: false,
    },
    {
      code: 'gosastan_day3_torch',
      titleFa: 'مشعل',
      sortOrder: 7,
      weightPercent: 14,
      xpReward: 10,
      isRequired: true,
    },
    {
      code: 'gosastan_day3_technique_1',
      titleFa: 'تکنیک اختصاصی اول',
      sortOrder: 8,
      weightPercent: 14,
      xpReward: 10,
      isRequired: true,
    },
    {
      code: 'gosastan_day3_technique_2',
      titleFa: 'تکنیک اختصاصی دوم',
      sortOrder: 9,
      weightPercent: 0,
      xpReward: 5,
      isRequired: false,
    },
    {
      code: 'gosastan_day3_night_routine',
      titleFa: 'روتین شبانگاهی',
      sortOrder: 10,
      weightPercent: 14,
      xpReward: 10,
      isRequired: true,
    },
  ];

  for (const task of tasks) {
    await prisma.pelekanTask.upsert({
      where: { code: task.code },
      update: {
        dayId: day.id,
        titleFa: task.titleFa,
        sortOrder: task.sortOrder,
        weightPercent: task.weightPercent,
        xpReward: task.xpReward,
        isRequired: task.isRequired,
      },
      create: {
        dayId: day.id,
        code: task.code,
        titleFa: task.titleFa,
        sortOrder: task.sortOrder,
        weightPercent: task.weightPercent,
        xpReward: task.xpReward,
        isRequired: task.isRequired,
      },
    });
  }

  console.log('✅ Gosastan day 3 tasks seeded successfully.');
}

module.exports = seedGosastanTasksDay3;

if (require.main === module) {
  seedGosastanTasksDay3()
    .catch((error) => {
      console.error('❌ Error seeding gosastan day 3 tasks:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
