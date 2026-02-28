// lib/payments/providers/bazaarProvider.ts
import * as PoolakeyNS from "@cafebazaar/react-native-poolakey";
import Constants from "expo-constants";
import type { PaymentApi, SubSku } from "../getPaymentProvider";

function getRsa(): string {
  return (
    (((Constants.expoConfig?.extra as any)?.EXPO_PUBLIC_BAZAAR_RSA_PUBLIC_KEY as
      | string
      | undefined) || "")
  ).trim();
}

/** بعضی نسخه‌ها default export دارن، بعضی namespace */
function getPk(): any {
  const ns: any = PoolakeyNS as any;
  return ns?.default ?? ns;
}

function mapSkuToProductId(sku: SubSku): string {
  return sku === "sub_30"
    ? "phoenix_pro_1m"
    : sku === "sub_90"
    ? "phoenix_pro_3m"
    : "phoenix_pro_6m";
}

async function ensureConnected(): Promise<void> {
  const rsaKey = getRsa();
  const pk = getPk();

  console.log("[bazaar] rsa len =", rsaKey.length);
  if (!rsaKey) throw new Error("BAZAAR_RSA_MISSING");

  // اگر نسخه‌ای isConnected داشت
  try {
    if (typeof pk.isConnected === "function") {
      const ok = await pk.isConnected();
      if (ok) return;
    }
  } catch {}

  if (typeof pk.connect === "function") {
    try {
      await pk.connect(rsaKey); // بعضی‌ها اینو می‌خوان
      return;
    } catch {
      await pk.connect(); // بعضی‌ها بدون آرگومان
      return;
    }
  }

  if (typeof pk.init === "function") {
    await pk.init(rsaKey);
    return;
  }

  if (typeof pk.setConfig === "function") {
    pk.setConfig({ rsaPublicKey: rsaKey });
    if (typeof pk.connect === "function") {
      await pk.connect();
      return;
    }
  }

  throw new Error("POOLAEKY_CONNECT_METHOD_NOT_FOUND");
}

function isBazaarCancelError(e: any): boolean {
  const msg = String(e?.message || e || "").toLowerCase();

  // متن‌های رایجِ Poolakey/Android
  return (
    msg.includes("purchase cancelled") ||
    msg.includes("purchase canceled") ||
    msg.includes("purchase cancelled") ||
    msg.includes("user canceled") ||
    msg.includes("user cancelled") ||
    msg.includes("cancelled") ||
    msg.includes("canceled")
  );
}

async function verifyOnServer(params: {
  phone: string;
  productId: string;
  purchaseToken: string;
  orderId?: string;
  packageName?: string;
  purchaseTime?: any;
}) {
  const res = await fetch("https://api.qoqnoos.app/api/pay-bazaar/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const text = await res.text();
  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // اگر سرور JSON نداد
  }

  if (!res.ok) {
    console.log("[bazaar] verify non-ok:", res.status, text);
    throw new Error(json?.error || `VERIFY_HTTP_${res.status}`);
  }

  console.log("[bazaar] server verify result =", json);
  return json;
}

export const bazaarProvider: PaymentApi = {
  id: "bazaar",

  async isAvailable() {
    try {
      await ensureConnected();
      console.log("[bazaar] connected = true");
      return true;
    } catch (e) {
      console.log("[bazaar] isAvailable error:", e);
      try {
        const pk = getPk();
        if (typeof pk.disconnect === "function") await pk.disconnect();
      } catch {}
      return false;
    }
  },

  async purchaseSubscription(sku: SubSku, phone: string): Promise<any> {
    const pk = getPk();
    const productId = mapSkuToProductId(sku);

    if (!phone) throw new Error("PHONE_MISSING");

    console.log("[bazaar] purchasing productId =", productId);

    // 1) کانکت
    await ensureConnected();

    // 2) خرید (با هندل لغو توسط کاربر)
    let result: any = null;
    try {
      if (typeof pk.subscribeProduct === "function") {
        result = await pk.subscribeProduct(productId, null, null);
      } else if (typeof pk.purchaseProduct === "function") {
        result = await pk.purchaseProduct(productId, null, null);
      } else {
        throw new Error("POOLAEKY_PURCHASE_METHOD_NOT_FOUND");
      }
    } catch (e: any) {
      // ✅ لغو خرید توسط کاربر → کد استاندارد برای UI
      if (isBazaarCancelError(e)) {
        throw new Error("BAZAAR_CANCELLED");
      }
      throw e;
    }

    console.log("[bazaar] purchase result =", result);

    // 3) verify روی سرور
    const verified = await verifyOnServer({
      phone,
      productId: result?.productId || productId,
      purchaseToken: result?.purchaseToken,
      orderId: result?.orderId,
      packageName: result?.packageName,
      purchaseTime: result?.purchaseTime,
    });

    // 4) خروجی کامل برگرده تا UI بتونه refresh کنه
    return { result, verified };
  },

  async restorePurchases(_phone: string) {
    // later
  },
};