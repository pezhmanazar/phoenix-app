// /api/otp.ts
import { toApi } from "@/constants/env";

export async function sendCode(phone: string) {
  const url = `${toApi("/api/sendCode")}?phone=${encodeURIComponent(phone)}&fresh=1`;
  const res = await fetch(url, { method: "GET" });
  const json = await res.json().catch(() => ({} as any));
  if (!res.ok || !json?.ok) throw new Error(json?.error || "SEND_FAILED");
  return json as { ok: true; token: string; expiresInSec: number };
}

export async function verifyCode(phone: string, code: string, token: string) {
  const url =
    `${toApi("/api/verifyCode")}` +
    `?phone=${encodeURIComponent(phone)}` +
    `&code=${encodeURIComponent(code)}` +
    `&token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { method: "GET" }); // ⬅️ صراحتاً GET
  const json = await res.json().catch(() => ({} as any));
  if (!res.ok || !json?.ok) throw new Error(json?.error || "VERIFY_FAILED");
  return json as { ok: true; sessionToken: string; sessionExpiresInSec: number };
}