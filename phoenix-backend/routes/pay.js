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

const PAY_RESULT_URL = (process.env.PAY_RESULT_URL || "").trim();
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

  const base = (PAY_RESULT_URL || `${PAY_RESULT_BASE.replace(/\/+$/, "")}/pay-result`).replace(/\/+$/, "");
  return `${base}?${params}`;
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

    const callback = PAY_REAL ? PAY_CALLBACK_URL : (String(body.callback || "") || `${req.protocol}://${req.get("host")}/api/pay/verify`);
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

  const ok = String(req.query.ok || "") === "1";
  const authority = String(req.query.authority || "").trim();

  const title = ok ? "پرداخت موفق" : "پرداخت ناموفق";
  const subtitle = ok
    ? "اشتراک شما فعال شد. می‌توانید به اپ برگردید."
    : "اگر مبلغی کسر شده، معمولاً تا چند دقیقه برگشت می‌خورد. دوباره تلاش کنید.";

  const deepLink = `phoenix://pay/result?ok=${ok ? "1" : "0"}&authority=${encodeURIComponent(authority)}`;
  const fallback = "https://qoqnoos.app";

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
      --bg:#0b0f14; --card:#111824; --text:#e8eef7; --muted:#a7b3c6;
      --line:rgba(255,255,255,.08);
      --gold:#D4AF37; --accent:#E98A15;
      --ok:#19c37d; --bad:#ff5a6a;
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
      background:linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02));
      border:1px solid var(--line);
      border-radius:18px;
      padding:22px;
      box-shadow: 0 18px 45px rgba(0,0,0,.35);
      position:relative;
      overflow:hidden;
    }
    .bar{
      height:4px; border-radius:999px;
      background:linear-gradient(90deg, var(--gold), var(--accent));
      opacity:.9; margin-bottom:16px;
    }
    .row{display:flex; gap:14px; align-items:center}
    .badge{
      width:44px; height:44px; border-radius:14px;
      display:grid; place-items:center;
      background:rgba(255,255,255,.06);
      border:1px solid var(--line);
      flex:0 0 auto;
    }
    .icon{
      width:18px; height:18px; border-radius:999px;
      background:${ok ? "var(--ok)" : "var(--bad)"};
      box-shadow: 0 0 0 6px ${ok ? "rgba(25,195,125,.18)" : "rgba(255,90,106,.18)"};
    }
    h1{margin:0; font-size:22px; letter-spacing:-.2px}
    p{margin:6px 0 0; color:var(--muted); line-height:1.7; font-size:14px}
    .kv{
      margin-top:16px; padding:12px 14px;
      border:1px solid var(--line);
      border-radius:14px;
      background:rgba(0,0,0,.18);
      display:flex; justify-content:space-between; gap:10px; align-items:center;
      font-size:13px;
    }
    .kv span{color:var(--muted)}
    code{
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size:12px;
      color:#fff;
      word-break:break-all;
    }
    .btns{display:flex; gap:10px; margin-top:16px; flex-wrap:wrap}
    a.btn{
      display:inline-flex; align-items:center; justify-content:center;
      padding:12px 14px;
      border-radius:14px;
      text-decoration:none;
      font-weight:700;
      font-size:14px;
      border:1px solid var(--line);
      background:rgba(255,255,255,.06);
      color:var(--text);
      transition:transform .06s ease, background .2s ease;
      flex:1 1 160px;
    }
    a.btn.primary{
      background:linear-gradient(90deg, rgba(212,175,55,.18), rgba(233,138,21,.18));
      border-color:rgba(212,175,55,.28);
    }
    a.btn:active{transform:scale(.99)}
    .hint{margin-top:12px; font-size:12px; color:rgba(231,238,247,.65)}
    .hint a{color:rgba(231,238,247,.85)}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="bar"></div>
      <div class="row">
        <div class="badge"><div class="icon"></div></div>
        <div>
          <h1>${title}</h1>
          <p>${subtitle}</p>
        </div>
      </div>

      <div class="kv">
        <span>کد پیگیری</span>
        <code>${authority || "-"}</code>
      </div>

      <div class="btns">
        <a class="btn primary" href="${deepLink}" id="openApp">بازگشت به اپ</a>
        <a class="btn" href="${fallback}">صفحه اصلی</a>
      </div>

      <div class="hint">
        اگر اپ باز نشد، اپ را نصب/آپدیت کنید یا از داخل مرورگر گوشی دوباره روی «بازگشت به اپ» بزنید.
      </div>
    </div>
  </div>

  <script>
  (function () {
    var a = document.getElementById("openApp");
    if (!a) return;

    var fallback = "https://qoqnoos.app";
    var deeplink = a.getAttribute("href");

    function isMobile() {
      var ua = navigator.userAgent || "";
      return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    }

    if (!isMobile()) {
      // Desktop: no auto-redirect
      return;
    }

    var opened = false;

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) opened = true;
    });

    setTimeout(function () {
      window.location.href = deeplink;
    }, 250);

    setTimeout(function () {
      if (!opened && !document.hidden) {
        window.location.href = fallback;
      }
    }, 7000);
  })();
</script>
</body>
</html>`);
});

export default router;