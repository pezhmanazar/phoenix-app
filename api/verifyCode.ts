import { toApi } from "@/constants/env";

export async function verifyCode(phone: string, code: string, token: string) {
  const url =
    `${toApi("/api/verifyCode")}` +
    `?phone=${encodeURIComponent(phone)}` +
    `&code=${encodeURIComponent(code)}` +
    `&token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { method: "GET" });
  const json = await res.json().catch(() => ({} as any));
  if (!res.ok || !json?.ok) throw new Error(json?.error || "VERIFY_FAILED");
  return json as { ok: true; message: string; sessionToken: string; sessionExpiresInSec: number };
}