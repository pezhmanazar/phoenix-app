const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const action = await prisma.bastanActionDefinition.findUnique({
    where: { code: "adult_responsibility" },
  });
  if (!action) throw new Error("Action adult_responsibility not found");

  const subtasks = [
    {
      key: "AR_1_own_share",
      kind: "text",
      titleFa: "سهم من",
      helpFa: null,
      isRequired: true,
      isFree: true,
      sortOrder: 1,
      xpReward: 10,
    },
    {
      key: "AR_2_pattern_link",
      kind: "choice",
      titleFa: "الگوی تکرارشونده",
      helpFa: null,
      isRequired: false,
      isFree: true,
      sortOrder: 2,
      xpReward: 5,
    },
    {
      key: "AR_3_boundary_next_time",
      kind: "form",
      titleFa: "مرزهای دفعه بعد",
      helpFa: null,
      isRequired: true,
      isFree: true,
      sortOrder: 3,
      xpReward: 10,
    },
    {
      key: "AR_4_no_blame_confirm",
      kind: "confirm",
      titleFa: "پذیرش بدون سرزنش",
      helpFa: null,
      isRequired: true,
      isFree: true,
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
  console.log("Seeded Adult Responsibility subtasks. Count =", n);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });