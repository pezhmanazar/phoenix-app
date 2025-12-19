// prisma/seed.js
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding...");

  // فعلاً چیزی نمی‌سازیم تا با دیتا/سیاست ادمین تداخل نکنه.
  // بعداً می‌تونیم: ساخت Admin اولیه، Announcement تستی، ...

  console.log("✅ Seed done.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });