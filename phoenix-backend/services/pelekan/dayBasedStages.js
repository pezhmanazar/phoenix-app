//phoenix-app\phoenix-backend\services\pelekan\dayBasedStages.js
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
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function isSafeNoContactEventType(eventType) {
  return eventType === "none" || eventType === "role_based";
}

function isNoContactTaskCode(taskCode) {
  return typeof taskCode === "string" && taskCode.endsWith("no_contact_check");
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

  if (hasNextDay) {
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

  continue;
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
      noContactWarningState: "none",
      noContactViolationCount: 0,
      noContactResetCount: 0,
      lastNoContactViolationAt: null,
      lastNoContactResetAt: null,
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
        streakAction: "unchanged",
        warningState: streak.noContactWarningState || "none",
        violationCount: streak.noContactViolationCount || 0,
        resetCount: streak.noContactResetCount || 0,
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
        reset: false,
        recountSkipped: true,
        streakAction: "unchanged",
        warningState: streak.noContactWarningState || "none",
        violationCount: streak.noContactViolationCount || 0,
        resetCount: streak.noContactResetCount || 0,
      },
    };
  }

  if (eventType === "emotional") {
    const currentResetCount = Number(streak.noContactResetCount) || 0;
    const nextViolationCount = (Number(streak.noContactViolationCount) || 0) + 1;

    const isBeforeFirstReset = currentResetCount === 0;
    const resetThreshold = isBeforeFirstReset ? 3 : 2;

    if (nextViolationCount >= resetThreshold) {
      const updated = await prisma.pelekanStreak.update({
        where: { userId },
        data: {
          currentDays: 0,
          yellowCardAt: now,
          noContactWarningState: "none",
          noContactViolationCount: 0,
          noContactResetCount: {
            increment: 1,
          },
          lastNoContactViolationAt: now,
          lastNoContactResetAt: now,
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
          streakAction: "reset",
          warningState: updated.noContactWarningState || "none",
          violationCount: updated.noContactViolationCount || 0,
          resetCount: updated.noContactResetCount || 0,
        },
      };
    }

    const warningState = isBeforeFirstReset && nextViolationCount === 1
      ? "promise_required"
      : "serious_warning";

    const updated = await prisma.pelekanStreak.update({
      where: { userId },
      data: {
        yellowCardAt: now,
        noContactWarningState: warningState,
        noContactViolationCount: nextViolationCount,
        lastNoContactViolationAt: now,
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
        streakAction: warningState,
        warningState: updated.noContactWarningState || "none",
        violationCount: updated.noContactViolationCount || 0,
        resetCount: updated.noContactResetCount || 0,
      },
    };
  }

  const nextCurrentDays = (Number(streak.currentDays) || 0) + 1;
  const nextBestDays = Math.max(Number(streak.bestDays) || 0, nextCurrentDays);

  const safeUpdateData = {
  currentDays: nextCurrentDays,
  bestDays: nextBestDays,
  lastCompletedAt: now,

  // فقط هشدار نمایشی پاک می‌شود
  noContactWarningState: "none",
};


  const updated = await prisma.pelekanStreak.update({
    where: { userId },
    data: safeUpdateData,
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
      streakAction: "continued",
      warningState: updated.noContactWarningState || "none",
      violationCount: updated.noContactViolationCount || 0,
      resetCount: updated.noContactResetCount || 0,
    },
  };
}

async function rebuildNoContactStreakFromLogs({ prisma, userId }) {
  const logs = await prisma.noContactLog.findMany({
    where: { userId },
    orderBy: [{ dateKey: "asc" }, { eventAt: "asc" }],
  });

  let currentDays = 0;
  let bestDays = 0;
  let lastCompletedAt = null;
  let yellowCardAt = null;
  let noContactWarningState = "none";
  let noContactViolationCount = 0;
  let noContactResetCount = 0;
  let lastNoContactViolationAt = null;
  let lastNoContactResetAt = null;

  for (const log of logs) {
    const eventType =
      log.eventType || (log.hadContact ? "emotional" : "none");
    const eventAt = log.eventAt || new Date();

    if (isSafeNoContactEventType(eventType)) {
  currentDays += 1;
  bestDays = Math.max(bestDays, currentDays);
  lastCompletedAt = eventAt;

  // فقط هشدار نمایشی پاک می‌شود؛ سابقه لغزش حفظ می‌شود
  noContactWarningState = "none";
  continue;
}

    if (eventType === "emotional") {
      const isBeforeFirstReset = noContactResetCount === 0;
      const nextViolationCount = noContactViolationCount + 1;
      const resetThreshold = isBeforeFirstReset ? 3 : 2;

      if (nextViolationCount >= resetThreshold) {
        currentDays = 0;
        yellowCardAt = eventAt;
        noContactWarningState = "none";
        noContactViolationCount = 0;
        noContactResetCount += 1;
        lastNoContactViolationAt = eventAt;
        lastNoContactResetAt = eventAt;
      } else {
        yellowCardAt = eventAt;
        noContactWarningState =
          isBeforeFirstReset && nextViolationCount === 1
            ? "promise_required"
            : "serious_warning";
        noContactViolationCount = nextViolationCount;
        lastNoContactViolationAt = eventAt;
      }
    }
  }

  return prisma.pelekanStreak.upsert({
    where: { userId },
    create: {
      userId,
      currentDays,
      bestDays,
      lastCompletedAt,
      yellowCardAt,
      noContactWarningState,
      noContactViolationCount,
      noContactResetCount,
      lastNoContactViolationAt,
      lastNoContactResetAt,
    },
    update: {
      currentDays,
      bestDays,
      lastCompletedAt,
      yellowCardAt,
      noContactWarningState,
      noContactViolationCount,
      noContactResetCount,
      lastNoContactViolationAt,
      lastNoContactResetAt,
    },
  });
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
      canReset: currentDayProgress?.status === "active",
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

  return prisma.$transaction(async (tx) => {
    const resolved = await resolveCurrentDay({ prisma: tx, userId, stageCode, now });
    if (!resolved.ok) return resolved;

    const { currentDay, currentDayProgress, isTimeLocked } = resolved;

    if (!currentDay?.id) return buildError("CURRENT_DAY_NOT_FOUND");
    if (currentDayProgress?.status === "completed" || isTimeLocked) {
      return buildError("DAY_ALREADY_COMPLETED");
    }

    const task = (currentDay.tasks || []).find((t) => t.id === taskId);
    if (!task) return buildError("INVALID_TASK_FOR_CURRENT_DAY");

    let noContactMeta = null;

    const hasNoContactPayload =
      result &&
      typeof result === "object" &&
      typeof result.noContactEventType === "string";

    const isNoContactTask = isNoContactTaskCode(task.code);

    if (done && isNoContactTask && !hasNoContactPayload) {
      return buildError("NO_CONTACT_RESULT_REQUIRED");
    }

    if (done && isNoContactTask && hasNoContactPayload) {
      const noContactResult = await handleNoContactTask({
        prisma: tx,
        userId,
        result,
        now,
      });

      if (!noContactResult.ok) return noContactResult;

      noContactMeta = noContactResult.noContact;
    }

    const existing = await tx.pelekanTaskProgress.findFirst({
      where: { userId, taskId, dayId: currentDay.id },
    });

    const wasDoneBefore = !!existing?.isDone;
    const willBeDone = !!done;

    let taskProgress;
    if (existing) {
      taskProgress = await tx.pelekanTaskProgress.update({
        where: { id: existing.id },
        data: {
          isDone: willBeDone,
          doneAt: willBeDone ? now : null,
        },
      });
    } else {
      taskProgress = await tx.pelekanTaskProgress.create({
        data: {
          userId,
          taskId,
          dayId: currentDay.id,
          isDone: willBeDone,
          doneAt: willBeDone ? now : null,
        },
      });
    }

    const taskXpReward = Number(task.xpReward) || 0;

    const blockedByEmotionalNoContact =
      isNoContactTask &&
      noContactMeta?.eventType === "emotional";

    const shouldAwardXp =
      willBeDone &&
      !wasDoneBefore &&
      taskXpReward > 0 &&
      !blockedByEmotionalNoContact;

        let awardedXp = 0;
    let revokedXp = 0;

    if (shouldAwardXp) {
      awardedXp = taskXpReward;

      await tx.xpLedger.create({
        data: {
          userId,
          amount: awardedXp,
          reason: "pelekan_day_task_completed",
          refType: "pelekan_task_progress",
          refId: taskProgress.id,
        },
      });
    }

    const shouldRevokeXp =
      !willBeDone &&
      wasDoneBefore &&
      taskXpReward > 0;

    if (shouldRevokeXp) {
      revokedXp = taskXpReward;

      await tx.xpLedger.create({
        data: {
          userId,
          amount: -revokedXp,
          reason: "pelekan_day_task_uncompleted",
          refType: "pelekan_task_progress",
          refId: taskProgress.id,
        },
      });
    }

    const taskProgressRows = await tx.pelekanTaskProgress.findMany({
      where: { userId, dayId: currentDay.id },
    });

    const progressMap = new Map(taskProgressRows.map((r) => [r.taskId, r]));
    const summary = summarizeTasks(currentDay.tasks || [], progressMap);

    const dayUpdateData = {
      completionPercent: summary.completionPercent,
      lastActivityAt: now,
    };

        if (shouldAwardXp && shouldRevokeXp) {
      dayUpdateData.xpEarned = {
        increment: awardedXp - revokedXp,
      };
    } else if (shouldAwardXp) {
      dayUpdateData.xpEarned = {
        increment: awardedXp,
      };
    } else if (shouldRevokeXp) {
      dayUpdateData.xpEarned = {
        decrement: revokedXp,
      };
    }


    if (summary.allRequiredDone) {
  dayUpdateData.status = "completed";
  dayUpdateData.completedAt = now;
  dayUpdateData.unlockedNextAt = now;
} else {
      dayUpdateData.status = "active";
      dayUpdateData.completedAt = null;
      dayUpdateData.unlockedNextAt = null;
    }

    const updatedDay = await tx.pelekanDayProgress.update({
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
        isTimeLocked: false,
        xpEarned: updatedDay.xpEarned,
      },
      meta: {
        noContact: noContactMeta,
        xp: {
          awarded: awardedXp,
          blockedReason: blockedByEmotionalNoContact ? "NO_CONTACT_EMOTIONAL" : null,
        },
      },
    };
  });
}

export async function getDayBasedStageDayState({ prisma, userId, stageCode, dayNumber }) {
  if (!isDayBasedStageCode(stageCode)) {
    return buildError("INVALID_STAGE_CODE");
  }

  const requestedDayNumber = Number(dayNumber);
  if (!Number.isInteger(requestedDayNumber) || requestedDayNumber < 1) {
    return buildError("INVALID_DAY_NUMBER");
  }

  const stage = await getStageWithDays(prisma, stageCode);
  if (!stage) return buildError("INVALID_STAGE_CODE");
  if (!stage.days?.length) return buildError("STAGE_HAS_NO_DAYS");

  const day = stage.days.find((d) => Number(d.dayNumberInStage) === requestedDayNumber);
  if (!day) return buildError("DAY_NOT_FOUND");

  const dayProgressMap = await getDayProgressMap(prisma, userId, [day.id]);
  const taskProgressMap = await getTaskProgressMap(prisma, userId, [day.id]);

  const dayProgress = dayProgressMap.get(day.id) || null;
  const summary = summarizeTasks(day.tasks || [], taskProgressMap);

  return {
    ok: true,
    stage: {
      id: stage.id,
      code: stage.code,
      titleFa: stage.titleFa,
      description: null,
    },
    currentDay: {
      id: day.id,
      dayNumberInStage: day.dayNumberInStage,
      globalDayNumber: day.globalDayNumber,
      titleFa: day.title,
      description: day.description,
      status: dayProgress?.status || "locked",
      completionPercent: dayProgress?.completionPercent || 0,
      startedAt: dayProgress?.startedAt || null,
      completedAt: dayProgress?.completedAt || null,
      unlockedNextAt: dayProgress?.unlockedNextAt || null,
      isTimeLocked: false,
      canReset: dayProgress?.status === "active",
      canGoNextDay: false,
    },
    tasks: (day.tasks || []).map((task) => {
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
    stageCompleted: false,
  };
}



export async function resetCurrentDay({ prisma, userId, stageCode }) {
  if (!isDayBasedStageCode(stageCode)) {
    return buildError("INVALID_STAGE_CODE");
  }

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const resolved = await resolveCurrentDay({ prisma: tx, userId, stageCode, now });
    if (!resolved.ok) return resolved;

    const { currentDay, currentDayProgress } = resolved;
    if (!currentDay?.id) return buildError("CURRENT_DAY_NOT_FOUND");

    const existingTaskProgresses = await tx.pelekanTaskProgress.findMany({
      where: { userId, dayId: currentDay.id },
      select: { id: true, taskId: true, isDone: true, doneAt: true },
    });

    const completedProgressIds = existingTaskProgresses
      .filter((row) => row.isDone)
      .map((row) => row.id);

    if (completedProgressIds.length > 0) {
      await tx.xpLedger.deleteMany({
        where: {
          userId,
          reason: {
            in: [
              "pelekan_day_task_completed",
              "pelekan_day_task_uncompleted",
            ],
          },
          refType: "pelekan_task_progress",
          refId: { in: completedProgressIds },
        },
      });
    }

    const hadNoContactTask = (currentDay.tasks || []).some((task) =>
      isNoContactTaskCode(task.code)
    );

        if (hadNoContactTask) {
      const noContactTaskIds = (currentDay.tasks || [])
        .filter((task) => isNoContactTaskCode(task.code))
        .map((task) => task.id);

      const noContactProgress = existingTaskProgresses.find((row) =>
        noContactTaskIds.includes(row.taskId)
      );

      const noContactDate = noContactProgress?.doneAt || currentDayProgress?.startedAt || now;
      const dateKey = toDateKey(new Date(noContactDate));

      await tx.noContactLog.deleteMany({
        where: { userId, dateKey },
      });

      await rebuildNoContactStreakFromLogs({ prisma: tx, userId });
    }


    await tx.pelekanTaskProgress.updateMany({
      where: { userId, dayId: currentDay.id },
      data: {
        isDone: false,
        doneAt: null,
      },
    });

    const day = await tx.pelekanDayProgress.update({
      where: { userId_dayId: { userId, dayId: currentDay.id } },
      data: {
        status: "active",
        completionPercent: 0,
        completedAt: null,
        unlockedNextAt: null,
        startedAt: now,
        lastActivityAt: now,
        xpEarned: 0,
        resetCount: { increment: 1 },
        lastResetAt: now,
      },
    });

    const refreshedTasks = await tx.pelekanTaskProgress.findMany({
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
        xpEarned: day.xpEarned,
      },
      tasks: (currentDay.tasks || []).map((task) => ({
        id: task.id,
        isDone: !!byTaskId.get(task.id)?.isDone,
        doneAt: byTaskId.get(task.id)?.doneAt || null,
      })),
    };
  });
}
