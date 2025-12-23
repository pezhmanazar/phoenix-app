const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const action = await prisma.bastanActionDefinition.findUnique({
    where: { code: "closure_ritual" },
  });
  if (!action) throw new Error("Action closure_ritual not found");

  const subtasks = [
    {
      key: "CR_1_choose_ritual",
      kind: "choice",
      titleFa: "کدام آیین بستن را انتخاب می‌کنی؟",
      helpFa:
        "قبل از انتخاب، متن راهنما را بخوان و صوت کوتاه را گوش بده.\nهدف آیین، بازگشت نیست؛ پایان دادن آگاهانه است.\nگزینه‌ها: پیاده‌روی و خداحافظی ذهنی / نوشتن و پاره‌کردن کاغذ / جعبه بستن و جمع‌کردن / دعا یا مدیتیشن بدون درخواست بازگشت",
      isRequired: true,
      isFree: false,
      sortOrder: 1,
      xpReward: 10,
    },
    {
      key: "CR_2_do_ritual",
      kind: "confirm",
      titleFa: "آیین را انجام دادم",
      helpFa: "لازم نیست کامل باشه؛ انجامش مهمه",
      isRequired: true,
      isFree: false,
      sortOrder: 2,
      xpReward: 10,
    },
    {
      key: "CR_3_after_feeling",
      kind: "text",
      titleFa: "بعد از آیین چه احساسی داشتی؟ (۳ جمله)",
      helpFa: null,
      isRequired: false,
      isFree: false,
      sortOrder: 3,
      xpReward: 5,
    },
    {
      key: "CR_4_close_confirm_with_date",
      kind: "confirm",
      titleFa: "می‌پذیرم این فصل بسته شد",
      helpFa: "با تأیید این مرحله، تاریخ بستن امروز ثبت می‌شود",
      isRequired: true,
      isFree: false,
      sortOrder: 4,
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
  console.log("Seeded Closure Ritual subtasks. Count =", n);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });