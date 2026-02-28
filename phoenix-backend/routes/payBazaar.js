// phoenix-backend/routes/payBazaar.js
import { PrismaClient } from "@prisma/client";
import express from "express";

const router = express.Router();
const prisma = new PrismaClient();

/* ------------------------------ helpers ------------------------------ */

function setCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function normalizeIranPhone(v = "") {
  const only = String(v).replace(/\D/g, "");
  if (only.startsWith("0098")) return "0" + only.slice(3);
  if (only.startsWith("098")) return "0" + only.slice(3);
  if (only.startsWith("98")) return "0" + only.slice(2);
  if (only.startsWith("9") && only.length === 10) return "0" + only;
  if (only.startsWith("0")) return only;
  return "";
}

function calcPlanExpiresAtFromBase(baseDate, months) {
  const d = new Date(baseDate);
  d.setMonth(d.getMonth() + Number(months || 1));
  return d;
}

function resolveMonthsFromBazaarProductId(productId = "") {
  const pid = String(productId || "").trim();
  if (pid === "phoenix_pro_1m") return 1;
  if (pid === "phoenix_pro_3m") return 3;
  if (pid === "phoenix_pro_6m") return 6;
  return 0;
}

// ✅ purchaseTime را به میلی‌ثانیه تبدیل کن (پشتیبانی از Date/number/string)
function parsePurchaseTimeMs(v) {
  if (v == null) return null;

  if (typeof v === "number" && Number.isFinite(v)) return v;

  if (typeof v === "string") {
    // ممکنه عدد باشه
    const asNum = Number(v);
    if (Number.isFinite(asNum) && asNum > 0) return asNum;

    // ممکنه ISO date باشه
    const d = new Date(v);
    const t = d.getTime();
    if (!Number.isNaN(t)) return t;

    return null;
  }

  // اگر Date آبجکت مستقیم رسید
  try {
    const d = new Date(v);
    const t = d.getTime();
    if (!Number.isNaN(t)) return t;
  } catch {}

  return null;
}

/**
 * ✅ authority یونیک برای هر خرید:
 * - اگر purchaseTime داریم => BAZAAR_<token>_<timeMs>
 * - اگر نداریم => BAZAAR_<token>
 */
function buildBazaarAuthority(purchaseToken = "", purchaseTimeMs = null) {
  const t = String(purchaseToken || "").trim();
  if (!t) return "";
  const ms = Number(purchaseTimeMs || 0);
  return ms > 0 ? `BAZAAR_${t}_${ms}` : `BAZAAR_${t}`;
}

const BACKEND_URL = (process.env.BACKEND_URL || "http://127.0.0.1:4000").trim();

async function upsertUserPlanOnServer({ phone, plan, planExpiresAt }) {
  if (!phone || !plan || !planExpiresAt) return;
  try {
    const base = BACKEND_URL.replace(/\/+$/, "");
    const targetUrl = `${base}/api/users/upsert`;
    const body = { phone, plan, planExpiresAt, profileCompleted: true };

    const resp = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "phoenix-bazaar-verify",
      },
      body: JSON.stringify(body),
    });

    const text = await resp.text();
    if (!resp.ok) console.error("[bazaar/verify] upsert non-OK:", resp.status, text);
  } catch (e) {
    console.error("[bazaar/verify] upsert error:", e);
  }
}

/* ------------------------------ routes ------------------------------ */

// ✅ GET /api/pay-bazaar/status?authority=...
router.get("/status", async (req, res) => {
  setCORS(res);
  try {
    const authority = String(req.query.authority || "").trim();

    // اگر authority ندادند => ping ساده
    if (!authority) {
      return res.json({ ok: true, service: "pay-bazaar", time: Date.now() });
    }

    const sub = await prisma.subscription.findFirst({
      where: { authority },
      include: { user: true },
    });

    if (!sub) return res.status(404).json({ ok: false, error: "SUBSCRIPTION_NOT_FOUND" });

    return res.json({
      ok: true,
      data: {
        authority: sub.authority,
        status: sub.status,
        plan: sub.plan,
        months: sub.months,
        planExpiresAt: sub.expiresAt ? new Date(sub.expiresAt).toISOString() : null,
        productId: sub.productId || null,
        orderId: sub.orderId || null,
        packageName: sub.packageName || null,
        userPlan: sub.user?.plan || null,
        userPlanExpiresAt: sub.user?.planExpiresAt ? new Date(sub.user.planExpiresAt).toISOString() : null,
      },
    });
  } catch (e) {
    console.error("PAY_BAZAAR_STATUS_ERR", e);
    return res.status(500).json({ ok: false, error: e?.message || "SERVER_ERROR" });
  }
});

/**
 * POST /api/pay-bazaar/verify
 * body: {
 *  phone: string,
 *  productId: string,
 *  purchaseToken: string,
 *  orderId?: string,
 *  packageName?: string,
 *  purchaseTime?: number|string|Date
 * }
 */
router.post("/verify", async (req, res) => {
  setCORS(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const body = req.body || {};
    const phone = normalizeIranPhone(String(body.phone || ""));
    const productId = String(body.productId || "").trim();
    const purchaseToken = String(body.purchaseToken || "").trim();
    const orderId = String(body.orderId || "").trim();
    const packageName = String(body.packageName || "").trim();
    const purchaseTimeMs = parsePurchaseTimeMs(body.purchaseTime);

    if (!phone) return res.status(400).json({ ok: false, error: "PHONE_INVALID" });
    if (!productId) return res.status(400).json({ ok: false, error: "PRODUCT_ID_REQUIRED" });
    if (!purchaseToken) return res.status(400).json({ ok: false, error: "PURCHASE_TOKEN_REQUIRED" });

    const months = resolveMonthsFromBazaarProductId(productId);
    if (!months) return res.status(400).json({ ok: false, error: "UNKNOWN_PRODUCT" });

    // ✅ authority یونیک بر اساس token + purchaseTime
    const authority = buildBazaarAuthority(purchaseToken, purchaseTimeMs);
    if (!authority) return res.status(400).json({ ok: false, error: "INVALID_AUTHORITY" });

    // ✅ user
    const user = await prisma.user.upsert({
      where: { phone },
      update: {},
      create: { phone, plan: "free", profileCompleted: true },
    });

    // ✅ اگر همین خرید قبلاً verify شده => idempotent
    const existing = await prisma.subscription.findFirst({
      where: { authority },
      include: { user: true },
    });

    if (existing && existing.status === "active") {
      return res.json({
        ok: true,
        data: {
          authority,
          status: "active",
          plan: existing.plan,
          months: existing.months,
          planExpiresAt: existing.expiresAt ? new Date(existing.expiresAt).toISOString() : null,
          productId: existing.productId || null,
          orderId: existing.orderId || null,
          packageName: existing.packageName || null,
          userPlan: existing.user?.plan || null,
          userPlanExpiresAt: existing.user?.planExpiresAt ? new Date(existing.user.planExpiresAt).toISOString() : null,
        },
      });
    }

    // ✅ تمدید تجمعی: اگر هنوز پرو داری، از همون تاریخ ادامه بده
    const now = new Date();
    const freshUser = await prisma.user.findUnique({ where: { phone } });

    const userCurrentExpire = freshUser?.planExpiresAt ? new Date(freshUser.planExpiresAt) : null;
    const base =
      userCurrentExpire &&
      !isNaN(userCurrentExpire.getTime()) &&
      userCurrentExpire.getTime() > now.getTime()
        ? userCurrentExpire
        : now;

    const planExpiresAtDate = calcPlanExpiresAtFromBase(base, months);
    const plan = "pro";

    // ✅ اگر رکورد وجود ندارد بساز pending
    if (!existing) {
      await prisma.subscription.create({
        data: {
          userId: user.id,
          phone,
          authority,
          refId: orderId || purchaseToken || "BAZAAR_PAID",
          amount: 0,
          months,
          plan,
          status: "pending",
          expiresAt: planExpiresAtDate,
          paidAt: now,

          // ✅ ذخیره متادیتا
          productId,
          orderId: orderId || null,
          packageName: packageName || null,
          purchaseTime: purchaseTimeMs ? new Date(purchaseTimeMs) : null,
        },
      });
    }

    // ✅ finalize فقط اگر pending بود
    const upd = await prisma.subscription.updateMany({
      where: { authority, status: "pending" },
      data: {
        status: "active",
        refId: orderId || purchaseToken || "BAZAAR_PAID",
        expiresAt: planExpiresAtDate,
        paidAt: now,
        productId,
        orderId: orderId || null,
        packageName: packageName || null,
        purchaseTime: purchaseTimeMs ? new Date(purchaseTimeMs) : null,
      },
    });

    // ✅ فقط اگر واقعاً همین دفعه finalize شد => یوزر آپدیت + upsert
    if (upd.count > 0) {
      await prisma.user.update({
        where: { phone },
        data: { plan: "pro", planExpiresAt: planExpiresAtDate },
      });

      await upsertUserPlanOnServer({
        phone,
        plan,
        planExpiresAt: planExpiresAtDate.toISOString(),
      });
    }

    return res.json({
      ok: true,
      data: {
        authority,
        status: "active",
        plan,
        months,
        planExpiresAt: planExpiresAtDate.toISOString(),
        productId,
        orderId: orderId || null,
        packageName: packageName || null,
      },
    });
  } catch (e) {
    console.error("[pay-bazaar/verify] err", e);
    return res.status(500).json({ ok: false, error: e?.message || "SERVER_ERROR" });
  }
});

export default router;