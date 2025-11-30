// phoenix-backend/middlewares/requireActivePlan.js
import prisma from "../utils/prisma.js";

// اگر لازم بود موبایل رو از body/query بخونیم
function normalizePhone(input) {
  const digits = String(input || "").replace(/\D/g, "");
  if (digits.startsWith("989") && digits.length === 12) return "0" + digits.slice(2);
  if (digits.startsWith("09") && digits.length === 11) return digits;
  if (digits.startsWith("9") && digits.length === 10) return "0" + digits;
  return null;
}

/**
 * این میدل‌ور از req.userPhone (ست شده توسط authUser)
 * یا phone داخل body/query استفاده می‌کنه و مطمئن می‌شه
 * که پلن کاربر فعال و غیررایگانه.
 */
export async function requireActivePlan(req, res, next) {
  try {
    let phone = req.userPhone;
    if (!phone) {
      const raw = req.body?.phone || req.query?.phone;
      phone = normalizePhone(raw);
    }

    if (!phone) {
      return res
        .status(401)
        .json({ ok: false, error: "USER_PHONE_REQUIRED_FOR_PLAN_CHECK" });
    }

    const user = await prisma.user.findUnique({
      where: { phone },
      select: { plan: true, planExpiresAt: true },
    });

    if (!user) {
      return res
        .status(403)
        .json({ ok: false, error: "USER_NOT_FOUND_FOR_PLAN" });
    }

    // free = دسترسی نداره
    if (!user.plan || user.plan === "free") {
      return res.status(403).json({ ok: false, error: "PLAN_REQUIRED" });
    }

    // اگر تاریخ انقضا تنظیم شده و گذشته، پلن منقضی است
    if (user.planExpiresAt) {
      const now = new Date();
      if (user.planExpiresAt.getTime() <= now.getTime()) {
        return res.status(403).json({ ok: false, error: "PLAN_EXPIRED" });
      }
    }

    // اوکیه، اجازه ادامه بده
    return next();
  } catch (e) {
    console.error("[requireActivePlan] error:", e);
    return res.status(500).json({ ok: false, error: "PLAN_CHECK_FAILED" });
  }
}