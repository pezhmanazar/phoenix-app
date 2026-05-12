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

function getApiError(json: any, status: number, fallback: string) {
  return (
    json?.error ||
    json?.message ||
    json?.detail ||
    json?.data?.error ||
    json?.data?.message ||
    `${fallback}_${status}`
  );
}

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
    throw new Error(getApiError(json, res.status, "SEND_FAILED"));
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
  code: string
): Promise<VerifyResp> {
  const url = toAppApi("/api/auth/verify-otp");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, code }),
  });

  const json = (await res.json().catch(() => ({}))) as any;

  console.log("VERIFY_API_STATUS:", res.status);
  console.log("VERIFY_API_JSON:", json);

  if (!res.ok || !json?.ok) {
    throw new Error(getApiError(json, res.status, "VERIFY_FAILED"));
  }

  const data = json.data ?? json;

  const sessionToken: string | undefined =
    data?.sessionToken ?? data?.token;

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
