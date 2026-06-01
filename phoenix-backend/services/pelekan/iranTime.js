export function getIranDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return {
    year: Number(parts.find((p) => p.type === "year")?.value),
    month: Number(parts.find((p) => p.type === "month")?.value),
    day: Number(parts.find((p) => p.type === "day")?.value),
  };
}

/**
 * شروع روز بعد تقویمی ایران را به Date بر اساس UTC برمی‌گرداند.
 * ایران فعلاً UTC+03:30 است.
 */
export function getNextIranCalendarDayStart(date = new Date()) {
  const { year, month, day } = getIranDateParts(date);

  // روز بعد، ساعت 00:00 تهران = روز قبل ساعت 20:30 UTC
  return new Date(Date.UTC(year, month - 1, day + 1, -3, -30, 0, 0));
}
