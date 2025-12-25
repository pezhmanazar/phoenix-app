// services/pelekan/computePelekanState.cjs
const prisma = require('../../utils/prisma.cjs');
const { StateError, StateErrorCodes } = require('./stateErrors.cjs');

function allDaysTerminal(daysInStage, progressByDayId) {
  // terminal = completed یا failed
  for (const d of daysInStage) {
    const p = progressByDayId.get(d.id);
    if (!p) return false;
    if (p.status !== 'completed' && p.status !== 'failed') return false;
  }
  return true;
}

/**
 * computePelekanState
 * - فقط می‌خواند و تصمیم می‌گیرد
 * - هیچ INSERT/UPDATE انجام نمی‌دهد
 */
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
  const stageIds = stages.map((s) => s.id);
  const days = await prisma.pelekanDay.findMany({
    where: { stageId: { in: stageIds } },
    orderBy: [{ stageId: 'asc' }, { dayNumberInStage: 'asc' }],
    select: { id: true, stageId: true, dayNumberInStage: true },
  });

  // 3) day progress (برای user)
  const dayProgressRows = await prisma.pelekanDayProgress.findMany({
    where: { userId },
    select: { dayId: true, status: true },
  });

  // 4) BastanState (برای امضا و safety + تاریخ unlock قبلی اگر وجود داشته)
  const bastanState = await prisma.bastanState.findUnique({
    where: { userId },
    select: {
      contractSignedAt: true,
      lastSafetyCheckResult: true, // none | role_based | emotional | null
      gosastanUnlockedAt: true,
    },
  });

  // 5) BastanActionDefinition (همه اکشن‌های تعریف‌شده: باید 8 تا باشند)
  const bastanDefs = await prisma.bastanActionDefinition.findMany({
    select: { id: true, code: true },
  });

  // 6) BastanActionProgress (پیشرفت کاربر)
  const bastanActionProgress = await prisma.bastanActionProgress.findMany({
    where: { userId },
    select: { actionId: true, status: true },
  });

  // maps
  const daysByStageId = new Map();
  for (const d of days) {
    if (!daysByStageId.has(d.stageId)) daysByStageId.set(d.stageId, []);
    daysByStageId.get(d.stageId).push(d);
  }

  const progressByDayId = new Map();
  for (const p of dayProgressRows) progressByDayId.set(p.dayId, p);

  // --- Bastan completion واقعی ---
  // شرط 1) همه 8 action تعریف‌شده باید progress داشته باشند و done باشند
  const progressByActionId = new Map();
  for (const p of bastanActionProgress) progressByActionId.set(p.actionId, p);

  const allBastanActionsDone =
    bastanDefs.length > 0 &&
    bastanDefs.every((def) => {
      const pr = progressByActionId.get(def.id);
      return pr && pr.status === 'done';
    });

  // شرط 2) امضا
  const hasSignature = !!bastanState?.contractSignedAt;

  // شرط 3) safety
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

      // توجه: این تاریخ ممکن است از قبل دستی ست شده باشد،
      // ولی unlock واقعی را "unlocked" تعیین می‌کند، نه این تاریخ.
      unlockedAt = bastanState?.gosastanUnlockedAt || null;

      // completion مراحل بعدی فعلاً با day terminal
      completed =
        unlocked && daysInStage.length
          ? allDaysTerminal(daysInStage, progressByDayId)
          : false;
    } else {
      // مراحل بعدی: فعلاً خطی بر اساس تکمیل مرحله قبلی
      unlocked = prevCompleted === true;
      completed =
        unlocked && daysInStage.length
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
        defsCount: bastanDefs.length,
        progressCount: bastanActionProgress.length,
        allBastanActionsDone,
        hasSignature,
        safetyOk,
        bastanCompleted,
      },
    },
  };
}

module.exports = { computePelekanState };