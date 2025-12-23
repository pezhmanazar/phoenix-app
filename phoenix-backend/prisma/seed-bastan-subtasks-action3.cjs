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
      titleFa: "نامه خداحافظی: یا اینجا بنویس، یا عکس بگیر و ثبت کن",
      helpFa: "گزینه ۱: متن (حداقل ۱۵۰ کلمه) / گزینه ۲: عکس از نامه دست‌نویس",
      isRequired: true,
      isFree: false,
      sortOrder: 1,
      xpReward: 12,
    },
    {
      key: "UL_2_no_send_confirm",
      kind: "confirm",
      titleFa: "تأیید می‌کنم این نامه ارسال نمی‌شود",
      helpFa: null,
      isRequired: true,
      isFree: false,
      sortOrder: 2,
      xpReward: 5,
    },
    {
      key: "UL_3_72h_lock_confirm",
      kind: "confirm",
      titleFa: "تعهد می‌دهم تا ۷۲ ساعت هیچ پیام/تماس هیجانی نداشته باشم",
      helpFa: "اگر نقض شد، ۷۲ ساعت از نو شروع می‌شود",
      isRequired: true,
      isFree: false,
      sortOrder: 3,
      xpReward: 5,
    },
    {
      key: "UL_4_store_ritual",
      kind: "choice",
      titleFa: "نامه را کجا نگه می‌داری؟",
      helpFa: "پاک می‌کنم / داخل Notes قفل‌دار / روی کاغذ در پاکت / به درمانگرم می‌دهم",
      isRequired: false,
      isFree: false,
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