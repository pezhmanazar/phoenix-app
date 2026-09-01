export type XpJourneyLevel = {
  level: number;
  minXp: number;
  titleFa: string;
  shortFa: string;
};

export const XP_JOURNEY_LEVELS: XpJourneyLevel[] = [
  {
    level: 1,
    minXp: 0,
    titleFa: "خاکستر",
    shortFa: "آغاز سفر ققنوس",
  },
  {
    level: 2,
    minXp: 300,
    titleFa: "نبض زندگی",
    shortFa: "زیر خاکستر، چیزی هنوز زنده‌ست",
  },
  {
    level: 3,
    minXp: 700,
    titleFa: "اولین نفس",
    shortFa: "زندگی آروم‌آروم برمی‌گرده",
  },
  {
    level: 4,
    minXp: 1200,
    titleFa: "ققنوس نوپا",
    shortFa: "ققنوس تو دوباره متولد شده",
  },
  {
    level: 5,
    minXp: 2000,
    titleFa: "ققنوس نوجوان",
    shortFa: "دیگه فقط زنده نیست؛ در حال قوی‌تر شدنه",
  },
  {
    level: 6,
    minXp: 3000,
    titleFa: "بال‌گشایی",
    shortFa: "وقت باز کردن بال‌هاییه که دوباره ساختی",
  },
  {
    level: 7,
    minXp: 4000,
    titleFa: "اولین پرواز",
    shortFa: "برای اولین بار، خاکستر رو زیر پات گذاشتی",
  },
  {
    level: 8,
    minXp: 5200,
    titleFa: "اوج‌گیری",
    shortFa: "مسیر حالا فقط رو به جلو نیست؛ رو به بالاست",
  },
  {
    level: 9,
    minXp: 6500,
    titleFa: "ققنوس بالغ",
    shortFa: "اون چیزی که از خاکستر بلند شد، حالا روی بال‌های خودشه",
  },
  {
    level: 10,
    minXp: 8000,
    titleFa: "ققنوس جاودان",
    shortFa: "تو جاودانه شدی",
  },
];

export function getXpJourneyState(xp: number) {
  const safeXp = Math.max(0, Number(xp) || 0);

  let current = XP_JOURNEY_LEVELS[0];

  for (const level of XP_JOURNEY_LEVELS) {
    if (safeXp >= level.minXp) {
      current = level;
    } else {
      break;
    }
  }

  const currentIndex = XP_JOURNEY_LEVELS.findIndex(
    (item) => item.level === current.level,
  );

  const next = XP_JOURNEY_LEVELS[currentIndex + 1] ?? null;

  const xpIntoLevel = safeXp - current.minXp;

  const xpNeededForLevel = next
    ? next.minXp - current.minXp
    : 0;

  const progress = next
    ? Math.max(
        0,
        Math.min(1, xpIntoLevel / xpNeededForLevel),
      )
    : 1;

  return {
    xp: safeXp,
    current,
    next,
    currentIndex,
    progress,
    xpIntoLevel,
    xpNeededForLevel,
    xpToNext: next
      ? Math.max(0, next.minXp - safeXp)
      : 0,
    isMaxLevel: !next,
  };
}

export function toPersianDigits(
  value: string | number,
) {
  return String(value).replace(
    /\d/g,
    (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)],
  );
}

export function formatXp(value: number) {
  return toPersianDigits(
    Math.max(0, Math.round(value)).toLocaleString("en-US"),
  );
}