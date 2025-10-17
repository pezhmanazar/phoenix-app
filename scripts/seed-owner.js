// scripts/seed-owner.js
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const pass  = process.argv[3];
  const name  = process.argv[4] || "Owner";

  if (!email || !pass) {
    console.error("Usage: node scripts/seed-owner.js <email> <password> [name]");
    process.exit(1);
  }

  const exists = await prisma.admin.count();
  if (exists > 0) {
    console.log("Admins already exist. Aborting.");
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(pass, 10);

  const admin = await prisma.admin.create({
    data: {
      email: email.toLowerCase().trim(),
      name,
      role: "owner",
      passwordHash,
      apiKey: `admin-${Math.random().toString(36).slice(2, 10)}`,
    },
    select: { id: true, email: true, name: true, role: true }
  });

  console.log("✅ Owner created:", admin);
}

main().finally(() => prisma.$disconnect());