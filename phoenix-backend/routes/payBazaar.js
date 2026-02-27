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

function buildBazaarAuthority(purchaseToken = "") {
  const t = String(purchaseToken || "").trim();
  return t ? `BAZAAR_${t}` : "";
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
/**
 * POST /api/pay-bazaar/verify
 * body: {
 *  phone: string,
 *  productId: "phoenix_pro_1m"|"phoenix_pro_3m"|"phoenix_pro_6m",
 *  purchaseToken: string,
 *  orderId?: string,
 *  packageName?: string,
 *  purchaseTime?: number|string
 * }
 *
 * ✅ فعلاً: فعال‌سازی بر اساس receipt اپ (dev-friendly)
 * 🔒 قدم بعد: verify واقعی بازار در سرور
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

    if (!phone) return res.status(400).json({ ok: false, error: "PHONE_INVALID" });
    if (!productId) return res.status(400).json({ ok: false, error: "PRODUCT_ID_REQUIRED" });
    if (!purchaseToken) return res.status(400).json({ ok: false, error: "PURCHASE_TOKEN_REQUIRED" });

    const months = resolveMonthsFromBazaarProductId(productId);
    if (!months) return res.status(400).json({ ok: false, error: "UNKNOWN_PRODUCT" });

    const authority = buildBazaarAuthority(purchaseToken);
    if (!authority) return res.status(400).json({ ok: false, error: "INVALID_AUTHORITY" });

    const user = await prisma.user.upsert({
      where: { phone },
      update: {},
      create: { phone, plan: "free", profileCompleted: true },
    });

    // ✅ اگر قبلاً همین receipt فعال شده، همون رو بده
    const existing = await prisma.subscription.findFirst({ where: { authority }, include: { user: true } });
    if (existing && existing.status === "active") {
      return res.json({
        ok: true,
        data: {
          authority,
          status: "active",
          refId: existing.refId,
          plan: existing.plan,
          months: existing.months,
          expiresAt: existing.expiresAt ? new Date(existing.expiresAt).toISOString() : null,
        },
      });
    }

    // ✅ تمدید درست
    const now = new Date();
    const userCurrentExpire = user.planExpiresAt ? new Date(user.planExpiresAt) : null;
    const base =
      userCurrentExpire && !isNaN(userCurrentExpire.getTime()) && userCurrentExpire.getTime() > now.getTime()
        ? userCurrentExpire
        : now;

    const plan = "pro";
    const planExpiresAtDate = calcPlanExpiresAtFromBase(base, months);

    // ✅ اگر رکورد وجود ندارد بساز (pending)
    if (!existing) {
      await prisma.subscription.create({
        data: {
          userId: user.id,
          phone,
          authority, // BAZAAR_<token>
          refId: orderId || purchaseToken || "BAZAAR_PAID",
          amount: 0,
          months,
          plan,
          status: "pending",
          expiresAt: planExpiresAtDate,
          paidAt: now,
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
      },
    });

    if (upd.count > 0) {
      await upsertUserPlanOnServer({ phone, plan, planExpiresAt: planExpiresAtDate.toISOString() });
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