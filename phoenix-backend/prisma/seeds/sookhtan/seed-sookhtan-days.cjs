// phoenix-backend/prisma/seeds/sookhtan/seed-sookhtan-days.cjs
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedSookhtanDays() {
  const stage = await prisma.pelekanStage.upsert({
    where: { code: 'sookhtan' },
    update: { titleFa: 'سوختن', sortOrder: 3 },
    create: { code: 'sookhtan', titleFa: 'سوختن', sortOrder: 3 },
  });


  const days = [
  {
    globalDayNumber: 14,
    dayNumberInStage: 1,
    title: 'روز اول سوختن',
    description: 'ورود به مرحله سوختن و آغاز مواجهه آگاهانه با درد و آشفتگی',
    requiredPercent: 70,
  },
  {
    globalDayNumber: 15,
    dayNumberInStage: 2,
    title: 'روز دوم سوختن',
    description: 'مشاهده دقیق‌تر احساسات و کاهش واکنش‌های تکانه‌ای در طول روز',
    requiredPercent: 70,
  },
  {
    globalDayNumber: 16,
    dayNumberInStage: 3,
    title: 'روز سوم سوختن',
    description: 'شناخت محرک‌های ذهنی و هیجانی و تمرین مکث پیش از واکنش',
    requiredPercent: 70,
  },
  {
    globalDayNumber: 17,
    dayNumberInStage: 4,
    title: 'روز چهارم سوختن',
    description: 'تمرکز بر تحمل هیجان و عبور تدریجی از آشفتگی‌های لحظه‌ای',
    requiredPercent: 70,
  },
  {
    globalDayNumber: 18,
    dayNumberInStage: 5,
    title: 'روز پنجم سوختن',
    description: 'تقویت ثبات روزانه و بازگرداندن توجه از گذشته به اکنون',
    requiredPercent: 70,
  },
  {
    globalDayNumber: 19,
    dayNumberInStage: 6,
    title: 'روز ششم سوختن',
    description: 'تمرین رها کردن نشخوار ذهنی و مشاهده افکار بدون درگیر شدن با آن‌ها',
    requiredPercent: 70,
  },
  {
    globalDayNumber: 20,
    dayNumberInStage: 7,
    title: 'روز هفتم سوختن',
    description: 'عبور از میانه مسیر با تکیه بر آگاهی، تعهد و مراقبت از خود',
    requiredPercent: 70,
  },
  {
    globalDayNumber: 21,
    dayNumberInStage: 8,
    title: 'روز هشتم سوختن',
    description: 'بازشناسی الگوهای فرساینده و انتخاب پاسخ‌های سالم‌تر در لحظه',
    requiredPercent: 70,
  },
  {
    globalDayNumber: 22,
    dayNumberInStage: 9,
    title: 'روز نهم سوختن',
    description: 'تقویت پیوند با خود و ادامه مسیر با پذیرش و صداقت درونی',
    requiredPercent: 70,
  },
  {
    globalDayNumber: 23,
    dayNumberInStage: 10,
    title: 'روز دهم سوختن',
    description: 'تمرین بازگشت به بدن، تنفس و زمان حال هنگام اوج‌گیری احساسات',
    requiredPercent: 70,
  },
  {
    globalDayNumber: 24,
    dayNumberInStage: 11,
    title: 'روز یازدهم سوختن',
    description: 'کاهش وابستگی به الگوهای قدیمی و ساختن پاسخ‌های تازه و آگاهانه',
    requiredPercent: 70,
  },
  {
    globalDayNumber: 25,
    dayNumberInStage: 12,
    title: 'روز دوازدهم سوختن',
    description: 'مرور تغییرات درونی و دیدن نشانه‌های رشد در دل رنج',
    requiredPercent: 70,
  },
  {
    globalDayNumber: 26,
    dayNumberInStage: 13,
    title: 'روز سیزدهم سوختن',
    description: 'آماده‌سازی برای جمع‌بندی مرحله و مشاهده مسیر طی‌شده',
    requiredPercent: 70,
  },
  {
    globalDayNumber: 27,
    dayNumberInStage: 14,
    title: 'روز چهاردهم سوختن',
    description: 'جمع‌بندی مرحله سوختن، مرور مسیر و آمادگی برای ارزیابی دوباره حال درونی',
    requiredPercent: 70,
  },
];


  for (const day of days) {
    await prisma.pelekanDay.upsert({
      where: { globalDayNumber: day.globalDayNumber },
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
  console.log('✅ Sookhtan stage and 14 days seeded successfully.');
}

module.exports = seedSookhtanDays;
