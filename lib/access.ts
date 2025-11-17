// lib/access.ts
import type { PlanStatus } from "./plan";

/**
 * نوع کلی نتیجه‌ی دسترسی.
 * reason می‌تونه بعداً برای نمایش پیام مناسب استفاده بشه.
 */
export type AccessReason =
  | "OK"
  | "NEED_PRO"
  | "NEED_LOGIN"
  | "LIMIT_REACHED"
  | "UNKNOWN";

export type AccessResult = {
  allowed: boolean;
  reason: AccessReason;
};

/** کمک ساده برای ساخت نتیجه */
function ok(): AccessResult {
  return { allowed: true, reason: "OK" };
}
function deny(reason: AccessReason): AccessResult {
  return { allowed: false, reason };
}

/* ================== قوانین تب‌ها ================== */

/**
 * دسترسی به روز مشخصی از پلکان.
 * dayIndex: 0 یعنی روز صفر (رایگان)، 1 به بعد یعنی قفل برای free.
 */
export function canAccessPelekanDay(
  plan: PlanStatus,
  dayIndex: number
): AccessResult {
  if (dayIndex <= 0) return ok(); // روز صفر همیشه باز

  if (!plan.isActive || !plan.isPaid) {
    // پلن یا پولی نیست یا منقضی شده
    return deny("NEED_PRO");
  }
  return ok();
}

/**
 * دسترسی به محتوای اصلی پناهگاه (غیر از متن معرفی).
 * معرفی همیشه آزاد است، پس این فقط برای بخش‌های عمیق‌تر است.
 */
export function canAccessPanahgahContent(plan: PlanStatus): AccessResult {
  if (!plan.isActive || !plan.isPaid) return deny("NEED_PRO");
  return ok();
}

/**
 * پشتیبانی فنی همیشه برای همه باز است.
 * قانونش ساده است ولی برای یک‌دست بودن نگهش می‌داریم.
 */
export function canAccessTechSupport(plan: PlanStatus): AccessResult {
  return ok();
}

/**
 * پشتیبانی درمانگر انسانی (چت/تیکت با تراپیست).
 * فقط pro/vip فعال.
 */
export function canAccessTherapistSupport(
  plan: PlanStatus
): AccessResult {
  if (!plan.isActive || !plan.isPaid) return deny("NEED_PRO");
  return ok();
}

/* ================== قوانین مربوط به AI ================== */

/**
 * حد روزانه‌ی پیام‌های AI برای کاربر فعلی.
 * free → 3 پیام در روز
 * pro/vip فعال → بی‌نهایت (عملاً 1000)
 */
export function getDailyAiLimit(plan: PlanStatus): number {
  if (!plan.isActive || !plan.isPaid) return 3;
  // اگر پلن فعال است
  return 1000; // سقف عملی، برای محاسبه راحت‌تر از Infinity
}

/**
 * چک می‌کند آیا کاربر می‌تواند پیام AI دیگری امروز بفرستد یا نه.
 * countToday: تعداد پیام‌هایی که امروز فرستاده.
 */
export function canSendAiMessage(
  plan: PlanStatus,
  countToday: number
): AccessResult {
  const limit = getDailyAiLimit(plan);
  if (countToday < limit) return ok();
  return deny("LIMIT_REACHED");
}

/* ================== تب‌های همیشه آزاد ================== */

/**
 * تب‌هایی که همیشه باز هستند: Phoenix Home و روزنگار.
 * این توابع صرفاً برای یک‌دست بودن API نگه‌داشته شده‌اند.
 */
export function canAccessPhoenixHome(plan: PlanStatus): AccessResult {
  return ok();
}

export function canAccessRooznegar(plan: PlanStatus): AccessResult {
  return ok();
}