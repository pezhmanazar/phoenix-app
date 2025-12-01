// lib/planStatus.ts

export type EffectivePlan = "free" | "pro" | "expired";
export type BaseStatus = "free" | "pro";

export interface PlanStatusInput {
  me: any;                     // همون شیء user از useUser()
  // ⚠️ این دو تا عملاً بازنشسته شدن؛ فقط برای سازگاری تایپی نگه‌شون می‌داریم
  proFlag?: boolean;           // phoenix_is_pro === "1" (دیگه در منطق استفاده نمی‌شود)
  localExpire?: string | null; // تاریخ لوکال بعد از پرداخت (دیگه در منطق استفاده نمی‌شود)
  now?: Date;                  // برای تست، می‌تونی تزریق کنی. در عمل لازم نیست پرش کنی.
}

export interface PlanStatusResult {
  rawPlan: string;             // مثلا "free" | "pro" | "vip" | ...
  baseStatus: BaseStatus;      // فقط "free" یا "pro" قبل از چک انقضا
  effectivePlan: EffectivePlan;// "free" | "pro" | "expired"
  planExpiresAt?: string;      // ISO نهایی که باید UI باهاش کار کنه
  isExpired: boolean;
  daysRemaining: number | null; // null یعنی تاریخ انقضا نداریم، 0 یعنی گذشته
  isAlmostExpired: boolean;    // ۱ تا ۷ روز مونده و هنوز پرو هست
}

/**
 * استخراج تاریخ انقضا از فیلدهای مختلف me
 * ترتیب اهمیت باید با همه جا یکی باشه تا قفل بشه.
 */
export function getServerExpireFromUser(me: any): string | null {
  if (!me) return null;
  return (
    me.planExpiresAt ??
    me.planExpireAt ??
    me.planExpire ??
    me.proUntil ??
    me.expiresAt ??
    null
  );
}

/**
 * محاسبه وضعیت نهایی پلن بر اساس فقط و فقط سرور:
 * - plan در سرور
 * - تاریخ انقضا از سرور
 *
 * proFlag و localExpire دیگر نقشی در منطق ندارند.
 */
export function computePlanStatus(input: PlanStatusInput): PlanStatusResult {
  const { me, now: nowArg } = input;
  const now = nowArg ?? new Date();

  const rawPlan: string = (me?.plan as string) || "free";

  // ۱) baseStatus قبل از درنظر گرفتن تاریخ انقضا (فقط از روی plan سرور)
  let baseStatus: BaseStatus = "free";
  if (rawPlan === "pro" || rawPlan === "vip") {
    baseStatus = "pro";
  }

  // ۲) تاریخ انقضا فقط از سرور
  const serverExpire = getServerExpireFromUser(me);
  const planExpiresAt: string | undefined = serverExpire || undefined;

  // ۳) چک انقضا
  let isExpired = false;
  if (planExpiresAt) {
    const ts = new Date(planExpiresAt).getTime();
    if (!Number.isNaN(ts) && ts < now.getTime()) {
      isExpired = true;
    }
  }

  // ۴) effectivePlan نهایی
  let effectivePlan: EffectivePlan;
  if (baseStatus === "pro") {
    effectivePlan = isExpired ? "expired" : "pro";
  } else {
    effectivePlan = "free";
  }

  // ۵) daysRemaining
  let daysRemaining: number | null = null;
  if (planExpiresAt) {
    const endTs = new Date(planExpiresAt).getTime();
    if (!Number.isNaN(endTs)) {
      const diffMs = endTs - now.getTime();
      if (diffMs <= 0) {
        daysRemaining = 0;
      } else {
        daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      }
    }
  }

  // ۶) نزدیک به انقضا: فقط وقتی پرو است و ۱ تا ۷ روز باقی مانده
  const isAlmostExpired =
    effectivePlan === "pro" &&
    typeof daysRemaining === "number" &&
    daysRemaining > 0 &&
    daysRemaining <= 7;

  return {
    rawPlan,
    baseStatus,
    effectivePlan,
    planExpiresAt,
    isExpired,
    daysRemaining,
    isAlmostExpired,
  };
}