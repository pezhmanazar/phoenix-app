// routes/pay.js
import express from "express";

const router = express.Router();

// ---- Zarinpal / Payment config ----
const PAY_REAL = process.env.PAY_REAL === "1"; // اگر 1 باشد → واقعی، اگر نه → ماک
const MERCHANT_ID = process.env.MERCHANT_ID || "";
const ZP_BASE =
  process.env.ZP_BASE || "https://sandbox.zarinpal.com/pg/v4/payment";
const ZP_CURRENCY = process.env.ZP_CURRENCY || "IRT";

// برای صدا زدن /api/users/upsert روی همین بک‌اند
const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:4000";

// اگر amount از طرف درگاه/اپ نرسید، این رو به عنوان تست در نظر می‌گیریم
const DEFAULT_VERIFY_AMOUNT = 10000;

/* ---------- helpers ---------- */

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

/**
 * بر اساس مبلغ، نوع پلن و طول آن را برمی‌گرداند
 * - 399000  => یک ماهه
 * - 899000  => سه ماهه
 * - 1199000 => شش ماهه
 * - 10000   => تست یک ماهه
 */
function resolvePlan(amount) {
  if (amount === 399000 || amount === 10000) {
    return { plan: "pro", months: 1 };
  }
  if (amount === 899000) {
    return { plan: "pro", months: 3 };
  }
  if (amount === 1199000) {
    return { plan: "pro", months: 6 };
  }
  // fallback: اگر مبلغ ناشناخته بود، یک ماهه حساب کن
  return { plan: "pro", months: 1 };
}

/** تاریخ انقضا را بر اساس طول پلن (به ماه) می‌سازد */
function calcPlanExpiresAt(months) {
  const now = new Date();
  const d = new Date(now);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

function getBaseUrl(req) {
  const proto =
    (req.headers["x-forwarded-proto"] || req.protocol || "https").toString();
  const host = (
    req.headers["x-forwarded-host"] ||
    req.headers.host ||
    ""
  ).toString();
  return `${proto}://${host}`;
}

/**
 * بعد از پرداخت موفق، پلن کاربر را روی /api/users/upsert بک‌اند خودت آپدیت می‌کنیم
 */
async function upsertUserPlanOnServer({ phone, plan, planExpiresAt }) {
  if (!phone || !plan) {
    console.error("[pay/verify] upsertUserPlanOnServer missing phone/plan", {
      phone,
      plan,
    });
    return;
  }
  try {
    const base = BACKEND_URL.replace(/\/+$/, "");
    const targetUrl = `${base}/api/users/upsert`;
    const body = {
      phone,
      plan,
      planExpiresAt,
      profileCompleted: true,
    };
    console.log("[pay/verify] POST →", targetUrl, body);
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
      console.error(
        "[pay/verify] upsertUserPlanOnServer non-OK:",
        resp.status,
        text
      );
    } else {
      console.log(
        "[pay/verify] user plan updated via backend /api/users/upsert:",
        text
      );
    }
  } catch (e) {
    console.error("[pay/verify] upsertUserPlanOnServer error:", e);
  }
}

/* ---------- /api/pay/start ---------- */
/**
 * بدنه: { phone: "09...", amount: number, description?: string, callback?: string }
 * خروجی روی وایر:
 * { ok:true, code, authority, gatewayUrl, description }
 */
router.post("/start", async (req, res) => {
  setCORS(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const body = req.body || {};
    const phone = normalizeIranPhone(String(body.phone || ""));
    const amount = Number(body.amount || 0);
    const description = String(body.description || "پرداخت اشتراک ققنوس");
    const callback = String(
      body.callback || `${getBaseUrl(req)}/api/pay/verify`
    );

    if (!phone) {
      return res.status(400).json({ ok: false, error: "PHONE_INVALID" });
    }
    if (!amount || amount < 1000) {
      return res.status(400).json({ ok: false, error: "AMOUNT_INVALID" });
    }

    // 🔹 حالت ماک (تستی) – اینجا دیگه ورسل نیست، خود qoqnoos.app است
    if (!PAY_REAL) {
      const authority = `MOCK_${Math.random().toString(36).slice(2, 10)}`;

      const baseUrl = getBaseUrl(req);
      const params = new URLSearchParams({
        authority,
        amount: String(amount),
        phone,
      }).toString();
      const gatewayUrl = `${baseUrl}/mock-pay?${params}`;

      console.log("[pay/start][MOCK]", { phone, amount, authority, gatewayUrl });

      return res.json({
        ok: true,
        code: 100,
        message: "SUCCESS (MOCK)",
        authority,
        gatewayUrl,
        description,
      });
    }

    // 🔹 از اینجا به بعد حالت واقعی زرین‌پال
    if (!MERCHANT_ID) {
      return res
        .status(500)
        .json({ ok: false, error: "MERCHANT_ID_MISSING" });
    }

    const payload = {
      merchant_id: MERCHANT_ID,
      amount,
      description,
      callback_url: callback,
      currency: ZP_CURRENCY,
      metadata: { mobile: phone },
    };

    const requestUrl = ZP_BASE.replace(/\/+$/, "") + "/request.json";

    const zpRes = await fetch(requestUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await zpRes.json().catch(() => null);
    if (!zpRes.ok || !json) {
      console.error("ZARINPAL_REQUEST_FAILED", zpRes.status, json);
      return res
        .status(502)
        .json({ ok: false, error: "ZARINPAL_REQUEST_FAILED" });
    }

    const { data, errors } = json;
    if (!data || data.code !== 100) {
      const code = data?.code ?? errors?.code ?? "UNKNOWN";
      console.error("ZARINPAL_ERROR", code, json);
      return res
        .status(502)
        .json({ ok: false, error: `ZP_ERROR_${code}` });
    }

    const authority = data.authority;
    const isSandbox = ZP_BASE.includes("sandbox");
    const gatewayBase = isSandbox
      ? "https://sandbox.zarinpal.com/pg/StartPay/"
      : "https://www.zarinpal.com/pg/StartPay/";
    const gatewayUrl = `${gatewayBase}${authority}`;

    console.log("START OK:", authority, gatewayUrl);

    return res.json({
      ok: true,
      code: data.code,
      authority,
      gatewayUrl,
      description,
    });
  } catch (e) {
    console.error("PAY_START_ERR", e);
    return res
      .status(500)
      .json({ ok: false, error: e?.message || "SERVER_ERROR" });
  }
});

/* ---------- /api/pay/verify ---------- */
/**
 * روی وایر:
 * GET /api/pay/verify?authority=...&status=OK&amount=...&phone=09...
 *
 * خروجی:
 * { ok:true, authority, status, amount, phone, refId, plan, planExpiresAt, verifyCode, canceled }
 */
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
    const authority = String(q.Authority || q.authority || "");
    const phone = q.phone ? normalizeIranPhone(String(q.phone)) : null;

    let amount = Number(q.amount || 0);
    if (!amount || isNaN(amount)) {
      amount = DEFAULT_VERIFY_AMOUNT;
    }

    if (!authority) {
      return res
        .status(400)
        .json({ ok: false, error: "INVALID_VERIFY_INPUT" });
    }

    const { plan, months } = resolvePlan(amount);
    const planExpiresAt = calcPlanExpiresAt(months);

    // اگر از درگاه برگشته و Status != OK → لغو
    if (hasGatewayStatus && status !== "OK") {
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

    // 🔹 MOCK mode
    if (!PAY_REAL) {
      const refId = `TEST-${Date.now()}`;

      if (phone) {
        await upsertUserPlanOnServer({
          phone,
          plan,
          planExpiresAt,
        });
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

    // 🔹 حالت واقعی زرین‌پال
    if (!MERCHANT_ID) {
      return res
        .status(500)
        .json({ ok: false, error: "MERCHANT_ID_MISSING" });
    }

    const verifyUrl = ZP_BASE.replace(/\/+$/, "") + "/verify.json";
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
      console.error("ZARINPAL_VERIFY_FAILED", zpRes.status, json);
      return res
        .status(502)
        .json({ ok: false, error: "ZARINPAL_VERIFY_FAILED" });
    }

    const { data, errors } = json;
    if (!data || (data.code !== 100 && data.code !== 101)) {
      const code = data?.code ?? errors?.code ?? "UNKNOWN";
      console.error("ZARINPAL_VERIFY_ERROR", code, json);
      return res
        .status(502)
        .json({ ok: false, error: `ZP_VERIFY_ERROR_${code}` });
    }

    const refId = data.ref_id;

    if (phone) {
      await upsertUserPlanOnServer({
        phone,
        plan,
        planExpiresAt,
      });
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
      verifyCode: data.code, // 100 یا 101
      canceled: false,
    });
  } catch (e) {
    console.error("VERIFY_ERR", e);
    return res
      .status(500)
      .json({ ok: false, error: e?.message || "SERVER_ERROR" });
  }
});

export default router;