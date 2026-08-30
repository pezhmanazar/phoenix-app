const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const MEDALS = [
  {
    code: "BASTAN_COMPLETE",
    titleFa: "مدال بستن ققنوس",
    description: "مرحله بستن رو با موفقیت به پایان رسوندی.",
    iconKey: "bastan_complete",
  },
  {
    code: "NO_CONTACT_10",
    titleFa: "مدال ۱۰ روز عدم تماس",
    description: "۱۰ روز عدم تماس رو با موفقیت پشت سر گذاشتی.",
    iconKey: "no_contact_10",
  },
  {
    code: "GOSASTAN_COMPLETE",
    titleFa: "مدال گسستن ققنوس",
    description: "مرحله گسستن رو با موفقیت به پایان رسوندی.",
    iconKey: "gosastan_complete",
  },
  {
    code: "NO_CONTACT_21",
    titleFa: "مدال ۲۱ روز عدم تماس",
    description: "۲۱ روز عدم تماس رو با موفقیت پشت سر گذاشتی.",
    iconKey: "no_contact_21",
  },
  {
    code: "SOOKHTAN_COMPLETE",
    titleFa: "مدال سوختن ققنوس",
    description: "مرحله سوختن رو با موفقیت به پایان رسوندی.",
    iconKey: "sookhtan_complete",
  },
  {
    code: "SERESHTAN_COMPLETE",
    titleFa: "مدال سرشتن ققنوس",
    description: "مرحله سرشتن رو با موفقیت به پایان رسوندی.",
    iconKey: "sereshtan_complete",
  },
  {
    code: "NO_CONTACT_40",
    titleFa: "مدال ۴۰ روز عدم تماس",
    description: "۴۰ روز عدم تماس رو با موفقیت پشت سر گذاشتی.",
    iconKey: "no_contact_40",
  },
  {
    code: "ZIESTAN_COMPLETE",
    titleFa: "مدال زیستن ققنوس",
    description: "مرحله زیستن رو با موفقیت به پایان رسوندی.",
    iconKey: "ziestan_complete",
  },
  {
    code: "SAKHTAN_COMPLETE",
    titleFa: "مدال ساختن ققنوس",
    description: "مرحله ساختن رو با موفقیت به پایان رسوندی.",
    iconKey: "sakhtan_complete",
  },
  {
    code: "RASTAN_COMPLETE",
    titleFa: "مدال رستن ققنوس",
    description: "مرحله رستن رو با موفقیت به پایان رسوندی.",
    iconKey: "rastan_complete",
  },
];

const BADGES = [
  {
    code: "PHOENIX_RESISTANCE",
    titleFa: "لوح مقاومت ققنوس",
    description:
      "برای رسیدن به ۵۰۰۰ امتیاز تجربه و تکمیل مرحله زیستن.",
    iconKey: "phoenix_resistance",
  },
  {
    code: "STEEL_CONTINUITY",
    titleFa: "نشان استمرار پولادین ققنوس",
    description:
      "نشان ویژه برای رسیدن تا پایان مرحله ساختن و استمرار در مسیر ققنوس.",
    iconKey: "steel_continuity",
  },
  {
    code: "GOLDEN_PHOENIX",
    titleFa: "تندیس زرین ققنوس",
    description:
      "بالاترین افتخار ققنوس؛ برای به پایان رساندن تمام مسیر پلکان.",
    iconKey: "golden_phoenix",
  },
];

async function main() {
  console.log("===== ACHIEVEMENT SEED =====");

  for (const medal of MEDALS) {
    const saved = await prisma.medal.upsert({
      where: { code: medal.code },
      update: {
        titleFa: medal.titleFa,
        description: medal.description,
        iconKey: medal.iconKey,
      },
      create: medal,
    });

    console.log("MEDAL:", saved.code, saved.titleFa);
  }

  for (const badge of BADGES) {
    const saved = await prisma.identityBadge.upsert({
      where: { code: badge.code },
      update: {
        titleFa: badge.titleFa,
        description: badge.description,
        iconKey: badge.iconKey,
      },
      create: badge,
    });

    console.log("BADGE:", saved.code, saved.titleFa);
  }

  const [medalCount, badgeCount] = await Promise.all([
    prisma.medal.count(),
    prisma.identityBadge.count(),
  ]);

  console.log("DONE:", {
    medals: medalCount,
    badges: badgeCount,
    total: medalCount + badgeCount,
  });
}

main()
  .catch((error) => {
    console.error("ACHIEVEMENT_SEED_ERROR:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });