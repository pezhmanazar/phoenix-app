import { getNextIranCalendarDayStart } from "./iranTime.js";

const DAY_BASED_STAGE_CODES = [
  "gosastan",
  "sookhtan",
  "sarashtan",
  "ziestan",
  "sakhtan",
  "rastan",
];

export function isDayBasedStageCode(stageCode) {
  return DAY_BASED_STAGE_CODES.includes(String(stageCode || "").trim());
}

function buildError(error, extra = {}) {
  return { ok: false, error, ...extra };
}

function toDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isSafeNoContactEventType(eventType) {
  return eventType === "none" || eventType === "role_based";
}

function summarizeTasks(tasks, progressMap) {
  let requiredTotal = 0;
  let requiredDone = 0;
  let optionalTotal = 0;
  let optionalDone = 0;

  for (const task of tasks || []) {
    const isDone = !!progressMap.get(task.id)?.isDone;

    if (task.isRequired) {
      requiredTotal += 1;
      if (isDone) requiredDone += 1;
    } else {
      optionalTotal += 1;
      if (isDone) optionalDone += 1;
    }
  }

  const allRequiredDone = requiredTotal > 0 && requiredDone === requiredTotal;
  const completionPercent =
    requiredTotal === 0 ? 0 : Math.round((requiredDone / requiredTotal) * 100);

  return {
    requiredTotal,
    requiredDone,
    optionalTotal,
    optionalDone,
    allRequiredDone,
    completionPercent,
  };
}

async function getStageWithDays(prisma, stageCode) {
  return prisma.pelekanStage.findFirst({
    where: { code: stageCode },
    include: {
      days: {
        orderBy: { dayNumberInStage: "asc" },
        include: {
          tasks: {
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });
}

async function getDayProgressMap(prisma, userId, dayIds) {
  const rows = await prisma.pelekanDayProgress.findMany({
    where: { userId, dayId: { in: dayIds } },
  });

  return new Map(rows.map((row) => [row.dayId, row]));
}

async function getTaskProgressMap(prisma, userId, dayIds) {
  const rows = await prisma.pelekanTaskProgress.findMany({
    where: { userId, dayId: { in: dayIds } },
  });

  return new Map(rows.map((row) => [row.taskId, row]));
}

async function ensureDayProgress(prisma, userId, dayId, now = new Date()) {
  return prisma.pelekanDayProgress.upsert({
    where: { userId_dayId: { userId, dayId } },
    create: {
      userId,
      dayId,
      status: "active",
      completionPercent: 0,
      startedAt: now,
      lastActivityAt: now,
      xpEarned: 0,
    },
    update: {
      status: "active",
      lastActivityAt: now,
    },
  });
}

async function resolveCurrentDay({ prisma, userId, stageCode, now = new Date() }) {
  const stage = await getStageWithDays(prisma, stageCode);
  if (!stage) return buildError("INVALID_STAGE_CODE");
  if (!stage.days?.length) return buildError("STAGE_HAS_NO_DAYS");

  const days = stage.days;
  const dayIds = days.map((d) => d.id);

  const dayProgressMap = await getDayProgressMap(prisma, userId, dayIds);

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const progress = dayProgressMap.get(day.id);

    if (!progress) {
      await ensureDayProgress(prisma, userId, day.id, now);
      return {
        ok: true,
        stage,
        currentDay: day,
        currentDayProgress: {
          userId,
          dayId: day.id,
          status: "active",
          completionPercent: 0,
          startedAt: now,
          lastActivityAt: now,
          completedAt: null,
          unlockedNextAt: null,
        },
        isTimeLocked: false,
      };
    }

    if (progress.status === "active") {
      return {
        ok: true,
        stage,
        currentDay: day,
        currentDayProgress: progress,
        isTimeLocked: false,
      };
    }

    if (progress.status === "completed") {
      const hasNextDay = i + 1 < days.length;
      const unlockedNextAt = progress.unlockedNextAt ? new Date(progress.unlockedNextAt) : null;

      if (hasNextDay && unlockedNextAt && now >= unlockedNextAt) {
        const nextDay = days[i + 1];
        const nextProgress = dayProgressMap.get(nextDay.id);

        if (!nextProgress) {
          const created = await ensureDayProgress(prisma, userId, nextDay.id, now);
          return {
            ok: true,
            stage,
            currentDay: nextDay,
            currentDayProgress: created,
            isTimeLocked: false,
          };
        }

        if (nextProgress.status === "active") {
          return {
            ok: true,
            stage,
            currentDay: nextDay,
            currentDayProgress: nextProgress,
            isTimeLocked: false,
          };
        }

        continue;
      }

      return {
        ok: true,
        stage,
        currentDay: day,
        currentDayProgress: progress,
        isTimeLocked: true,
      };
    }
  }

  const lastDay = days[days.length - 1];
  const lastProgress = dayProgressMap.get(lastDay.id) || null;

  return {
    ok: true,
    stage,
    currentDay: lastDay,
    currentDayProgress: lastProgress,
    isTimeLocked: false,
    stageCompleted: true,
  };
}

async function handleNoContactTask({
  prisma,
  userId,
  result,
  now,
}) {
  const rawEventType = result?.noContactEventType;
  const note =
    typeof result?.noContactNote === "string" ? result.noContactNote.trim() : null;

  if (!rawEventType || !["none", "role_based", "emotional"].includes(String(rawEventType))) {
    return buildError("NO_CONTACT_RESULT_REQUIRED");
  }

  const eventType = String(rawEventType);
  const dateKey = toDateKey(now);

  const existingLog = await prisma.noContactLog.findUnique({
    where: { userId_dateKey: { userId, dateKey } },
    select: { eventType: true, hadContact: true },
  });

  await prisma.noContactLog.upsert({
    where: { userId_dateKey: { userId, dateKey } },
    create: {
      userId,
      dateKey,
      hadContact: eventType === "emotional",
      note: note || null,
      eventType,
      eventAt: now,
    },
    update: {
      hadContact: eventType === "emotional",
      note: note || null,
      eventType,
      eventAt: now,
    },
  });

  const previousEventType =
    existingLog?.eventType || (existingLog?.hadContact ? "emotional" : null);

  const previousSafe = isSafeNoContactEventType(previousEventType);
  const nextSafe = isSafeNoContactEventType(eventType);

  const streak = await prisma.pelekanStreak.upsert({
    where: { userId },
    create: {
      userId,
      currentDays: 0,
      bestDays: 0,
      lastCompletedAt: null,
      yellowCardAt: null,
    },
    update: {},
  });

  if (previousSafe && nextSafe) {
    return {
      ok: true,
      noContact: {
        eventType,
        note: note || null,
        streakCurrentDays: streak.currentDays,
        streakBestDays: streak.bestDays,
        reset: false,
        recountSkipped: true,
      },
    };
  }

  if (previousEventType === "emotional" && eventType === "emotional") {
    return {
      ok: true,
      noContact: {
        eventType,
        note: note || null,
        streakCurrentDays: streak.currentDays,
        streakBestDays: streak.bestDays,
        reset: true,
        recountSkipped: true,
      },
    };
  }

  if (eventType === "emotional") {
    const updated = await prisma.pelekanStreak.update({
      where: { userId },
      data: {
        currentDays: 0,
        yellowCardAt: now,
      },
    });

    return {
      ok: true,
      noContact: {
        eventType,
        note: note || null,
        streakCurrentDays: updated.currentDays,
        streakBestDays: updated.bestDays,
        reset: true,
        recountSkipped: false,
      },
    };
  }

  const nextCurrentDays = (Number(streak.currentDays) || 0) + 1;
  const nextBestDays = Math.max(Number(streak.bestDays) || 0, nextCurrentDays);

  const updated = await prisma.pelekanStreak.update({
    where: { userId },
    data: {
      currentDays: nextCurrentDays,
      bestDays: nextBestDays,
      lastCompletedAt: now,
    },
  });

  return {
    ok: true,
    noContact: {
      eventType,
      note: note || null,
      streakCurrentDays: updated.currentDays,
      streakBestDays: updated.bestDays,
      reset: false,
      recountSkipped: false,
    },
  };
}


export async function getDayBasedStageState({ prisma, userId, stageCode }) {
  if (!isDayBasedStageCode(stageCode)) {
    return buildError("INVALID_STAGE_CODE");
  }

  const resolved = await resolveCurrentDay({ prisma, userId, stageCode });
  if (!resolved.ok) return resolved;

  const { stage, currentDay, currentDayProgress, isTimeLocked, stageCompleted } = resolved;

  const taskProgressMap = await getTaskProgressMap(prisma, userId, [currentDay.id]);
  const summary = summarizeTasks(currentDay.tasks || [], taskProgressMap);

  return {
    ok: true,
    stage: {
  id: stage.id,
  code: stage.code,
  titleFa: stage.titleFa,
  description: null,
},
    currentDay: {
      id: currentDay.id,
      dayNumberInStage: currentDay.dayNumberInStage,
      globalDayNumber: currentDay.globalDayNumber,
      titleFa: currentDay.title,
      description: currentDay.description,
      status: currentDayProgress?.status || "active",
      completionPercent: currentDayProgress?.completionPercent || 0,
      startedAt: currentDayProgress?.startedAt || null,
      completedAt: currentDayProgress?.completedAt || null,
      unlockedNextAt: currentDayProgress?.unlockedNextAt || null,
      isTimeLocked,
      canReset: true,
      canGoNextDay: !isTimeLocked && currentDayProgress?.status === "completed",
    },
    tasks: (currentDay.tasks || []).map((task) => {
  const p = taskProgressMap.get(task.id);
  return {
    id: task.id,
    code: task.code,
    titleFa: task.titleFa,
    description: task.description,
    suggestedTimeFa: task.suggestedTimeFa,
    sortOrder: task.sortOrder,
    isRequired: task.isRequired,
    weightPercent: task.weightPercent,
    xpReward: task.xpReward,
    isDone: !!p?.isDone,
    doneAt: p?.doneAt || null,
  };
}),
    summary,
    stageCompleted: !!stageCompleted,
  };
}

export async function completeDayBasedTask({ prisma, userId, stageCode, taskId, done, result = null }) {
  if (!isDayBasedStageCode(stageCode)) {
    return buildError("INVALID_STAGE_CODE");
  }

  const now = new Date();
  const resolved = await resolveCurrentDay({ prisma, userId, stageCode, now });
  if (!resolved.ok) return resolved;

  const { currentDay, currentDayProgress, isTimeLocked } = resolved;

  if (!currentDay?.id) return buildError("CURRENT_DAY_NOT_FOUND");
  if (currentDayProgress?.status === "completed" || isTimeLocked) {
    return buildError("DAY_ALREADY_COMPLETED");
  }

    const task = (currentDay.tasks || []).find((t) => t.id === taskId);
  if (!task) return buildError("INVALID_TASK_FOR_CURRENT_DAY");

  let noContactMeta = null;

  if (task.code === "no_contact_check" && done) {
    const noContactResult = await handleNoContactTask({
      prisma,
      userId,
      result,
      now,
    });

    if (!noContactResult.ok) return noContactResult;

    noContactMeta = noContactResult.noContact;
  }

  const existing = await prisma.pelekanTaskProgress.findFirst({
    where: { userId, taskId, dayId: currentDay.id },
  });

  let taskProgress;
  if (existing) {
    taskProgress = await prisma.pelekanTaskProgress.update({
      where: { id: existing.id },
      data: {
        isDone: !!done,
        doneAt: done ? now : null,
      },
    });
  } else {
    taskProgress = await prisma.pelekanTaskProgress.create({
      data: {
        userId,
        taskId,
        dayId: currentDay.id,
        isDone: !!done,
        doneAt: done ? now : null,
      },
    });
  }

  const taskProgressRows = await prisma.pelekanTaskProgress.findMany({
    where: { userId, dayId: currentDay.id },
  });

  const progressMap = new Map(taskProgressRows.map((r) => [r.taskId, r]));
  const summary = summarizeTasks(currentDay.tasks || [], progressMap);

  const dayUpdateData = {
    completionPercent: summary.completionPercent,
    lastActivityAt: now,
  };

  if (summary.allRequiredDone) {
    dayUpdateData.status = "completed";
    dayUpdateData.completedAt = now;
    dayUpdateData.unlockedNextAt = getNextIranCalendarDayStart(now);
  } else {
    dayUpdateData.status = "active";
    dayUpdateData.completedAt = null;
    dayUpdateData.unlockedNextAt = null;
  }

  const updatedDay = await prisma.pelekanDayProgress.update({
    where: { userId_dayId: { userId, dayId: currentDay.id } },
    data: dayUpdateData,
  });

    return {
    ok: true,
    task: {
      id: task.id,
      isDone: !!taskProgress.isDone,
      doneAt: taskProgress.doneAt,
    },
    day: {
      id: currentDay.id,
      status: updatedDay.status,
      completionPercent: updatedDay.completionPercent,
      allRequiredDone: summary.allRequiredDone,
      completedAt: updatedDay.completedAt,
      unlockedNextAt: updatedDay.unlockedNextAt,
      isTimeLocked: updatedDay.status === "completed",
    },
    meta: {
      noContact: noContactMeta,
    },
  };
}

export async function resetCurrentDay({ prisma, userId, stageCode }) {
  if (!isDayBasedStageCode(stageCode)) {
    return buildError("INVALID_STAGE_CODE");
  }

  const now = new Date();
  const resolved = await resolveCurrentDay({ prisma, userId, stageCode, now });
  if (!resolved.ok) return resolved;

  const { currentDay } = resolved;
  if (!currentDay?.id) return buildError("CURRENT_DAY_NOT_FOUND");

  await prisma.pelekanTaskProgress.updateMany({
    where: { userId, dayId: currentDay.id },
    data: {
      isDone: false,
      doneAt: null,
    },
  });

  const day = await prisma.pelekanDayProgress.update({
    where: { userId_dayId: { userId, dayId: currentDay.id } },
    data: {
      status: "active",
      completionPercent: 0,
      completedAt: null,
      unlockedNextAt: null,
      startedAt: now,
      lastActivityAt: now,
      resetCount: { increment: 1 },
      lastResetAt: now,
    },
  });

  const refreshedTasks = await prisma.pelekanTaskProgress.findMany({
    where: { userId, dayId: currentDay.id },
    select: { taskId: true, isDone: true, doneAt: true },
  });

  const byTaskId = new Map(refreshedTasks.map((t) => [t.taskId, t]));

  return {
    ok: true,
    day: {
      id: currentDay.id,
      status: day.status,
      completionPercent: day.completionPercent,
      startedAt: day.startedAt,
      completedAt: day.completedAt,
      unlockedNextAt: day.unlockedNextAt,
      resetCount: day.resetCount,
      lastResetAt: day.lastResetAt,
    },
    tasks: (currentDay.tasks || []).map((task) => ({
      id: task.id,
      isDone: !!byTaskId.get(task.id)?.isDone,
      doneAt: byTaskId.get(task.id)?.doneAt || null,
    })),
  };
}
