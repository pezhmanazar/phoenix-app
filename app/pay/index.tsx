// phoenix-app/app/pay/index.tsx
import { useEffect, useRef } from "react";
import { View, ActivityIndicator } from "react-native";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";

const API_BASE = "https://qoqnoos.app"; // ✅ دامنه اصلی شما

type PayStatusResp = {
  ok: boolean;
  authority?: string;
  status?: string; // "pending" | "active" | "canceled" | ...
  refId?: string | null;
};

export default function PayCallback() {
  const handled = useRef(false);

  useEffect(() => {
    const go = async (url: string) => {
      if (!url || handled.current) return;

      const parsed = Linking.parse(url);
      const qp = (parsed.queryParams || {}) as Record<string, any>;

      // authority ممکنه با Authority بیاد
      const authority = String(qp.authority || qp.Authority || "").trim();
      const ok = String(qp.ok || "").trim(); // "1" | "0"
      const status = String(qp.status || qp.Status || "").trim(); // "OK"|"NOK" یا "success"|"failed"

      if (!authority) {
        // ✅ اگر لینک خراب بود، گیر نکنیم
        router.replace("/(tabs)/Subscription" as any);
        return;
      }

      // نرمال‌سازی status به success/failed
      let normalizedStatus = "";
      const s = status.toLowerCase();
      if (s === "ok" || s === "success") normalizedStatus = "success";
      else if (s === "nok" || s === "failed" || s === "cancel" || s === "canceled")
        normalizedStatus = "failed";

      handled.current = true;

      // ✅ مهم: به محض اینکه دیپ‌لینک خورد، مرورگر رو ببند
      try {
        WebBrowser.dismissBrowser();
      } catch {}

      // ✅ NEW: یک بار از سرور بپرس authority الان چه وضعیتی داره
      // اگر قبلاً active/canceled شده بود، مستقیم نتیجه درست رو نشان بده
      try {
        const resp = await fetch(
          `${API_BASE}/api/pay/status?authority=${encodeURIComponent(authority)}`,
          {
            method: "GET",
            headers: { "X-Requested-With": "phoenix-pay-status" },
          }
        );

        const js = (await resp.json().catch(() => null)) as PayStatusResp | null;

        if (resp.ok && js?.ok && js?.status) {
          const st = String(js.status).toLowerCase();

          // حالت‌های قطعی: active / canceled
          if (st === "active") {
            router.replace({
              pathname: "/pay/result",
              params: {
                authority,
                ok: "1",
                status: "success",
              },
            } as any);
            return;
          }

          if (st === "canceled" || st === "expired") {
            router.replace({
              pathname: "/pay/result",
              params: {
                authority,
                ok: "0",
                status: "failed",
              },
            } as any);
            return;
          }

          // pending یا هر چیز نامشخص: بذار صفحه نتیجه خودش پولینگ کنه
          router.replace({
            pathname: "/pay/result",
            params: { authority },
          } as any);
          return;
        }
      } catch {
        // هیچ
      }

      // ✅ FALLBACK: اگر status چک نشد، مثل قبل برو نتیجه
      router.replace({
        pathname: "/pay/result",
        params: {
          authority,
          ...(ok === "1" || ok === "0" ? { ok } : {}),
          ...(normalizedStatus ? { status: normalizedStatus } : {}),
        },
      } as any);
    };

    // 1) وقتی اپ از طریق دیپ‌لینک باز می‌شود
    Linking.getInitialURL().then((u) => {
      if (typeof u === "string") go(u);
      else {
        // ✅ اگر هیچ لینکی نبود، گیر نکنیم
        setTimeout(() => {
          if (!handled.current) router.replace("/(tabs)/Subscription" as any);
        }, 700);
      }
    });

    // 2) وقتی اپ باز است و لینک جدید می‌رسد
    const sub = Linking.addEventListener("url", ({ url }) => go(url));

    return () => {
      sub.remove();
    };
  }, []);

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#000",
      }}
    >
      <ActivityIndicator />
    </View>
  );
}