// /api/otp.ts
// این نسخه، OTP را از بک‌اند اصلی qoqnoos.app می‌گیرد، نه ورسل.

import { toAppApi } from "@/constants/env";

/**
 * ارسال کد OTP
 *
 * سرور:
 *   POST https://qoqnoos.app/api/auth/send-otp
 *   body: { phone }
 *   resp: { ok: true, data: { phone, expiresInSec, devHint? } }
 *
 * ما:
 *   برای useAuth مثل قبل برمی‌گردانیم:
 *   { ok: true; token: string; expiresInSec: number }
 */
export async function sendCode(phone: string) {
  const url = toAppApi("/api/auth/send-otp");

  console.log("[sendCode] →", url, "phone =", phone);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });

  const json = (await res.json().catch(() => ({} as any))) as any;

  if (!res.ok || !json?.ok) {
    console.log("[sendCode][ERR]", json);
    throw new Error(json?.error || "SEND_FAILED");
  }

  const data = json.data || {};

  // قبلاً ورسل یه otpToken می‌داد. الان بک‌اند ما لازم نداره.
  // برای این‌که useAuth خراب نشه، یه رشته ثابت برمی‌گردونیم.
  const otpToken = "OTP_TOKEN_NOT_USED";

  const expiresInSec = Number(data.expiresInSec) || 180;

  console.log("[sendCode][OK]", { otpToken, expiresInSec });

  return {
    ok: true as const,
    token: otpToken,
    expiresInSec,
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
 *   برای useAuth مثل قبل برمی‌گردانیم:
 *   { ok: true; sessionToken: string; sessionExpiresInSec: number }
 */
export async function verifyCode(
  phone: string,
  code: string,
  token: string // فقط برای سازگاری با useAuth؛ سمت سرور استفاده نمی‌شود
) {
  const url = toAppApi("/api/auth/verify-otp");

  console.log("[verifyCode] →", url, "phone =", phone, "code =", code);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, code }),
  });

  const json = (await res.json().catch(() => ({} as any))) as any;

  if (!res.ok || !json?.ok) {
    console.log("[verifyCode][ERR]", json);
    throw new Error(json?.error || "VERIFY_FAILED");
  }

  const data = json.data || {};

  const sessionToken: string = data.token || "";
  const sessionExpiresInSec = 30 * 24 * 60 * 60; // ۳۰ روز

  console.log("[verifyCode][OK]", {
    sessionToken: sessionToken ? "***" : "",
    sessionExpiresInSec,
  });

  return {
    ok: true as const,
    sessionToken,
    sessionExpiresInSec,
  };
}