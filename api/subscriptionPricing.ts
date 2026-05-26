import { BACKEND_URL as RAW_BACKEND_URL } from "../constants/env";
import type { ApiResp } from "./pay";
import type { SubscriptionPricingShape } from "../config/subscriptionPricing";

function getBackendBase() {
  const base = (RAW_BACKEND_URL || "").trim();
  if (!base) return "https://api.qoqnoos.app";
  if (base.includes("vercel.app")) return "https://api.qoqnoos.app";
  return base;
}

function toUrl(path: string) {
  const base = getBackendBase().replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

async function doJson<T>(
  input: RequestInfo,
  init?: RequestInit
): Promise<ApiResp<T>> {
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
      return {
        ok: false,
        error: "INVALID_JSON",
        status: res.status,
      };
    }

    if (!res.ok || json?.ok === false) {
      return {
        ok: false,
        error: json?.error || `HTTP_${res.status}`,
        status: res.status,
      };
    }

    if (json && typeof json === "object" && "data" in json) {
      return json as ApiResp<T>;
    }

    const { ok, ...rest } = json || {};
    return { ok: true, data: rest as T };
  } catch (e: any) {
    return {
      ok: false,
      error: e?.message || "NETWORK_ERROR",
    };
  }
}

export async function getSubscriptionPricing(): Promise<ApiResp<SubscriptionPricingShape>> {
  const url = toUrl("/api/pay/pricing");
  return doJson<SubscriptionPricingShape>(url, {
    method: "GET",
  });
}
