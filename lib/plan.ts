// phoenix-app/lib/plan.ts
import type { UserRecord } from "../api/user";

/** فلگ مشترک برای جاهایی که می‌خوایم پرو بودن را تو AsyncStorage نگه داریم */
export const PRO_FLAG_KEY = "phoenix_is_pro";

export type EffectivePlan = "free" | "pro" | "vip";

export type PlanStatus = {
  /** پلن خامی که از سرور می‌آید (بدون درنظر گرفتن انقضا) */
  rawPlan: EffectivePlan;
  /** تاریخ انقضای خام (ممکن است null باشد) */
  rawExpiresAt: string | null;
  /** پلن نهایی بعد از درنظر گرفتن انقضا */
  effectivePlan: EffectivePlan;
  /** آیا عملاً پرو (یا VIP) است؟ */
  isPro: boolean;
  /** آیا پلن منقضی شده است؟ */
  isExpired: boolean;
  /** تعداد روز باقیمانده تا انقضا؛ اگر تاریخ نداشته باشیم → null */
  daysLeft: number | null;
  /**
   * آیا پلن "در حال انقضا" است؟
   * یعنی هنوز پرو است و بین ۱ تا ۷ روز تا پایانش باقی مانده.
   */
  isAlmostExpired: boolean;
};

/** پلن خام را از یوزر بگیر (اگر undefined بود → free) */
function getRawPlan(user?: UserRecord | null): EffectivePlan {
  const p = user?.plan ?? "free";
  return p === "pro" || p === "vip" ? p : "free";
}

/** ISO → Date (اگر نامعتبر بود null) */
function safeDate(input?: string | null): Date | null {
  if (!input) return null;
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * محاسبه وضعیت پلن از روی رکورد یوزر
 * - اگر planExpiresAt نداشته باشد → پلن می‌تواند دائمی باشد (مثلاً PRO دائمی) یا free
 * - اگر planExpiresAt در گذشته باشد → پلن موثر free و isExpired = true
 */
export function getPlanStatus(
  user?: UserRecord | null,
  now: Date = new Date()
): PlanStatus {
  const rawPlan = getRawPlan(user);
  const rawExpiresAt = user?.planExpiresAt ?? null;

  const exp = safeDate(rawExpiresAt);
  const hasExpiry = !!exp;

  let isExpired = false;
  let daysLeft: number | null = null;

  if (hasExpiry && exp) {
    const diffMs = exp.getTime() - now.getTime();
    const d = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    // اگر گذشته باشد، روز باقیمانده را ۰ درنظر می‌گیریم
    daysLeft = d >= 0 ? d : 0;
    isExpired = diffMs <= 0;
  }

  let effectivePlan: EffectivePlan = "free";

  if (!hasExpiry) {
    // بدون تاریخ انقضا → پلن می‌تواند واقعاً PRO/VIP دائمی باشد
    effectivePlan = rawPlan === "pro" || rawPlan === "vip" ? rawPlan : "free";
    // در این حالت daysLeft = null می‌ماند و isExpired = false
  } else {
    // اگر تاریخ داریم:
    if (!isExpired) {
      effectivePlan = rawPlan;
    } else {
      // منقضی شده → عملاً دسترسی مثل free
      effectivePlan = "free";
    }
  }

  const isPro = effectivePlan === "pro" || effectivePlan === "vip";

  const isAlmostExpired =
    isPro &&
    !isExpired &&
    typeof daysLeft === "number" &&
    daysLeft > 0 &&
    daysLeft <= 7;

  return {
    rawPlan,
    rawExpiresAt,
    effectivePlan,
    isPro,
    isExpired,
    daysLeft,
    isAlmostExpired,
  };
}

/** یک فرمت ساده برای نمایش تاریخ انقضا (می‌تونی بعداً عوضش کنی) */
export function formatExpireDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = safeDate(iso);
  if (!d) return null;
  // فعلاً میلادی ساده؛ بعداً اگر خواستی شمسی/لوکال اضافه می‌کنیم
  return d.toISOString().slice(0, 10); // yyyy-mm-dd
}