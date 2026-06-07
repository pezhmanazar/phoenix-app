const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedGosastanTasksDay2() {
  const day = await prisma.pelekanDay.findUnique({
    where: { globalDayNumber: 10 },
  });

  if (!day) {
    throw new Error('Gosastan day 2 not found. Please run seed-gosastan-days first.');
  }

  const tasks = [
    {
      code: 'gosastan_day2_feelings_log',
      titleFa: 'ثبت حال و هیجانات ابتدای روز',
      suggestedTimeFa: 'صبح',
      sortOrder: 1,
      weightPercent: 15,
      xpReward: 10,
      isRequired: true,
    },
    {
      code: 'gosastan_day2_morning_routine',
      titleFa: 'روتین صبحگاهی',
      suggestedTimeFa: 'صبح',
      sortOrder: 2,
      weightPercent: 15,
      xpReward: 10,
      isRequired: true,
    },
    {
      code: 'gosastan_day2_daily_commitment',
      titleFa: 'تعهد روزانه',
      suggestedTimeFa: 'صبح',
      sortOrder: 3,
      weightPercent: 14,
      xpReward: 10,
      isRequired: true,
    },
    {
      code: 'gosastan_day2_safe_place',
      titleFa: 'پناهگاه',
      suggestedTimeFa: 'در لحظه بحران',
      sortOrder: 4,
      weightPercent: 0,
      xpReward: 5,
      isRequired: false,
    },
    {
      code: 'gosastan_day2_daily_meditation',
      titleFa: 'مراقبه اختصاصی روز',
      suggestedTimeFa: 'ظهر یا عصر',
      sortOrder: 5,
      weightPercent: 14,
      xpReward: 10,
      isRequired: true,
    },
    {
      code: 'gosastan_day2_feel_good_task',
      titleFa: 'کار حال خوب کن',
      suggestedTimeFa: 'عصر',
      sortOrder: 6,
      weightPercent: 0,
      xpReward: 5,
      isRequired: false,
    },
    {
      code: 'gosastan_day2_torch',
      titleFa: 'مشعل',
      suggestedTimeFa: 'عصر',
      sortOrder: 7,
      weightPercent: 14,
      xpReward: 10,
      isRequired: true,
    },
    {
      code: 'gosastan_day2_technique_1',
      titleFa: 'تکنیک اختصاصی اول',
      suggestedTimeFa: 'عصر یا غروب',
      sortOrder: 8,
      weightPercent: 14,
      xpReward: 10,
      isRequired: true,
    },
    {
      code: 'gosastan_day2_technique_2',
      titleFa: 'تکنیک اختصاصی دوم',
      suggestedTimeFa: 'اختیاری در طول روز',
      sortOrder: 9,
      weightPercent: 0,
      xpReward: 5,
      isRequired: false,
    },
    {
      code: 'gosastan_day2_no_contact_check',
      titleFa: 'بررسی قاعده قطع تماس',
      suggestedTimeFa: 'قبل از روتین شبانگاهی',
      sortOrder: 10,
      weightPercent: 5,
      xpReward: 5,
      isRequired: true,
    },
    {
      code: 'gosastan_day2_night_routine',
      titleFa: 'روتین شبانگاهی',
      suggestedTimeFa: 'شب قبل از خواب',
      sortOrder: 11,
      weightPercent: 9,
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
        suggestedTimeFa: task.suggestedTimeFa,
        sortOrder: task.sortOrder,
        weightPercent: task.weightPercent,
        xpReward: task.xpReward,
        isRequired: task.isRequired,
      },
      create: {
        dayId: day.id,
        code: task.code,
        titleFa: task.titleFa,
        suggestedTimeFa: task.suggestedTimeFa,
        sortOrder: task.sortOrder,
        weightPercent: task.weightPercent,
        xpReward: task.xpReward,
        isRequired: task.isRequired,
      },
    });
  }

  console.log('✅ Gosastan day 2 tasks seeded successfully.');
}

module.exports = seedGosastanTasksDay2;

if (require.main === module) {
  seedGosastanTasksDay2()
    .catch((error) => {
      console.error('❌ Error seeding gosastan day 2 tasks:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
