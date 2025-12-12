import express from "express";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

const PAY_REAL = process.env.PAY_REAL === "1";

const MERCHANT_ID =
  (process.env.MERCHANT_ID || "").trim() ||
  (process.env.ZARINPAL_MERCHANT_ID || "").trim() ||
  "";

const ZP_API_BASE =
  (process.env.ZARINPAL_API_BASE || "").trim() ||
  (process.env.ZP_BASE || "").trim() ||
  "https://api.zarinpal.com/pg/v4/payment";

const ZP_GATEWAY_BASE =
  (process.env.ZARINPAL_GATEWAY_BASE || "").trim() ||
  "https://payment.zarinpal.com/pg/StartPay/";

const ZP_CURRENCY = (process.env.ZP_CURRENCY || process.env.ZARINPAL_CURRENCY || "IRT").trim();

const PAY_CALLBACK_URL = (process.env.PAY_CALLBACK_URL || "").trim();

const APP_SUCCESS_REDIRECT = (process.env.PAY_SUCCESS_REDIRECT || "").trim();
const APP_CANCEL_REDIRECT = (process.env.PAY_CANCEL_REDIRECT || "").trim();

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

function getBaseUrl(req) {
  const proto = (req.headers["x-forwarded-proto"] || req.protocol || "https").toString();
  const host = (req.headers["x-forwarded-host"] || req.headers.host || "").toString();
  return `${proto}://${host}`;
}

function resolvePlanFromInput({ amount, plan, days, months }) {
  const p = String(plan || "pro").trim() || "pro";

  const m = Number(months);
  if (Number.isFinite(m) && m > 0) return { plan: p, months: m };

  const d = Number(days);
  if (Number.isFinite(d) && d > 0) {
    if (d >= 180) return { plan: p, months: 6 };
    if (d >= 90) return { plan: p, months: 3 };
    if (d >= 30) return { plan: p, months: 1 };
    return { plan: p, months: 1 };
  }

  if (amount === 399000 || amount === 10000) return { plan: "pro", months: 1 };
  if (amount === 899000) return { plan: "pro", months: 3 };
  if (amount === 1199000) return { plan: "pro", months: 6 };

  return { plan: p, months: 1 };
}

function calcExpiresAtFromMonths(months) {
  const now = new Date();
  const d = new Date(now);
  d.setMonth(d.getMonth() + Number(months || 1));
  return d;
}

function buildRedirectUrl(base, params) {
  if (!base) return "";
  const u = new URL(base);
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    u.searchParams.set(k, String(v));
  });
  return u.toString();
}

/* -------------------- POST /api/pay/start -------------------- */
router.post("/start", async (req, res) => {
  setCORS(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const body = req.body || {};

    const phone = normalizeIranPhone(String(body.phone || ""));
    const amount = Number(body.amount || 0);
    const description = String(body.description || "Phoenix Subscription").trim() || "Phoenix Subscription";

    if (!phone) return res.status(400).json({ ok: false, error: "PHONE_INVALID" });
    if (!Number.isFinite(amount) || amount < 1000) return res.status(400).json({ ok: false, error: "AMOUNT_INVALID" });

    const { plan, months } = resolvePlanFromInput({
      amount,
      plan: body.plan,
      days: body.days,
      months: body.months,
    });

    const expiresAt = calcExpiresAtFromMonths(months);

    const callbackUrl = PAY_REAL
      ? PAY_CALLBACK_URL
      : String(body.callback || "").trim() || `${getBaseUrl(req)}/api/pay/verify`;

    if (PAY_REAL && !callbackUrl) {
      return res.status(500).json({ ok: false, error: "PAY_CALLBACK_URL_MISSING" });
    }

    const user = await prisma.user.upsert({
      where: { phone },
      update: {},
      create: { phone, plan: "free", profileCompleted: true },
    });

    if (!PAY_REAL) {
      const authority = `MOCK_${Math.random().toString(36).slice(2, 10)}`;
      const gatewayUrl = `${getBaseUrl(req)}/mock-pay?${new URLSearchParams({
        Authority: authority,
        Status: "OK",
      }).toString()}`;

      await prisma.subscription.create({
        data: {
          userId: user.id,
          authority,
          refId: "PENDING",
          amount,
          months,
          plan,
          status: "pending",
          expiresAt,
        },
      });

      return res.json({ ok: true, code: 100, authority, gatewayUrl, description });
    }

    if (!MERCHANT_ID) return res.status(500).json({ ok: false, error: "MERCHANT_ID_MISSING" });

    const requestUrl = ZP_API_BASE.replace(/\/+$/, "") + "/request.json";
    const payload = {
      merchant_id: MERCHANT_ID,
      amount,
      description,
      callback_url: callbackUrl,
      currency: ZP_CURRENCY,
      metadata: { mobile: phone },
    };

    const zpRes = await fetch(requestUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await zpRes.json().catch(() => null);

    if (!zpRes.ok || !json) {
      console.error("[pay/start] ZARINPAL_REQUEST_FAILED", { status: zpRes.status, requestUrl, payload, response: json });
      return res.status(502).json({ ok: false, error: "ZARINPAL_REQUEST_FAILED" });
    }

    const { data, errors } = json;

    if (!data || data.code !== 100) {
      const code = data?.code ?? errors?.code ?? "UNKNOWN";
      console.error("[pay/start] ZARINPAL_ERROR", { code, json });
      return res.status(502).json({ ok: false, error: `ZP_ERROR_${code}` });
    }

    const authority = String(data.authority || "").trim();
    if (!authority) return res.status(502).json({ ok: false, error: "ZP_AUTHORITY_MISSING" });

    await prisma.subscription.create({
      data: {
        userId: user.id,
        authority,
        refId: "PENDING",
        amount,
        months,
        plan,
        status: "pending",
        expiresAt,
      },
    });

    const gatewayUrl = `${ZP_GATEWAY_BASE}${authority}`;
    return res.json({ ok: true, code: data.code, authority, gatewayUrl, description });
  } catch (e) {
    console.error("[pay/start] SERVER_ERROR", e);
    return res.status(500).json({ ok: false, error: e?.message || "SERVER_ERROR" });
  }
});

/* -------------------- GET /api/pay/verify -------------------- */
router.get("/verify", async (req, res) => {
  setCORS(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const q = req.query || {};

    const rawStatus =
      typeof q.Status === "string"
        ? q.Status
        : typeof q.status === "string"
        ? q.status
        : typeof q.StatusCode === "string"
        ? q.StatusCode
        : "";

    const hasGatewayStatus = rawStatus.length > 0;
    const status = hasGatewayStatus ? rawStatus.toUpperCase() : "UNDEFINED";

    const authority = String(q.Authority || q.authority || "").trim();
    if (!authority) return res.status(400).json({ ok: false, error: "INVALID_VERIFY_INPUT" });

    const sub = await prisma.subscription.findFirst({
      where: { authority },
      include: { user: true },
    });

    if (!sub) return res.status(404).json({ ok: false, error: "SUBSCRIPTION_NOT_FOUND", authority });

    const phone = sub.user?.phone || null;

    if (sub.status === "active") {
      const okUrl = buildRedirectUrl(APP_SUCCESS_REDIRECT, {
        authority,
        status: "OK",
        refId: sub.refId,
      });
      if (okUrl) return res.redirect(302, okUrl);

      return res.json({
        ok: true,
        authority,
        status: hasGatewayStatus ? status : "OK",
        amount: sub.amount,
        phone,
        refId: sub.refId,
        plan: sub.plan,
        planExpiresAt: new Date(sub.expiresAt).toISOString(),
        verifyCode: 100,
        canceled: false,
        alreadyApplied: true,
      });
    }

    if (hasGatewayStatus && status !== "OK") {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: "canceled", refId: "CANCELED" },
      });

      const cancelUrl = buildRedirectUrl(APP_CANCEL_REDIRECT, { authority, status });
      if (cancelUrl) return res.redirect(302, cancelUrl);

      return res.json({
        ok: true,
        authority,
        status,
        amount: sub.amount,
        phone,
        refId: null,
        plan: "free",
        planExpiresAt: null,
        verifyCode: -1,
        canceled: true,
      });
    }

    if (!PAY_REAL) {
      const refId = `TEST-${Date.now()}`;

      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: "active", refId },
      });

      await prisma.user.update({
        where: { id: sub.userId },
        data: { plan: sub.plan, planExpiresAt: sub.expiresAt, profileCompleted: true },
      });

      const okUrl = buildRedirectUrl(APP_SUCCESS_REDIRECT, { authority, status: "OK", refId });
      if (okUrl) return res.redirect(302, okUrl);

      return res.json({
        ok: true,
        authority,
        status: hasGatewayStatus ? status : "OK",
        amount: sub.amount,
        phone,
        refId,
        plan: sub.plan,
        planExpiresAt: new Date(sub.expiresAt).toISOString(),
        verifyCode: 100,
        canceled: false,
      });
    }

    if (!MERCHANT_ID) return res.status(500).json({ ok: false, error: "MERCHANT_ID_MISSING" });

    const verifyUrl = ZP_API_BASE.replace(/\/+$/, "") + "/verify.json";
    const payload = { merchant_id: MERCHANT_ID, authority, amount: sub.amount };

    const zpRes = await fetch(verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await zpRes.json().catch(() => null);

    if (!zpRes.ok || !json) {
      console.error("[pay/verify] ZARINPAL_VERIFY_FAILED", { status: zpRes.status, verifyUrl, payload, response: json });
      return res.status(502).json({ ok: false, error: "ZARINPAL_VERIFY_FAILED" });
    }

    const { data, errors } = json;

    if (!data || (data.code !== 100 && data.code !== 101)) {
      const code = data?.code ?? errors?.code ?? "UNKNOWN";
      console.error("[pay/verify] ZP_VERIFY_ERROR", { code, json });

      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: "canceled", refId: "VERIFY_FAILED" },
      });

      return res.status(502).json({ ok: false, error: `ZP_VERIFY_ERROR_${code}` });
    }

    const refId = String(data.ref_id || "").trim() || "PAID";

    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: "active", refId },
    });

    await prisma.user.update({
      where: { id: sub.userId },
      data: { plan: sub.plan, planExpiresAt: sub.expiresAt, profileCompleted: true },
    });

    const okUrl = buildRedirectUrl(APP_SUCCESS_REDIRECT, {
      authority,
      status: "OK",
      refId,
    });
    if (okUrl) return res.redirect(302, okUrl);

    return res.json({
      ok: true,
      authority,
      status: hasGatewayStatus ? status : "OK",
      amount: sub.amount,
      phone,
      refId,
      plan: sub.plan,
      planExpiresAt: new Date(sub.expiresAt).toISOString(),
      verifyCode: data.code,
      canceled: false,
    });
  } catch (e) {
    console.error("[pay/verify] SERVER_ERROR", e);
    return res.status(500).json({ ok: false, error: e?.message || "SERVER_ERROR" });
  }
});

export default router;