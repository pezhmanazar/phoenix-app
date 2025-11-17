import { BACKEND_URL } from "../constants/env";

// همون تیپ‌های user.ts
type ApiOk<T> = { ok: true; data: T };
type ApiErr = { ok: false; error: string };
export type ApiResp<T> = ApiOk<T> | ApiErr;

type StartReq = {
  phone: string;
  amount: number;
  description?: string;
};

type StartResp = {
  code: number;
  message?: string;
  authority: string;
  gatewayUrl: string;
  description: string;
};

type VerifyReq = {
  authority: string;
  status: "OK" | "NOK";
  amount: number;
  phone: string;
};

type VerifyResp = {
  authority: string;
  status: "OK" | "NOK";
  amount: number;
  phone: string | null;
  refId: string | number;
  plan: "free" | "pro" | "vip";
  verifyCode: number;
};

// 🔧 این تابع را کامل همینطوری بگذار
async function doJson<T>(input: RequestInfo, init?: RequestInit): Promise<ApiResp<T>> {
  try {
    const res = await fetch(input, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });

    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      return { ok: false, error: "INVALID_JSON" };
    }

    // اگر سرور خودش خطا برگردونده یا status بد است
    if (!res.ok || json?.ok === false) {
      return { ok: false, error: json?.error || `HTTP_${res.status}` };
    }

    // اگر از قبل data داشت (مثل بقیه‌ی APIها)، همون را پاس می‌دهیم
    if (json && typeof json === "object" && "data" in json) {
      return json as ApiResp<T>;
    }

    // 🔥 مخصوص pay/start و pay/verify:
    // json شکلی مثل { ok:true, code, authority, ... } دارد
    const { ok, ...rest } = json || {};
    return { ok: true, data: rest as T };
  } catch (e: any) {
    return { ok: false, error: e?.message || "NETWORK_ERROR" };
  }
}

// ---------- شروع پرداخت ----------
export async function startPay(body: StartReq): Promise<ApiResp<StartResp>> {
  const url = `${BACKEND_URL.replace(/\/+$/, "")}/api/pay/start`;
  return doJson<StartResp>(url, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ---------- وریفای پرداخت ----------
export async function verifyPay(q: VerifyReq): Promise<ApiResp<VerifyResp>> {
  const base = `${BACKEND_URL.replace(/\/+$/, "")}/api/pay/verify`;
  const url = new URL(base);
  url.searchParams.set("authority", q.authority);
  url.searchParams.set("status", q.status);
  url.searchParams.set("amount", String(q.amount));
  url.searchParams.set("phone", q.phone);

  return doJson<VerifyResp>(url.toString());
}