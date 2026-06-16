
//phoenix-app\phoenix-backend\prisma\seeds\sookhtan\seed-sookhtan-tasks-all.cjs
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * اینجا تسک‌های پایه روزهای سوختن تعریف می‌شوند.
 * همه روزها به صورت پیش‌فرض همین ساختار را دارند.
 */
function buildBaseTasks(dayNumber) {
  return [
    {
      key: 'feelings_log',
      titleFa: 'ثبت حال و هیجانات ابتدای روز',
      suggestedTimeFa: 'صبح',
      sortOrder: 1,
      weightPercent: 15,
      xpReward: 10,
      isRequired: true,
    },
    {
      key: 'morning_routine',
      titleFa: 'روتین صبحگاهی',
      suggestedTimeFa: 'صبح',
      sortOrder: 2,
      weightPercent: 15,
      xpReward: 10,
      isRequired: true,
    },
    {
      key: 'daily_commitment',
      titleFa: 'تعهد روزانه',
      suggestedTimeFa: 'صبح',
      sortOrder: 3,
      weightPercent: 14,
      xpReward: 10,
      isRequired: true,
    },
    {
      key: 'safe_place',
      titleFa: 'پناهگاه',
      suggestedTimeFa: 'در لحظه بحران',
      sortOrder: 4,
      weightPercent: 0,
      xpReward: 5,
      isRequired: false,
    },
    {
      key: 'daily_meditation',
      titleFa: 'مراقبه اختصاصی روز',
      suggestedTimeFa: 'ظهر یا عصر',
      sortOrder: 5,
      weightPercent: 14,
      xpReward: 10,
      isRequired: true,
    },
    {
      key: 'feel_good_task',
      titleFa: 'کار حال خوب کن',
      suggestedTimeFa: 'عصر',
      sortOrder: 6,
      weightPercent: 0,
      xpReward: 5,
      isRequired: false,
    },
    {
      key: 'torch',
      titleFa: 'مشعل',
      suggestedTimeFa: 'عصر',
      sortOrder: 7,
      weightPercent: 14,
      xpReward: 10,
      isRequired: true,
    },
    {
      key: 'technique_1',
      titleFa: 'تکنیک اختصاصی اول',
      suggestedTimeFa: 'عصر یا غروب',
      sortOrder: 8,
      weightPercent: 14,
      xpReward: 10,
      isRequired: true,
    },
    {
      key: 'technique_2',
      titleFa: 'تکنیک اختصاصی دوم',
      suggestedTimeFa: 'اختیاری در طول روز',
      sortOrder: 9,
      weightPercent: 0,
      xpReward: 5,
      isRequired: false,
    },
    {
      key: 'no_contact_check',
      titleFa: 'بررسی قاعده قطع تماس',
      suggestedTimeFa: 'قبل از روتین شبانگاهی',
      sortOrder: 10,
      weightPercent: 5,
      xpReward: 5,
      isRequired: true,
    },
    {
      key: 'night_routine',
      titleFa: 'روتین شبانگاهی',
      suggestedTimeFa: 'شب قبل از خواب',
      sortOrder: 11,
      weightPercent: 9,
      xpReward: 10,
      isRequired: true,
    },
  ];
}

/**
 * اینجا تغییرات مخصوص روزهای خاص را تعریف می‌کنیم.
 *
 * فعلاً خالی است، چون گفتی روز ۱ تا ۱۴ یک‌شکل هستند.
 *
 * بعداً اگر خواستی یک روز خاص را تغییر بدهی، فقط همینجا تغییر می‌دهیم.
 */
const dayOverrides = {
  /*
  7: {
    update: {
      technique_1: {
        titleFa: 'تکنیک اختصاصی متفاوت روز هفتم',
        xpReward: 15,
      },
      technique_2: {
        titleFa: 'تکنیک دوم متفاوت روز هفتم',
      },
    },
  },

  14: {
    remove: ['feel_good_task'],

    add: [
      {
        key: 'final_reflection',
        titleFa: 'جمع‌بندی پایانی مرحله سوختن',
        suggestedTimeFa: 'شب',
        sortOrder: 12,
        weightPercent: 0,
        xpReward: 10,
        isRequired: false,
      },
    ],
  },
  */
};

/**
 * این تابع تغییرات روز خاص را روی تسک‌های پایه اعمال می‌کند.
 */
function applyDayOverride(dayNumber, tasks) {
  const override = dayOverrides[dayNumber];

  if (!override) {
    return tasks;
  }

  let finalTasks = [...tasks];

  // حذف تسک‌های خاص از یک روز
  if (Array.isArray(override.remove)) {
    finalTasks = finalTasks.filter((task) => !override.remove.includes(task.key));
  }

  // ویرایش تسک‌های موجود در یک روز
  if (override.update) {
    finalTasks = finalTasks.map((task) => {
      const taskUpdate = override.update[task.key];

      if (!taskUpdate) {
        return task;
      }

      return {
        ...task,
        ...taskUpdate,
      };
    });
  }

  // اضافه کردن تسک جدید به یک روز
  if (Array.isArray(override.add)) {
    finalTasks = [...finalTasks, ...override.add];
  }

  return finalTasks;
}

/**
 * این تابع کد نهایی هر تسک را می‌سازد.
 * مثال:
 * sookhtan_day1_technique_1
 */
function attachTaskCodes(dayNumber, tasks) {
  return tasks.map((task) => ({
    ...task,
    code: `sookhtan_day${dayNumber}_${task.key}`,
  }));
}

/**
 * این تابع تسک‌های نهایی هر روز را می‌سازد.
 */
function buildTasks(dayNumber) {
  const baseTasks = buildBaseTasks(dayNumber);
  const overriddenTasks = applyDayOverride(dayNumber, baseTasks);
  return attachTaskCodes(dayNumber, overriddenTasks);
}

async function seedSookhtanTasksAll() {
  for (let dayNumber = 1; dayNumber <= 14; dayNumber++) {
    const globalDayNumber = 13 + dayNumber;

    const day = await prisma.pelekanDay.findUnique({
      where: { globalDayNumber },
    });

    if (!day) {
      throw new Error(
        `Sookhtan day ${dayNumber} not found (globalDayNumber: ${globalDayNumber}). Please run seed-sookhtan-days first.`
      );
    }

    const tasks = buildTasks(dayNumber);

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

    console.log(`✅ Sookhtan day ${dayNumber} tasks seeded successfully.`);
  }

  console.log('🔥 All sookhtan tasks for days 1 to 14 seeded successfully.');
}

module.exports = seedSookhtanTasksAll;

if (require.main === module) {
  seedSookhtanTasksAll()
    .catch((error) => {
      console.error('❌ Error seeding all sookhtan tasks:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
