/* prisma/seed.js */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding...");

  // نمونه: اگر خواستی admin اولیه بسازی، اینجا انجام بده
  // (الان چون مدل Admin نیاز به passwordHash/apiKey دارد، بدون تصمیم قبلی نمی‌سازم)

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