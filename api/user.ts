// phoenix-app/api/user.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { APP_API_URL } from "../constants/env";

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

function userUrl(path: string) {
  const base = APP_API_URL.replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

async function doJson<T>(
  input: RequestInfo,
  init?: RequestInit
): Promise<ApiResp<T>> {
  try {
    // 1) هدرهای قبلی را جمع می‌کنیم
    const baseHeaders: Record<string, string> = {};
    if (init?.headers) {
      // اگر قبلاً هدر داشتیم (مثلاً Content-Type) حفظشان می‌کنیم
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

    // 2) توکن سشن را از AsyncStorage می‌خوانیم
    const sessionToken = await AsyncStorage.getItem("session_v1");
    if (sessionToken) {
      // هر دو نوع هدر را می‌فرستیم تا با هر میدل‌وری‌ای سازگار باشد
      baseHeaders["Authorization"] = `Bearer ${sessionToken}`;
      baseHeaders["x-session-token"] = sessionToken;
    }

    // 3) درخواست را با هدرهای نهایی می‌فرستیم
    const res = await fetch(input, {
      ...init,
      headers: baseHeaders,
    });

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
  const cacheBuster = Date.now();
  const url = userUrl(
    `/api/users/me?phone=${encodeURIComponent(p)}&cb=${cacheBuster}`
  );
  console.log("[user.getMeByPhone] url =", url);
  return doJson<UserRecord | null>(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });
}

// POST http://192.168.xxx.xxx:4000/api/users/upsert
export async function upsertUserByPhone(
  phone: string,
  payload: Partial<UserRecord>
): Promise<ApiResp<UserRecord>> {
  const p = normalizeIranPhone(phone);
  const url = userUrl(`/api/users/upsert`);
  console.log("[user.upsertUserByPhone] url =", url, "payload =", {
    ...payload,
    phone: p,
  });
  return doJson<UserRecord>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, phone: p }),
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

/* ----------------- fetchMe برای useUser ----------------- */
/**
 * me را واقعا از بک‌اند ققنوس می‌خواند.
 * منبع شماره موبایل: otp_phone_v1 داخل AsyncStorage (همونی که useAuth می‌سازه).
 */
export async function fetchMe(): Promise<Me | null> {
  try {
    const storedPhone = await AsyncStorage.getItem("otp_phone_v1");
    if (!storedPhone) {
      console.log("[user.fetchMe] no stored phone");
      return null;
    }
    console.log("[user.fetchMe] loading me for phone =", storedPhone);
    const resp = await getMeByPhone(storedPhone);
    if (!resp.ok) {
      console.log("[user.fetchMe] error =", resp.error);
      return null;
    }
    console.log("[user.fetchMe] loaded me =", resp.data);
    return resp.data;
  } catch (e: any) {
    console.log("[user.fetchMe] exception", e?.message || e);
    return null;
  }
}