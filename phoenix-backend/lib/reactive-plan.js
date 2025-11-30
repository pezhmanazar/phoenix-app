// phoenix-backend/lib/reactive-plan.js
import { PrismaClient } from "@prisma/client";

// حواسمون هست روی ورسل هزار تا کانکشن نسازیم
const globalForPrisma = globalThis;
const prisma =
  globalForPrisma.__phoenixPrisma || new PrismaClient();

if (!globalForPrisma.__phoenixPrisma) {
  globalForPrisma.__phoenixPrisma = prisma;
}

// پلن‌هایی که اجازه چت درمانگر دارند
const ALLOWED_PLANS = ["pro", "vip"];

/**
 * ensureTherapyChatAllowed(userKey)
 *
 * userKey می‌تونه id کاربر یا شماره موبایلش باشه.
 * اگر:
 *   - کاربر پیدا نشه ⇒ Error
 *   - پلن free باشه ⇒ Error
 *   - پلن پرو باشه ولی تاریخ انقضا گذشته باشه ⇒ Error
 * اگر همه‌چیز اوکی باشه فقط return می‌کنه.
 */
export async function ensureTherapyChatAllowed(userKey) {
  if (!userKey) {
    throw new Error("missing_user");
  }

  const key = String(userKey);

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ id: key }, { phone: key }],
    },
    select: {
      id: true,
      phone: true,
      plan: true,
      planExpiresAt: true,
    },
  });

  if (!user) {
    throw new Error("user_not_found");
  }

  const plan = (user.plan || "free").toLowerCase();

  if (!ALLOWED_PLANS.includes(plan)) {
    throw new Error("plan_not_pro");
  }

  if (user.planExpiresAt) {
    const exp = new Date(user.planExpiresAt);
    if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
      throw new Error("plan_expired");
    }
  }

  // این یعنی اوکیه
  return;
}