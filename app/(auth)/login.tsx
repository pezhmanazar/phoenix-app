// app/(auth)/login.tsx
import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  TextInput,
  Alert,
  I18nManager,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { sendCode } from "../../api/otp"; // ⬅️ OTP الان از بک‌اند خودت
import { APP_API_URL } from "../../constants/env"; // ⬅️ دیگه از BACKEND_URL / toApi استفاده نمی‌کنیم

/* تبدیل اعداد فارسی/عربی به انگلیسی */
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

/* نرمال‌سازی شماره ایران */
function normalizeIranPhone(value: string) {
  const only = toEnDigits(value).replace(/\D/g, "");
  if (only.startsWith("0098")) return "0" + only.slice(3);
  if (only.startsWith("098")) return "0" + only.slice(3);
  if (only.startsWith("98")) return "0" + only.slice(2);
  if (only.startsWith("9") && only.length === 10) return "0" + only;
  return only;
}

/* بخش‌های بیانیه استفاده و حریم خصوصی با آیکون */
const TERMS_SECTIONS = [
  {
    icon: "medkit-outline",
    title: "این محصول درمان روان‌شناختی نیست",
    body:
      "اپلیکیشن و محتوای ققنوس تشخیص، درمان، مشاوره روان‌شناسی فردی یا مداخله بالینی محسوب نمی‌شود و جایگزین جلسات حضوری یا آنلاین با روان‌شناس دارای مجوز نیست.",
  },
  {
    icon: "people-circle-outline",
    title: "محتوا عمومی است و برای افراد خاص تنظیم نشده",
    body:
      "تمام اطلاعات، آموزش‌ها و تکنیک‌ها بر اساس داده‌های آماری، پژوهش‌های علمی و الگوهای رفتاری رایج افراد دچار شکست عشقی ارائه شده‌اند و برای هر فرد نسخه‌ی اختصاصی محسوب نمی‌شوند.",
  },
  {
    icon: "alert-circle-outline",
    title: "مسئولیت وضعیت روانی کاربر خارج از تعهد ماست",
    body:
      "این محصول پرونده درمانی باز نمی‌کند، تشخیص بالینی نمی‌دهد و بر اساس اطلاعات کاربر نسخه درمانی صادر نمی‌کند و جایگزین روان‌درمانگر نیست. مسئولیت استفاده صحیح از تکنیک‌ها و تصمیم‌گیری درباره رجوع به متخصص بر عهده‌ی خود کاربر است.",
  },
  {
    icon: "bandage-outline",
    title: "خدمات فوریت‌های روانی ارائه نمی‌شود",
    body:
      "در صورت افکار خودآسیبی یا دیگرآسیبی، احساس بی‌ثباتی شدید، علائم شدید اضطراب یا افسردگی، تجربه خشونت خانگی یا ترومای فعال، یا نشانه‌های اختلالات شدید روانی، کاربر باید فوراً با اورژانس یا متخصص سلامت روان تماس بگیرد.",
  },
  {
    icon: "trending-up-outline",
    title: "نتیجه قطعی وعده داده نمی‌شود",
    body:
      "بهبود روندی فردی و پیچیده است و این محصول هیچ نتیجه‌ی قطعی و یکسانی برای همه‌ی افراد تضمین نمی‌کند.",
  },
  {
    icon: "lock-closed-outline",
    title: "حریم خصوصی و داده‌ها",
    body:
      "اطلاعات کاربران برای اهداف تبلیغاتی به شخص ثالث فروخته نمی‌شود، فقط برای تحلیل آماری ناشناس و بهبود تجربه کاربری استفاده می‌شود و کاربر می‌تواند درخواست حذف کامل داده‌های خود را ثبت کند. اطلاعات حساس با استانداردهای امنیتی ذخیره می‌شود.",
  },
  {
    icon: "document-text-outline",
    title: "مالکیت معنوی",
    body:
      "تمام محتوا، ساختار، آموزش‌ها و تکنیک‌ها متعلق به برند ققنوس است و هرگونه تکثیر، انتشار یا استفاده‌ی تجاری بدون مجوز ممنوع است.",
  },
  {
    icon: "shield-checkmark-outline",
    title: "حد و مرزهای اخلاقی و حرفه‌ای",
    body:
      "کاربر تعهد می‌دهد اطلاعات نادرست وارد نکند، از محتوا به‌صورت ایمن و اخلاقی استفاده کند، از تکنیک‌ها برای آسیب زدن به خود یا دیگران استفاده نکند و قوانین کشور محل اقامت خود را رعایت کند.",
  },
  {
    icon: "refresh-circle-outline",
    title: "امکان تغییر این بیانیه",
    body:
      "این بیانیه ممکن است به‌روزرسانی شود و نسخه‌ی جدید از طریق اپلیکیشن یا سایت به اطلاع کاربران خواهد رسید.",
  },
] as const;

export default function LoginScreen() {
  const router = useRouter();
  const { colors, dark } = useTheme();
  const [rawPhone, setRawPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [agree, setAgree] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const phone = useMemo(() => normalizeIranPhone(rawPhone), [rawPhone]);
  const isValid = /^09\d{9}$/.test(phone);

  // گارد ضد چندبارکلیک همزمان
  const runningRef = useRef(false);

  // تایم‌اوت امن برای fetch‌ها
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

  async function safePing() {
    try {
      const url = `${APP_API_URL}/api/ping`;
      console.log("[ENV] APP_API_URL =", APP_API_URL, " → ", url);
      // پینگ سبک با تایم‌اوت 3s و نادیده گرفتن خطا
      await withTimeout(fetch(url, { method: "GET" }), 3000).catch(() => {});
    } catch {}
  }

  async function onSend() {
    if (loading || runningRef.current) return;
    console.log("[login] click", {
      backend: APP_API_URL + "/",
      isValid,
      phone,
      rawPhone,
    });

    if (!isValid) {
      Alert.alert(
        "خطا",
        "شماره موبایل را به‌صورت ۱۱ رقمی و با 09 وارد کن."
      );
      return;
    }

    if (!agree) {
      Alert.alert(
        "نیاز به تأیید قوانین",
        "برای ادامه استفاده از اپ ققنوس، باید شرایط استفاده و حریم خصوصی را بپذیری."
      );
      return;
    }

    runningRef.current = true;
    setLoading(true);
    try {
      await safePing(); // اختیاری، اما جلوی هنگی‌های محیطی را می‌گیرد

      console.log("[sendCode] via otp → /api/auth/send-otp", { phone });

      const res = (await withTimeout(
        sendCode(phone),
        15000
      )) as { ok: true; token: string; expiresInSec: number };

      console.log("[sendCode][OK]", res);
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
        Alert.alert(
          "لطفاً کمی صبر کن",
          "تعداد درخواست‌ها زیاد بوده. بعد از کمی مکث دوباره تلاش کن."
        );
      } else if (msg === "SERVER_MISCONFIGURED") {
        Alert.alert("خطای سرور", "پیکربندی سرویس ارسال پیامک کامل نیست.");
      } else if (msg === "REQUEST_TIMEOUT") {
        Alert.alert(
          "کندی شبکه",
          "پاسخی دریافت نشد. اینترنت را چک کن و دوباره امتحان کن."
        );
      } else {
        Alert.alert("خطا", "ارسال کد ناموفق بود. دوباره تلاش کن.");
      }
    } finally {
      setLoading(false);
      runningRef.current = false;
    }
  }

  const disableButton = loading || !isValid || !agree;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={dark ? "light" : "dark"} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={{
            flex: 1,
            paddingHorizontal: 20,
            paddingTop: 32,
            paddingBottom: 24,
            justifyContent: "flex-start",
            gap: 24,
          }}
        >
          {/* کارت عنوان */}
          <View
            style={{
              borderRadius: 18,
              borderWidth: 1,
              paddingHorizontal: 16,
              paddingVertical: 18,
              gap: 8,
              backgroundColor: colors.card,
              borderColor: colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 22,
                fontWeight: "900",
                textAlign: "center",
                color: colors.text,
              }}
            >
              ورود | ثبت‌نام
            </Text>
            <Text
              style={{
                fontSize: 13,
                lineHeight: 20,
                color: dark ? "#d4d4d8" : "#9ca3af",
                textAlign: "center",
              }}
            >
              شماره موبایل خودت رو وارد کن تا کد تأیید برات پیامک بشه.
            </Text>
          </View>

          {/* فیلد شماره موبایل */}
          <View style={{ gap: 8 }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: colors.text,
                textAlign: "right",
              }}
            >
              شماره موبایل
            </Text>
            <TextInput
              value={rawPhone}
              onChangeText={(t) => setRawPhone(toEnDigits(t))}
              keyboardType="phone-pad"
              placeholder="مثلاً 09123456789"
              placeholderTextColor={dark ? "#6b7280" : "#9ca3af"}
              maxLength={14}
              onSubmitEditing={onSend}
              returnKeyType="done"
              style={{
                backgroundColor: colors.card,
                color: colors.text,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 14,
                height: 48,
                marginBottom: 4,
                textAlign: "right",
              }}
            />
          </View>

          {/* قوانین و حریم خصوصی */}
          <View
            style={{
              borderWidth: 1,
              borderRadius: 16,
              paddingHorizontal: 12,
              paddingVertical: 10,
              gap: 8,
              backgroundColor: colors.card,
              borderColor: colors.border,
            }}
          >
            <Pressable
              onPress={() => setAgree((p) => !p)}
              style={{
                flexDirection: "row-reverse",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Ionicons
                name={agree ? "checkbox-outline" : "square-outline"}
                size={20}
                color={agree ? "#22c55e" : dark ? "#e5e7eb" : "#4b5563"}
              />
              <Text
                style={{
                  flex: 1,
                  fontSize: 11,
                  lineHeight: 18,
                  textAlign: "right",
                  color: colors.text,
                }}
              >
                تأیید می‌کنم که شرایط استفاده، محدودیت‌ها و حریم خصوصی اپ
                ققنوس رو خوندم و می‌پذیرم.
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setShowTerms(true)}
              style={{
                flexDirection: "row-reverse",
                alignItems: "center",
                gap: 6,
                marginTop: 2,
              }}
            >
              <Ionicons
                name="document-text-outline"
                size={18}
                color={colors.primary}
              />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  textAlign: "right",
                  color: colors.primary,
                }}
              >
                مشاهده متن کامل شرایط و حریم خصوصی
              </Text>
            </Pressable>
          </View>

          {/* دکمه ادامه */}
          <Pressable
            onPress={onSend}
            disabled={disableButton}
            style={{
              height: 48,
              borderRadius: 12,
              backgroundColor: disableButton ? "#374151" : "#2563eb",
              alignItems: "center",
              justifyContent: "center",
              marginTop: 8,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}
              >
                ادامه
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* مودال متن کامل قوانین */}
      <Modal
        visible={showTerms}
        animationType="slide"
        onRequestClose={() => setShowTerms(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          {/* هدر مودال */}
          <View
            style={{
              flexDirection: "row-reverse",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              backgroundColor: colors.card,
            }}
          >
            <View
              style={{
                flexDirection: "row-reverse",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Ionicons
                name="shield-checkmark"
                size={20}
                color={colors.primary}
              />
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "900",
                  color: colors.text,
                }}
              >
                شرایط استفاده و حریم خصوصی
              </Text>
            </View>
            <Pressable
              onPress={() => setShowTerms(false)}
              style={{ padding: 6 }}
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          >
            {TERMS_SECTIONS.map((item, idx) => (
              <View
                key={item.title}
                style={{
                  flexDirection: "row-reverse",
                  alignItems: "flex-start",
                  gap: 10,
                  marginBottom:
                    idx === TERMS_SECTIONS.length - 1 ? 0 : 18,
                }}
              >
                <View style={{ marginTop: 3 }}>
                  <Ionicons
                    name={item.icon as any}
                    size={20}
                    color={colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 13,
                      fontWeight: "900",
                      textAlign: "right",
                      marginBottom: 4,
                    }}
                  >
                    {`${idx + 1}) ${item.title}`}
                  </Text>
                  <Text
                    style={{
                      color: dark ? "#e5e7eb" : "#4b5563",
                      fontSize: 12.5,
                      lineHeight: 21,
                      textAlign: "right",
                    }}
                  >
                    {item.body}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}