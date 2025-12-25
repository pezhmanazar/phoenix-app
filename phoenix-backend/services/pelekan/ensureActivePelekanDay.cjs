// services/pelekan/ensureActivePelekanDay.cjs
const prisma = require('../../utils/prisma.cjs');
const { computePelekanState } = require('./computePelekanState.cjs');
const { ExecutorError, ExecutorErrorCodes } = require('./stateErrors.cjs');

/**
 * ensureActivePelekanDay
 * - تصمیم computePelekanState را در DB اجرا می‌کند
 * - داخل transaction
 * - تضمین می‌کند فقط یک dayProgress با status=active وجود داشته باشد
 */
async function ensureActivePelekanDay(userId) {
  if (!userId) throw new Error('userId is required');

  // 1) تصمیم مطلوب را از مغز می‌گیریم (read-only)
  const desired = await computePelekanState(userId);
  const desiredDayId = desired?.activeDay?.dayId;

  if (!desiredDayId) {
    throw new ExecutorError(
      ExecutorErrorCodes.TX_FAILED,
      'desired activeDay.dayId is missing'
    );
  }

  // 2) اجرا در transaction
  await tx.pelekanDayProgress.findMany({
  where: { userId },
  select: { id: true },
  take: 1,
});
  try {
    await prisma.$transaction(
  async (tx) => {
    // 0) Lock-ish read (برای کاهش race condition روی یک user)
    // اگر هیچ ردیفی هم نباشد مشکلی نیست؛ فقط باعث می‌شود همزمانی کمتر خرابکاری کند.
    await tx.pelekanDayProgress.findMany({
      where: { userId },
      select: { id: true },
      take: 1,
    });

    // 2-1) همه activeهای فعلی را بگیر
    const actives = await tx.pelekanDayProgress.findMany({
      where: { userId, status: "active" },
      select: { dayId: true },
    });

    // 2-2) هر active که dayId اش مطلوب نیست => failed کن
    const toFail = actives
      .filter((a) => a.dayId !== desiredDayId)
      .map((a) => a.dayId);

    if (toFail.length) {
      await tx.pelekanDayProgress.updateMany({
        where: { userId, dayId: { in: toFail }, status: "active" },
        data: { status: "failed", lastActivityAt: new Date() },
      });
    }

    // 2-3) dayProgress مطلوب را active کن (upsert)
    const existing = await tx.pelekanDayProgress.findUnique({
      where: { userId_dayId: { userId, dayId: desiredDayId } },
      select: { id: true, status: true, startedAt: true },
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
  },
  { isolationLevel: "Serializable" }
);
  } catch (e) {
    throw new ExecutorError(
      ExecutorErrorCodes.TX_FAILED,
      e?.message || 'transaction failed'
    );
  }

  // 3) بعد از اجرا، state نهایی را برگردان
  const finalState = await computePelekanState(userId);
  return finalState;
}

module.exports = { ensureActivePelekanDay };