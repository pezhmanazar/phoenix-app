// services/pelekan/engine.cjs
const { ensureActivePelekanDay } = require("./ensureActivePelekanDay.cjs");

async function refresh(prisma, userId) {
  if (!prisma) throw new Error("PRISMA_REQUIRED");
  if (!userId) throw new Error("USER_ID_REQUIRED");

  const bastanState = await prisma.bastanState.findUnique({
    where: { userId },
    select: { gosastanUnlockedAt: true },
  });

  const bastanCompleted = !!bastanState?.gosastanUnlockedAt;

  if (!bastanCompleted) {
    return {
      ok: true,
      desiredDayId: null,
      activeDayId: null,
      alreadyActive: false,
      waitingForBastan: true,
    };
  }

  const stages = await prisma.pelekanStage.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      code: true,
      sortOrder: true,
      days: {
        orderBy: { dayNumberInStage: "asc" },
        select: {
          id: true,
          dayNumberInStage: true,
          globalDayNumber: true,
        },
      },
    },
  });

  const dayBasedStages = stages.filter((stage) => stage.code !== "bastan");
  const orderedDayIds = dayBasedStages.flatMap((stage) =>
    (stage.days || []).map((day) => day.id),
  );

  if (!orderedDayIds.length) {
    return {
      ok: true,
      desiredDayId: null,
      activeDayId: null,
      alreadyActive: false,
      completed: true,
    };
  }

  const progressRows = await prisma.pelekanDayProgress.findMany({
    where: {
      userId,
      dayId: { in: orderedDayIds },
    },
    select: {
      dayId: true,
      status: true,
    },
  });

  const progressMap = new Map(
    progressRows.map((row) => [row.dayId, row.status]),
  );

  let desiredDayId = null;

  for (const stage of dayBasedStages) {
    if (!stage.days?.length) continue;

    const firstIncompleteDay = stage.days.find((day) => {
      const status = progressMap.get(day.id);
      return status !== "completed";
    });

    if (firstIncompleteDay) {
      desiredDayId = firstIncompleteDay.id;
      break;
    }
  }

  if (!desiredDayId) {
    return {
      ok: true,
      desiredDayId: null,
      activeDayId: null,
      alreadyActive: false,
      completed: true,
    };
  }

  const activeDayId = orderedDayIds.find(
    (dayId) => progressMap.get(dayId) === "active",
  );

  if (activeDayId === desiredDayId) {
    return {
      ok: true,
      desiredDayId,
      activeDayId,
      alreadyActive: true,
    };
  }

  const activation = await ensureActivePelekanDay(prisma, userId, desiredDayId);

  if (!activation?.ok) {
    return {
      ok: false,
      desiredDayId,
      activeDayId: null,
      alreadyActive: false,
      reason: activation?.reason || "ACTIVATION_FAILED",
    };
  }

  return {
    ok: true,
    desiredDayId,
    activeDayId: desiredDayId,
    alreadyActive: false,
  };
}

module.exports = { refresh };
