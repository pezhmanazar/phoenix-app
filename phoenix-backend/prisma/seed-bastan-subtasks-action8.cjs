const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const action = await prisma.bastanActionDefinition.findUnique({
    where: { code: "commitment_contract" },
  });
  if (!action) throw new Error("Action commitment_contract not found");

  const subtasks = [
   {
  key: "CC_1_read_contract",
  kind: "confirm",
  titleFa: "مطالعه تعهدنامه",
  helpFa: null,
  isRequired: true,
  isFree: false,
  sortOrder: 1,
  xpReward: 5,
},
{
  key: "CC_2_signature",
  kind: "signature",
  titleFa: "امضای تعهدنامه",
  helpFa: null,
  isRequired: true,
  isFree: false,
  sortOrder: 2,
  xpReward: 15,
},
{
  key: "CC_3_24h_safety_check",
  kind: "choice",
  titleFa: "بررسی ایمنی ۲۴ ساعته",
  helpFa: null,
  isRequired: true,
  isFree: false,
  sortOrder: 3,
  xpReward: 10,
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
  console.log("Seeded Commitment Contract subtasks. Count =", n);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });