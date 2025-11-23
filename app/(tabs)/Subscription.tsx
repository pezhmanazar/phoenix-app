// app/(tabs)/Subscription.tsx
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../hooks/useAuth";
import { useUser } from "../../hooks/useUser";

import { startPay, verifyPay } from "../../api/pay";
import * as WebBrowser from "expo-web-browser";
import { toJalaali } from "jalaali-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

type PlanKey = "trial15" | "p30" | "p90" | "p180";

type PlanOption = {
  key: PlanKey;
  title: string;
  subtitle: string;
  price: string;
  amount?: number;
  badge?: string;
  badgeType?: "best" | "value" | "premium";
};

type PayResultState = {
  visible: boolean;
  success: boolean;
  refId?: string | null;
  message?: string | null;
};

// 🔧 حالت‌های تست UI اشتراک
type DebugState = "real" | "pro-almost" | "pro-expired";
const DAY_MS = 24 * 60 * 60 * 1000;

const plans: PlanOption[] = [
  {
    key: "p30",
    title: "اشتراک ۳۰ روزه",
    subtitle: "یک ماه همراهی کامل ققنوس",
    price: "۳۹۹,۰۰۰ تومان",
    amount: 399000,
    badge: "پرفروش‌ترین",
    badgeType: "best",
  },
  {
    key: "p90",
    title: "اشتراک ۹۰ روزه",
    subtitle: "سه ماه مسیر عمیق‌تر درمان",
    price: "۸۹۹,۰۰۰ تومان",
    amount: 899000,
    badge: "به‌صرفه‌ترین",
    badgeType: "value",
  },
  {
    key: "p180",
    title: "اشتراک ۱۸۰ روزه",
    subtitle: "شش ماه برنامه‌ی کامل ققنوس",
    price: "۱,۱۹۹,۰۰۰ تومان",
    amount: 1199000,
    badge: "کامل‌ترین",
    badgeType: "premium",
  },
];

function formatJalaliDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;

  const { jy, jm, jd } = toJalaali(d);
  const months = [
    "فروردین",
    "اردیبهشت",
    "خرداد",
    "تیر",
    "مرداد",
    "شهریور",
    "مهر",
    "آبان",
    "آذر",
    "دی",
    "بهمن",
    "اسفند",
  ];
  const faDigits = "۰۱۲۳۴۵۶۷۸۹";
  const toFa = (n: number) =>
    String(n).replace(/\d/g, (d) => faDigits[Number(d)]);

  return `${toFa(jd)} ${months[jm - 1]} ${toFa(jy)}`;
}

const PRO_FLAG_KEY = "phoenix_is_pro";

export default function SubscriptionScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { phone, isAuthenticated } = useAuth();
  const { me, refresh, refreshing } = useUser() as any;

  const toFaNum = (n: number) =>
    String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);

  const [payingKey, setPayingKey] = useState<PlanKey | null>(null);
  const payingRef = useRef(false);
  const [proFlag, setProFlag] = useState(false);
  const [localExpire, setLocalExpire] = useState<string | null>(null);

  const [payResult, setPayResult] = useState<PayResultState>({
    visible: false,
    success: false,
    refId: null,
    message: null,
  });

  // 🔧 حالت تست UI (واقعی / پرو نزدیک انقضا / پرو منقضی)
  const [debugState, setDebugState] = useState<DebugState>("real");

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const v = await AsyncStorage.getItem(PRO_FLAG_KEY);
          const isPro = v === "1";
          setProFlag(isPro);
          console.log("[SUB] focus -> local PRO flag =", v, "=>", isPro);
        } catch {
          setProFlag(false);
        }
      })();

      refresh().catch(() => {});
      return () => {};
    }, [refresh])
  );

  const now = new Date();
  const rawPlan: string = (me?.plan as string) || "free";

  const serverExpire =
    (me?.planExpiresAt ??
      me?.planExpireAt ??
      me?.planExpire ??
      me?.proUntil ??
      me?.expiresAt ??
      null) as string | null;

  const planExpiresRaw: string | null = localExpire || serverExpire;
  // باید let باشد تا برای حالت تست اوورراید کنیم
  let planExpiresAt: string | undefined = planExpiresRaw || undefined;

  console.log(
    "[SUB] plan =",
    rawPlan,
    "serverExpire =",
    serverExpire,
    "localExpire =",
    localExpire
  );

  let baseStatus: "free" | "pro" = "free";
  if (rawPlan === "pro" || rawPlan === "vip") baseStatus = "pro";
  if (proFlag) baseStatus = "pro";

  // 🔧 اوورراید برای تست UI
  if (debugState !== "real") {
    baseStatus = "pro";
    const nowTs = Date.now();

    if (debugState === "pro-almost") {
      // دو روز تا انقضا
      planExpiresAt = new Date(nowTs + 2 * DAY_MS).toISOString();
    } else if (debugState === "pro-expired") {
      // دیروز منقضی شده
      planExpiresAt = new Date(nowTs - 1 * DAY_MS).toISOString();
    }

    console.log("[SUB][DEBUG] override status", {
      debugState,
      planExpiresAt,
    });
  }

  const isExpired =
    !!planExpiresAt && new Date(planExpiresAt).getTime() < now.getTime();

  const effectivePlan: "free" | "pro" | "expired" =
    baseStatus === "pro" ? (isExpired ? "expired" : "pro") : "free";

  const daysRemaining = useMemo(() => {
    if (!planExpiresAt) return null;
    const diffMs = new Date(planExpiresAt).getTime() - Date.now();
    if (diffMs <= 0) return 0;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }, [planExpiresAt]);

  // حالت نزدیک به انقضا (۱ تا ۷ روز باقی‌مانده)
  const isAlmostExpired =
    effectivePlan === "pro" &&
    typeof daysRemaining === "number" &&
    daysRemaining > 0 &&
    daysRemaining <= 7;

  const niceExpireText = useMemo(() => {
    if (!planExpiresAt) return null;
    const j = formatJalaliDate(planExpiresAt);
    return j || null;
  }, [planExpiresAt]);

  async function handleBuy(option: PlanOption) {
    if (!option.amount) {
      Alert.alert("به‌زودی", "این پلن هنوز فعال نشده است.");
      return;
    }
    if (!isAuthenticated || !phone) {
      Alert.alert("نیاز به ورود", "اول با شماره موبایل وارد اپ شو.");
      return;
    }
    if (payingRef.current) return;

    payingRef.current = true;
    setPayingKey(option.key);

    try {
      console.log("[SUB] startPay request", { phone, amount: option.amount });

      const start = await startPay({
        phone: phone!,
        amount: option.amount,
      });

      console.log("[SUB] startPay response", start);

      if (!start.ok || !start.data) {
        Alert.alert(
          "خطا",
          start.error || "در اتصال به سرور مشکلی پیش آمد."
        );
        return;
      }

      const { gatewayUrl, authority } = start.data;
      if (!gatewayUrl || !authority) {
        Alert.alert("خطا", "اطلاعات درگاه پرداخت ناقص است.");
        return;
      }

      const result = await WebBrowser.openBrowserAsync(gatewayUrl);
      console.log("[SUB] WebBrowser result", result);

      if (result.type === "cancel") {
        Alert.alert(
          "لغو پرداخت",
          "پرداخت توسط شما لغو شد. هر زمان خواستی می‌توانی دوباره امتحان کنی."
        );
        return;
      }

      console.log("[SUB] verifyPay request", {
        authority,
        amount: option.amount,
        phone,
      });

      const ver = await verifyPay({
        authority,
        status: "OK",
        phone: phone!,
        amount: option.amount!,
      });

      console.log("[SUB] verifyPay response", ver);

      if (!ver.ok || !ver.data) {
        setPayResult({
          visible: true,
          success: false,
          refId: null,
          message:
            ver.error ||
            "وضعیت پرداخت مشخص نشد. اگر مبلغ از حسابت کم شده، چند دقیقه بعد وضعیت اشتراک را دوباره چک کن.",
        });
        return;
      }

      const data = ver.data;
      const refId = data.refId ?? "—";

      if (data.plan === "pro" || data.plan === "vip") {
        await AsyncStorage.setItem(PRO_FLAG_KEY, "1");
        console.log("[SUB] set local PRO flag -> phoenix_is_pro = 1");
      } else {
        await AsyncStorage.removeItem(PRO_FLAG_KEY);
        console.log("[SUB] clear local PRO flag");
      }

      const respExpire =
        data.planExpiresAt ??
        data.planExpireAt ??
        data.planExpire ??
        data.proUntil ??
        data.expiresAt ??
        null;

      if (respExpire) {
        setLocalExpire(respExpire);
        console.log("[SUB] got expire from verify =", respExpire);
      }

      await refresh().catch(() => {});

      setPayResult({
        visible: true,
        success: true,
        refId,
        message: "پرداخت با موفقیت انجام شد و اشتراک ققنوس برات فعال شده.",
      });
    } catch (e: any) {
      console.log("[SUB] handleBuy error", e?.message || e);
      setPayResult({
        visible: true,
        success: false,
        refId: null,
        message:
          e?.message ||
          "در اتصال به درگاه مشکلی پیش اومد. اگه مبلغ از حسابت کم شده، وضعیت اشتراک رو بعد از چند دقیقه دوباره چک کن.",
      });
    } finally {
      payingRef.current = false;
      setPayingKey(null);
    }
  }

  const headerBg = "#0B0C10";
  const cardBg = "#111216";
  const border = "#20242C";

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: headerBg }}
      edges={["top", "left", "right", "bottom"]}
    >
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 24,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* 🔧 پنل تست حالت اشتراک (می‌تونی قبل از انتشار پاکش کنی) */}
          <View
            style={{
              marginTop: 12,
              marginBottom: 8,
              padding: 10,
              borderRadius: 12,
              backgroundColor: "#020617",
              borderWidth: 1,
              borderColor: "#1F2937",
            }}
          >
            <Text
              style={{
                color: "#9CA3AF",
                fontSize: 11,
                marginBottom: 6,
                textAlign: "right",
              }}
            >
              حالت نمایش اشتراک برای تست UI:
            </Text>
            <View
              style={{
                flexDirection: "row-reverse",
                justifyContent: "space-between",
                gap: 6,
              }}
            >
              {(
                [
                  { key: "real", label: "داده واقعی" },
                  { key: "pro-almost", label: "پرو - نزدیک انقضا" },
                  { key: "pro-expired", label: "پرو - منقضی‌شده" },
                ] as { key: DebugState; label: string }[]
              ).map((opt) => {
                const active = debugState === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => setDebugState(opt.key)}
                    style={{
                      flex: 1,
                      paddingVertical: 6,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: active ? "#2563EB" : "#4B5563",
                      backgroundColor: active ? "#1D4ED8" : "#020617",
                    }}
                  >
                    <Text
                      style={{
                        color: active ? "#E5E7EB" : "#9CA3AF",
                        fontSize: 11,
                        textAlign: "center",
                        fontWeight: active ? "800" : "500",
                      }}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Header */}
          <View
            style={{
              marginTop: 4,
              padding: 16,
              borderRadius: 20,
              backgroundColor: "#111827",
            }}
          >
            <Text
              style={{
                color: "#F9FAFB",
                fontSize: 20,
                fontWeight: "900",
                marginBottom: 4,
                textAlign: "right",
              }}
            >
              اشتراک ققنوس
            </Text>
            <Text
              style={{
                color: "#9CA3AF",
                fontSize: 12,
                lineHeight: 18,
                textAlign: "right",
              }}
            >
              برای رهایی، برای بازسازی، برای شروع دوباره.
            </Text>

            {/* وضعیت فعلی اشتراک */}
            <View
              style={{
                marginTop: 12,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#1F2937",
                backgroundColor: "#030712",
                flexDirection: "row-reverse",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View
                style={{
                  flex: 1,
                  marginLeft: 12,
                }}
              >
                {refreshing ? (
                  <Text
                    style={{ color: "#9CA3AF", fontSize: 12, marginTop: 4 }}
                  >
                    در حال به‌روزرسانی…
                  </Text>
                ) : effectivePlan === "pro" ? (
                  <>
                    <Text
                      style={{
                        color: isAlmostExpired ? "#FBBF24" : "#6EE7B7",
                        fontSize: 13,
                        fontWeight: "800",
                        textAlign: "right",
                      }}
                    >
                      اشتراک ققنوسِ تو فعاله
                    </Text>

                    {niceExpireText && (
                      <Text
                        style={{
                          color: isAlmostExpired ? "#FBBF24" : "#9CA3AF",
                          fontSize: 11,
                          marginTop: 2,
                          textAlign: "right",
                        }}
                      >
                        پایان اشتراک: {niceExpireText}
                      </Text>
                    )}

                    {typeof daysRemaining === "number" &&
                      daysRemaining > 0 && (
                        <Text
                          style={{
                            color: isAlmostExpired ? "#FBBF24" : "#D1FAE5",
                            fontSize: 11,
                            marginTop: 2,
                            textAlign: "right",
                          }}
                        >
                          {toFaNum(daysRemaining)} روز از اشتراکت باقی مانده.
                        </Text>
                      )}
                  </>
                ) : effectivePlan === "expired" ? (
                  <>
                    <Text
                      style={{
                        color: "#F97373",
                        fontSize: 12,
                        marginTop: 4,
                        fontWeight: "800",
                        textAlign: "right",
                      }}
                    >
                      اشتراک منقضی شده
                    </Text>
                    {niceExpireText && (
                      <Text
                        style={{
                          color: "#FCA5A5",
                          fontSize: 11,
                          marginTop: 2,
                          textAlign: "right",
                        }}
                      >
                        تاریخ انقضا: {niceExpireText}
                      </Text>
                    )}
                    <Text
                      style={{
                        color: "#ff5100ff",
                        fontSize: 11,
                        marginTop: 2,
                        textAlign: "right",
                      }}
                    >
                     همه بخش‌های حالت پرو الان از دسترس تو خارج شده
                    </Text>
                  </>
                ) : (
                  <Text
                    style={{
                      color: "#9CA3AF",
                      fontSize: 12,
                      marginTop: 4,
                      textAlign: "right",
                    }}
                  >
                    در حال حاضر روی پلن رایگان هستی. با فعال‌کردن اشتراک به
                    همهٔ دوره‌ها، پاکسازی‌ها و برنامه‌های روزانه دسترسی پیدا
                    می‌کنی.
                  </Text>
                )}
              </View>

              {/* بج وضعیت (PRO / EXPIRED / FREE) */}
              <View
                style={{
                  paddingHorizontal: 18,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: isAlmostExpired
                    ? "#fbbf2455" // زرد شفاف وقتی نزدیک انقضاست
                    : effectivePlan === "pro"
                    ? "#16a34a33" // سبز شفاف
                    : effectivePlan === "expired"
                    ? "#7f1d1d55" // قرمز شفاف
                    : "#4B556333", // خاکستری برای free
                }}
              >
                <Text
                  style={{
                    color: isAlmostExpired
                      ? "#FBBF24" // زرد
                      : effectivePlan === "pro"
                      ? "#4ADE80" // سبز
                      : effectivePlan === "expired"
                      ? "#F87171" // قرمز روشن
                      : "#E5E7EB", // free
                    fontSize: 13,
                    fontWeight: "900",
                  }}
                >
                  {effectivePlan === "pro"
                    ? "PRO"
                    : effectivePlan === "expired"
                    ? "EXPIRED"
                    : "FREE"}
                </Text>
              </View>
            </View>
          </View>

          {/* باکس ارزش اشتراک */}
          <View
            style={{
              marginTop: 16,
              padding: 16,
              borderRadius: 20,
              backgroundColor: cardBg,
              borderWidth: 1,
              borderColor: border,
            }}
          >
            <Text
              style={{
                color: "#F9FAFB",
                fontSize: 15,
                fontWeight: "800",
                marginBottom: 10,
                textAlign: "right",
              }}
            >
              با اشتراک ققنوس به چه چیزهایی می‌رسی؟
            </Text>

            {[
              "دسترسی کامل به تمام دوره‌ها و تکنیک‌ها",
              "مدیتیشن‌ها و پاکسازی‌های اختصاصی",
              "برنامه‌های روزانه و مسیر درمان قدم‌به‌قدم",
              "تست‌های روانشناسی و تحلیل‌های تخصصی",
              "امکان ارتباط و پشتیبانی با درمانگر واقعی",
              "ردیابی پیشرفت و استریک تمرین‌ها",
            ].map((item) => (
              <View
                key={item}
                style={{
                  flexDirection: "row-reverse",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color="#10B981"
                  style={{ marginLeft: 6 }}
                />
                <Text
                  style={{
                    color: "#D1D5DB",
                    fontSize: 12,
                    textAlign: "right",
                    flex: 1,
                  }}
                >
                  {item}
                </Text>
              </View>
            ))}
          </View>

          {/* پلن‌ها */}
          <View style={{ marginTop: 18 }}>
            <Text
              style={{
                color: "#E5E7EB",
                fontSize: 15,
                fontWeight: "800",
                marginBottom: 10,
                textAlign: "right",
              }}
            >
              انتخاب پلن اشتراک
            </Text>

            {plans.map((p) => {
              const isLoading = payingKey === p.key;
              const disabled = !p.amount || isLoading;

              const borderColor =
                p.badgeType === "best"
                  ? "#F97316"
                  : p.badgeType === "value"
                  ? "#22C55E"
                  : p.badgeType === "premium"
                  ? "#C8A951"
                  : border;

              const bgHighlight =
                p.badgeType === "best"
                  ? "#111827"
                  : p.badgeType === "value"
                  ? "#022C22"
                  : p.badgeType === "premium"
                  ? "#1A1A10"
                  : cardBg;

              let ctaLabel = "شروع اشتراک";
              if (p.amount) {
                if (effectivePlan === "pro") {
                  ctaLabel = "تغییر / تمدید اشتراک";
                } else if (effectivePlan === "expired") {
                  ctaLabel = "تمدید اشتراک";
                } else {
                  ctaLabel = "شروع اشتراک";
                }
              } else {
                ctaLabel = "به‌زودی";
              }

              return (
                <View
                  key={p.key}
                  style={{
                    marginBottom: 12,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: borderColor,
                    backgroundColor: bgHighlight,
                    padding: 14,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row-reverse",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: "#F9FAFB",
                        fontSize: 14,
                        fontWeight: "800",
                        textAlign: "right",
                        flex: 1,
                        marginLeft: 10,
                      }}
                    >
                      {p.title}
                    </Text>

                    {p.badge && (
                      <View
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 999,
                          backgroundColor:
                            p.badgeType === "best"
                              ? "#F9731633"
                              : p.badgeType === "value"
                              ? "#22C55E33"
                              : p.badgeType === "premium"
                              ? "#C8A95133"
                              : "#37415133",
                        }}
                      >
                        <Text
                          style={{
                            color:
                              p.badgeType === "best"
                                ? "#FDBA74"
                                : p.badgeType === "value"
                                ? "#6EE7B7"
                                : p.badgeType === "premium"
                                ? "#EAD49F"
                                : "#FFFFFF",
                            fontSize: 11,
                            fontWeight: "900",
                          }}
                        >
                          {p.badge}
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text
                    style={{
                      color: "#9CA3AF",
                      fontSize: 12,
                      marginTop: 4,
                      textAlign: "right",
                    }}
                  >
                    {p.subtitle}
                  </Text>

                  <View
                    style={{
                      marginTop: 10,
                      flexDirection: "row-reverse",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text
                      style={{
                        color: p.amount ? "#FBBF24" : "#9CA3AF",
                        fontSize: 14,
                        fontWeight: "900",
                        textAlign: "right",
                      }}
                    >
                      {p.price}
                    </Text>

                    <TouchableOpacity
                      activeOpacity={0.85}
                      disabled={disabled}
                      onPress={() => handleBuy(p)}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 999,
                        backgroundColor: disabled ? "#4B5563" : "#2563EB",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {isLoading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="card" size={16} color="#fff" />
                          <Text
                            style={{
                              color: "#FFFFFF",
                              fontSize: 12,
                              fontWeight: "800",
                            }}
                          >
                            {ctaLabel}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>

          {/* بخش اعتمادسازی پایین صفحه */}
          <View
            style={{
              marginTop: 18,
              padding: 14,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: border,
              backgroundColor: "#020617",
              gap: 8,
            }}
          >
            <View
              style={{ flexDirection: "row-reverse", alignItems: "center" }}
            >
              <Ionicons name="shield-checkmark" size={18} color="#22C55E" />
              <Text
                style={{
                  color: "#E5E7EB",
                  fontSize: 12,
                  marginRight: 6,
                  textAlign: "right",
                  flex: 1,
                }}
              >
                حریم خصوصی و اطلاعاتت داخل ققنوس کاملاً محرمانه‌ست.
              </Text>
            </View>

            <View
              style={{ flexDirection: "row-reverse", alignItems: "center" }}
            >
              <Ionicons name="lock-closed" size={18} color="#60A5FA" />
              <Text
                style={{
                  color: "#E5E7EB",
                  fontSize: 12,
                  marginRight: 6,
                  textAlign: "right",
                  flex: 1,
                }}
              >
                پرداخت از طریق درگاه امن و معتبر انجام میشه.
              </Text>
            </View>

            <View
              style={{ flexDirection: "row-reverse", alignItems: "center" }}
            >
              <Ionicons name="help-circle" size={18} color="#F97316" />
              <Text
                style={{
                  color: "#9CA3AF",
                  fontSize: 11,
                  marginRight: 6,
                  textAlign: "right",
                  flex: 1,
                  flexWrap: "wrap",
                }}
              >
                این محصول یک ابزار کمک‌درمانی برای رهایی از زخم جداییه.
              </Text>
            </View>
          </View>

          {/* اسپیسِر پایین برای اینکه زیر تب‌بار نره */}
          <View style={{ height: 80 }} />
        </ScrollView>

        {/* بنر نتیجه پرداخت (موفق / ناموفق) */}
        {payResult.visible && (
          <View
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: "rgba(0,0,0,0.6)",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: "80%",
                borderRadius: 18,
                backgroundColor: "#111827",
                paddingVertical: 18,
                paddingHorizontal: 16,
              }}
            >
              <View
                style={{
                  flexDirection: "row-reverse",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <Ionicons
                  name={
                    payResult.success ? "checkmark-circle" : "close-circle"
                  }
                  size={28}
                  color={payResult.success ? "#22C55E" : "#F97373"}
                  style={{ marginLeft: 8 }}
                />
                <Text
                  style={{
                    color: "#F9FAFB",
                    fontSize: 18,
                    fontWeight: "900",
                    textAlign: "right",
                    flex: 1,
                  }}
                >
                  {payResult.success ? "پرداخت موفق" : "پرداخت ناموفق"}
                </Text>
              </View>

              {payResult.refId && (
                <View style={{ marginTop: 4 }}>
                  <Text
                    style={{
                      color: "#9CA3AF",
                      fontSize: 12,
                      textAlign: "right",
                    }}
                  >
                    کد رهگیری:
                  </Text>
                  <Text
                    style={{
                      color: "#E5E7EB",
                      fontSize: 14,
                      fontWeight: "800",
                      marginTop: 2,
                      textAlign: "left",
                    }}
                  >
                    {payResult.refId}
                  </Text>
                </View>
              )}

              {payResult.message && (
                <Text
                  style={{
                    color: "#D1D5DB",
                    fontSize: 12,
                    textAlign: "right",
                    marginTop: 8,
                  }}
                >
                  {payResult.message}
                </Text>
              )}

              <TouchableOpacity
                onPress={() => {
                  setPayResult((prev) => ({ ...prev, visible: false }));
                  if (payResult.success) {
                    router.replace("/(tabs)/Phoenix");
                  }
                }}
                style={{
                  alignSelf: "flex-start",
                  marginTop: 14,
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: payResult.success ? "#2563EB" : "#4B5563",
                }}
              >
                <Text
                  style={{
                    color: "#E5E7EB",
                    fontSize: 13,
                    fontWeight: "800",
                  }}
                >
                  ادامه
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}