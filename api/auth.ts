// /api/auth.ts
// ⬅️ این نسخه جدید، به جای ورسل، به بک‌اند اصلی qoqnoos.app وصل می‌شود.

import { toAppApi } from "../constants/env";

/**
 * ارسال کد OTP به شماره کاربر
 *
 * سرور:
 *   POST https://qoqnoos.app/api/auth/send-otp
 *   body: { phone: "0914..." }
 *   resp: { ok: true, data: { phone, expiresInSec, devHint? } }
 *
 * ما:
 *   همان شکل قبلی را به useAuth برمی‌گردانیم:
 *   { ok: true, token: string, expiresInSec: number }
 */
export async function sendCode(phone: string) {
  const url = toAppApi("/api/auth/send-otp");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });

  const json = (await res.json().catch(() => ({} as any))) as any;

  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || "SEND_FAILED");
  }

  const data = json.data || {};

  // ⚠️ قبلاً backend ورسل یک otpToken می‌داد؛
  // الان بک‌اند جدید نیاز به otpToken ندارد، ولی برای این‌که
  // useAuth خراب نشود، یک رشته ثابت/نمادین برمی‌گردانیم.
  const otpToken = "OTP_TOKEN_NOT_USED";

  return {
    ok: true as const,
    token: otpToken,
    // از مقدار سرور استفاده می‌کنیم، اگر نبود ۱۸۰ ثانیه (۳ دقیقه)
    expiresInSec: Number(data.expiresInSec) || 180,
  };
}

/**
 * تایید کد OTP
 *
 * سرور:
 *   POST https://qoqnoos.app/api/auth/verify-otp
 *   body: { phone, code }
 *   resp: { ok: true, data: { phone, token } }
 *
 * ما:
 *   دوباره خروجی را به شکل قدیمی تبدیل می‌کنیم:
 *   { ok: true, sessionToken: string, sessionExpiresInSec: number }
 */
export async function verifyCode(
  phone: string,
  code: string,
  otpToken: string // اینجا فقط برای سازگاری با useAuth است، ولی سمت سرور استفاده نمی‌شود
) {
  const url = toAppApi("/api/auth/verify-otp");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, code }),
  });

  const json = (await res.json().catch(() => ({} as any))) as any;

  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || "VERIFY_FAILED");
  }

  const data = json.data || {};

  // سرور فعلاً فقط یک token ساده می‌دهد (FAKE_TOKEN_FOR_NOW)
  const sessionToken: string = data.token || "";
  // برای سازگاری، یک انقضای فرضی ۳۰ روزه می‌گذاریم
  const sessionExpiresInSec = 30 * 24 * 60 * 60; // ۳۰ روز

  return {
    ok: true as const,
    sessionToken,
    sessionExpiresInSec,
  };
}