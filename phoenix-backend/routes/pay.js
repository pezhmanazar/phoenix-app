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

const BACKEND_URL = (process.env.BACKEND_URL || "http://127.0.0.1:4000").trim();

const PAY_CALLBACK_URL = (process.env.PAY_CALLBACK_URL || "").trim();

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

function calcPlanExpiresAt(months) {
  const now = new Date();
  const d = new Date(now);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

function getBaseUrl(req) {
  const proto = (req.headers["x-forwarded-proto"] || req.protocol || "https").toString();
  const host = (req.headers["x-forwarded-host"] || req.headers.host || "").toString();
  return `${proto}://${host}`;
}

async function upsertUserPlanOnServer({ phone, plan, planExpiresAt }) {
  if (!phone || !plan) return;
  try {
    const base = BACKEND_URL.replace(/\/+$/, "");
    const targetUrl = `${base}/api/users/upsert`;
    const body = { phone, plan, planExpiresAt, profileCompleted: true };
    const resp = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "phoenix-pay-verify",
      },
      body: JSON.stringify(body),
    });
    const text = await resp.text();
    if (!resp.ok) {
      console.error("[pay/verify] upsertUserPlanOnServer non-OK:", resp.status, text);
    }
  } catch (e) {
    console.error("[pay/verify] upsertUserPlanOnServer error:", e);
  }
}

function resolvePlanFromInput({ amount, plan, days, months }) {
  const p = String(plan || "pro");
  if (Number(months) > 0) return { plan: p, months: Number(months) };
  if (Number(days) > 0) {
    const d = Number(days);
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

router.post("/start", async (req, res) => {
  setCORS(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const body = req.body || {};
    const phone = normalizeIranPhone(String(body.phone || ""));
    const amount = Number(body.amount || 0);
    const description = String(body.description || "پرداخت اشتراک ققنوس");

    const callback = PAY_REAL
  ? PAY_CALLBACK_URL
  : String(body.callback || "") || `${getBaseUrl(req)}/api/pay/verify`;

if (PAY_REAL && !callback) {
  return res.status(500).json({ ok: false, error: "PAY_CALLBACK_URL_MISSING" });
}

    if (!phone) return res.status(400).json({ ok: false, error: "PHONE_INVALID" });
    if (!amount || amount < 1000) return res.status(400).json({ ok: false, error: "AMOUNT_INVALID" });

    const { plan, months } = resolvePlanFromInput({
      amount,
      plan: body.plan,
      days: body.days,
      months: body.months,
    });

    if (!PAY_REAL) {
      const authority = `MOCK_${Math.random().toString(36).slice(2, 10)}`;
      const baseUrl = getBaseUrl(req);
      const params = new URLSearchParams({ authority, amount: String(amount), phone }).toString();
      const gatewayUrl = `${baseUrl}/mock-pay?${params}`;

      const user = await prisma.user.upsert({
        where: { phone },
        update: {},
        create: { phone, plan: "free", profileCompleted: true },
      });

      await prisma.subscription.create({
        data: {
          userId: user.id,
          authority,
          refId: "PENDING",
          amount,
          months,
          plan,
          status: "pending",
          expiresAt: new Date(),
        },
      });

      return res.json({ ok: true, code: 100, message: "SUCCESS (MOCK)", authority, gatewayUrl, description });
    }

    if (!MERCHANT_ID) return res.status(500).json({ ok: false, error: "MERCHANT_ID_MISSING" });

    const requestUrl = ZP_API_BASE.replace(/\/+$/, "") + "/request.json";
    const payload = {
      merchant_id: MERCHANT_ID,
      amount,
      description,
      callback_url: callback,
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
      console.error("[pay/start] ZARINPAL_REQUEST_FAILED", {
        status: zpRes.status,
        requestUrl,
        payload,
        response: json,
      });
      return res.status(502).json({ ok: false, error: "ZARINPAL_REQUEST_FAILED" });
    }

    const { data, errors } = json;

    if (!data || data.code !== 100) {
      const code = data?.code ?? errors?.code ?? "UNKNOWN";
      console.error("[pay/start] ZARINPAL_ERROR", { code, json });
      return res.status(502).json({ ok: false, error: `ZP_ERROR_${code}` });
    }

    const authority = data.authority;
    const gatewayUrl = `${ZP_GATEWAY_BASE}${authority}`;

    const user = await prisma.user.upsert({
      where: { phone },
      update: {},
      create: { phone, plan: "free", profileCompleted: true },
    });

    await prisma.subscription.create({
      data: {
        userId: user.id,
        authority,
        refId: "PENDING",
        amount,
        months,
        plan,
        status: "pending",
        expiresAt: new Date(),
      },
    });

    return res.json({ ok: true, code: data.code, authority, gatewayUrl, description });
  } catch (e) {
    console.error("PAY_START_ERR", e);
    return res.status(500).json({ ok: false, error: e?.message || "SERVER_ERROR" });
  }
});

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

    if (!authority) {
      return res.status(400).json({ ok: false, error: "INVALID_VERIFY_INPUT" });
    }

    const sub = await prisma.subscription.findFirst({
      where: { authority },
      include: { user: true },
    });

    if (!sub) {
      return res.status(404).json({ ok: false, error: "SUBSCRIPTION_NOT_FOUND", authority });
    }

    const amount = sub.amount;
    const plan = sub.plan || "pro";
    const months = sub.months || 1;
    const planExpiresAt = sub.expiresAt ? new Date(sub.expiresAt).toISOString() : null;
    const phone = sub.user?.phone || null;

    if (hasGatewayStatus && status !== "OK") {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: "canceled", refId: "CANCELED" },
      });

      return res.json({
        ok: true,
        authority,
        status,
        amount,
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

      if (phone && planExpiresAt) {
        await upsertUserPlanOnServer({ phone, plan, planExpiresAt });
      }

      return res.json({
        ok: true,
        authority,
        status: hasGatewayStatus ? status : "OK",
        amount,
        phone,
        refId,
        plan,
        planExpiresAt,
        verifyCode: 100,
        canceled: false,
      });
    }

    if (!MERCHANT_ID) {
      return res.status(500).json({ ok: false, error: "MERCHANT_ID_MISSING" });
    }

    const verifyUrl = ZP_API_BASE.replace(/\/+$/, "") + "/verify.json";
    const payload = { merchant_id: MERCHANT_ID, authority, amount };

    const zpRes = await fetch(verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await zpRes.json().catch(() => null);

    if (!zpRes.ok || !json) {
      console.error("[pay/verify] ZARINPAL_VERIFY_FAILED", {
        status: zpRes.status,
        verifyUrl,
        payload,
        response: json,
      });
      return res.status(502).json({ ok: false, error: "ZARINPAL_VERIFY_FAILED" });
    }

    const { data, errors } = json;

    if (!data || (data.code !== 100 && data.code !== 101)) {
      const code = data?.code ?? errors?.code ?? "UNKNOWN";
      console.error("[pay/verify] ZARINPAL_VERIFY_ERROR", { code, json });

      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: "canceled", refId: "VERIFY_FAILED" },
      });

      return res.status(502).json({ ok: false, error: `ZP_VERIFY_ERROR_${code}` });
    }

    const refId = String(data.ref_id || "");

    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: "active", refId },
    });

    if (phone && planExpiresAt) {
      await upsertUserPlanOnServer({ phone, plan, planExpiresAt });
    }

    return res.json({
      ok: true,
      authority,
      status: hasGatewayStatus ? status : "OK",
      amount,
      phone,
      refId,
      plan,
      planExpiresAt,
      verifyCode: data.code,
      canceled: false,
    });
  } catch (e) {
    console.error("VERIFY_ERR", e);
    return res.status(500).json({ ok: false, error: e?.message || "SERVER_ERROR" });
  }
});

export default router;