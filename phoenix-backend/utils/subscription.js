// phoenix-app/phoenix-backend/utils/subscription.js

import { computePlanExpiry } from "./plan.js";

/**
 * نهایی‌سازی اشتراک به صورت اتمیک و idempotent
 *
 * سناریوها:
 * 1) اگر subscription با provider+authority از قبل active باشد => همان را idempotent برمی‌گرداند
 * 2) اگر subscription با provider+authority از قبل pending باشد => همان را active می‌کند
 * 3) اگر subscription وجود نداشته باشد => create active
 *
 * نکته مهم:
 * - بهتر است در Prisma schema روی [provider, authority] unique داشته باشید:
 *   @@unique([provider, authority])
 *
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {{
 *   phone: string,
 *   provider: string,
 *   authority: string,
 *   refId: string,
 *   amount: number,
 *   months: number,
 *   plan: string,
 *   now?: Date | string,
 *   metaJson?: any
 * }} input
 */
export async function finalizeSubscription(prisma, input) {
  const {
    phone,
    provider,
    authority,
    refId,
    amount,
    months,
    plan,
    now = new Date(),
    metaJson = null,
  } = input || {};

  const normalizedPhone = String(phone || "").trim();
  const normalizedProvider = String(provider || "").trim().toLowerCase();
  const normalizedAuthority = String(authority || "").trim();
  const normalizedRefId = String(refId || "").trim();
  const normalizedPlan = String(plan || "").trim();

  const normalizedAmount = Number(amount);
  const normalizedMonths = Number(months);

  if (
    !normalizedPhone ||
    !normalizedProvider ||
    !normalizedAuthority ||
    !normalizedRefId ||
    !normalizedPlan ||
    Number.isNaN(normalizedAmount) ||
    Number.isNaN(normalizedMonths) ||
    normalizedMonths <= 0
  ) {
    throw new Error("FINALIZE_SUBSCRIPTION_INVALID_INPUT");
  }

  const paidAt = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(paidAt.getTime())) {
    throw new Error("FINALIZE_SUBSCRIPTION_INVALID_NOW");
  }

  return prisma.$transaction(async (tx) => {
    // 1) کاربر را حتماً داشته باش
    const user = await tx.user.upsert({
      where: { phone: normalizedPhone },
      update: {},
      create: {
        phone: normalizedPhone,
        plan: "free",
        profileCompleted: true,
      },
    });

    // 2) تاریخ انقضا را درست حساب کن:
    // اگر اشتراک فعلی هنوز فعال است، از همان ادامه بده؛
    // وگرنه از paidAt شروع کن.
    const planExpiresAt = computePlanExpiry({
      currentExpiresAt: user.planExpiresAt,
      now: paidAt,
      months: normalizedMonths,
    });

    // 3) اگر subscription با همین provider+authority هست، تعیین تکلیف کن
    const existing = await tx.subscription.findFirst({
      where: {
        provider: normalizedProvider,
        authority: normalizedAuthority,
      },
    });

    if (existing) {
      // اگر قبلاً active شده، idempotent رفتار کن
      if (existing.status === "active") {
        const existingExpiresAt =
          existing.expiresAt || user.planExpiresAt || planExpiresAt;

        await tx.user.update({
          where: { id: user.id },
          data: {
            plan: existing.plan || normalizedPlan,
            planExpiresAt: existingExpiresAt,
          },
        });

        return {
          created: false,
          updatedExisting: false,
          alreadyFinalized: true,
          subscriptionId: existing.id,
          userId: user.id,
          authority: normalizedAuthority,
          provider: normalizedProvider,
          plan: existing.plan || normalizedPlan,
          months: existing.months || normalizedMonths,
          amount: existing.amount || normalizedAmount,
          status: existing.status,
          planExpiresAt: existingExpiresAt,
        };
      }

      // اگر pending است، نهایی‌اش کن
      if (existing.status === "pending") {
        const updatedSub = await tx.subscription.update({
          where: { id: existing.id },
          data: {
            userId: user.id,
            phone: normalizedPhone,
            refId: normalizedRefId,
            amount: normalizedAmount,
            months: normalizedMonths,
            plan: normalizedPlan,
            status: "active",
            provider: normalizedProvider,
            paidAt,
            expiresAt: planExpiresAt,
            metaJson,
          },
        });

        await tx.user.update({
          where: { id: user.id },
          data: {
            plan: normalizedPlan,
            planExpiresAt,
          },
        });

        return {
          created: false,
          updatedExisting: true,
          alreadyFinalized: false,
          subscriptionId: updatedSub.id,
          userId: user.id,
          authority: normalizedAuthority,
          provider: normalizedProvider,
          plan: normalizedPlan,
          months: normalizedMonths,
          amount: normalizedAmount,
          status: "active",
          planExpiresAt,
        };
      }

      // سایر stateها را سخت‌گیرانه fail می‌کنیم
      throw new Error(`FINALIZE_SUBSCRIPTION_INVALID_STATE_${existing.status}`);
    }

    // 4) اگر وجود ندارد، create active
    try {
      const createdSub = await tx.subscription.create({
        data: {
          userId: user.id,
          phone: normalizedPhone,
          authority: normalizedAuthority,
          refId: normalizedRefId,
          amount: normalizedAmount,
          months: normalizedMonths,
          plan: normalizedPlan,
          status: "active",
          provider: normalizedProvider,
          paidAt,
          expiresAt: planExpiresAt,
          metaJson,
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: {
          plan: normalizedPlan,
          planExpiresAt,
        },
      });

      return {
        created: true,
        updatedExisting: false,
        alreadyFinalized: false,
        subscriptionId: createdSub.id,
        userId: user.id,
        authority: normalizedAuthority,
        provider: normalizedProvider,
        plan: normalizedPlan,
        months: normalizedMonths,
        amount: normalizedAmount,
        status: "active",
        planExpiresAt,
      };
    } catch (err) {
      // race condition / unique conflict
      const code = err?.code || err?.meta?.code;
      if (code !== "P2002") throw err;

      const raced = await tx.subscription.findFirst({
        where: {
          provider: normalizedProvider,
          authority: normalizedAuthority,
        },
      });

      if (!raced) throw err;

      if (raced.status === "active") {
        const racedExpiresAt =
          raced.expiresAt || user.planExpiresAt || planExpiresAt;

        await tx.user.update({
          where: { id: user.id },
          data: {
            plan: raced.plan || normalizedPlan,
            planExpiresAt: racedExpiresAt,
          },
        });

        return {
          created: false,
          updatedExisting: false,
          alreadyFinalized: true,
          subscriptionId: raced.id,
          userId: user.id,
          authority: normalizedAuthority,
          provider: normalizedProvider,
          plan: raced.plan || normalizedPlan,
          months: raced.months || normalizedMonths,
          amount: raced.amount || normalizedAmount,
          status: raced.status,
          planExpiresAt: racedExpiresAt,
        };
      }

      if (raced.status === "pending") {
        const updatedSub = await tx.subscription.update({
          where: { id: raced.id },
          data: {
            userId: user.id,
            phone: normalizedPhone,
            refId: normalizedRefId,
            amount: normalizedAmount,
            months: normalizedMonths,
            plan: normalizedPlan,
            status: "active",
            provider: normalizedProvider,
            paidAt,
            expiresAt: planExpiresAt,
            metaJson,
          },
        });

        await tx.user.update({
          where: { id: user.id },
          data: {
            plan: normalizedPlan,
            planExpiresAt,
          },
        });

        return {
          created: false,
          updatedExisting: true,
          alreadyFinalized: false,
          subscriptionId: updatedSub.id,
          userId: user.id,
          authority: normalizedAuthority,
          provider: normalizedProvider,
          plan: normalizedPlan,
          months: normalizedMonths,
          amount: normalizedAmount,
          status: "active",
          planExpiresAt,
        };
      }

      throw new Error(`FINALIZE_SUBSCRIPTION_INVALID_STATE_${raced.status}`);
    }
  });
}
