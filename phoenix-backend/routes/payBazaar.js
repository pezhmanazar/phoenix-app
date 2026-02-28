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

function toDateSafe(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

// ✅ authority باید هم یکتا باشه هم برای retry پایدار بمونه.
// ✅ قاعده:
// - اگر orderId داریم: authority = BAZAAR_<orderId>
// - اگر نداریم: authority = BAZAAR_<purchaseToken>_<purchaseTimeMs>
function buildAuthority({ purchaseToken, orderId, purchaseTime }) {
  const oid = String(orderId || "").trim();
  if (oid) return `BAZAAR_${oid}`;

  const t = String(purchaseToken || "").trim();
  if (!t) return "";

  const pt = toDateSafe(purchaseTime);
  const ms = pt ? pt.getTime() : Date.now();
  return `BAZAAR_${t}_${ms}`;
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

// ✅ health/status
router.get("/status", async (req, res) => {
  setCORS(res);
  try {
    const authority = String(req.query.authority || "").trim();
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
        provider: sub.provider,
        metaJson: sub.metaJson ?? null,
        userPlan: sub.user?.plan ?? null,
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
 */
router.post("/verify", async (req, res) => {
  setCORS(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const body = req.body || {};
    const phone = normalizeIranPhone(String(body.phone || ""));
    const productId = String(body.productId || "").trim();
    const purchaseToken = String(body.purchaseToken || "").trim();
    const orderId = String(body.orderId || "").trim() || null;
    const packageName = String(body.packageName || "").trim() || null;
    const purchaseTimeRaw = body.purchaseTime;

    if (!phone) return res.status(400).json({ ok: false, error: "PHONE_INVALID" });
    if (!productId) return res.status(400).json({ ok: false, error: "PRODUCT_ID_REQUIRED" });
    if (!purchaseToken) return res.status(400).json({ ok: false, error: "PURCHASE_TOKEN_REQUIRED" });

    const months = resolveMonthsFromBazaarProductId(productId);
    if (!months) return res.status(400).json({ ok: false, error: "UNKNOWN_PRODUCT" });

    const purchaseTime = toDateSafe(purchaseTimeRaw) || new Date();
    const purchaseTimeMs = purchaseTime.getTime();

    // ✅ authority پایدار:
    // اگر orderId داریم، بهترین کلید یکتای "تراکنش" همونه.
    // اگر نداریم، token+ptimeMs پایدار می‌مونه (برای retry همان رسید).
    const authority = orderId
      ? `BAZAAR_${orderId}`
      : `BAZAAR_${purchaseToken}_${purchaseTimeMs}`;

    if (!authority) return res.status(400).json({ ok: false, error: "INVALID_AUTHORITY" });

    // ✅ user upsert
    const user = await prisma.user.upsert({
      where: { phone },
      update: {},
      create: { phone, plan: "free", profileCompleted: true },
    });

    // ✅ ضدگلوله‌ترین idempotency:
    // اول بر اساس purchaseToken (حتی اگر authority تغییر کرده باشد)
    const existingByToken = await prisma.subscription.findFirst({
      where: {
        provider: "bazaar",
        metaJson: { path: ["purchaseToken"], equals: purchaseToken },
      },
      include: { user: true },
      orderBy: { paidAt: "desc" },
    });

    if (existingByToken && existingByToken.status === "active") {
      // (اختیاری ولی مفید) اگر به هر دلیل یوزر عقب‌تر بود، سینک کن؛ اما تمدید جدید نزن
      try {
        const subExp = existingByToken.expiresAt ? new Date(existingByToken.expiresAt) : null;
        const uExp = existingByToken.user?.planExpiresAt ? new Date(existingByToken.user.planExpiresAt) : null;
        if (subExp && (!uExp || subExp.getTime() > uExp.getTime())) {
          await prisma.user.update({
            where: { id: existingByToken.userId || user.id },
            data: { plan: existingByToken.plan, planExpiresAt: subExp },
          });
        }
      } catch {}

      return res.json({
        ok: true,
        data: {
          authority: existingByToken.authority,
          status: "active",
          plan: existingByToken.plan,
          months: existingByToken.months,
          planExpiresAt: existingByToken.expiresAt
            ? new Date(existingByToken.expiresAt).toISOString()
            : null,
          provider: existingByToken.provider,
          metaJson: existingByToken.metaJson ?? null,
          userPlan: existingByToken.user?.plan ?? null,
          userPlanExpiresAt: existingByToken.user?.planExpiresAt
            ? new Date(existingByToken.user.planExpiresAt).toISOString()
            : null,
          idempotent: true,
          reason: "EXISTING_BY_PURCHASE_TOKEN",
        },
      });
    }

    // ✅ idempotency ثانویه: اگر همین authority قبلاً active شده (retry همان تراکنش)
    const existingByAuthority = await prisma.subscription.findFirst({
      where: { provider: "bazaar", authority },
      include: { user: true },
    });

    if (existingByAuthority && existingByAuthority.status === "active") {
      return res.json({
        ok: true,
        data: {
          authority: existingByAuthority.authority,
          status: "active",
          plan: existingByAuthority.plan,
          months: existingByAuthority.months,
          planExpiresAt: existingByAuthority.expiresAt
            ? new Date(existingByAuthority.expiresAt).toISOString()
            : null,
          provider: existingByAuthority.provider,
          metaJson: existingByAuthority.metaJson ?? null,
          userPlan: existingByAuthority.user?.plan ?? null,
          userPlanExpiresAt: existingByAuthority.user?.planExpiresAt
            ? new Date(existingByAuthority.user.planExpiresAt).toISOString()
            : null,
          idempotent: true,
          reason: "EXISTING_BY_AUTHORITY",
        },
      });
    }

    // ✅ تمدید تجمعی (فقط وقتی خرید واقعاً جدید است)
    const now = new Date();
    const userCurrentExpire = user.planExpiresAt ? new Date(user.planExpiresAt) : null;
    const base =
      userCurrentExpire &&
      !isNaN(userCurrentExpire.getTime()) &&
      userCurrentExpire.getTime() > now.getTime()
        ? userCurrentExpire
        : now;

    const plan = "pro";
    const planExpiresAtDate = calcPlanExpiresAtFromBase(base, months);

    const metaJson = {
      productId,
      purchaseToken,
      orderId,
      packageName,
      purchaseTime: purchaseTime.toISOString(),
    };

    // ✅ تراکنش + هندل race روی unique(authority)
    try {
      await prisma.$transaction(async (tx) => {
        await tx.subscription.create({
          data: {
            user: { connect: { id: user.id } },
            phone,
            authority,
            refId: orderId || purchaseToken || "BAZAAR_PAID",
            amount: 0,
            months,
            plan,
            status: "active",
            expiresAt: planExpiresAtDate,
            paidAt: now,
            provider: "bazaar",
            metaJson,
          },
        });

        await tx.user.update({
          where: { id: user.id },
          data: { plan, planExpiresAt: planExpiresAtDate },
        });
      });
    } catch (e) {
      // اگر به خاطر unique(authority) خورد به دیوار، یعنی همزمان ثبت شده؛ همون رو برگردون
      const again = await prisma.subscription.findFirst({
        where: { provider: "bazaar", authority },
        include: { user: true },
      });
      if (again && again.status === "active") {
        return res.json({
          ok: true,
          data: {
            authority: again.authority,
            status: "active",
            plan: again.plan,
            months: again.months,
            planExpiresAt: again.expiresAt ? new Date(again.expiresAt).toISOString() : null,
            provider: again.provider,
            metaJson: again.metaJson ?? null,
            userPlan: again.user?.plan ?? null,
            userPlanExpiresAt: again.user?.planExpiresAt
              ? new Date(again.user.planExpiresAt).toISOString()
              : null,
            idempotent: true,
            reason: "RACE_UNIQUE_AUTHORITY",
          },
        });
      }
      throw e;
    }

    await upsertUserPlanOnServer({ phone, plan, planExpiresAt: planExpiresAtDate.toISOString() });

    return res.json({
      ok: true,
      data: {
        authority,
        status: "active",
        plan,
        months,
        planExpiresAt: planExpiresAtDate.toISOString(),
        provider: "bazaar",
        metaJson,
      },
    });
  } catch (e) {
    console.error("[pay-bazaar/verify] err", e);
    return res.status(500).json({ ok: false, error: e?.message || "SERVER_ERROR" });
  }
});

export default router;