const { execSync } = require("child_process");
const path = require("path");

const files = [
  "seed-bastan-actions.cjs",
  "seed-bastan-subtasks-action1.cjs",
  "seed-bastan-subtasks-action2.cjs",
  "seed-bastan-subtasks-action3.cjs",
  "seed-bastan-subtasks-action4.cjs",
  "seed-bastan-subtasks-action5.cjs",
  "seed-bastan-subtasks-action6.cjs",
  "seed-bastan-subtasks-action7.cjs",
  "seed-bastan-subtasks-action8.cjs",
];

const baseDir = path.resolve(process.cwd(), "prisma/seeds/bastan");

for (const file of files) {
  const fullPath = path.join(baseDir, file);
  console.log(`\n=== Running ${file} ===`);
  execSync(`node "${fullPath}"`, { stdio: "inherit" });
}

console.log("\n✅ Bastan seeds completed successfully.");
