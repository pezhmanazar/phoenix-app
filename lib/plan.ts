// phoenix-app/lib/plan.ts
import type { UserRecord } from "../api/user";

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
 * - اگر planExpiresAt نداشته باشد → فرض می‌کنیم پلن فعلی آزاد است (free) مگر این‌که بعداً قواعد جدید بگذاریم
 * - اگر planExpiresAt در گذشته باشد → پلن موثر free
 */
export function getPlanStatus(user?: UserRecord | null, now: Date = new Date()): PlanStatus {
  const rawPlan = getRawPlan(user);
  const rawExpiresAt = user?.planExpiresAt ?? null;

  const exp = safeDate(rawExpiresAt);
  const hasExpiry = !!exp;

  let isExpired = false;
  if (hasExpiry && exp) {
    isExpired = exp.getTime() <= now.getTime();
  }

  let effectivePlan: EffectivePlan = "free";
  if (!hasExpiry) {
    // اگر هیچ تاریخ انقضایی نداریم، فعلاً فقط free را معتبر می‌گیریم
    effectivePlan = rawPlan === "pro" || rawPlan === "vip" ? rawPlan : "free";
  } else {
    // اگر تاریخ داریم و منقضی نشده:
    if (!isExpired) {
      effectivePlan = rawPlan;
    } else {
      effectivePlan = "free";
    }
  }

  const isPro = effectivePlan === "pro" || effectivePlan === "vip";

  return {
    rawPlan,
    rawExpiresAt,
    effectivePlan,
    isPro,
    isExpired,
  };
}

/** یک فرمت ساده برای نمایش تاریخ انقضا (می‌تونی بعداً عوضش کنی) */
export function formatExpireDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = safeDate(iso);
  if (!d) return null;
  // اینجا فعلاً میلادی ساده؛ بعداً اگر خواستی شمسی/لوکال اضافه می‌کنیم
  return d.toISOString().slice(0, 10); // yyyy-mm-dd
}