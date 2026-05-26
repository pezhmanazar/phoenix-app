// phoenix-app/phoenix-backend/routes/pay.js

import pkg from "@prisma/client";
const { PrismaClient } = pkg;

import express from "express";
import {
  getPublicSubscriptionPricing,
  getZarinpalPlanConfig,
} from "../config/subscriptionPricing.js";

import { finalizeSubscription } from "../utils/subscription.js";

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

const ZP_CURRENCY = (
  process.env.ZP_CURRENCY ||
  process.env.ZARINPAL_CURRENCY ||
  "IRT"
).trim();

const PAY_CALLBACK_URL = (process.env.PAY_CALLBACK_URL || "").trim();
const PAY_RESULT_URL = (process.env.PAY_RESULT_URL || "").trim();
const PAY_RESULT_BASE = (process.env.PAY_RESULT_BASE || "https://qoqnoos.app/pay").trim();

// باید با app.json یکی باشد (scheme)
const APP_SCHEME = (process.env.APP_SCHEME || "phoenixapp").trim();
// پکیج اندروید (برای intent)
const ANDROID_PACKAGE = (process.env.ANDROID_PACKAGE || "com.pezhman.phoenix").trim();

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

function buildResultUrl({ ok, authority }) {
  const params = new URLSearchParams({
    ok: ok ? "1" : "0",
    authority: authority || "",
  }).toString();

  const base = (PAY_RESULT_URL || `${PAY_RESULT_BASE.replace(/\/+$/, "")}/pay-result`).replace(/\/+$/, "");
  return `${base}?${params}`;
}

function buildDeepLink({ ok, authority }) {
  const base = `${APP_SCHEME}://pay`;
  const params = new URLSearchParams({
    authority: authority || "",
    status: ok ? "success" : "failed",
  }).toString();
  return `${base}?${params}`;
}

function buildAndroidIntentLink({ ok, authority }) {
  const pathAndQuery = `pay?authority=${encodeURIComponent(authority || "")}&status=${ok ? "success" : "failed"}`;
  return `intent://${pathAndQuery}#Intent;scheme=${encodeURIComponent(APP_SCHEME)};package=${encodeURIComponent(
    ANDROID_PACKAGE
  )};end`;
}

router.post("/start", async (req, res) => {
  setCORS(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const body = req.body || {};
    const phone = normalizeIranPhone(String(body.phone || ""));
    const planKey = String(body.planKey || "").trim();

    if (!phone) {
      return res.status(400).json({
        ok: false,
        error: "PHONE_REQUIRED",
      });
    }

    if (!planKey || !["p30", "p90", "p180"].includes(planKey)) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_PLAN_KEY",
      });
    }

    const selectedPricing = getZarinpalPlanConfig(planKey);

    if (!selectedPricing) {
      return res.status(400).json({
        ok: false,
        error: "PLAN_NOT_FOUND",
      });
    }

    const amount = Number(selectedPricing.amount || 0);
    const months = Number(selectedPricing.months || 0);
    const plan = selectedPricing.plan;
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + months);


    if (!amount || amount < 1000) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_AMOUNT",
      });
    }

    const description =
      String(body.description || "").trim() ||
      `خرید اشتراک ${plan} ققنوس - ${planKey}`;

    const callback = PAY_REAL
      ? PAY_CALLBACK_URL
      : String(body.callback || "") || `${req.protocol}://${req.get("host")}/api/pay/verify`;

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
      const gatewayUrl = `https://example.com/mock/${authority}`;

      await prisma.subscription.create({
        data: {
          userId: user.id,
          phone,
          authority,
          refId: "PENDING",
          amount,
          months,
          expiresAt,
          plan,
          status: "pending",
          provider: "zarinpal",
        },
      });

      return res.json({
        ok: true,
        code: 100,
        message: "SUCCESS (MOCK)",
        authority,
        gatewayUrl,
        description,
      });
    }

    if (!MERCHANT_ID) {
      return res.status(500).json({ ok: false, error: "MERCHANT_ID_MISSING" });
    }

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
      console.error(
        "[pay/start] ZARINPAL_REQUEST_FAILED:",
        `status=${zpRes.status}`
      );
      return res.status(502).json({ ok: false, error: "ZARINPAL_REQUEST_FAILED" });
    }

    const { data, errors } = json;

    if (!data || data.code !== 100) {
      const code = data?.code ?? errors?.code ?? "UNKNOWN";
      console.error(
        "[pay/start] ZARINPAL_ERROR:",
        `code=${code}`
      );
      return res.status(502).json({ ok: false, error: `ZP_ERROR_${code}` });
    }

    const authority = String(data.authority || "").trim();
    const gatewayUrl = `${ZP_GATEWAY_BASE}${authority}`;

    await prisma.subscription.create({
  data: {
    userId: user.id,
    phone,
    authority,
    refId: "PENDING",
    amount,
    months,
    expiresAt,
    plan,
    status: "pending",
    provider: "zarinpal",
  },
});

    return res.json({
      ok: true,
      code: data.code,
      authority,
      gatewayUrl,
      description,
    });
  } catch (e) {
    console.error("PAY_START_ERR:", e?.message || "unknown_error");
    return res.status(500).json({
      ok: false,
      error: "SERVER_ERROR",
    });
  }
});

router.get("/pricing", async (_req, res) => {
  try {
    return res.json({
      ok: true,
      data: getPublicSubscriptionPricing(),
    });
  } catch (e) {
    console.error("PAY_PRICING_ERROR", e);
    return res.status(500).json({
      ok: false,
      error: "PRICING_UNAVAILABLE",
    });
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
          : "";

    const hasGatewayStatus = rawStatus.length > 0;
    const status = hasGatewayStatus ? rawStatus.toUpperCase() : "UNDEFINED";

    const authority = String(q.Authority || q.authority || "").trim();
    if (!authority) {
      return res.status(400).json({ ok: false, error: "INVALID_VERIFY_INPUT" });
    }

    const sub = await prisma.subscription.findUnique({
      where: {
        provider_authority: {
          provider: "zarinpal",
          authority,
        },
      },
      include: { user: true },
    });

    if (!sub) {
      return res.status(404).json({ ok: false, error: "SUBSCRIPTION_NOT_FOUND" });
    }

    if (sub.status === "active") {
      return res.redirect(302, buildResultUrl({ ok: true, authority }));
    }

    if (sub.status === "canceled" || sub.status === "expired") {
      return res.redirect(302, buildResultUrl({ ok: false, authority }));
    }

        if (sub.status !== "pending") {
      console.error(
        "[pay/verify] INVALID_SUBSCRIPTION_STATE",
        `subId=${sub.id || "unknown"}`,
        `status=${sub.status || "unknown"}`
      );
      return res.redirect(302, buildResultUrl({ ok: false, authority }));
    }

    const amount = sub.amount;
    const plan = sub.plan || "pro";
    const months = sub.months || 1;
    const phone = normalizeIranPhone(sub.phone || sub.user?.phone || "");

        if (!phone) {
      console.error(
        "[pay/verify] PHONE_MISSING_FOR_SUBSCRIPTION",
        `subId=${sub.id || "unknown"}`
      );
      return res.redirect(302, buildResultUrl({ ok: false, authority }));
    }

    if (hasGatewayStatus && status !== "OK") {
      await prisma.subscription.updateMany({
        where: {
          id: sub.id,
          status: "pending",
        },
        data: {
          status: "canceled",
          refId: "CANCELED",
        },
      });

      return res.redirect(302, buildResultUrl({ ok: false, authority }));
    }

    const now = new Date();

    if (!PAY_REAL) {
      const refId = `TEST-${Date.now()}`;

      await finalizeSubscription(prisma, {
        phone,
        provider: "zarinpal",
        authority,
        refId,
        amount,
        months,
        plan,
        now,
        metaJson: {
          mode: "mock",
          authority,
        },
      });

      return res.redirect(302, buildResultUrl({ ok: true, authority }));
    }

    if (!MERCHANT_ID) {
      return res.status(500).json({ ok: false, error: "MERCHANT_ID_MISSING" });
    }

    const verifyUrl = ZP_API_BASE.replace(/\/+$/, "") + "/verify.json";
    const payload = {
      merchant_id: MERCHANT_ID,
      authority,
      amount,
    };

    const zpRes = await fetch(verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await zpRes.json().catch(() => null);

        if (!zpRes.ok || !json) {
      console.error(
        "[pay/verify] ZARINPAL_VERIFY_FAILED",
        `status=${zpRes.status}`,
        `hasBody=${json ? "yes" : "no"}`
      );

      await prisma.subscription.updateMany({
        where: {
          id: sub.id,
          status: "pending",
        },
        data: {
          status: "canceled",
          refId: "VERIFY_FAILED",
        },
      });

      return res.redirect(302, buildResultUrl({ ok: false, authority }));
    }

    const { data, errors } = json;

        if (!data || (data.code !== 100 && data.code !== 101)) {
      const code = data?.code ?? errors?.code ?? "UNKNOWN";
      console.error(
        "[pay/verify] ZARINPAL_VERIFY_ERROR",
        `code=${code}`,
        `hasBody=${json ? "yes" : "no"}`
      );

      await prisma.subscription.updateMany({
        where: {
          id: sub.id,
          status: "pending",
        },
        data: {
          status: "canceled",
          refId: "VERIFY_FAILED",
        },
      });

      return res.redirect(302, buildResultUrl({ ok: false, authority }));
    }

    const refId = String(data.ref_id || "").trim() || "PAID";

    const metaJson = {
      gateway: "zarinpal",
      verifyCode: data.code,
      cardPan: data.card_pan || null,
      cardHash: data.card_hash || null,
      feeType: data.fee_type || null,
      fee: data.fee || null,
    };

    await finalizeSubscription(prisma, {
      phone,
      provider: "zarinpal",
      authority,
      refId,
      amount,
      months,
      plan,
      now,
      metaJson,
    });

    return res.redirect(302, buildResultUrl({ ok: true, authority }));
    } catch (e) {
    console.error("VERIFY_ERR", e?.message || "unknown_error");
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

router.get("/pay-result", async (req, res) => {
  setCORS(res);

  const ok = String(req.query.ok || "") === "1";
  const authority = String(req.query.authority || "").trim();

  const title = ok ? "پرداخت موفق" : "پرداخت ناموفق";
  const subtitle = ok
    ? "اشتراک شما فعال شد. می‌تونید به ققنوس برگردید."
    : "پرداخت تایید نشد. اگر مبلغی کم شده، معمولاً تا چند دقیقه برگشت می‌خوره.";

  const deepLink = buildDeepLink({ ok, authority });
  const intentLink = buildAndroidIntentLink({ ok, authority });

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.send(`<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Phoenix Pay</title>
  <meta name="theme-color" content="#0b0f14" />
  <style>
    :root{
      --bg:#0b0f14; --text:#e8eef7; --muted:#a7b3c6;
      --line:rgba(255,255,255,.10);
      --gold:#D4AF37; --accent:#E98A15;
      --ok:#22c55e; --bad:#f87171;
      --cardOk:#0b1220; --cardBad:#120b0f;
    }
    *{box-sizing:border-box}
    body{
      margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
      background:radial-gradient(900px 600px at 15% 10%, rgba(212,175,55,.14), transparent 55%),
                 radial-gradient(900px 600px at 85% 0%, rgba(233,138,21,.14), transparent 55%),
                 var(--bg);
      color:var(--text);
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      padding:24px;
    }
    .wrap{width:min(520px, 100%)}
    .card{
      background:${ok ? "var(--cardOk)" : "var(--cardBad)"};
      border:1px solid ${ok ? "rgba(212,175,55,.35)" : "rgba(248,113,113,.35)"};
      border-radius:22px;
      padding:22px;
      box-shadow: 0 18px 45px rgba(0,0,0,.35);
      position:relative;
      overflow:hidden;
    }
    .glow1,.glow2{ position:absolute; border-radius:999px; opacity:.9; pointer-events:none; }
    .glow1{ width:260px; height:260px; left:-120px; top:-120px; background:rgba(212,175,55,.12); }
    .glow2{ width:280px; height:280px; right:-140px; bottom:-140px; background:${ok ? "rgba(34,197,94,.10)" : "rgba(248,113,113,.10)"}; }
    .bar{
      height:4px; border-radius:999px;
      background:${ok ? "linear-gradient(90deg, var(--gold), var(--ok))" : "var(--bad)"};
      margin-bottom:16px;
    }
    .row{display:flex; gap:14px; align-items:center}
    .badge{
      width:48px; height:48px; border-radius:18px;
      display:grid; place-items:center;
      background:rgba(255,255,255,.05);
      border:1px solid var(--line);
      flex:0 0 auto;
    }
    .dot{
      width:18px; height:18px; border-radius:999px;
      background:${ok ? "var(--ok)" : "var(--bad)"};
      box-shadow: 0 0 0 7px ${ok ? "rgba(34,197,94,.18)" : "rgba(248,113,113,.18)"};
    }
    h1{margin:0; font-size:22px; letter-spacing:-.2px}
    p{margin:6px 0 0; color:var(--muted); line-height:1.7; font-size:14px}
    .btns{display:flex; gap:10px; margin-top:16px; flex-wrap:wrap}
    a.btn{
      display:inline-flex; align-items:center; justify-content:center;
      padding:12px 14px;
      border-radius:16px;
      text-decoration:none;
      font-weight:800;
      font-size:14px;
      border:1px solid ${ok ? "rgba(34,197,94,.35)" : "rgba(248,113,113,.35)"};
      background:${ok ? "rgba(34,197,94,.14)" : "rgba(248,113,113,.14)"};
      color:var(--text);
      flex:1 1 220px;
    }
    .hint{margin-top:12px; font-size:12px; color:rgba(231,238,247,.65)}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="glow1"></div><div class="glow2"></div>
      <div class="bar"></div>

      <div class="row">
        <div class="badge"><div class="dot"></div></div>
        <div>
          <h1>${title}</h1>
          <p>${subtitle}</p>
        </div>
      </div>

      <div class="btns">
        <a class="btn" href="#" id="openApp">بازگشت به قـــقنوس</a>
      </div>

      <div class="hint">
        اگر اپ باز نشد، اپ رو آپدیت کنید و دوباره روی دکمه بزنید.
      </div>
    </div>
  </div>

  <script>
  (function () {
    var btn = document.getElementById("openApp");
    if (!btn) return;

    var deepLink = ${JSON.stringify(deepLink)};
    var intentLink = ${JSON.stringify(intentLink)};

    function isAndroid() {
      var ua = navigator.userAgent || "";
      return /Android/i.test(ua);
    }

    function openApp() {
      if (isAndroid()) window.location.href = intentLink;
      else window.location.href = deepLink;

      setTimeout(function () {
        if (!document.hidden) {
          try { window.close(); } catch(e) {}
          try { history.back(); } catch(e) {}
        }
      }, 1200);
    }

    btn.addEventListener("click", function(e){
      e.preventDefault();
      openApp();
    });
  })();
  </script>
</body>
</html>`);
});

router.get("/status", async (req, res) => {
  setCORS(res);

  try {
    const authority = String(req.query.authority || "").trim();
    if (!authority) {
      return res.status(400).json({ ok: false, error: "AUTHORITY_REQUIRED" });
    }

    const sub = await prisma.subscription.findUnique({
      where: {
        provider_authority: {
          provider: "zarinpal",
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
  authority: sub.authority,
  status: sub.status,
  refId: sub.refId,
  amount: sub.amount,
  plan: sub.plan,
  months: sub.months,
  expiresAt: sub.expiresAt ? new Date(sub.expiresAt).toISOString() : null,
  paidAt: sub.paidAt ? new Date(sub.paidAt).toISOString() : null,
  provider: sub.provider || null,
});
    } catch (e) {
    console.error("PAY_STATUS_ERR", e?.message || "unknown_error");
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

export default router;