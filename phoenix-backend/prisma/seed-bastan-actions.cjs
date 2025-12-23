const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const actions = [
  {
    sortOrder: 1,
    code: "reality_check",
    titleFa: "Reality Check – بازبینی بی‌رحمانه رابطه",
    totalSubtasks: 5,
    minRequiredSubtasks: 4,
    isProLocked: false,
    medalCode: "bronze",
    badgeCode: "RC",
    xpPerSubtask: 10,
    xpOnComplete: 30,
  },
  {
    sortOrder: 2,
    code: "adult_responsibility",
    titleFa: "Adult Responsibility – پذیرش سهم بدون خودسرزنشی",
    totalSubtasks: 4,
    minRequiredSubtasks: 3,
    isProLocked: false,
    medalCode: "bronze",
    badgeCode: "AR",
    xpPerSubtask: 10,
    xpOnComplete: 25,
  },
  {
    sortOrder: 3,
    code: "unsent_letter",
    titleFa: "Unsent Letter – نامه خداحافظی ارسال‌نشده",
    totalSubtasks: 4,
    minRequiredSubtasks: 3,
    isProLocked: true,
    medalCode: "silver",
    badgeCode: "UL",
    xpPerSubtask: 12,
    xpOnComplete: 30,
  },
  {
    sortOrder: 4,
    code: "trigger_detox",
    titleFa: "Trigger Detox – پاک‌سازی محرک‌ها",
    totalSubtasks: 6,
    minRequiredSubtasks: 5,
    isProLocked: true,
    medalCode: "silver",
    badgeCode: "TD",
    xpPerSubtask: 12,
    xpOnComplete: 35,
  },
  {
    sortOrder: 5,
    code: "limited_contact",
    titleFa: "Limited Contact (FRL) – رابطه رسمی محدود",
    totalSubtasks: 5,
    minRequiredSubtasks: 4,
    isProLocked: true,
    medalCode: "silver",
    badgeCode: "FRL",
    xpPerSubtask: 12,
    xpOnComplete: 35,
  },
  {
    sortOrder: 6,
    code: "meaning_learning",
    titleFa: "Meaning & Learning – معنا و درس‌ها",
    totalSubtasks: 5,
    minRequiredSubtasks: 3,
    isProLocked: true,
    medalCode: "gold",
    badgeCode: "ML",
    xpPerSubtask: 14,
    xpOnComplete: 40,
  },
  {
    sortOrder: 7,
    code: "closure_ritual",
    titleFa: "Closure Ritual – آیین بستن",
    totalSubtasks: 4,
    minRequiredSubtasks: 3,
    isProLocked: true,
    medalCode: "gold",
    badgeCode: "CR",
    xpPerSubtask: 14,
    xpOnComplete: 40,
  },
  {
    sortOrder: 8,
    code: "commitment_contract",
    titleFa: "Commitment Contract – تعهدنامه رسمی + امضا",
    totalSubtasks: 3,
    minRequiredSubtasks: 3,
    isProLocked: true,
    medalCode: "gold",
    badgeCode: "CC",
    xpPerSubtask: 15,
    xpOnComplete: 50,
  },
];

async function main() {
  for (const a of actions) {
    await prisma.bastanActionDefinition.upsert({
      where: { code: a.code },
      create: a,
      update: {
        sortOrder: a.sortOrder,
        titleFa: a.titleFa,
        totalSubtasks: a.totalSubtasks,
        minRequiredSubtasks: a.minRequiredSubtasks,
        isProLocked: a.isProLocked,
        medalCode: a.medalCode,
        badgeCode: a.badgeCode,
        xpPerSubtask: a.xpPerSubtask,
        xpOnComplete: a.xpOnComplete,
      },
    });
  }

  const n = await prisma.bastanActionDefinition.count();
  console.log("Seeded BastanActionDefinition. Count =", n);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });