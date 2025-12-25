const { computePelekanState } = require("./computePelekanState.cjs");
const { ensureActivePelekanDay } = require("./ensureActivePelekanDay.cjs");

async function refresh(userId) {
  await ensureActivePelekanDay(userId);
  return computePelekanState(userId);
}

module.exports = { refresh };