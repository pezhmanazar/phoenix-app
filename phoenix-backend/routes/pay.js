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

const PAY_RESULT_BASE = (process.env.PAY_RESULT_BASE || "https://qoqnoos.app/pay").trim();
const APP_DEEPLINK_BASE = (process.env.APP_DEEPLINK_BASE || "phoenix://pay/result").trim();

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

function calcPlanExpiresAtFromNow(months) {
  const d = new Date();
  d.setMonth(d.getMonth() + Number(months || 1));
  return d;
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

function buildResultUrl({ ok, authority }) {
  const params = new URLSearchParams({
    ok: ok ? "1" : "0",
    authority: authority || "",
  }).toString();
  return `https://qoqnoos.app/api/pay/pay-result?${params}`;
}

function buildDeepLink({ ok, authority }) {
  const base = APP_DEEPLINK_BASE.replace(/\/+$/, "");
  const params = new URLSearchParams({
    authority,
    status: ok ? "success" : "failed",
  }).toString();
  return `${base}?${params}`;
}

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

    const callback = PAY_REAL ? PAY_CALLBACK_URL : (body.callback || "");
    if (PAY_REAL && !callback) return res.status(500).json({ ok: false, error: "PAY_CALLBACK_URL_MISSING" });

    const user = await prisma.user.upsert({
      where: { phone },
      update: {},
      create: { phone, plan: "free", profileCompleted: true },
    });

    if (!PAY_REAL) {
      const authority = `MOCK_${Math.random().toString(36).slice(2, 10)}`;
      const gatewayUrl = `https://example.com/mock/${authority}`;

      await prisma.subscription.create({
        data: {
          userId: user.id,
          authority,
          refId: "PENDING",
          amount,
          months,
          plan,
          status: "pending",
          expiresAt: calcPlanExpiresAtFromNow(months),
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
        expiresAt: calcPlanExpiresAtFromNow(months),
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
      typeof q.Status === "string" ? q.Status :
      typeof q.status === "string" ? q.status :
      "";

    const hasGatewayStatus = rawStatus.length > 0;
    const status = hasGatewayStatus ? rawStatus.toUpperCase() : "UNDEFINED";

    const authority = String(q.Authority || q.authority || "").trim();
    if (!authority) return res.status(400).json({ ok: false, error: "INVALID_VERIFY_INPUT" });

    const sub = await prisma.subscription.findFirst({ where: { authority }, include: { user: true } });
    if (!sub) return res.status(404).json({ ok: false, error: "SUBSCRIPTION_NOT_FOUND", authority });

    const amount = sub.amount;
    const plan = sub.plan || "pro";
    const months = sub.months || 1;
    const phone = sub.user?.phone || null;

    if (hasGatewayStatus && status !== "OK") {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: "canceled", refId: "CANCELED" },
      });

      return res.redirect(302, buildResultUrl({ ok: false, authority }));
    }

    if (!PAY_REAL) {
      const refId = `TEST-${Date.now()}`;
      const planExpiresAtDate = calcPlanExpiresAtFromNow(months);

      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: "active", refId, expiresAt: planExpiresAtDate },
      });

      if (phone) await upsertUserPlanOnServer({ phone, plan, planExpiresAt: planExpiresAtDate.toISOString() });

      return res.redirect(302, buildResultUrl({ ok: true, authority }));
    }

    if (!MERCHANT_ID) return res.status(500).json({ ok: false, error: "MERCHANT_ID_MISSING" });

    const verifyUrl = ZP_API_BASE.replace(/\/+$/, "") + "/verify.json";
    const payload = { merchant_id: MERCHANT_ID, authority, amount };

    const zpRes = await fetch(verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await zpRes.json().catch(() => null);

    if (!zpRes.ok || !json) {
      console.error("[pay/verify] ZARINPAL_VERIFY_FAILED", { status: zpRes.status, verifyUrl, payload, response: json });
      await prisma.subscription.update({ where: { id: sub.id }, data: { status: "canceled", refId: "VERIFY_FAILED" } });
      return res.redirect(302, buildResultUrl({ ok: false, authority }));
    }

    const { data, errors } = json;

    if (!data || (data.code !== 100 && data.code !== 101)) {
      const code = data?.code ?? errors?.code ?? "UNKNOWN";
      console.error("[pay/verify] ZARINPAL_VERIFY_ERROR", { code, json });
      await prisma.subscription.update({ where: { id: sub.id }, data: { status: "canceled", refId: "VERIFY_FAILED" } });
      return res.redirect(302, buildResultUrl({ ok: false, authority }));
    }

    const refId = String(data.ref_id || "");
    const planExpiresAtDate = calcPlanExpiresAtFromNow(months);

    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: "active", refId, expiresAt: planExpiresAtDate },
    });

    if (phone) await upsertUserPlanOnServer({ phone, plan, planExpiresAt: planExpiresAtDate.toISOString() });

    return res.redirect(302, buildResultUrl({ ok: true, authority }));
  } catch (e) {
    console.error("VERIFY_ERR", e);
    return res.status(500).json({ ok: false, error: e?.message || "SERVER_ERROR" });
  }
});

router.get("/pay-result", async (req, res) => {
  setCORS(res);
  const authority = String(req.query.authority || "").trim();
  const ok = String(req.query.ok || "").trim() === "1";
  const deepLink = authority ? buildDeepLink({ ok, authority }) : APP_DEEPLINK_BASE;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Phoenix Pay</title>
</head>
<body style="font-family: sans-serif; padding: 24px;">
<h2>${ok ? "پرداخت موفق" : "پرداخت ناموفق"}</h2>
<p>${authority ? "کد پیگیری: " + authority : ""}</p>
<p><a href="${deepLink}">بازگشت به اپ</a></p>
<script>
setTimeout(function(){ window.location.href = ${JSON.stringify(deepLink)}; }, 300);
</script>
</body>
</html>`);
});

export default router;