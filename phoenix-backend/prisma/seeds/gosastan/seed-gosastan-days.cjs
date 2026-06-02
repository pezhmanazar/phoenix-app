const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedGosastanDays() {
  const stage = await prisma.pelekanStage.upsert({
    where: {
      code: 'gosastan',
    },
    update: {
      titleFa: 'گسستن',
      sortOrder: 2,
    },
    create: {
      code: 'gosastan',
      titleFa: 'گسستن',
      sortOrder: 2,
    },
  });

  const days = [
    {
      globalDayNumber: 9,
      dayNumberInStage: 1,
      title: 'روز اول گسستن',
      description: 'شروع مرحله گسستن و آگاهی از وضعیت فعلی',
      requiredPercent: 70,
    },
    {
      globalDayNumber: 10,
      dayNumberInStage: 2,
      title: 'روز دوم گسستن',
      description: 'ادامه تمرین‌ها با تمرکز بر ثبات و تعهد روزانه',
      requiredPercent: 70,
    },
    {
      globalDayNumber: 11,
      dayNumberInStage: 3,
      title: 'روز سوم گسستن',
      description: 'تعمیق تمرین‌ها و مشاهده دقیق‌تر الگوهای ذهنی و رفتاری',
      requiredPercent: 70,
    },
    {
      globalDayNumber: 12,
      dayNumberInStage: 4,
      title: 'روز چهارم گسستن',
      description: 'تثبیت مهارت‌ها و تقویت حضور آگاهانه در طول روز',
      requiredPercent: 70,
    },
    {
      globalDayNumber: 13,
      dayNumberInStage: 5,
      title: 'روز پنجم گسستن',
      description: 'جمع‌بندی مرحله و تکمیل مسیر گسستن',
      requiredPercent: 70,
    },
  ];

  for (const day of days) {
    await prisma.pelekanDay.upsert({
      where: {
        globalDayNumber: day.globalDayNumber,
      },
      update: {
        stageId: stage.id,
        dayNumberInStage: day.dayNumberInStage,
        title: day.title,
        description: day.description,
        requiredPercent: day.requiredPercent,
      },
      create: {
        stageId: stage.id,
        globalDayNumber: day.globalDayNumber,
        dayNumberInStage: day.dayNumberInStage,
        title: day.title,
        description: day.description,
        requiredPercent: day.requiredPercent,
      },
    });
  }

  console.log('✅ Gosastan stage and days seeded successfully.');
}

module.exports = seedGosastanDays;

if (require.main === module) {
  seedGosastanDays()
    .catch((error) => {
      console.error('❌ Error seeding gosastan days:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
