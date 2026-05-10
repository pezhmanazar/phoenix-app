// api/otp.ts
import { toAppApi } from "@/constants/env";

type SendResp = {
  ok: true;
  expiresInSec?: number;
  devHint?: string;
  token?: string | null;
};

type VerifyResp = {
  ok: true;
  sessionToken: string;
  sessionExpiresInSec?: number;
};

// ----------------- ارسال کد -----------------
export async function sendCode(phone: string): Promise<SendResp> {
  const url = toAppApi("/api/auth/send-otp");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });

  const json = (await res.json().catch(() => ({}))) as any;

  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || `SEND_FAILED_${res.status}`);
  }

  const data = json.data ?? json;

  const out: SendResp = {
    ok: true,
    expiresInSec: data.expiresInSec,
    devHint: data.devHint,
    token: data.token ?? null, // الان فعلاً استفاده نمی‌کنیم
  };

  return out;
}

// ----------------- وریفای کد -----------------
export async function verifyCode(
  phone: string,
  code: string,
  _otpToken: string | null
): Promise<VerifyResp> {
  const url = toAppApi("/api/auth/verify-otp");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, code }),
  });

  const json = (await res.json().catch(() => ({}))) as any;

  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || `VERIFY_FAILED_${res.status}`);
  }

  const data = json.data ?? json;
  const sessionToken: string | undefined = data.token ?? data.sessionToken;

  if (!sessionToken) {
    throw new Error("NO_SESSION_FROM_BACKEND");
  }

  const out: VerifyResp = {
    ok: true,
    sessionToken,
    sessionExpiresInSec: data.sessionExpiresInSec ?? 24 * 3600,
  };

  return out;
}
