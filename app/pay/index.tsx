// phoenix-app/app/pay/index.tsx
import { useEffect, useRef } from "react";
import { View, ActivityIndicator } from "react-native";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";

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

      if (!authority) return;

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

      // رفتن به صفحه نتیجه داخل اپ
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
    });

    // 2) وقتی اپ باز است و لینک جدید می‌رسد
    const sub = Linking.addEventListener("url", ({ url }) => go(url));

    return () => {
      sub.remove();
    };
  }, []);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000" }}>
      <ActivityIndicator />
    </View>
  );
}