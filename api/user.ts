// phoenix-app/api/user.ts
import { BACKEND_URL } from "../constants/env";

type ApiOk<T> = { ok: true; data: T };
type ApiErr = { ok: false; error: string };
export type ApiResp<T> = ApiOk<T> | ApiErr;

export type UserRecord = {
  phone: string;

  fullName?: string | null;
  gender?: "male" | "female" | "other" | null;
  birthDate?: string | null; // yyyy-mm-dd
  avatarUrl?: string | null; // http/file/icon

  // 🔥 پلن و انقضا
  plan?: "free" | "pro" | "vip";
  planExpiresAt?: string | null; // ISO یا null

  profileCompleted?: boolean;
  notifyTags?: string[];

  // 🔍 فیلدهای زمانی از دیتابیس
  createdAt?: string | null;
  lastLoginAt?: string | null; // ISO
  updatedAt?: string | null;
};

function toUrl(path: string) {
  const base = BACKEND_URL.replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

async function doJson<T>(input: RequestInfo, init?: RequestInit): Promise<ApiResp<T>> {
  try {
    const res = await fetch(input, init);
    const text = await res.text();
    const json = text ? JSON.parse(text) : {};

    if (!res.ok) {
      const err = (json as any)?.error || `HTTP_${res.status}`;
      return { ok: false, error: err };
    }

    // اگر سرور خودش { ok, data } برگردانده، همان را پاس بده
    if (typeof json === "object" && json && "ok" in json && "data" in json) {
      return json as ApiResp<T>;
    }

    // در غیر اینصورت فرض کن بدنه مستقیم خود دیتا بوده
    return { ok: true, data: json as T };
  } catch (e: any) {
    return { ok: false, error: e?.message || "NETWORK_ERROR" };
  }
}

// ----------------- helpers برای شماره موبایل -----------------
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

// ----------------- APIهای سمت اپ -----------------

// گرفتن پروفایل بر اساس شماره (الان از همین استفاده می‌کنیم)
export async function getMeByPhone(phone: string): Promise<ApiResp<UserRecord>> {
  const p = normalizeIranPhone(phone);
  const url = toUrl(`/api/user?phone=${encodeURIComponent(p)}`);
  return doJson<UserRecord>(url, { method: "GET" });
}

// آپسرت پروفایل (پروفایل ویزارد، آپدیت پلن بعد از پرداخت، ...)
export async function upsertUserByPhone(
  phone: string,
  payload: Partial<UserRecord>
): Promise<ApiResp<UserRecord>> {
  const p = normalizeIranPhone(phone);
  const url = toUrl(`/api/user?phone=${encodeURIComponent(p)}`);
  return doJson<UserRecord>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, phone: p }),
  });
}

// ریست‌کردن پروفایل (برای تست)
export async function resetUserByPhone(phone: string): Promise<ApiResp<UserRecord>> {
  const p = normalizeIranPhone(phone);
  const url = toUrl(`/api/user?phone=${encodeURIComponent(p)}&reset=true`);
  return doJson<UserRecord>(url, { method: "DELETE" });
}