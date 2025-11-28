// phoenix-app/api/user.ts
import { APP_API_URL } from "../constants/env";

type ApiOk<T> = { ok: true; data: T };
type ApiErr = { ok: false; error: string };
export type ApiResp<T> = ApiOk<T> | ApiErr;

export type UserRecord = {
  phone: string;
  fullName?: string | null;
  gender?: "male" | "female" | "other" | null;
  birthDate?: string | null; // yyyy-mm-dd
  avatarUrl?: string | null; // http/file/icon
  plan?: "free" | "pro" | "vip";
  planExpiresAt?: string | null; // ISO
  profileCompleted?: boolean;
  notifyTags?: string[];
  createdAt?: string | null;
  lastLoginAt?: string | null;
  updatedAt?: string | null;
};

function userUrl(path: string) {
  const base = APP_API_URL.replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

async function doJson<T>(input: RequestInfo, init?: RequestInit): Promise<ApiResp<T>> {
  try {
    const res = await fetch(input, init);
    const text = await res.text();

    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch (e: any) {
      console.log(
        "[user.doJson] parse error, status =",
        res.status,
        "body[0..120] =",
        text.slice(0, 120)
      );
      return { ok: false, error: `PARSE_ERROR_${res.status}` };
    }

    if (!res.ok) {
      const err = json?.error || `HTTP_${res.status}`;
      return { ok: false, error: err };
    }

    if (typeof json === "object" && json && "ok" in json && "data" in json) {
      return json as ApiResp<T>;
    }

    return { ok: true, data: json as T };
  } catch (e: any) {
    return { ok: false, error: e?.message || "NETWORK_ERROR" };
  }
}

// ----------------- helpers تلفن -----------------
const toEnDigits = (s: string) =>
  String(s || "").replace(/[0-9۰-۹٠-٩]/g, (d) => {
    const fa = "۰۱۲۳۴۵۶۷۸۹";
    const ar = "٠١٢٣٤٥٦٧٨٩";
    const iFa = fa.indexOf(d);
    if (iFa > -1) return String(iFa);
    const iAr = ar.indexOf(d);
    if (iAr > -1) return String(iAr);
    return d;
  });

export function normalizeIranPhone(v: string) {
  const only = toEnDigits(v).replace(/\D/g, "");
  if (only.startsWith("0098")) return "0" + only.slice(3);
  if (only.startsWith("098")) return "0" + only.slice(3);
  if (only.startsWith("98")) return "0" + only.slice(2);
  if (only.startsWith("9") && only.length === 10) return "0" + only;
  return only;
}

// ----------------- APIها (روی بک‌اند، نه ورسل) -----------------

// GET http://192.168.100.4:4000/api/users/me?phone=...
export async function getMeByPhone(phone: string): Promise<ApiResp<UserRecord>> {
  const p = normalizeIranPhone(phone);
  const url = userUrl(`/api/users/me?phone=${encodeURIComponent(p)}`);
  console.log("[user.getMeByPhone] url =", url);
  return doJson<UserRecord>(url, { method: "GET" });
}

// POST http://192.168.100.4:4000/api/users/upsert
export async function upsertUserByPhone(
  phone: string,
  payload: Partial<UserRecord>
): Promise<ApiResp<UserRecord>> {
  const p = normalizeIranPhone(phone);
  const url = userUrl(`/api/users/upsert`);
  console.log("[user.upsertUserByPhone] url =", url, "payload =", { ...payload, phone: p });
  return doJson<UserRecord>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, phone: p }),
  });
}

// اختیاری
export async function resetUserByPhone(phone: string): Promise<ApiResp<UserRecord>> {
  const p = normalizeIranPhone(phone);
  const url = userUrl(`/api/users/reset?phone=${encodeURIComponent(p)}`);
  return doJson<UserRecord>(url, { method: "DELETE" });
}