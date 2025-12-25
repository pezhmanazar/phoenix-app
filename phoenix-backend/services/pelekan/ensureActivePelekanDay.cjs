// services/pelekan/ensureActivePelekanDay.cjs
module.exports = async function ensureActivePelekanDay(prisma, userId, desiredDayId) {
  if (!prisma) throw new Error("PRISMA_REQUIRED");
  if (!userId) throw new Error("USER_ID_REQUIRED");
  if (!desiredDayId) return { ok: false, reason: "NO_DESIRED_DAY" };

  await prisma.$transaction(async (tx) => {
    // 2-1) همه activeهای فعلی را بگیر
    const actives = await tx.pelekanDayProgress.findMany({
      where: { userId, status: "active" },
      select: { dayId: true },
    });

    // 2-2) هر active که dayId اش مطلوب نیست => failed کن
    const toFail = actives.filter((a) => a.dayId !== desiredDayId).map((a) => a.dayId);
    if (toFail.length) {
      await tx.pelekanDayProgress.updateMany({
        where: { userId, dayId: { in: toFail }, status: "active" },
        data: { status: "failed", lastActivityAt: new Date() },
      });
    }

    // 2-3) dayProgress مطلوب را active کن (upsert)
    const existing = await tx.pelekanDayProgress.findUnique({
      where: { userId_dayId: { userId, dayId: desiredDayId } },
      select: { startedAt: true },
    });

    if (!existing) {
      await tx.pelekanDayProgress.create({
        data: {
          userId,
          dayId: desiredDayId,
          status: "active",
          completionPercent: 0,
          startedAt: new Date(),
          lastActivityAt: new Date(),
        },
      });
    } else {
      await tx.pelekanDayProgress.update({
        where: { userId_dayId: { userId, dayId: desiredDayId } },
        data: {
          status: "active",
          lastActivityAt: new Date(),
          ...(existing.startedAt ? {} : { startedAt: new Date() }),
        },
      });
    }
  });

  return { ok: true };
};