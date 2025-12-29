// scripts/seed_unsent_letter_subtasks.cjs
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const action = await prisma.bastanActionDefinition.findUnique({
    where: { code: "unsent_letter" },
  });
  if (!action) throw new Error("Action unsent_letter not found");

  const subtasks = [
    {
      key: "UL_1_letter_write_or_photo",
      kind: "form",
      titleFa: "نامهٔ خداحافظی",
      isRequired: true,
      isFree: false,
      sortOrder: 1,
      xpReward: 12,
    },
    {
      key: "UL_2_no_send_confirm",
      kind: "confirm",
      titleFa: "تعهدنامه عدم ارسال",
      isRequired: true,
      isFree: false,
      sortOrder: 2,
      xpReward: 5,
    },
    {
      key: "UL_3_72h_lock_confirm",
      kind: "confirm",
      titleFa: "تعهدنامه 72 ساعته عدم تکانه هیجانی",
      isRequired: true,
      isFree: false,
      sortOrder: 3,
      xpReward: 5,
    },
    {
      key: "UL_4_store_ritual",
      kind: "choice",
      titleFa: "آیین نگه‌داری یا رها کردن نامه",
      isRequired: false,
      isFree: false,
      sortOrder: 4,
      xpReward: 5,
    },
  ];

  for (const s of subtasks) {
    await prisma.bastanSubtaskDefinition.upsert({
      where: { actionId_key: { actionId: action.id, key: s.key } },
      create: {
        actionId: action.id,
        key: s.key,
        kind: s.kind,
        titleFa: s.titleFa,
        helpFa: null, // طبق درخواست: هیچ helpFa نداشته باشیم
        isRequired: s.isRequired,
        isFree: s.isFree,
        sortOrder: s.sortOrder,
        xpReward: s.xpReward,
      },
      update: {
        kind: s.kind,
        titleFa: s.titleFa,
        helpFa: null, // طبق درخواست: پاک/نول شود
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

  console.log("Seeded Unsent Letter subtasks. Count =", n);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });