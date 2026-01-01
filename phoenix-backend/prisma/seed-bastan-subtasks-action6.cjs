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
    titleFa: "درس‌های رابطه",
    helpFa: null,
    isRequired: true,
    isFree: false,
    sortOrder: 1,
    xpReward: 12,
  },
  {
    key: "ML_2_pattern_awareness",
    kind: "choice",
    titleFa: "الگوی قابل توقف",
    helpFa: null,
    isRequired: false,
    isFree: false,
    sortOrder: 2,
    xpReward: 5,
  },
  {
    key: "ML_3_values_next_time",
    kind: "form",
    titleFa: "ارزش‌های غیرقابل‌مذاکره",
    helpFa: null,
    isRequired: true,
    isFree: false,
    sortOrder: 3,
    xpReward: 10,
  },
  {
    key: "ML_4_golden_rule",
    kind: "text",
    titleFa: "اصل طلایی رابطه",
    helpFa: null,
    isRequired: true,
    isFree: false,
    sortOrder: 4,
    xpReward: 10,
  },
  {
    key: "ML_5_learning_confirm",
    kind: "confirm",
    titleFa: "پذیرش یادگیری",
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