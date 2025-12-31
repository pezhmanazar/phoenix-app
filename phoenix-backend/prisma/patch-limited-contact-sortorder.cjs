// prisma/patch-limited-contact-sortorder.cjs
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const action = await prisma.bastanActionDefinition.findUnique({
    where: { code: "limited_contact" },
    select: { id: true, code: true },
  });
  if (!action) throw new Error("Action limited_contact not found");

  const subs = await prisma.bastanSubtaskDefinition.findMany({
    where: { actionId: action.id },
    select: { id: true, key: true, sortOrder: true },
  });

  // فقط اگر کسی 0 داشت، پچ کن (idempotent)
  const hasZero = subs.some((s) => s.sortOrder === 0);
  if (!hasZero) {
    console.log("✅ sortOrder already ok (no zero).");
    return;
  }

  for (const s of subs) {
    await prisma.bastanSubtaskDefinition.update({
      where: { id: s.id },
      data: { sortOrder: (s.sortOrder ?? 0) + 1 },
    });
  }

  const after = await prisma.bastanSubtaskDefinition.findMany({
    where: { actionId: action.id },
    orderBy: { sortOrder: "asc" },
    select: { key: true, sortOrder: true },
  });

  console.log("✅ patched sortOrder (+1) for limited_contact");
  console.table(after);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());