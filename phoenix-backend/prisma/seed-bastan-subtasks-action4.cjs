const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const action = await prisma.bastanActionDefinition.findUnique({
    where: { code: "trigger_detox" },
  });
  if (!action) throw new Error("Action trigger_detox not found");

  const subtasks = [
    {
      key: "TD_1_social_cleanup",
      kind: "checklist",
      titleFa: "پاکسازی شبکه‌های اجتماعی (اکس + محتوای جدایی/بازگشت)",
      helpFa: "علاوه بر اکس: پیج‌های فال/دعا/طلسم/بازگشت معشوق و هر محتوای تحریک‌کننده شکست عشقی را میوت/آنفالو کن.",
      isRequired: true,
      isFree: false,
      sortOrder: 1,
      xpReward: 12,
    },
    {
      key: "TD_2_gallery_cleanup",
      kind: "confirm",
      titleFa: "عکس‌ها/چت‌ها را آرشیو کردم یا از دسترس خارج کردم",
      helpFa: "حذف لازم نیست؛ هدف: کاهش محرک",
      isRequired: true,
      isFree: false,
      sortOrder: 2,
      xpReward: 10,
    },
    {
      key: "TD_3_places_playlist",
      kind: "form",
      titleFa: "۳ محرک اصلی من چیست؟ (مکان/آهنگ/عطر/ساعت/اکانت/...)",
      helpFa: null,
      isRequired: true,
      isFree: false,
      sortOrder: 3,
      xpReward: 10,
    },
    {
      key: "TD_4_if_then_plan",
      kind: "form",
      titleFa: "اگر محرک دیدم، دقیقاً چه می‌کنم؟ (پلن ۳ مرحله‌ای)",
      helpFa: "۱) توقف ۱۰ ثانیه ۲) تنفس ۴-۶ ۳) جایگزین عملی",
      isRequired: true,
      isFree: false,
      sortOrder: 4,
      xpReward: 10,
    },
    {
      key: "TD_5_home_object",
      kind: "choice",
      titleFa: "با یادگاری‌های فیزیکی چی کار می‌کنی؟",
      helpFa: "جمع و بسته‌بندی (فقط چیزهای قابل جمع‌کردن) / می‌سپارم به دوست / می‌برم انبار / برمی‌گردانم به خودش / فعلاً دست نمی‌زنم",
      isRequired: false,
      isFree: false,
      sortOrder: 5,
      xpReward: 5,
    },
    {
      key: "TD_6_detox_confirm",
      kind: "confirm",
      titleFa: "متعهد می‌شوم ۷ روز محرک‌زدایی را حفظ کنم",
      helpFa: null,
      isRequired: true,
      isFree: false,
      sortOrder: 6,
      xpReward: 5,
    },
  ];

  for (const s of subtasks) {
    await prisma.bastanSubtaskDefinition.upsert({
      where: { actionId_key: { actionId: action.id, key: s.key } },
      create: { ...s, actionId: action.id },
      update: {
        kind: s.kind,
        titleFa: s.titleFa,
        helpFa: s.helpFa,
        isRequired: s.isRequired,
        isFree: s.isFree,
        sortOrder: s.sortOrder,
        xpReward: s.xpReward,
      },
    });
  }

  const n = await prisma.bastanSubtaskDefinition.count({
    where: { actionId: action.id },
  });
  console.log("Seeded Trigger Detox subtasks. Count =", n);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });