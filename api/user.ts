// phoenix-app/api/user.ts

import AsyncStorage from "@react-native-async-storage/async-storage";

type ApiOk<T> = { ok: true; data: T };
type ApiErr = { ok: false; error: string };
export type ApiResp<T> = ApiOk<T> | ApiErr;

export type UserPlan = "free" | "pro" | "vip";

export type UserRecord = {
  id?: string;
  phone: string;

  fullName?: string | null;
  gender?: "male" | "female" | "other" | null;
  birthDate?: string | null; // yyyy-mm-dd

  avatarUrl?: string | null; // http/file/icon

  plan?: UserPlan;
  planExpiresAt?: string | null; // ISO

  profileCompleted?: boolean;

  notifyTags?: string[];

  createdAt?: string | null;
  lastLoginAt?: string | null;
  updatedAt?: string | null;
};

export type Me = UserRecord;

/**
 * ✅ مهم: فقط API مربوط به /api/users/* را از api.qoqnoos.app بزنیم
 * تا WCDN روی qoqnoos.app مزاحم JSON نشود.
 * بقیه سیستم‌ها (OTP/پرداخت/...) همچنان از APP_API_URL استفاده می‌کنند.
 */
const USERS_API_URL =
  (process.env.EXPO_PUBLIC_USERS_API_URL || "").trim() ||
  "https://api.qoqnoos.app";

function userUrl(path: string) {
  const base = USERS_API_URL.replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

async function doJson<T>(
  input: RequestInfo,
  init?: RequestInit,
  options?: { notFoundError?: string }
): Promise<ApiResp<T>> {
  try {
    const baseHeaders: Record<string, string> = {};
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((v, k) => {
          baseHeaders[k] = v;
        });
      } else if (Array.isArray(init.headers)) {
        for (const [k, v] of init.headers as [string, string][]) {
          baseHeaders[k] = v;
        }
      } else {
        Object.assign(baseHeaders, init.headers as Record<string, string>);
      }
    }

    baseHeaders["Cache-Control"] = "no-cache";
    baseHeaders["Pragma"] = "no-cache";
    baseHeaders["x-cache-bust"] = String(Date.now());

    const sessionToken = await AsyncStorage.getItem("session_v1");
    if (sessionToken) {
      baseHeaders["Authorization"] = `Bearer ${sessionToken}`;
      baseHeaders["x-session-token"] = sessionToken;
    }

    const res = await fetch(input, {
      ...init,
      headers: baseHeaders,
    });

    if (res.status === 404) {
      return { ok: false, error: options?.notFoundError || "HTTP_404" };
    }

    const text = await res.text();
    let json: any = {};

    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      if (!res.ok) {
        return { ok: false, error: `HTTP_${res.status}` };
      }

      return { ok: false, error: `PARSE_ERROR_${res.status}` };
    }

    if (!res.ok) {
      const err = json?.error || `HTTP_${res.status}`;
      return { ok: false, error: err };
    }

    if (typeof json === "object" && json && "ok" in json) {
      return json as ApiResp<T>;
    }

    return { ok: true, data: json as T };
   } catch (e: any) {
    return {
      ok: false,
      error: e?.message || e?.name || "NETWORK_ERROR",
    };
  }
}

// ----------------- helper تبدیل رقم -----------------

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

/* ----------------- این سه تا برای پروفایل‌ویزارد و کار با بک‌اند لوکال ----------------- */

// GET http://192.168.xxx.xxx:4000/api/users/me?phone=...
export async function getMeByPhone(
  phone: string
): Promise<ApiResp<UserRecord | null>> {
  const p = normalizeIranPhone(phone);
  const cacheBuster = `cb=${Date.now()}`;
  const url =
    userUrl(`/api/users/me`) + `?phone=${encodeURIComponent(p)}&${cacheBuster}`;
  return doJson<UserRecord | null>(
  url,
  {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  },
  { notFoundError: "USER_NOT_FOUND" }
);
}

// POST http://192.168.xxx.xxx:4000/api/users/upsert
export async function upsertUserByPhone(
  phone: string,
  payload: Partial<UserRecord>
): Promise<ApiResp<UserRecord>> {
  // phone فعلاً فقط برای سازگاری با کدهای قدیمی نگه داشته شده.
  // بک‌اند کاربر را از روی توکن می‌شناسد، نه از روی phone ارسالی.
  normalizeIranPhone(phone);

  const url = userUrl(`/api/users/upsert`);

  const safePayload: Partial<UserRecord> = {};

  if (typeof payload.fullName === "string") {
    safePayload.fullName = payload.fullName;
  }

  if (typeof payload.gender === "string") {
    safePayload.gender = payload.gender;
  }

  if (payload.birthDate !== undefined) {
    safePayload.birthDate = payload.birthDate;
  }

  if (typeof payload.profileCompleted === "boolean") {
    safePayload.profileCompleted = payload.profileCompleted;
  }

  if (typeof payload.avatarUrl === "string") {
  safePayload.avatarUrl = payload.avatarUrl;
}

if (typeof payload.plan === "string") {
  safePayload.plan = payload.plan;
}

if (typeof payload.lastLoginAt === "string") {
  safePayload.lastLoginAt = payload.lastLoginAt;
}

  return doJson<UserRecord>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(safePayload),
  });
}


// DELETE برای ریست پروفایل (اگر روی بک‌اند پیاده شده باشد)
export async function resetUserByPhone(
  phone: string
): Promise<ApiResp<UserRecord>> {
  const p = normalizeIranPhone(phone);
  const url = userUrl(`/api/users/reset?phone=${encodeURIComponent(p)}`);
  return doJson<UserRecord>(url, { method: "DELETE" });
}

// ✅ NEW: POST /api/users/me/reset?phone=...
// ریست کامل داده‌های درمان/آزمون/پلکان روی سرور (بدون حذف خود User)
export async function resetAllUserDataByPhone(
  phone: string
): Promise<ApiResp<{ reset: boolean }>> {
  const p = normalizeIranPhone(phone);
  const url = userUrl(`/api/users/me/reset?phone=${encodeURIComponent(p)}`);
  return doJson<{ reset: boolean }>(url, { method: "POST" });
}

// DELETE /api/users/delete?phone=...
export async function deleteMeByPhone(
  phone: string
): Promise<ApiResp<{ deleted: boolean }>> {
  const p = normalizeIranPhone(phone);
  const url = userUrl(`/api/users/me/delete?phone=${encodeURIComponent(p)}`);
  return doJson<{ deleted: boolean }>(url, { method: "POST" });
}

/* ----------------- fetchMe برای useUser ----------------- */

/**
 * me را واقعا از بک‌اند ققنوس می‌خواند.
 * منبع شماره موبایل: otp_phone_v1 داخل AsyncStorage (همونی که useAuth می‌سازه).
 */
export async function fetchMe(): Promise<Me | null> {
  try {
    const storedPhone = await AsyncStorage.getItem("otp_phone_v1");
    if (!storedPhone) {
      return null;
    }

    const resp = await getMeByPhone(storedPhone);
    if (!resp.ok) {
      return null;
    }

    return resp.data;
  } catch {
    return null;
  }
}
