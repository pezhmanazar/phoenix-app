// phoenix-backend/prisma/seed-bastan-subtasks-action1.cjs
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
    titleFa: "بررسی نشانه‌های هشداردهنده رابطه",
    isRequired: true,
    isFree: true,
    sortOrder: 1,
    xpReward: 30,
  },
  {
    key: "RC_2_costs",
    kind: "form",
    titleFa: "شناسایی هزینه‌های رابطه",
    isRequired: true,
    isFree: true,
    sortOrder: 2,
    xpReward: 10,
  },
  {
    key: "RC_3_reality_vs_fantasy",
    kind: "text",
    titleFa: "تفکیک واقعیت از خیال در رابطه",
    isRequired: true,
    isFree: true,
    sortOrder: 3,
    xpReward: 10,
  },
  {
    key: "RC_4_deal_breakers",
    kind: "choice",
    titleFa: "ارزیابی ادامه یا توقف رابطه",
    isRequired: false,
    isFree: true,
    sortOrder: 4,
    xpReward: 5,
  },
  {
    key: "RC_5_commit_confirm",
    kind: "confirm",
    titleFa: "تأیید پذیرش واقعیت رابطه",
    isRequired: true,
    isFree: true,
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

  const n = await prisma.bastanSubtaskDefinition.count({ where: { actionId: action.id } });
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