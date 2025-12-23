const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const action = await prisma.bastanActionDefinition.findUnique({
    where: { code: "limited_contact" },
  });
  if (!action) throw new Error("Action limited_contact not found");

  const subtasks = [
    {
      key: "FRL_1_define_roles",
      kind: "choice",
      titleFa: "آیا تماس نقش‌محور اجتناب‌ناپذیر است؟",
      helpFa: "اگر «هیچ‌کدام» را انتخاب کنی، یعنی باید قطع ارتباط کامل انجام بدهی.",
      isRequired: true,
      isFree: false,
      sortOrder: 1,
      xpReward: 10,
    },
    {
      key: "FRL_2_contact_rules",
      kind: "form",
      titleFa: "قوانین تماس مجاز من چیست؟ (حداکثر ۵ خط)",
      helpFa: "اگر در گزینه ۱ «هیچ‌کدام» بود: بنویس «قطع ارتباط کامل». اگر نقش‌محور بود: موضوعات مجاز، کانال ارتباط، زمان پاسخ، ممنوعیت حرف شخصی.",
      isRequired: true,
      isFree: false,
      sortOrder: 2,
      xpReward: 10,
    },
    {
      key: "FRL_3_no_emotional_contact_confirm",
      kind: "confirm",
      titleFa: "متعهد می‌شوم هیچ تماس هیجانی نداشته باشم",
      helpFa: "درددل/کنایه/یادآوری/چک‌کردن شبکه‌ها = تماس هیجانی",
      isRequired: true,
      isFree: false,
      sortOrder: 3,
      xpReward: 5,
    },
    {
      key: "FRL_4_boundary_script",
      kind: "text",
      titleFa: "یک جمله آماده برای حفظ مرز بنویس",
      helpFa: "مثال: الان فقط درباره موضوع کاری صحبت می‌کنم.",
      isRequired: false,
      isFree: false,
      sortOrder: 4,
      xpReward: 5,
    },
    {
      key: "FRL_5_violation_plan",
      kind: "form",
      titleFa: "اگر قانون را شکستم چه می‌کنم؟ (پلن جبران)",
      helpFa: "قطع گفتگو، گزارش به خود، بازگشت به اقدام ۳ یا ۴",
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