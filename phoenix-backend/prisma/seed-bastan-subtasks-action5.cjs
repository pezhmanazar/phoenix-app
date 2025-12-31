const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const action = await prisma.bastanActionDefinition.findUnique({
    where: { code: "limited_contact" },
  });
  if (!action) throw new Error("Action limited_contact not found");

  const subtasks = [
    // ✅ NEW Gate (قبل از همه)
    {
      key: "FRL_0_contact_gate",
      kind: "choice",
      titleFa: "دوراهی تماس",
      helpFa: null,
      isRequired: true,
      isFree: false,
      sortOrder: 0,
      xpReward: 5,
    },

    // ✅ Existing (with short real titles + helpFa null)
    {
      key: "FRL_1_define_roles",
      kind: "choice",
      titleFa: "تعریف نقش تماس",
      helpFa: null,
      isRequired: true,
      isFree: false,
      sortOrder: 1,
      xpReward: 10,
    },
    {
      key: "FRL_2_contact_rules",
      kind: "form",
      titleFa: "قوانین تماس مجاز",
      helpFa: null,
      isRequired: true,
      isFree: false,
      sortOrder: 2,
      xpReward: 10,
    },
    {
      key: "FRL_3_no_emotional_contact_confirm",
      kind: "confirm",
      titleFa: "تعهد عدم تماس هیجانی",
      helpFa: null,
      isRequired: true,
      isFree: false,
      sortOrder: 3,
      xpReward: 5,
    },
    {
      key: "FRL_4_boundary_script",
      kind: "text",
      titleFa: "جمله مرزبندی",
      helpFa: null,
      isRequired: false,
      isFree: false,
      sortOrder: 4,
      xpReward: 5,
    },
    {
      key: "FRL_5_violation_plan",
      kind: "form",
      titleFa: "پلن جبران",
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

  console.log("Seeded Limited Contact subtasks. Count =", n);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });