// app/(auth)/verify.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, TextInput, Alert, I18nManager } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@react-navigation/native";
import { toApi } from "../../constants/env";
import { useAuth } from "../../hooks/useAuth";
import { useUser } from "../../hooks/useUser";
import { sendCode as apiSendCode, verifyCode as apiVerifyCode } from "../../api/auth"; // اگر verifyCode را نداری، از fetch داخلی پایین استفاده می‌شود

// تبدیل اعداد فارسی/عربی به انگلیسی
function toEnDigits(input: string) {
  const fa = "۰۱۲۳۴۵۶۷۸۹", ar = "٠١٢٣٤٥٦٧٨٩";
  return String(input || "").replace(/[0-9۰-۹٠-٩]/g, (d) => {
    const iFa = fa.indexOf(d); if (iFa > -1) return String(iFa);
    const iAr = ar.indexOf(d); if (iAr > -1) return String(iAr);
    return d;
  });
}

function withTimeout<T>(p: Promise<T>, ms = 15000) {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error("REQUEST_TIMEOUT")), ms);
    p.then((v) => { clearTimeout(id); resolve(v); })
     .catch((e) => { clearTimeout(id); reject(e); });
  });
}

export default function VerifyScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { setToken, setPhone } = useAuth();
  const { refresh } = useUser();

  // پارامترها از صفحهٔ لاگین
  const params = useLocalSearchParams<{ phone?: string; token?: string; exp?: string }>();
  const phone = useMemo(() => String(params.phone || ""), [params.phone]);
  const otpToken = useMemo(() => String(params.token || ""), [params.token]);
  const initialExp = useMemo(() => Math.max(1, parseInt(String(params.exp || "120"), 10) || 120), [params.exp]);

  // وضعیت‌ها
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(initialExp);
  const runRef = useRef(false);

  // شمارش معکوس اعتبار کد
  useEffect(() => {
    setSecondsLeft(initialExp);
  }, [initialExp]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [secondsLeft]);

  const canVerify = /^\d{5,6}$/.test(toEnDigits(code)) && !loading;

  async function doVerify() {
    if (!canVerify || runRef.current) return;
    runRef.current = true;
    setLoading(true);
    try {
      const enCode = toEnDigits(code).trim();
      const url = `${toApi("/api/verifyCode")}?phone=${encodeURIComponent(phone)}&code=${encodeURIComponent(enCode)}&token=${encodeURIComponent(otpToken)}`;

      console.log("[verifyCode] →", url);

      // اگر api/auth شما verifyCode را صادر می‌کند از آن استفاده کن؛ وگرنه fallback
      let resp: any;
      if (typeof apiVerifyCode === "function") {
        resp = await withTimeout(apiVerifyCode(phone, enCode, otpToken), 15000);
      } else {
        const r = await withTimeout(fetch(url, { method: "GET" }), 15000);
        resp = await r.json().catch(() => ({} as any));
      }

      console.log("[verifyCode][OK]", resp);

      if (!resp?.ok) {
        const err = String(resp?.error || "VERIFY_FAILED");
        if (err === "TOKEN_INVALID_OR_EXPIRED") {
          Alert.alert("کد منقضی شد", "دوباره ارسال کد را بزن.");
        } else if (err === "MISMATCH" || err === "CODE_NOT_MATCH" || err === "INVALID_CODE") {
          Alert.alert("کد نادرست", "کد تأیید اشتباه است. دوباره تلاش کن.");
        } else {
          Alert.alert("خطا", "تأیید ناموفق بود. دوباره امتحان کن.");
        }
        return;
      }

      // ✅ انتظار داریم سرور sessionToken بده (طبق لاگ‌های قبلی‌ات)
      const sessionToken: string | undefined = resp.sessionToken || resp.data?.sessionToken;
      if (!sessionToken) {
        Alert.alert("خطا", "توکن سشن از سرور دریافت نشد.");
        return;
      }

    await setToken(sessionToken);
await setPhone(phone);
await refresh().catch(() => {});

// 👇 به‌جای رفتن مستقیم به تب‌ها، برو به ویزارد
router.replace("/(auth)/profile-wizard");
    } catch (e: any) {
      console.log("[verifyCode][ERR]", e?.message);
      const msg = String(e?.message || "");
      if (msg === "REQUEST_TIMEOUT") {
        Alert.alert("کندی شبکه", "پاسخی دریافت نشد. اینترنت را چک کن و دوباره امتحان کن.");
      } else {
        Alert.alert("خطا", "تأیید کد ناموفق بود.");
      }
    } finally {
      setLoading(false);
      runRef.current = false;
    }
  }

  async function resend() {
    if (resending || secondsLeft > 0) return;
    setResending(true);
    try {
      console.log("[resend] →", `${toApi("/api/sendCode")}?phone=${encodeURIComponent(phone)}`);
      const res = await withTimeout(apiSendCode(phone), 15000);
      if (res?.ok && res?.token) {
        // توکن جدید می‌آید؛ صفحهٔ فعلی با توکن تازه ریست شود
        // راه ساده: پارامترها را با router.setParams آپدیت کن
        router.setParams({
          phone,
          token: res.token,
          exp: String(res.expiresInSec ?? 120),
        });
        setSecondsLeft(res.expiresInSec ?? 120);
        setCode("");
        Alert.alert("ارسال شد", "کد جدید ارسال شد.");
      } else {
        Alert.alert("خطا", "ارسال مجدد ناموفق بود.");
      }
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("429") || msg === "TOO_MANY_REQUESTS") {
        Alert.alert("محدودیت", "درخواست‌ها زیاد بوده؛ کمی بعد دوباره تلاش کن.");
      } else if (msg === "REQUEST_TIMEOUT") {
        Alert.alert("کندی شبکه", "پاسخی دریافت نشد. دوباره تلاش کن.");
      } else {
        Alert.alert("خطا", "ارسال مجدد ناموفق بود.");
      }
    } finally {
      setResending(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0b0c10" }}>
      <View style={{ flex: 1, justifyContent: "center", padding: 20 }}>
        <Text style={{ fontSize: 20, fontWeight: "800", color: "#fff", marginBottom: 8 }}>
          تأیید کد
        </Text>
        <Text style={{ color: "#9aa0a6", marginBottom: 12 }}>
          کد ۵ رقمی ارسال‌شده به {phone} را وارد کن.
        </Text>

        <TextInput
          value={code}
          onChangeText={(t) => setCode(toEnDigits(t).replace(/\D/g, "").slice(0, 6))}
          keyboardType="number-pad"
          placeholder="کد تأیید"
          placeholderTextColor="#6b7280"
          maxLength={6}
          onSubmitEditing={doVerify}
          returnKeyType="done"
          style={{
            backgroundColor: "#111216",
            color: "#fff",
            borderWidth: 1,
            borderColor: "#2a2f36",
            borderRadius: 12,
            paddingHorizontal: 14,
            height: 48,
            marginBottom: 12,
            letterSpacing: 6,
            textAlign: I18nManager.isRTL ? "center" : "center",
            fontSize: 18,
            fontWeight: "800",
          }}
        />

        <Pressable
          onPress={doVerify}
          disabled={!canVerify}
          style={{
            height: 48,
            borderRadius: 12,
            backgroundColor: canVerify ? "#10b981" : "#374151",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 12,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>ورود</Text>
          )}
        </Pressable>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: "#9aa0a6" }}>
            انقضا: <Text style={{ color: "#fff", fontWeight: "800" }}>{secondsLeft}s</Text>
          </Text>

          <Pressable
            onPress={resend}
            disabled={resending || secondsLeft > 0}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: secondsLeft > 0 ? "#374151" : "#2563eb",
              opacity: secondsLeft > 0 ? 0.6 : 1,
            }}
          >
            {resending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: secondsLeft > 0 ? "#9aa0a6" : "#60a5fa", fontWeight: "800" }}>
                ارسال مجدد کد
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}