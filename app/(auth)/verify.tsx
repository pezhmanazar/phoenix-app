// app/(auth)/verify.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../hooks/useAuth";
import { useUser } from "../../hooks/useUser";
import { sendCode as apiSendCode, verifyCode as apiVerifyCode } from "../../api/otp";

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

// تایم‌اوت امن برای درخواست‌ها
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
  return /^\d{6}$/.test(toEnDigits(value));
}

type NoticeType = "error" | "warn" | "info" | "success";
type NoticeState = null | { type: NoticeType; title: string; message?: string };

// ✅ قفل ارسال مجدد: همیشه ۴۵ ثانیه (مستقل از exp سرور)
const RESEND_COOLDOWN_SEC = 30;

export default function VerifyScreen() {
  const router = useRouter();
  const { setToken, setPhone } = useAuth();
  const { refresh } = useUser();

  // پارامترها از صفحهٔ لاگین
  const params = useLocalSearchParams<{ phone?: string; token?: string; exp?: string }>();

  const phone = useMemo(() => String(params.phone || ""), [params.phone]);
  const otpToken = useMemo(() => String(params.token || ""), [params.token]);

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  // ✅ این تایمر فقط برای «ارسال مجدد» است (نه اعتبار کد)
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SEC);

  const runRef = useRef(false);

  // نوتیف تم‌دار (جای Alert)
  const [notice, setNotice] = useState<NoticeState>(null);

  // پالت ثابت مثل onboarding/login
  const BG = "#0b0f14";
  const TEXT = "#e8eef7";
  const MUTED = "rgba(231,238,247,.72)";
  const LINE = "rgba(255,255,255,.10)";
  const GOLD = "#D4AF37";
  const OK = "#22c55e";
  const BAD = "rgba(248,113,113,1)";
  const WARN = "rgba(251,191,36,1)";
  const INFO = "rgba(96,165,250,1)";
  const INPUT_BG = "rgba(255,255,255,.04)";

  function noticeStyle(type: NoticeType) {
    if (type === "success")
      return {
        border: "rgba(34,197,94,.35)",
        bg: "rgba(34,197,94,.10)",
        icon: "checkmark-circle-outline" as const,
        iconColor: OK,
      };
    if (type === "warn")
      return {
        border: "rgba(251,191,36,.38)",
        bg: "rgba(251,191,36,.10)",
        icon: "alert-circle-outline" as const,
        iconColor: WARN,
      };
    if (type === "info")
      return {
        border: "rgba(96,165,250,.35)",
        bg: "rgba(96,165,250,.10)",
        icon: "information-circle-outline" as const,
        iconColor: INFO,
      };
    return {
      border: "rgba(248,113,113,.40)",
      bg: "rgba(248,113,113,.10)",
      icon: "close-circle-outline" as const,
      iconColor: BAD,
    };
  }

  // ✅ هر بار که وارد صفحه می‌شیم، قفل resend از ۴۵ شروع بشه
  useEffect(() => {
    setSecondsLeft(RESEND_COOLDOWN_SEC);
  }, [phone, otpToken]);

  // تایمر ثانیه‌ای
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [secondsLeft]);

  const canVerifyNow = isCodeReady(code) && !loading;

  async function doVerify(enCodeOverride?: string) {
    const enCode = enCodeOverride ?? toEnDigits(code).trim();
    if (!isCodeReady(enCode) || loading || runRef.current) return;

    setNotice(null);
    runRef.current = true;
    setLoading(true);

    try {
      const resp = await withTimeout(apiVerifyCode(phone, enCode, otpToken), 15000);

      if (!resp?.ok) {
        const err = String((resp as any)?.error || "VERIFY_FAILED");

        if (err === "TOKEN_INVALID_OR_EXPIRED") {
          setNotice({
            type: "warn",
            title: "کد منقضی شد",
            message: "ارسال مجدد کد رو بزن تا یک کد جدید بگیری.",
          });
        } else if (err === "MISMATCH" || err === "CODE_NOT_MATCH" || err === "INVALID_CODE") {
          setNotice({
            type: "error",
            title: "کد نادرست است",
            message: "کد تأیید اشتباهه. دوباره تلاش کن.",
          });
        } else {
          setNotice({
            type: "error",
            title: "تأیید ناموفق بود",
            message: "چند لحظه بعد دوباره امتحان کن.",
          });
        }
        return;
      }

      const sessionToken: string | undefined =
        (resp as any).sessionToken || (resp as any).data?.sessionToken;

      if (!sessionToken) {
        setNotice({
          type: "error",
          title: "خطای سرور",
          message: "توکن سشن از سرور دریافت نشد.",
        });
        return;
      }

      await setToken(sessionToken);
      await setPhone(phone);
      await refresh().catch(() => {});
      router.replace("/(auth)/profile-wizard");
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg === "REQUEST_TIMEOUT") {
        setNotice({
          type: "warn",
          title: "کندی شبکه",
          message: "پاسخی دریافت نشد. اینترنت را چک کن و دوباره امتحان کن.",
        });
      } else {
        setNotice({
          type: "error",
          title: "تأیید کد ناموفق بود",
          message: "دوباره تلاش کن.",
        });
      }
    } finally {
      setLoading(false);
      runRef.current = false;
    }
  }

  async function resend() {
  if (resending || secondsLeft > 0) return;

  setNotice(null);
  setResending(true);
  try {
    const res = (await withTimeout(apiSendCode(phone), 15000)) as {
      ok: boolean;
      token?: string | null;
      expiresInSec?: number;
      error?: string;
    };

    // ✅ معیار موفقیت فقط ok باشد
    if (res?.ok) {
      // اگر توکن داری، آپدیت کن؛ اگر نداری، مهم نیست چون verify فعلاً بهش نیاز نداره
      if (res.token) {
        router.setParams({
          phone,
          token: res.token,
          exp: String(res.expiresInSec ?? 45),
        });
      } else {
        router.setParams({
          phone,
          exp: String(res.expiresInSec ?? 45),
        });
      }

      setSecondsLeft(res.expiresInSec ?? 45);
      setCode("");

      setNotice({
        type: "success",
        title: "کد ارسال شد",
        message: "کد جدید ارسال شد. لطفاً کد ۶ رقمی را وارد کن.",
      });
    } else {
      setNotice({
        type: "error",
        title: "ارسال مجدد ناموفق بود",
        message: "چند لحظه بعد دوباره تلاش کن.",
      });
    }
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (msg.includes("429") || msg === "TOO_MANY_REQUESTS") {
      setNotice({
        type: "warn",
        title: "محدودیت درخواست",
        message: "درخواست‌ها زیاد بوده؛ کمی بعد دوباره تلاش کن.",
      });
    } else if (msg === "REQUEST_TIMEOUT") {
      setNotice({
        type: "warn",
        title: "کندی شبکه",
        message: "پاسخی دریافت نشد. دوباره تلاش کن.",
      });
    } else {
      setNotice({
        type: "error",
        title: "ارسال مجدد ناموفق بود",
        message: "دوباره تلاش کن.",
      });
    }
  } finally {
    setResending(false);
  }
}

  function handleChangeCode(t: string) {
    const next = toEnDigits(t).replace(/\D/g, "").slice(0, 6);
    setCode(next);
    if (notice) setNotice(null);

    // اتو-ورود
    if (isCodeReady(next) && !loading && !runRef.current) {
      doVerify(next);
    }
  }

  const helperColor =
    code.length === 0 || isCodeReady(code)
      ? "rgba(231,238,247,.65)"
      : "rgba(248,113,113,.95)";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ flex: 1 }}>
          {/* گلوها مثل لاگین */}
          <View
            style={{
              position: "absolute",
              top: -220,
              left: -220,
              width: 420,
              height: 420,
              borderRadius: 999,
              backgroundColor: "rgba(212,175,55,.16)",
            }}
          />
          <View
            style={{
              position: "absolute",
              bottom: -240,
              right: -240,
              width: 480,
              height: 480,
              borderRadius: 999,
              backgroundColor: "rgba(233,138,21,.12)",
            }}
          />

          <View style={{ flex: 1, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 18, gap: 14 }}>
            {/* هدر */}
            <View style={{ alignItems: "center", gap: 6, marginTop: 6 }}>
              <View
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 22,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(212,175,55,.10)",
                  borderWidth: 1,
                  borderColor: "rgba(212,175,55,.28)",
                }}
              >
                <Ionicons name="key-outline" size={26} color={GOLD} />
              </View>

              <Text style={{ color: TEXT, fontSize: 20, fontWeight: "900", textAlign: "center" }}>
                تأیید کد
              </Text>

              <Text style={{ color: MUTED, fontSize: 12.5, lineHeight: 20, textAlign: "center", paddingHorizontal: 12 }}>
                کد ۶ رقمی ارسال‌شده به{" "}
                <Text style={{ color: TEXT, fontWeight: "900" }}>{phone}</Text>{" "}
                را وارد کن.
              </Text>
            </View>

            {/* نوتیف تم‌دار */}
            {notice && (
              <View
                style={{
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: noticeStyle(notice.type).border,
                  backgroundColor: noticeStyle(notice.type).bg,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  flexDirection: "row-reverse",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <Ionicons
                  name={noticeStyle(notice.type).icon}
                  size={20}
                  color={noticeStyle(notice.type).iconColor}
                  style={{ marginTop: 2 }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: TEXT,
                      fontSize: 13,
                      fontWeight: "900",
                      textAlign: "right",
                      marginBottom: notice.message ? 4 : 0,
                    }}
                  >
                    {notice.title}
                  </Text>
                  {!!notice.message && (
                    <Text style={{ color: "rgba(231,238,247,.78)", fontSize: 12.5, lineHeight: 20, textAlign: "right" }}>
                      {notice.message}
                    </Text>
                  )}
                </View>

                <Pressable onPress={() => setNotice(null)} hitSlop={10} style={{ padding: 2 }}>
                  <Ionicons name="close" size={18} color="rgba(231,238,247,.75)" />
                </Pressable>
              </View>
            )}

            {/* کارت اصلی */}
            <View
              style={{
                marginTop: 4,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: LINE,
                backgroundColor: "rgba(255,255,255,.03)",
                padding: 16,
                gap: 12,
              }}
            >
              {/* فیلد کد */}
              <View style={{ gap: 8 }}>
                <Text style={{ color: MUTED, fontSize: 12, fontWeight: "800", textAlign: "right" }}>
                  کد تأیید
                </Text>

                <View
                  style={{
                    flexDirection: "row-reverse",
                    alignItems: "center",
                    gap: 10,
                    borderWidth: 1,
                    borderColor:
                      code.length === 0 || isCodeReady(code) ? LINE : "rgba(248,113,113,.35)",
                    borderRadius: 16,
                    backgroundColor: INPUT_BG,
                    paddingHorizontal: 12,
                    height: 56,
                  }}
                >
                  <Ionicons name="shield-checkmark-outline" size={20} color="rgba(231,238,247,.75)" />
                  <TextInput
                    value={code}
                    onChangeText={handleChangeCode}
                    keyboardType="number-pad"
                    placeholder="------"
                    placeholderTextColor="rgba(231,238,247,.45)"
                    maxLength={6}
                    returnKeyType="done"
                    style={{
                      flex: 1,
                      color: TEXT,
                      fontSize: 22,
                      fontWeight: "900",
                      textAlign: "center",
                      letterSpacing: 8,
                      paddingVertical: 0,
                    }}
                  />
                </View>

                <Text style={{ color: helperColor, fontSize: 11.5, textAlign: "right" }}>
                  کد باید ۶ رقم باشه. بعد از وارد کردن کامل، به‌صورت خودکار بررسی میشه.
                </Text>
              </View>

              {/* دکمه تأیید/ورود */}
              <Pressable
                onPress={() => doVerify()}
                disabled={!canVerifyNow}
                style={{
                  height: 54,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: !canVerifyNow ? "rgba(255,255,255,.06)" : "rgba(212,175,55,.16)",
                  borderWidth: 1,
                  borderColor: !canVerifyNow ? LINE : "rgba(212,175,55,.35)",
                }}
              >
                {loading ? (
                  <ActivityIndicator color={TEXT} />
                ) : (
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons name="log-in-outline" size={18} color={TEXT} />
                    <Text style={{ color: TEXT, fontSize: 14, fontWeight: "900" }}>ورود</Text>
                  </View>
                )}
              </Pressable>

              {/* تایمر resend */}
              <Text style={{ color: "rgba(231,238,247,.60)", fontSize: 12, textAlign: "center", marginTop: 2 }}>
                امکان ارسال مجدد تا{" "}
                <Text style={{ color: TEXT, fontWeight: "900" }}>{secondsLeft} ثانیه</Text>{" "}
                دیگر
              </Text>

              {/* ارسال مجدد */}
              <Pressable
                onPress={resend}
                disabled={resending || secondsLeft > 0}
                style={{
                  height: 50,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(255,255,255,.02)",
                  borderWidth: 1,
                  borderColor: secondsLeft > 0 || resending ? LINE : "rgba(96,165,250,.35)",
                  opacity: secondsLeft > 0 || resending ? 0.6 : 1,
                }}
              >
                {resending ? (
                  <ActivityIndicator color={TEXT} />
                ) : (
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name="refresh-outline"
                      size={18}
                      color={secondsLeft > 0 ? "rgba(231,238,247,.65)" : "rgba(96,165,250,1)"}
                    />
                    <Text
                      style={{
                        color: secondsLeft > 0 ? "rgba(231,238,247,.65)" : "rgba(96,165,250,1)",
                        fontSize: 13,
                        fontWeight: "900",
                      }}
                    >
                      ارسال مجدد کد
                    </Text>
                  </View>
                )}
              </Pressable>

              {/* راهنمای ریز */}
              <Text style={{ color: "rgba(231,238,247,.55)", fontSize: 11, lineHeight: 18, textAlign: "center" }}>
                اگر پیامک نیومد، پوشه اسپم یا پیامک‌های تبلیغاتی رو هم چک کن.
              </Text>
            </View>

            <View style={{ flex: 1 }} />

            {/* برگشت */}
            <Pressable
              onPress={() => router.back()}
              style={{
                alignSelf: "center",
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: LINE,
                backgroundColor: "rgba(255,255,255,.02)",
              }}
            >
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
                <Ionicons name="arrow-back-outline" size={16} color="rgba(231,238,247,.75)" />
                <Text style={{ color: "rgba(231,238,247,.78)", fontSize: 12.5, fontWeight: "800" }}>
                  تغییر شماره
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}