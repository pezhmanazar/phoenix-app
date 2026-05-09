//phoenix-app\phoenix-backend\utils\plan.js
function addMonthsSafe(date, months) {
  const d = new Date(date);
  const day = d.getDate();

  d.setMonth(d.getMonth() + Number(months || 0));

  if (d.getDate() < day) {
    d.setDate(0);
  }

  return d;
}

function computePlanExpiry({ currentExpiresAt, now = new Date(), months }) {
  const current = currentExpiresAt ? new Date(currentExpiresAt) : null;
  const baseDate = current && current > now ? current : now;

  return addMonthsSafe(baseDate, months);
}

export { addMonthsSafe, computePlanExpiry };
