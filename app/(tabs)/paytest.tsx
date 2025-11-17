// app/(tabs)/paytest.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  I18nManager,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "@react-navigation/native";
import * as WebBrowser from "expo-web-browser";
import Screen from "../../components/Screen";
import PlanBadge from "../../components/PlanBadge";
import { useAuth } from "../../hooks/useAuth";
import { useUser } from "../../hooks/useUser";
import { startPay, verifyPay } from "../../api/pay";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function PayTestScreen() {
  const { colors } = useTheme();
  const rtl = I18nManager.isRTL;
  const { phone: authPhone } = useAuth();
  const { me, refresh, refreshing } = useUser();

  const [amount, setAmount] = useState("10000");
  const [lastAuthority, setLastAuthority] = useState<string | null>(null);
  const [refId, setRefId] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("هنوز هیچ پرداختی تست نشده.");
  const [loadingStart, setLoadingStart] = useState(false);
  const [loadingVerify, setLoadingVerify] = useState(false);

  /** پلن لوکال برای آپدیت سریع UI */
  const [planLocal, setPlanLocal] = useState<"free" | "pro" | "vip">(
    ((me?.plan as any) || "free") as any
  );

  /** اگر پلن سرور تغییر کرد، با UI سینک شود */
  useEffect(() => {
    if (me?.plan && me.plan !== planLocal) {
      setPlanLocal(me.plan as any);
    }
  }, [me?.plan]);

  const effectivePlan =
    (planLocal || (me?.plan as any) || "free") as "free" | "pro" | "vip";

  /* ------------------------- START PAY -------------------------- */
  const onStartPay = async () => {
    if (loadingStart || loadingVerify) return;

    const amt = Number(amount || "0");
    if (!amt || amt < 1000) {
      Alert.alert("مبلغ نامعتبر", "مبلغ باید حداقل ۱۰۰۰ تومان باشد.");
      return;
    }

    if (!authPhone) {
      Alert.alert("نیاز به ورود", "ابتدا باید با شماره موبایل وارد شوی.");
      return;
    }

    try {
      setLoadingStart(true);
      setStatusText("در حال شروع پرداخت…");

      const start = await startPay({ phone: authPhone, amount: amt });
      console.log("START RESP:", start);

      if (!start.ok || !start.data) {
        Alert.alert(
          "خطا در شروع پرداخت",
          String(start.error || "ZARINPAL_REQUEST_FAILED")
        );
        setStatusText("خطا در شروع پرداخت.");
        return;
      }

      const { authority, gatewayUrl } = start.data;
      if (!authority || !gatewayUrl) {
        Alert.alert("خطا", "authority یا gatewayUrl دریافت نشد.");
        setStatusText("جواب سرور نامعتبر است.");
        return;
      }

      setLastAuthority(authority);
      setRefId(null);
      console.log("START OK:", authority, gatewayUrl);

      const result = await WebBrowser.openBrowserAsync(gatewayUrl);
      console.log("BROWSER RESULT:", result);

      setStatusText(
        "درگاه بسته شد. برای بررسی نتیجه، روی «چک کردن وضعیت پرداخت» بزن."
      );
    } catch (e: any) {
      console.log("START ERR:", e);
      Alert.alert("خطا", e?.message || "اشکال در شروع پرداخت");
      setStatusText("خطا در شروع پرداخت.");
    } finally {
      setLoadingStart(false);
    }
  };

  /* ------------------------- VERIFY PAY -------------------------- */
  const onVerify = async () => {
    if (loadingVerify || loadingStart) return;

    if (!lastAuthority) {
      Alert.alert("بدون تراکنش", "اول یک پرداخت تستی را شروع کن.");
      return;
    }

    try {
      setLoadingVerify(true);
      setStatusText("در حال استعلام وضعیت پرداخت…");

      const amt = Number(amount || "0") || 10000;

      const ver = await verifyPay({
        authority: lastAuthority,
        status: "OK", // با verify.js فعلی هماهنگ است
        amount: amt,
        phone: authPhone || undefined,
      });

      console.log("VERIFY RESP:", ver);

      if (!ver.ok || !ver.data) {
        Alert.alert(
          "پرداخت ناموفق",
          String((ver as any).error || "VERIFY_FAILED")
        );
        setStatusText("پرداخت ناموفق بود یا پیدا نشد.");
        return;
      }

      const data = ver.data;
      setRefId(data.refId ? String(data.refId) : null);

      if (data.canceled) {
        setStatusText("پرداخت لغو شده یا درگاه آن را تایید نکرده است.");
      } else if (data.verifyCode === 100 || data.verifyCode === 101) {
        setStatusText("پرداخت با موفقیت تأیید شد.");
      } else {
        setStatusText("پرداخت ثبت شد.");
      }

      // ✅ آپدیت پلن در UI و فلگ لوکال برای تب‌های دیگر (مثل پلکان)
      if (data.plan === "pro" || data.plan === "vip") {
        setPlanLocal(data.plan);
        await AsyncStorage.setItem("phoenix_is_pro", "1");
        console.log("LOCAL PRO FLAG SET → phoenix_is_pro = 1");
      } else {
        setPlanLocal("free");
        await AsyncStorage.removeItem("phoenix_is_pro");
        console.log("LOCAL PRO FLAG CLEARED");
      }

      // sync دوباره با سرور (وقتی /api/user پلن را برگرداند)
      await refresh().catch(() => {});
    } catch (e: any) {
      console.log("VERIFY EXC:", e);
      Alert.alert("خطا", e?.message || "اشکال در استعلام پرداخت");
      setStatusText("خطا در استعلام پرداخت.");
    } finally {
      setLoadingVerify(false);
    }
  };

  /* ---------------------- RESET LOCAL PRO FLAG ---------------------- */
  const resetProFlag = async () => {
    try {
      await AsyncStorage.removeItem("phoenix_is_pro");
      setPlanLocal("free");
      console.log("LOCAL PRO FLAG REMOVED → phoenix_is_pro cleared");
      await refresh().catch(() => {});
      Alert.alert("حالت پرو پاک شد", "الآن اپ باید مثل کاربر رایگان رفتار کند.");
    } catch (e: any) {
      console.log("RESET PRO ERR:", e);
      Alert.alert("خطا", e?.message || "اشکال در پاک کردن حالت پرو");
    }
  };

  /* ---------------------------- UI ------------------------------- */
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style="light" />
      <Screen
        backgroundColor={colors.background}
        contentContainerStyle={{
          paddingVertical: 12,
          paddingHorizontal: 12,
          direction: rtl ? "rtl" : "ltr",
        }}
      >
        {/* ----- کارت وضعیت پلن ----- */}
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 16,
            padding: 14,
            borderWidth: 1,
            borderColor: colors.border,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
              تست پرداخت زرین‌پال (sandbox)
            </Text>
            <Text style={{ color: "#8E8E93", marginTop: 4, fontSize: 12 }}>
              وضعیت فعلی پلن:
            </Text>
          </View>
          <PlanBadge
            plan={effectivePlan}
            loading={refreshing || loadingVerify}
            compact
          />
        </View>

        {/* ----- فرم ورودی ----- */}
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 16,
            padding: 14,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.text, marginBottom: 6 }}>
            شماره موبایل:
          </Text>
          <Text style={{ color: "#8E8E93", marginBottom: 10 }}>
            {authPhone || "— (وارد نشده)"}
          </Text>

          <Text style={{ color: colors.text, marginBottom: 6 }}>
            مبلغ (تومان):
          </Text>
          <TextInput
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
            placeholder="مثلاً 10000"
            placeholderTextColor="#8E8E93"
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 8,
              color: colors.text,
            }}
          />

          <TouchableOpacity
            onPress={onStartPay}
            activeOpacity={0.85}
            style={{
              marginTop: 16,
              backgroundColor: loadingStart ? "#4b5563" : "#059669",
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800" }}>
              {loadingStart ? "در حال اتصال…" : "رفتن به درگاه تست"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onVerify}
            activeOpacity={0.85}
            style={{
              marginTop: 10,
              backgroundColor: colors.text,
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.background, fontWeight: "800" }}>
              {loadingVerify ? "در حال بررسی…" : "چک کردن وضعیت پرداخت"}
            </Text>
          </TouchableOpacity>

          {/* 🔧 دکمه‌ی فقط دیباگ برای ریست پرو */}
          <TouchableOpacity
            onPress={resetProFlag}
            activeOpacity={0.85}
            style={{
              marginTop: 10,
              backgroundColor: "#b91c1c",
              paddingVertical: 10,
              borderRadius: 10,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>
              🔧 ریست حالت پرو (فقط دیباگ)
            </Text>
          </TouchableOpacity>

          {/* ----- خروجی‌ها ----- */}
          <View style={{ marginTop: 16 }}>
            <Text style={{ color: "#8E8E93", fontSize: 12 }}>وضعیت:</Text>
            <Text style={{ color: colors.text, fontSize: 12, marginTop: 4 }}>
              {statusText}
            </Text>

            <Text style={{ color: "#8E8E93", marginTop: 10, fontSize: 12 }}>
              Authority:
            </Text>
            <Text style={{ color: colors.text, fontSize: 12 }}>
              {lastAuthority || "—"}
            </Text>

            <Text style={{ color: "#8E8E93", marginTop: 10, fontSize: 12 }}>
              RefID:
            </Text>
            <Text style={{ color: colors.text, fontSize: 12 }}>
              {refId || "—"}
            </Text>
          </View>
        </View>
      </Screen>
    </View>
  );
}