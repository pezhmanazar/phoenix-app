// services/pelekan/computePelekanState.cjs
const prisma = require('../../utils/prisma.cjs');
const { StateError, StateErrorCodes } = require('./stateErrors.cjs');

function allDaysTerminal(daysInStage, progressByDayId) {
  for (const d of daysInStage) {
    const p = progressByDayId.get(d.id);
    if (!p) return false;
    if (p.status !== 'completed' && p.status !== 'failed') return false;
  }
  return true;
}

function findActiveStage(stageStates) {
  const unlocked = stageStates.filter((s) => s.unlocked);
  // آخرین stage باز شده که کامل نشده
  for (let i = unlocked.length - 1; i >= 0; i--) {
    if (!unlocked[i].completed) return unlocked[i];
  }
  return null;
}

function pickActiveDay(daysInStage, progressByDayId) {
  // 1) اگر active وجود دارد
  const active = [];
  for (const d of daysInStage) {
    const p = progressByDayId.get(d.id);
    if (p && p.status === 'active') {
      active.push({ day: d, progress: p });
    }
  }
  if (active.length === 1) return active[0];
  if (active.length > 1) {
    throw new StateError(StateErrorCodes.INVALID_ACTIVE_DAY_COUNT, 'More than one active day');
  }

  // 2) اگر active نداریم: اولین day که completed/failed نیست
  for (const d of daysInStage) {
    const p = progressByDayId.get(d.id);
    if (!p) {
      // progress اصلاً ساخته نشده => یعنی هنوز شروع نشده => candidate
      return { day: d, progress: null };
    }
    if (p.status !== 'completed' && p.status !== 'failed') {
      return { day: d, progress: p };
    }
  }

  // 3) هیچ روزی برای کار باقی نمانده
  return null;
}

async function computePelekanState(userId) {
  if (!userId) throw new Error('userId is required');

  // 1) stages
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

  // 3) day progress
  const dayProgressRows = await prisma.pelekanDayProgress.findMany({
    where: { userId },
    select: { dayId: true, status: true },
  });

  // 4) BastanState
  const bastanState = await prisma.bastanState.findUnique({
    where: { userId },
    select: {
      contractSignedAt: true,
      lastSafetyCheckResult: true,
      gosastanUnlockedAt: true,
    },
  });

  // 5) BastanActionDefinition
  const bastanDefs = await prisma.bastanActionDefinition.findMany({
    select: { id: true, code: true },
  });

  // 6) BastanActionProgress
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

  // bastan completion
  const progressByActionId = new Map();
  for (const p of bastanActionProgress) progressByActionId.set(p.actionId, p);

  const allBastanActionsDone =
    bastanDefs.length > 0 &&
    bastanDefs.every((def) => {
      const pr = progressByActionId.get(def.id);
      return pr && pr.status === 'done';
    });

  const hasSignature = !!bastanState?.contractSignedAt;
  const safetyOk = bastanState?.lastSafetyCheckResult === 'none';
  const bastanCompleted = allBastanActionsDone && hasSignature && safetyOk;

  // stageStates
  const stageStates = [];
  let prevCompleted = true;

  for (const s of stages) {
    const code = String(s.code);
    const daysInStage = daysByStageId.get(s.id) || [];

    let unlocked = false;
    let completed = false;
    let canUnlockNow = false;
    let unlockedAt = null;

    if (code === 'bastan') {
      unlocked = true;
      completed = bastanCompleted;
    } else if (code === 'gosastan') {
      unlocked = bastanCompleted;
      canUnlockNow = bastanCompleted;
      unlockedAt = bastanState?.gosastanUnlockedAt || null;
      completed = unlocked && daysInStage.length ? allDaysTerminal(daysInStage, progressByDayId) : false;
    } else {
      unlocked = prevCompleted === true;
      completed = unlocked && daysInStage.length ? allDaysTerminal(daysInStage, progressByDayId) : false;
    }

    stageStates.push({ code, unlocked, completed, canUnlockNow, unlockedAt });
    prevCompleted = completed;
  }

  // Active Stage
  let activeStage = findActiveStage(stageStates);
  if (!activeStage) {
    throw new StateError(StateErrorCodes.NO_ACTIVE_STAGE, 'No active stage could be determined');
  }

  // Active Day (داخل activeStage)
  const activeStageEntity = stages.find((s) => String(s.code) === activeStage.code);
  const daysInActiveStage = daysByStageId.get(activeStageEntity.id) || [];

  const picked = pickActiveDay(daysInActiveStage, progressByDayId);
  if (!picked) {
    // یعنی کل روزهای این stage تمام شده؛ پس state فعلاً ناقص است چون هنوز executor نداریم که stage را complete کند
    // ولی برای جلوگیری از سکوت، خطا می‌دهیم
    throw new StateError(StateErrorCodes.INVALID_ACTIVE_DAY_COUNT, 'No remaining day to activate in active stage');
  }

  const activeDay = {
    stageCode: activeStage.code,
    dayNumberInStage: picked.day.dayNumberInStage,
    status: picked.progress ? picked.progress.status : 'active',
    dayId: picked.day.id, // مفید برای executor بعدی
  };

  // validate یکتایی: مطمئن شو activeDay متعلق به همان stage است (عملاً هست)
  return {
    activeStage,
    activeDay,
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