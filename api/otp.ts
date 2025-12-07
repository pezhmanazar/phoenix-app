// api/otp.ts
import { toAppApi } from "@/constants/env";

/**
 * ارسال OTP
 * از سرور اصلی ققنوس:
 *  POST https://qoqnoos.app/api/auth/send-otp
 */
export async function sendCode(phone: string) {
  const url = toAppApi("/api/auth/send-otp");
  console.log("[otp.sendCode] →", url, "phone =", phone);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });

  const json = await res.json().catch(() => ({} as any));
  console.log("[otp.sendCode][RAW]", json);

  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || `SEND_FAILED_${res.status}`);
  }

  const data = json.data || {};

  // سرور فعلی این رو برمی‌گردونه:
  // { ok:true, data:{ phone, expiresInSec, devHint, token? } }
  return {
    ok: true as const,
    token: (data.token as string | undefined) ?? null, // فعلاً استفاده نمی‌کنیم
    expiresInSec: (data.expiresInSec as number | undefined) ?? 180,
  };
}

/**
 * وریفای OTP
 *  POST https://qoqnoos.app/api/auth/verify-otp
 *
 * توجه: سرور فعلی:
 *  { ok:true, data:{ phone, token: "FAKE_TOKEN_FOR_NOW" } }
 * ما این را به شکل sessionToken برمی‌گردانیم تا useAuth تغییری نخواهد.
 */
export async function verifyCode(
  phone: string,
  code: string,
  _otpToken?: string | null
) {
  const url = toAppApi("/api/auth/verify-otp");
  console.log("[otp.verifyCode] →", url, { phone, code });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, code }),
  });

  const json = await res.json().catch(() => ({} as any));
  console.log("[otp.verifyCode][RAW]", json);

  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || `VERIFY_FAILED_${res.status}`);
  }

  const data = json.data || {};

  const sessionToken = (data.token as string | undefined) ?? null;
  if (!sessionToken) {
    throw new Error("NO_SESSION_TOKEN_FROM_BACKEND");
  }

  // useAuth انتظار این شکل رو داشت:
  // { ok:true, sessionToken, sessionExpiresInSec }
  return {
    ok: true as const,
    sessionToken,
    sessionExpiresInSec:
      (data.sessionExpiresInSec as number | undefined) ??
      365 * 24 * 60 * 60, // یک سال، صرفاً دیفالت
  };
}