const prisma = require('../../utils/prisma.cjs');
const { StateError, StateErrorCodes } = require('./stateErrors');

function allDaysTerminal(daysInStage, progressByDayId) {
  for (const d of daysInStage) {
    const p = progressByDayId.get(d.id);
    if (!p) return false;
    if (p.status !== 'completed' && p.status !== 'failed') return false;
  }
  return true;
}

async function computePelekanState(userId) {
  if (!userId) throw new Error('userId is required');

  // 1) stages (ترتیب درست = sortOrder)
  const stages = await prisma.pelekanStage.findMany({
    orderBy: { sortOrder: 'asc' },
    select: { id: true, code: true, sortOrder: true },
  });

  if (!stages.length) {
    throw new StateError(StateErrorCodes.NO_ACTIVE_STAGE, 'No stages found');
  }

  // 2) days
  const days = await prisma.pelekanDay.findMany({
    where: { stageId: { in: stages.map((s) => s.id) } },
    orderBy: [{ stageId: 'asc' }, { dayNumberInStage: 'asc' }],
    select: { id: true, stageId: true, dayNumberInStage: true },
  });

  // 3) day progress
  const dayProgressRows = await prisma.pelekanDayProgress.findMany({
    where: { userId },
    select: { dayId: true, status: true },
  });

  // 4) BastanState (برای امضا و safety)
  const bastanState = await prisma.bastanState.findUnique({
    where: { userId },
    select: {
      contractSignedAt: true,
      lastSafetyCheckResult: true, // none | role_based | emotional | null
      gosastanUnlockedAt: true,
    },
  });

  // 5) BastanActionProgress (برای done شدن ۸ اقدام)
  const bastanActionProgress = await prisma.bastanActionProgress.findMany({
    where: { userId },
    select: { status: true },
  });

  // maps
  const daysByStageId = new Map();
  for (const d of days) {
    if (!daysByStageId.has(d.stageId)) daysByStageId.set(d.stageId, []);
    daysByStageId.get(d.stageId).push(d);
  }

  const progressByDayId = new Map();
  for (const p of dayProgressRows) progressByDayId.set(p.dayId, p);

  // Bastan completion واقعی طبق شرطی که خودت گفتی:
  // 1) همه actions done
  // 2) contractSignedAt موجود
  // 3) lastSafetyCheckResult === 'none'
  const allBastanActionsDone =
    bastanActionProgress.length > 0 &&
    bastanActionProgress.every((a) => a.status === 'done');

  const hasSignature = !!bastanState?.contractSignedAt;
  const safetyOk = bastanState?.lastSafetyCheckResult === 'none';

  const bastanCompleted = allBastanActionsDone && hasSignature && safetyOk;

  // stageStates
  const stageStates = [];
  let prevCompleted = true;

  for (const s of stages) {
    const code = String(s.code); // enum -> string
    const daysInStage = daysByStageId.get(s.id) || [];

    let unlocked = false;
    let completed = false;
    let canUnlockNow = false;
    let unlockedAt = null;

    if (code === 'bastan') {
      unlocked = true;
      completed = bastanCompleted;
      canUnlockNow = false;
    } else if (code === 'gosastan') {
      // unlock گسستن فقط با bastanCompleted
      unlocked = bastanCompleted;
      canUnlockNow = bastanCompleted;
      unlockedAt = bastanState?.gosastanUnlockedAt || null;

      // completion مراحل بعدی فعلاً با day terminal
      completed = unlocked && daysInStage.length
        ? allDaysTerminal(daysInStage, progressByDayId)
        : false;
    } else {
      // مراحل بعدی: فعلاً خطی بر اساس تکمیل مرحله قبلی (بعداً دقیق‌تر می‌کنیم)
      unlocked = prevCompleted === true;
      completed = unlocked && daysInStage.length
        ? allDaysTerminal(daysInStage, progressByDayId)
        : false;
      canUnlockNow = false;
    }

    stageStates.push({ code, unlocked, completed, canUnlockNow, unlockedAt });
    prevCompleted = completed;
  }

  return {
    activeStage: null,
    activeDay: null,
    stages: stageStates,
    _debug: {
      bastan: {
        allBastanActionsDone,
        hasSignature,
        safetyOk,
        bastanCompleted,
      },
    },
  };
}

module.exports = { computePelekanState };