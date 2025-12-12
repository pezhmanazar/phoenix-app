import express from "express";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

const PAY_REAL = String(process.env.PAY_REAL || "").trim() === "1";

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

const ZP_CURRENCY = String(
  process.env.ZP_CURRENCY || process.env.ZARINPAL_CURRENCY || "IRT"
).trim();

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

function getBaseUrl(req) {
  const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "https");
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "");
  return `${proto}://${host}`;
}

function calcExpiresAtByMonths(months) {
  const m = Number(months) > 0 ? Number(months) : 1;
  const d = new Date();
  d.setMonth(d.getMonth() + m);
  return d;
}

function resolvePlanFromInput({ amount, plan, days, months }) {
  const p = String(plan || "pro").trim() || "pro";

  const mm = Number(months);
  if (mm > 0) return { plan: p, months: mm };

  const dd = Number(days);
  if (dd > 0) {
    if (dd >= 180) return { plan: p, months: 6 };
    if (dd >= 90) return { plan: p, months: 3 };
    return { plan: p, months: 1 };
  }

  const a = Number(amount);
  if (a === 399000 || a === 10000) return { plan: "pro", months: 1 };
  if (a === 899000) return { plan: "pro", months: 3 };
  if (a === 1199000) return { plan: "pro", months: 6 };
  return { plan: p, months: 1 };
}

async function upsertUserPlanOnServer({ phone, plan, planExpiresAt }) {
  if (!phone || !plan || !planExpiresAt) return;
  const normalized = normalizeIranPhone(phone);
  if (!normalized) return;

  try {
    const base = BACKEND_URL.replace(/\/+$/, "");
    const targetUrl = `${base}/api/users/upsert`;
    const body = { phone: normalized, plan, planExpiresAt, profileCompleted: true };

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
      console.error("[pay/verify] upsert non-ok", resp.status, text);
    }
  } catch (e) {
    console.error("[pay/verify] upsert error", e);
  }
}

router.post("/start", async (req, res) => {
  setCORS(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const body = req.body || {};
    const phone = normalizeIranPhone(String(body.phone || ""));
    const amount = Number(body.amount || 0);
    const description = String(body.description || "پرداخت اشتراک ققنوس");

    if (!phone) return res.status(400).json({ ok: false, error: "PHONE_INVALID" });
    if (!amount || amount < 1000) return res.status(400).json({ ok: false, error: "AMOUNT_INVALID" });

    const { plan, months } = resolvePlanFromInput({
      amount,
      plan: body.plan,
      days: body.days,
      months: body.months,
    });

    const expiresAt = calcExpiresAtByMonths(months);

    const callback = PAY_REAL
      ? PAY_CALLBACK_URL
      : (String(body.callback || "").trim() || `${getBaseUrl(req)}/api/pay/verify`);

    if (PAY_REAL && !callback) {
      return res.status(500).json({ ok: false, error: "PAY_CALLBACK_URL_MISSING" });
    }

    const user = await prisma.user.upsert({
      where: { phone },
      update: {},
      create: { phone, plan: "free", profileCompleted: true },
    });

    if (!PAY_REAL) {
      const authority = `MOCK_${Math.random().toString(36).slice(2, 10)}`;
      const params = new URLSearchParams({ Status: "OK", Authority: authority }).toString();
      const gatewayUrl = `${getBaseUrl(req)}/api/pay/verify?${params}`;

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
      console.error("[pay/start] request failed", { status: zpRes.status, requestUrl, payload, response: json });
      return res.status(502).json({ ok: false, error: "ZARINPAL_REQUEST_FAILED" });
    }

    const { data, errors } = json;

    if (!data || data.code !== 100) {
      const code = data?.code ?? errors?.code ?? "UNKNOWN";
      console.error("[pay/start] zarinpal error", { code, json });
      return res.status(502).json({ ok: false, error: `ZP_ERROR_${code}` });
    }

    const authority = String(data.authority || "").trim();
    const gatewayUrl = `${ZP_GATEWAY_BASE}${authority}`;

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
  } catch (e) {
    console.error("[pay/start] err", e);
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
    if (!authority) return res.status(400).json({ ok: false, error: "INVALID_VERIFY_INPUT" });

    const sub = await prisma.subscription.findFirst({
      where: { authority },
      include: { user: true },
    });

    if (!sub) return res.status(404).json({ ok: false, error: "SUBSCRIPTION_NOT_FOUND", authority });

    const amount = Number(sub.amount);
    const plan = String(sub.plan || "pro");
    const planExpiresAt = sub.expiresAt ? new Date(sub.expiresAt).toISOString() : null;
    const phone = sub.user?.phone ? normalizeIranPhone(sub.user.phone) : null;

    if (hasGatewayStatus && status !== "OK") {
      if (sub.status !== "canceled") {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: "canceled", refId: "CANCELED" },
        });
      }

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
      const refId = sub.refId && sub.refId !== "PENDING" ? sub.refId : `TEST-${Date.now()}`;

      if (sub.status !== "active") {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: "active", refId },
        });
      }

      if (phone && planExpiresAt) await upsertUserPlanOnServer({ phone, plan, planExpiresAt });

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

    if (!MERCHANT_ID) return res.status(500).json({ ok: false, error: "MERCHANT_ID_MISSING" });

    if (sub.status === "active" && sub.refId && sub.refId !== "PENDING") {
      return res.json({
        ok: true,
        authority,
        status: hasGatewayStatus ? status : "OK",
        amount,
        phone,
        refId: sub.refId,
        plan,
        planExpiresAt,
        verifyCode: 100,
        canceled: false,
        alreadyVerified: true,
      });
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
      console.error("[pay/verify] failed", { status: zpRes.status, verifyUrl, payload, response: json });
      return res.status(502).json({ ok: false, error: "ZARINPAL_VERIFY_FAILED" });
    }

    const { data, errors } = json;

    if (!data || (data.code !== 100 && data.code !== 101)) {
      const code = data?.code ?? errors?.code ?? "UNKNOWN";
      console.error("[pay/verify] error", { code, json });

      if (sub.status !== "canceled") {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: "canceled", refId: "VERIFY_FAILED" },
        });
      }

      return res.status(502).json({ ok: false, error: `ZP_VERIFY_ERROR_${code}` });
    }

    const refId = String(data.ref_id || "").trim() || "NO_REF_ID";

    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: "active", refId },
    });

    if (phone && planExpiresAt) await upsertUserPlanOnServer({ phone, plan, planExpiresAt });

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
    console.error("[pay/verify] err", e);
    return res.status(500).json({ ok: false, error: e?.message || "SERVER_ERROR" });
  }
});

export default router;