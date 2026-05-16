// utils/prisma.js
import pkg from "@prisma/client";
const { PrismaClient } = pkg;

let prisma;

if (process.env.NODE_ENV !== "production") {
  if (!globalThis.__phoenixPrisma) {
    globalThis.__phoenixPrisma = new PrismaClient();
  }
  prisma = globalThis.__phoenixPrisma;
} else {
  prisma = new PrismaClient();
}

export default prisma;