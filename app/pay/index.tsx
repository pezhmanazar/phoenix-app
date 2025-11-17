import { useEffect, useRef } from "react";
import { View, ActivityIndicator, Alert } from "react-native";
import * as Linking from "expo-linking";
import { toApi } from "@/constants/env"; // <— همینی که گفتی

export default function PayCallback() {
  const handled = useRef(false);

  useEffect(() => {
    Linking.getInitialURL().then((u) => u && handleUrl(u));
    const sub = Linking.addEventListener("url", ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  async function handleUrl(url: string) {
    if (handled.current) return;

    const parsed = Linking.parse(url);
    const qp = parsed.queryParams as any;
    const Status = String(qp?.Status || "");
    const Authority = String(qp?.Authority || "");
    const amount = Number(qp?.amount || 0);
    const phone = String(qp?.phone || "");

    if (!Status || !Authority) return;

    try {
      const res = await fetch(toApi("/api/pay/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: Status, authority: Authority, amount, phone }),
      });
      const json = await res.json();

      if (json.ok && json.data?.verifyCode === 100) {
        handled.current = true;
        Alert.alert("پرداخت موفق", `کد پیگیری: ${json.data.refId}`);
        // TODO: اینجا پلن کاربر رو PRO کن و نِویگیت کن
      } else {
        Alert.alert("خطا", json.error || "VERIFY_FAILED");
      }
    } catch (e: any) {
      Alert.alert("شبکه", e?.message || "NETWORK_ERROR");
    }
  }

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000" }}>
      <ActivityIndicator />
    </View>
  );
}