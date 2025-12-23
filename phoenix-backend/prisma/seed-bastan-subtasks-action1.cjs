const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const action = await prisma.bastanActionDefinition.findUnique({
    where: { code: "reality_check" },
  });
  if (!action) throw new Error("Action reality_check not found");

  const subtasks = [
    {
      key: "RC_1_red_flags",
      kind: "checklist",
      titleFa: "۱۰ پرچم قرمز رابطه‌ات را تیک بزن",
      helpFa: null,
      isRequired: true,
      isFree: true,
      sortOrder: 1,
      xpReward: 10,
    },
    {
      key: "RC_2_costs",
      kind: "form",
      titleFa: "۳ هزینه‌ای که این رابطه از تو گرفت",
      helpFa: "وقت/سلامت روان/اعتبار/پول/…",
      isRequired: true,
      isFree: true,
      sortOrder: 2,
      xpReward: 10,
    },
    {
      key: "RC_3_reality_vs_fantasy",
      kind: "text",
      titleFa: "واقعیت رابطه vs خیال: ۵ جمله بنویس",
      helpFa: null,
      isRequired: true,
      isFree: true,
      sortOrder: 3,
      xpReward: 10,
    },
    {
      key: "RC_4_deal_breakers",
      kind: "choice",
      titleFa: "اگر دوستت همین رابطه را داشت، به او می‌گفتی ادامه بده؟",
      helpFa: "ادامه بده / تمامش کن / مطمئن نیستم",
      isRequired: false,
      isFree: true,
      sortOrder: 4,
      xpReward: 5,
    },
    {
      key: "RC_5_commit_confirm",
      kind: "confirm",
      titleFa: "تأیید می‌کنم امروز واقعیت را دیدم، نه توهم را",
      helpFa: null,
      isRequired: true,
      isFree: true,
      sortOrder: 5,
      xpReward: 5,
    },
  ];

  for (const s of subtasks) {
    await prisma.bastanSubtaskDefinition.upsert({
      where: { key: s.key },
      create: { ...s, actionId: action.id },
      update: { ...s },
    });
  }

  const n = await prisma.bastanSubtaskDefinition.count({
    where: { actionId: action.id },
  });
  console.log("Seeded Reality Check subtasks. Count =", n);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });