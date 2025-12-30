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
    titleFa: "پاکسازی شبکه‌های اجتماعی",
    helpFa: null,
    isRequired: true,
    isFree: false,
    sortOrder: 1,
    xpReward: 12,
  },
  {
    key: "TD_2_gallery_cleanup",
    kind: "confirm",
    titleFa: "آرشیو عکس‌ها و چت‌ها",
    helpFa: null,
    isRequired: true,
    isFree: false,
    sortOrder: 2,
    xpReward: 10,
  },
  {
    key: "TD_3_places_playlist",
    kind: "form",
    titleFa: "شناسایی محرک‌های اصلی",
    helpFa: null,
    isRequired: true,
    isFree: false,
    sortOrder: 3,
    xpReward: 10,
  },
  {
    key: "TD_4_if_then_plan",
    kind: "form",
    titleFa: "برنامه مواجهه با محرک‌ها",
    helpFa: null,
    isRequired: true,
    isFree: false,
    sortOrder: 4,
    xpReward: 10,
  },
  {
    key: "TD_5_home_object",
    kind: "choice",
    titleFa: "مدیریت یادگاری‌های فیزیکی",
    helpFa: null,
    isRequired: false,
    isFree: false,
    sortOrder: 5,
    xpReward: 5,
  },
  {
    key: "TD_6_detox_confirm",
    kind: "confirm",
    titleFa: "محرک‌زدایی ۷ روزه",
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