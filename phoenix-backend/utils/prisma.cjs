// utils/prisma.cjs
const { PrismaClient } = require("@prisma/client");

let prisma;

if (process.env.NODE_ENV !== "production") {
  if (!global.__phoenixPrisma) {
    global.__phoenixPrisma = new PrismaClient();
  }
  prisma = global.__phoenixPrisma;
} else {
  prisma = new PrismaClient();
}

module.exports = prisma;