// /api/auth.ts
import { toApi } from "../constants/env";

export async function sendCode(phone: string) {
  const url = `${toApi("/api/sendCode")}?phone=${encodeURIComponent(phone)}`; // sendCode همان GET بماند
  const r = await fetch(url, { method: "GET" });
  const j = await r.json().catch(() => ({} as any));
  if (!r.ok || !j?.ok) throw new Error(j?.error || "SEND_FAILED");
  return j as { ok: true; token: string; expiresInSec: number };
}

export async function verifyCode(phone: string, code: string, otpToken: string) {
  const url = toApi("/api/verifyCode");
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, code, token: otpToken }),
  });
  const j = await r.json().catch(() => ({} as any));
  if (!r.ok || !j?.ok) throw new Error(j?.error || "VERIFY_FAILED");
  return j as { ok: true; sessionToken: string; sessionExpiresInSec: number };
}