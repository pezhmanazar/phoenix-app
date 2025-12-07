// app/(auth)/verify.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  TextInput,
  Alert,
  I18nManager,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { toApi } from "../../constants/env";
import { useAuth } from "../../hooks/useAuth";
import { useUser } from "../../hooks/useUser";
import {
  sendCode as apiSendCode,
  verifyCode as apiVerifyCode,
} from "../../api/otp"; // ⬅️ اینجا

// تبدیل اعداد فارسی/عربی به انگلیسی
function toEnDigits(input: string) {
  const fa = "۰۱۲۳۴۵۶۷۸۹",
    ar = "٠١٢٣٤٥٦٧٨٩";
  return String(input || "").replace(/[0-9۰-۹٠-٩]/g, (d) => {
    const iFa = fa.indexOf(d);
    if (iFa > -1) return String(iFa);
    const iAr = ar.indexOf(d);
    if (iAr > -1) return String(iAr);
    return d;
  });
}

function withTimeout<T>(p: Promise<T>, ms = 15000) {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error("REQUEST_TIMEOUT")), ms);
    p.then((v) => {
      clearTimeout(id);
      resolve(v);
    }).catch((e) => {
      clearTimeout(id);
      reject(e);
    });
  });
}

// چک ساده اینکه کد آمادهٔ تأیید است یا نه
function isCodeReady(value: string) {
  return /^\d{5,6}$/.test(toEnDigits(value));
}

export default function VerifyScreen() {
  const { colors, dark } = useTheme();
  const router = useRouter();
  const { setToken, setPhone } = useAuth();
  const { refresh } = useUser();

  const params =
    useLocalSearchParams<{ phone?: string; token?: string; exp?: string }>();
  const phone = useMemo(() => String(params.phone || ""), [params.phone]);
  const otpToken = useMemo(() => String(params.token || ""), [params.token]);
  const initialExp = useMemo(
    () =>
      Math.max(
        1,
        parseInt(String(params.exp || "120"), 10) || 120
      ),
    [params.exp]
  );

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(initialExp);
  const runRef = useRef(false);

  useEffect(() => {
    setSecondsLeft(initialExp);
  }, [initialExp]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setInterval(
      () => setSecondsLeft((s) => Math.max(0, s - 1)),
      1000
    );
    return () => clearInterval(t);
  }, [secondsLeft]);

  const canVerifyNow = isCodeReady(code) && !loading;

  async function doVerify(enCodeOverride?: string) {
    const enCode = enCodeOverride ?? toEnDigits(code).trim();
    if (!isCodeReady(enCode) || loading || runRef.current) return;
    runRef.current = true;
    setLoading(true);
    try {
      const url = `${toApi("/api/verifyCode")}?phone=${encodeURIComponent(
        phone
      )}&code=${encodeURIComponent(enCode)}&token=${encodeURIComponent(
        otpToken
      )}`;
      console.log("[verifyCode] →", url);

      let resp: any;
      if (typeof apiVerifyCode === "function") {
        resp = await withTimeout(
          apiVerifyCode(phone, enCode, otpToken),
          15000
        );
      } else {
        const r = await withTimeout(fetch(url, { method: "GET" }), 15000);
        resp = await r.json().catch(() => ({} as any));
      }
      console.log("[verifyCode][OK]", resp);

      if (!resp?.ok) {
        const err = String(resp?.error || "VERIFY_FAILED");
        if (err === "TOKEN_INVALID_OR_EXPIRED") {
          Alert.alert("کد منقضی شد", "دوباره ارسال کد را بزن.");
        } else if (
          err === "MISMATCH" ||
          err === "CODE_NOT_MATCH" ||
          err === "INVALID_CODE"
        ) {
          Alert.alert("کد نادرست", "کد تأیید اشتباه است. دوباره تلاش کن.");
        } else {
          Alert.alert("خطا", "تأیید ناموفق بود. دوباره امتحان کن.");
        }
        return;
      }

      const sessionToken: string | undefined =
        resp.sessionToken || resp.data?.sessionToken;
      if (!sessionToken) {
        Alert.alert("خطا", "توکن سشن از سرور دریافت نشد.");
        return;
      }

      await setToken(sessionToken);
      await setPhone(phone);
      await refresh().catch(() => {});
      router.replace("/(auth)/profile-wizard");
    } catch (e: any) {
      console.log("[verifyCode][ERR]", e?.message);
      const msg = String(e?.message || "");
      if (msg === "REQUEST_TIMEOUT") {
        Alert.alert(
          "کندی شبکه",
          "پاسخی دریافت نشد. اینترنت را چک کن و دوباره امتحان کن."
        );
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
      console.log(
        "[resend] →",
        `${toApi("/api/sendCode")}?phone=${encodeURIComponent(phone)}`
      );
      const res = (await withTimeout(
        apiSendCode(phone),
        15000
      )) as { ok: boolean; token?: string; expiresInSec?: number }; // ⬅️ تایپ
      if (res?.ok && res?.token) {
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

  function handleChangeCode(t: string) {
    const next = toEnDigits(t).replace(/\D/g, "").slice(0, 6);
    setCode(next);
    if (isCodeReady(next) && !loading && !runRef.current) {
      doVerify(next);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={dark ? "light" : "dark"} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* بقیه JSX همان چیزی است که خودت فرستادی؛
            هیچ تغییری در UI نداده‌ام. */}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}