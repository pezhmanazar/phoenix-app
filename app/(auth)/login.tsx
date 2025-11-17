// app/(auth)/login.tsx
import React, { useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, TextInput, Alert, I18nManager } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { sendCode } from "../../api/auth";              // ⬅️ نسبی
import { toApi, BACKEND_URL } from "../../constants/env"; // ⬅️ نسبی

function toEnDigits(input: string) {
  const fa = "۰۱۲۳۴۵۶۷۸۹", ar = "٠١٢٣٤٥٦٧٨٩";
  return String(input || "").replace(/[0-9۰-۹٠-٩]/g, (d) => {
    const iFa = fa.indexOf(d); if (iFa > -1) return String(iFa);
    const iAr = ar.indexOf(d); if (iAr > -1) return String(iAr);
    return d;
  });
}
function normalizeIranPhone(value: string) {
  const only = toEnDigits(value).replace(/\D/g, "");
  if (only.startsWith("0098")) return "0" + only.slice(3);
  if (only.startsWith("098"))  return "0" + only.slice(3);
  if (only.startsWith("98"))   return "0" + only.slice(2);
  if (only.startsWith("9") && only.length === 10) return "0" + only;
  return only;
}

export default function LoginScreen() {
  const router = useRouter();
  const [rawPhone, setRawPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const phone = useMemo(() => normalizeIranPhone(rawPhone), [rawPhone]);
  const isValid = /^09\d{9}$/.test(phone);

  // گارد ضد چندبارکلیک همزمان
  const runningRef = useRef(false);

  // تایم‌اوت امن برای fetch‌ها
  function withTimeout<T>(p: Promise<T>, ms = 15000) {
    return new Promise<T>((resolve, reject) => {
      const id = setTimeout(() => reject(new Error("REQUEST_TIMEOUT")), ms);
      p.then((v) => { clearTimeout(id); resolve(v); })
       .catch((e) => { clearTimeout(id); reject(e); });
    });
  }

  async function safePing() {
    try {
      const url = toApi("/api/ping");
      console.log("[ENV] BACKEND_URL =", BACKEND_URL, " → ", url);
      // پینگ سبک با تایم‌اوت 3s و نادیده گرفتن خطا
      await withTimeout(fetch(url, { method: "GET" }), 3000).catch(() => {});
    } catch {}
  }

  async function onSend() {
    if (loading || runningRef.current) return;
    console.log("[login] click", { backend: BACKEND_URL + "/", isValid, phone, rawPhone });

    if (!isValid) {
      Alert.alert("خطا", "شماره موبایل را به‌صورت ۱۱ رقمی و با 09 وارد کن.");
      return;
    }

    runningRef.current = true;
    setLoading(true);
    try {
      await safePing(); // اختیاری، اما جلوی هنگی‌های محیطی را می‌گیرد

      // ⭐️ فقط درخواست کد؛ هیچ توکنی اینجا در استور ذخیره نشود
      console.log("[sendCode] →", `${toApi("/api/sendCode")}?phone=${encodeURIComponent(phone)}`);
      const res = await withTimeout(sendCode(phone), 15000);
      console.log("[sendCode][OK]", res);

      // پاس‌دادن OTP token به صفحه‌ی تأیید
      router.push({
        pathname: "/(auth)/verify",
        params: {
          phone,
          token: res.token,
          exp: String(res.expiresInSec ?? 120),
        },
      });
    } catch (e: any) {
      console.log("[sendCode][ERR]", e?.message);
      const msg = String(e?.message || "");
      if (msg.includes("429") || msg === "TOO_MANY_REQUESTS") {
        Alert.alert("لطفاً کمی صبر کن", "تعداد درخواست‌ها زیاد بوده. بعد از کمی مکث دوباره تلاش کن.");
      } else if (msg === "SERVER_MISCONFIGURED") {
        Alert.alert("خطای سرور", "پیکربندی سرویس ارسال پیامک کامل نیست.");
      } else if (msg === "REQUEST_TIMEOUT") {
        Alert.alert("کندی شبکه", "پاسخی دریافت نشد. اینترنت را چک کن و دوباره امتحان کن.");
      } else {
        Alert.alert("خطا", "ارسال کد ناموفق بود. دوباره تلاش کن.");
      }
    } finally {
      setLoading(false);
      runningRef.current = false;
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0b0c10" }}>
      <View style={{ flex: 1, justifyContent: "center", padding: 20 }}>
        <Text style={{ fontSize: 24, fontWeight: "700", color: "#fff", marginBottom: 16 }}>
          ورود / ثبت‌نام
        </Text>

        <Text style={{ color: "#9aa0a6", marginBottom: 8 }}>
          شماره موبایل خود را وارد کن تا کد تأیید برایت پیامک شود.
        </Text>

        <TextInput
          value={rawPhone}
          onChangeText={(t) => setRawPhone(toEnDigits(t))}
          keyboardType="phone-pad"
          placeholder="مثلاً 09123456789"
          placeholderTextColor="#6b7280"
          maxLength={14}
          onSubmitEditing={onSend}
          returnKeyType="done"
          style={{
            backgroundColor: "#111216",
            color: "#fff",
            borderWidth: 1,
            borderColor: "#2a2f36",
            borderRadius: 12,
            paddingHorizontal: 14,
            height: 48,
            marginBottom: 16,
            textAlign: I18nManager.isRTL ? "right" : "left",
          }}
        />

        <Pressable
          onPress={onSend}
          disabled={loading || !isValid}
          style={{
            height: 48,
            borderRadius: 12,
            backgroundColor: loading || !isValid ? "#374151" : "#2563eb",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>ادامه</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}