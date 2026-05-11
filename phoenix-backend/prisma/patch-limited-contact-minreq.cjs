const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const code = "limited_contact";

  const before = await prisma.bastanActionDefinition.findUnique({ where: { code } });
  if (!before) throw new Error(`Action ${code} not found`);

  await prisma.bastanActionDefinition.update({
    where: { code },
    data: { minRequiredSubtasks: 5 },
  });

  const after = await prisma.bastanActionDefinition.findUnique({ where: { code } });

  console.log("✅ patched minRequiredSubtasks");
  console.log(
    `Patch summary: ${code} minRequiredSubtasks ${before.minRequiredSubtasks} -> ${
      after?.minRequiredSubtasks ?? "unknown"
    }`
  );
}

main()
  .catch((e) => {
    console.error("patch-limited-contact-minreq error:", e?.message || "unknown_error");
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });