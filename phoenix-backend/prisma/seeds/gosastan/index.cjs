const seedGosastanDays = require('./seed-gosastan-days.cjs');
const seedGosastanTasksDay1 = require('./seed-gosastan-tasks-day1.cjs');
const seedGosastanTasksDay2 = require('./seed-gosastan-tasks-day2.cjs');
const seedGosastanTasksDay3 = require('./seed-gosastan-tasks-day3.cjs');
const seedGosastanTasksDay4 = require('./seed-gosastan-tasks-day4.cjs');
const seedGosastanTasksDay5 = require('./seed-gosastan-tasks-day5.cjs');

async function main() {
  await seedGosastanDays();
  await seedGosastanTasksDay1();
  await seedGosastanTasksDay2();
  await seedGosastanTasksDay3();
  await seedGosastanTasksDay4();
  await seedGosastanTasksDay5();

  console.log('✅ All gosastan seeds executed successfully.');
}

main()
  .catch((error) => {
    console.error('❌ Error running gosastan seeds:', error);
    process.exit(1);
  });
