const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const action = await prisma.bastanActionDefinition.findUnique({
    where: { code: "meaning_learning" },
  });
  if (!action) throw new Error("Action meaning_learning not found");

  const subtasks = [
    {
      key: "ML_1_what_did_i_learn",
      kind: "text",
      titleFa: "این رابطه چه درسی به من داد؟ (۳ نکته واقعی)",
      helpFa: null,
      isRequired: true,
      isFree: false,
      sortOrder: 1,
      xpReward: 12,
    },
    {
      key: "ML_2_pattern_awareness",
      kind: "choice",
      titleFa: "کدام الگو را باید آگاهانه متوقف کنم؟",
      helpFa: "تعقیب هیجانی / نادیده‌گرفتن مرزها / ایده‌آل‌سازی / نجات‌دادن / انتخاب‌های عجولانه / نمی‌دانم",
      isRequired: false,
      isFree: false,
      sortOrder: 2,
      xpReward: 5,
    },
    {
      key: "ML_3_values_next_time",
      kind: "form",
      titleFa: "۳ ارزش غیرقابل‌مذاکره من در رابطه بعدی",
      helpFa: null,
      isRequired: true,
      isFree: false,
      sortOrder: 3,
      xpReward: 10,
    },
    {
      key: "ML_4_golden_rule",
      kind: "text",
      titleFa: "اصل طلایی شخصی من در رابطه چیست؟",
      helpFa: "مثال: عشق بدون احترام = خطر",
      isRequired: true,
      isFree: false,
      sortOrder: 4,
      xpReward: 10,
    },
    {
      key: "ML_5_learning_confirm",
      kind: "confirm",
      titleFa: "می‌پذیرم این تجربه قرار بود چیزی به من یاد بدهد",
      helpFa: null,
      isRequired: true,
      isFree: false,
      sortOrder: 5,
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
  console.log("Seeded Meaning & Learning subtasks. Count =", n);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });