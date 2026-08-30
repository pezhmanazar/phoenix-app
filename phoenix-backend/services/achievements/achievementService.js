import prisma from "../../utils/prisma.js";
import { createAndSendNotification } from "../notifications/notificationService.js";

const ACHIEVEMENT_ORDER = [
  "BASTAN_COMPLETE",
  "NO_CONTACT_10",
  "GOSASTAN_COMPLETE",
  "NO_CONTACT_21",
  "SOOKHTAN_COMPLETE",
  "PHOENIX_RESISTANCE",
  "SERESHTAN_COMPLETE",
  "NO_CONTACT_40",
  "ZIESTAN_COMPLETE",
  "SAKHTAN_COMPLETE",
  "STEEL_CONTINUITY",
  "RASTAN_COMPLETE",
  "GOLDEN_PHOENIX",
];

const STAGE_TO_MEDAL = {
  bastan: "BASTAN_COMPLETE",
  gosastan: "GOSASTAN_COMPLETE",
  sookhtan: "SOOKHTAN_COMPLETE",
  sereshtan: "SERESHTAN_COMPLETE",
  ziestan: "ZIESTAN_COMPLETE",
  sakhtan: "SAKHTAN_COMPLETE",
  rastan: "RASTAN_COMPLETE",
};

function allDaysTerminal(days, progressByDayId) {
  if (!days.length) {
    return false;
  }

  return days.every((day) => {
    const progress = progressByDayId.get(day.id);

    return (
      progress &&
      (progress.status === "completed" || progress.status === "failed")
    );
  });
}

async function computeAchievementEligibility(userId) {
  const [stages, dayProgress, streak, xpAggregate] = await Promise.all([
    prisma.pelekanStage.findMany({
      orderBy: {
        sortOrder: "asc",
      },
      include: {
        days: {
          select: {
            id: true,
          },
        },
      },
    }),

    prisma.pelekanDayProgress.findMany({
      where: {
        userId,
      },
      select: {
        dayId: true,
        status: true,
      },
    }),

    prisma.pelekanStreak.findUnique({
      where: {
        userId,
      },
      select: {
        currentDays: true,
        bestDays: true,
      },
    }),

    prisma.xpLedger.aggregate({
      where: {
        userId,
      },
      _sum: {
        amount: true,
      },
    }),
  ]);

  const progressByDayId = new Map(dayProgress.map((row) => [row.dayId, row]));

  const completedStages = new Set();

  for (const stage of stages) {
    const code = String(stage.code);

    const completed = allDaysTerminal(stage.days || [], progressByDayId);

    if (completed) {
      completedStages.add(code);
    }
  }

  const bestNoContactDays = Number(streak?.bestDays) || 0;

  const currentNoContactDays = Number(streak?.currentDays) || 0;

  const xpTotal = Number(xpAggregate?._sum?.amount) || 0;

  const eligibleCodes = new Set();

  for (const [stageCode, medalCode] of Object.entries(STAGE_TO_MEDAL)) {
    if (completedStages.has(stageCode)) {
      eligibleCodes.add(medalCode);
    }
  }

  if (bestNoContactDays >= 10) {
    eligibleCodes.add("NO_CONTACT_10");
  }

  if (bestNoContactDays >= 21) {
    eligibleCodes.add("NO_CONTACT_21");
  }

  if (bestNoContactDays >= 40) {
    eligibleCodes.add("NO_CONTACT_40");
  }

  /*
   * لوح مقاومت ققنوس:
   * زیستن تکمیل شده باشد
   * و کاربر حداقل یک‌بار به 40 روز عدم تماس رسیده باشد.
   */
  if (completedStages.has("ziestan") && bestNoContactDays >= 40) {
    eligibleCodes.add("PHOENIX_RESISTANCE");
  }

  /*
   * استمرار پولادین:
   * همزمان با تکمیل ساختن.
   */
  if (completedStages.has("sakhtan")) {
    eligibleCodes.add("STEEL_CONTINUITY");
  }

  /*
   * تندیس زرین ققنوس:
   * بالاترین دستاورد سیستم.
   * تنها زمانی داده می‌شود که تمام 12 دستاورد قبلی
   * واجد شرایط شده باشند.
   */
  const goldenPhoenixRequirements = [
    "BASTAN_COMPLETE",
    "NO_CONTACT_10",
    "GOSASTAN_COMPLETE",
    "NO_CONTACT_21",
    "SOOKHTAN_COMPLETE",
    "PHOENIX_RESISTANCE",
    "SERESHTAN_COMPLETE",
    "NO_CONTACT_40",
    "ZIESTAN_COMPLETE",
    "SAKHTAN_COMPLETE",
    "STEEL_CONTINUITY",
    "RASTAN_COMPLETE",
  ];

  const goldenPhoenixEligible = goldenPhoenixRequirements.every((code) =>
    eligibleCodes.has(code),
  );

  if (goldenPhoenixEligible) {
    eligibleCodes.add("GOLDEN_PHOENIX");
  }

  return {
    eligibleCodes,
    completedStages,
    bestNoContactDays,
    currentNoContactDays,
    xpTotal,
  };
}

async function sendAchievementNotification({ userId, achievement, kind }) {
  try {
    await createAndSendNotification({
      userId,
      type: "achievement",
      title: "دستاورد جدید ققنوس 🏅",
      body: `«${achievement.titleFa}» را به دست آوردی.`,
      data: {
        achievementCode: achievement.code,
        achievementKind: kind,
        route: "/achievements",
      },
    });
  } catch (error) {
    /*
     * شکست Notification نباید باعث شود
     * خود achievement rollback یا خراب شود.
     */
    console.error("[ACHIEVEMENT_NOTIFICATION_ERROR]", {
      userId,
      code: achievement.code,
      error: error?.message || "unknown_error",
    });
  }
}

async function awardMedal({ userId, medal, notify }) {
  try {
    const userMedal = await prisma.userMedal.create({
      data: {
        userId,
        medalId: medal.id,
      },
    });

    if (notify) {
      await sendAchievementNotification({
        userId,
        achievement: medal,
        kind: "medal",
      });
    }

    return {
      created: true,
      earnedAt: userMedal.earnedAt,
    };
  } catch (error) {
    /*
     * unique(userId, medalId)
     * باعث می‌شود sync کاملاً idempotent باشد.
     */
    if (error?.code === "P2002") {
      return {
        created: false,
        earnedAt: null,
      };
    }

    throw error;
  }
}

async function awardBadge({ userId, badge, notify }) {
  try {
    const userBadge = await prisma.userIdentityBadge.create({
      data: {
        userId,
        badgeId: badge.id,
      },
    });

    if (notify) {
      await sendAchievementNotification({
        userId,
        achievement: badge,
        kind: "badge",
      });
    }

    return {
      created: true,
      earnedAt: userBadge.earnedAt,
    };
  } catch (error) {
    if (error?.code === "P2002") {
      return {
        created: false,
        earnedAt: null,
      };
    }

    throw error;
  }
}

export async function syncUserAchievements(userId, { notifyNew = false } = {}) {
  if (!userId) {
    throw new Error("userId is required");
  }

  const eligibility = await computeAchievementEligibility(userId);

  const [medals, badges, existingMedals, existingBadges] = await Promise.all([
    prisma.medal.findMany(),
    prisma.identityBadge.findMany(),

    prisma.userMedal.findMany({
      where: {
        userId,
      },
      select: {
        medalId: true,
        earnedAt: true,
        medal: {
          select: {
            code: true,
          },
        },
      },
    }),

    prisma.userIdentityBadge.findMany({
      where: {
        userId,
      },
      select: {
        badgeId: true,
        earnedAt: true,
        badge: {
          select: {
            code: true,
          },
        },
      },
    }),
  ]);

  const existingMedalCodes = new Set(
    existingMedals.map((row) => row.medal.code),
  );

  const existingBadgeCodes = new Set(
    existingBadges.map((row) => row.badge.code),
  );

  const newlyUnlocked = [];

  for (const medal of medals) {
    if (
      !eligibility.eligibleCodes.has(medal.code) ||
      existingMedalCodes.has(medal.code)
    ) {
      continue;
    }

    const result = await awardMedal({
      userId,
      medal,
      notify: notifyNew,
    });

    if (result.created) {
      newlyUnlocked.push({
        code: medal.code,
        kind: "medal",
        titleFa: medal.titleFa,
        earnedAt: result.earnedAt,
      });

      existingMedalCodes.add(medal.code);
    }
  }

  for (const badge of badges) {
    if (
      !eligibility.eligibleCodes.has(badge.code) ||
      existingBadgeCodes.has(badge.code)
    ) {
      continue;
    }

    const result = await awardBadge({
      userId,
      badge,
      notify: notifyNew,
    });

    if (result.created) {
      newlyUnlocked.push({
        code: badge.code,
        kind: "badge",
        titleFa: badge.titleFa,
        earnedAt: result.earnedAt,
      });

      existingBadgeCodes.add(badge.code);
    }
  }

  return {
    ok: true,
    newlyUnlocked,
    metrics: {
      xpTotal: eligibility.xpTotal,
      noContact: {
        currentDays: eligibility.currentNoContactDays,
        bestDays: eligibility.bestNoContactDays,
      },
      completedStages: Array.from(eligibility.completedStages),
    },
  };
}

export async function getUserAchievements(userId, { sync = true } = {}) {
  if (!userId) {
    throw new Error("userId is required");
  }

  /*
   * GET صفحه افتخارات:
   * دستاوردهای قدیمی را backfill می‌کند
   * ولی Push انبوه برای گذشته نمی‌فرستد.
   */
  if (sync) {
    await syncUserAchievements(userId, {
      notifyNew: false,
    });
  }

  const [medals, badges, userMedals, userBadges] = await Promise.all([
    prisma.medal.findMany(),
    prisma.identityBadge.findMany(),

    prisma.userMedal.findMany({
      where: {
        userId,
      },
      select: {
        medalId: true,
        earnedAt: true,
      },
    }),

    prisma.userIdentityBadge.findMany({
      where: {
        userId,
      },
      select: {
        badgeId: true,
        earnedAt: true,
      },
    }),
  ]);

  const earnedMedals = new Map(
    userMedals.map((row) => [row.medalId, row.earnedAt]),
  );

  const earnedBadges = new Map(
    userBadges.map((row) => [row.badgeId, row.earnedAt]),
  );

  const items = [
    ...medals.map((medal) => ({
      code: medal.code,
      kind: "medal",
      titleFa: medal.titleFa,
      description: medal.description || null,
      iconKey: medal.iconKey || null,
      unlocked: earnedMedals.has(medal.id),
      earnedAt: earnedMedals.get(medal.id) || null,
    })),

    ...badges.map((badge) => ({
      code: badge.code,
      kind: "badge",
      titleFa: badge.titleFa,
      description: badge.description || null,
      iconKey: badge.iconKey || null,
      unlocked: earnedBadges.has(badge.id),
      earnedAt: earnedBadges.get(badge.id) || null,
    })),
  ];

  items.sort((a, b) => {
    const aIndex = ACHIEVEMENT_ORDER.indexOf(a.code);

    const bIndex = ACHIEVEMENT_ORDER.indexOf(b.code);

    const safeA = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;

    const safeB = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;

    return safeA - safeB;
  });

  const unlockedCount = items.filter((item) => item.unlocked).length;

  return {
    ok: true,
    totalCount: items.length,
    unlockedCount,
    lockedCount: items.length - unlockedCount,
    items,
  };
}
