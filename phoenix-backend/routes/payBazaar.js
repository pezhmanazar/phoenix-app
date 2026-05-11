// phoenix-backend/routes/payBazaar.js

import { PrismaClient } from "@prisma/client";
import express from "express";

import { finalizeSubscription } from "../utils/subscription.js";

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

// authority باید برای retry پایدار باشد.
function buildAuthority({ purchaseToken, orderId, purchaseTime }) {
  const token = String(purchaseToken || "").trim();
  if (!token) return "";

  const oid = String(orderId || "").trim();
  const pt = toDateSafe(purchaseTime);

  if (oid && oid !== token) {
    return `BAZAAR_ORDER_${oid}`;
  }

  if (pt) {
    return `BAZAAR_TOKEN_${token}_${pt.getTime()}`;
  }

  return `BAZAAR_TOKEN_${token}`;
}

/* ------------------------------ routes ------------------------------ */

router.get("/status", async (req, res) => {
  setCORS(res);

  try {
    const authority = String(req.query.authority || "").trim();

    if (!authority) {
      return res.json({ ok: true, service: "pay-bazaar", time: Date.now() });
    }

    const sub = await prisma.subscription.findUnique({
      where: {
        provider_authority: {
          provider: "bazaar",
          authority,
        },
      },
      include: { user: true },
    });

    if (!sub) {
      return res.status(404).json({ ok: false, error: "SUBSCRIPTION_NOT_FOUND" });
    }

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
        userPlanExpiresAt: sub.user?.planExpiresAt
          ? new Date(sub.user.planExpiresAt).toISOString()
          : null,
      },
    });
  } catch (e) {
    console.error("[payBazaar.status] error:", e?.message || "unknown_error");
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

    if (!phone) {
      return res.status(400).json({ ok: false, error: "PHONE_INVALID" });
    }

    if (!productId) {
      return res.status(400).json({ ok: false, error: "PRODUCT_ID_REQUIRED" });
    }

    if (!purchaseToken) {
      return res.status(400).json({ ok: false, error: "PURCHASE_TOKEN_REQUIRED" });
    }

    const months = resolveMonthsFromBazaarProductId(productId);
    if (!months) {
      return res.status(400).json({ ok: false, error: "UNKNOWN_PRODUCT" });
    }

    const plan = "pro";
    const purchaseTime = toDateSafe(purchaseTimeRaw);

    if ((!orderId || orderId === purchaseToken) && !purchaseTime) {
      return res.status(400).json({
        ok: false,
        error: "PURCHASE_TIME_REQUIRED_WHEN_ORDER_ID_IS_MISSING_OR_EQUALS_TOKEN",
      });
    }

    const authority = buildAuthority({
      purchaseToken,
      orderId,
      purchaseTime,
    });

    if (!authority) {
      return res.status(400).json({ ok: false, error: "INVALID_AUTHORITY" });
    }

    const now = new Date();

    const metaJson = {
      productId,
      purchaseToken,
      orderId,
      packageName,
      purchaseTime: purchaseTime ? purchaseTime.toISOString() : null,
    };

    const result = await finalizeSubscription(prisma, {
      phone,
      provider: "bazaar",
      authority,
      refId: orderId || purchaseToken || "BAZAAR_PAID",
      amount: 0,
      months,
      plan,
      now,
      metaJson,
    });

    return res.json({
      ok: true,
      data: {
        authority: result.authority,
        provider: result.provider,
        subscriptionId: result.subscriptionId,
        userId: result.userId,
        created: result.created,
        updatedExisting: result.updatedExisting,
        alreadyFinalized: result.alreadyFinalized,
        plan: result.plan,
        months: result.months,
        amount: result.amount,
        status: result.status,
        planExpiresAt: result.planExpiresAt
          ? new Date(result.planExpiresAt).toISOString()
          : null,
      },
    });
  } catch (e) {
    console.error("[payBazaar.verify] error:", e?.message || "unknown_error");
    return res.status(500).json({ ok: false, error: e?.message || "SERVER_ERROR" });
  }
});

export default router;
