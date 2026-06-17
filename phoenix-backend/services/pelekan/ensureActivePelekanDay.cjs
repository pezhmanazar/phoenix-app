// services/pelekan/ensureActivePelekanDay.cjs

async function ensureActivePelekanDay(prisma, userId, desiredDayId) {
  if (!prisma) throw new Error("PRISMA_REQUIRED");
  if (!userId) throw new Error("USER_ID_REQUIRED");
  if (!desiredDayId) return { ok: false, reason: "NO_DESIRED_DAY" };

  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.pelekanDayProgress.findUnique({
      where: {
        userId_dayId: {
          userId,
          dayId: desiredDayId,
        },
      },
      select: {
        startedAt: true,
        status: true,
      },
    });

    // اگر روز مطلوب قبلاً کامل شده، هیچ active دیگری را خراب نکن
    if (existing?.status === "completed") {
      return { ok: false, reason: "DESIRED_DAY_ALREADY_COMPLETED" };
    }

    const actives = await tx.pelekanDayProgress.findMany({
      where: {
        userId,
        status: "active",
      },
      select: {
        dayId: true,
      },
    });

    const toFail = actives
      .filter((active) => active.dayId !== desiredDayId)
      .map((active) => active.dayId);

    if (toFail.length) {
      await tx.pelekanDayProgress.updateMany({
        where: {
          userId,
          dayId: { in: toFail },
          status: "active",
        },
        data: {
          status: "failed",
          lastActivityAt: now,
        },
      });
    }

    if (!existing) {
      await tx.pelekanDayProgress.create({
        data: {
          userId,
          dayId: desiredDayId,
          status: "active",
          completionPercent: 0,
          startedAt: now,
          lastActivityAt: now,
        },
      });

      return { ok: true, created: true };
    }

    await tx.pelekanDayProgress.update({
      where: {
        userId_dayId: {
          userId,
          dayId: desiredDayId,
        },
      },
      data: {
        status: "active",
        lastActivityAt: now,
        ...(existing.startedAt ? {} : { startedAt: now }),
      },
    });

    return { ok: true, created: false };
  });

  return result;
}

module.exports = { ensureActivePelekanDay };
