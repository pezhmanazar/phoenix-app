import { toApi } from "@/constants/env";

export async function sendCode(phone: string) {
  const url = `${toApi("/api/sendCode")}?phone=${encodeURIComponent(phone)}`;
  const res = await fetch(url, { method: "GET" });
  const json = await res.json().catch(() => ({} as any));
  if (!res.ok || !json?.ok) throw new Error(json?.error || "SEND_FAILED");
  return json as { ok: true; token: string; expiresInSec: number };
}