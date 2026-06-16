const seedSookhtanDays = require('./seed-sookhtan-days.cjs');
const seedSookhtanTasksAll = require('./seed-sookhtan-tasks-all.cjs');

async function main() {
  await seedSookhtanDays();
  await seedSookhtanTasksAll();

  console.log('✅ All sookhtan seeds executed successfully.');
}

main()
  .catch((error) => {
    console.error('❌ Error running sookhtan seeds:', error);
    process.exit(1);
  });
