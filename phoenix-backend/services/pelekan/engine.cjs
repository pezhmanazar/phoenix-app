// services/pelekan/engine.cjs
const { ensureActivePelekanDay } = require("./ensureActivePelekanDay.cjs");

async function refresh(prisma, userId) {
  if (!prisma) throw new Error("PRISMA_REQUIRED");
  if (!userId) throw new Error("USER_ID_REQUIRED");

  // 1) اگر همین الان activeDay داریم، دست نزن
  const active = await prisma.pelekanDayProgress.findFirst({
    where: { userId, status: "active" },
    select: { dayId: true },
  });
  if (active?.dayId) {
    return { ok: true, desiredDayId: active.dayId, alreadyActive: true };
  }

  // 2) تشخیص unlock گسستن از روی BastanState
  const bastanState = await prisma.bastanState.findUnique({
    where: { userId },
    select: { gosastanUnlockedAt: true },
  });
  const gosastanUnlocked = !!bastanState?.gosastanUnlockedAt;

  // 3) مراحل و روزها
  const stages = await prisma.pelekanStage.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      code: true,
      sortOrder: true,
      days: {
        orderBy: { dayNumberInStage: "asc" },
        select: { id: true, dayNumberInStage: true, globalDayNumber: true },
      },
    },
  });

  // 4) فقط فعلاً تا گسستن را unlock می‌کنیم (برای مراحل بعدی بعداً گسترش می‌دهیم)
  const isUnlocked = (code) => {
    if (code === "bastan") return true;
    if (code === "gosastan") return gosastanUnlocked;
    return false;
  };

  // 5) پیدا کردن اولین stage که unlock است و هنوز کامل نشده
  let desiredDayId = null;

  for (const s of stages) {
    if (!isUnlocked(s.code)) continue;
    if (!s.days?.length) continue;

    const dayIds = s.days.map((d) => d.id);

    const completedCount = await prisma.pelekanDayProgress.count({
      where: { userId, dayId: { in: dayIds }, status: "completed" },
    });

    const stageCompleted = completedCount >= dayIds.length;
    if (stageCompleted) continue;

    // اولین روز این stage
    desiredDayId = s.days[0].id;
    break;
  }

  // 6) اگر هیچ چیزی پیدا نکردیم، fallback: اولین روز bastan
  if (!desiredDayId) {
    const bastan = stages.find((s) => s.code === "bastan");
    desiredDayId = bastan?.days?.[0]?.id ?? null;
  }

  // 7) فعال‌سازی یک activeDay واحد
  await ensureActivePelekanDay(prisma, userId, desiredDayId);

  return { ok: true, desiredDayId, alreadyActive: false };
}

module.exports = { refresh };