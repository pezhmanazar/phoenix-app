// api/otp.ts
import { toAppApi } from "@/constants/env";

type SendResp = {
  ok: true;
  phone?: string;
  expiresInSec?: number;
  devHint?: string;
  smsSent?: boolean;
  smsError?: string | null;
};

type VerifyResp = {
  ok: true;
  phone?: string;
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

  return {
    ok: true,
    phone: data.phone,
    expiresInSec: data.expiresInSec,
    devHint: data.devHint,
    smsSent: data.smsSent,
    smsError: data.smsError ?? null,
  };
}

// ----------------- وریفای کد -----------------
export async function verifyCode(
  phone: string,
  code: string,
  _otpToken?: string | null
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

  const sessionToken: string | undefined =
    data.token ?? data.sessionToken;

  if (!sessionToken) {
    throw new Error("NO_SESSION_FROM_BACKEND");
  }

  return {
    ok: true,
    phone: data.phone,
    sessionToken,
    sessionExpiresInSec: data.sessionExpiresInSec,
  };
}
