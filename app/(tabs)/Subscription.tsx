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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useTheme, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../hooks/useAuth";
import { useUser } from "../../hooks/useUser";

// پرداخت
import { startPay, verifyPay } from "../../api/pay";
import * as WebBrowser from "expo-web-browser";
// دیگه LinkingExpo و makeRedirectUri لازم نداریم
import { toJalaali } from "jalaali-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

type PlanKey = "trial15" | "p30" | "p90" | "p180";

type PlanOption = {
  key: PlanKey;
  title: string;
  subtitle: string;
  price: string;
  amount?: number; // اگر undefined → به زودی / غیرفعال
  badge?: string;
  badgeType?: "best" | "value";
};

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
  },
  {
    key: "trial15",
    title: "اشتراک ۱۵ روزه",
    subtitle: "برای تست و شروع مسیر",
    price: "به‌زودی",
    // فعلاً غیرفعال؛ بعداً می‌تونی amount + منطق بک‌اند رو اضافه کنی
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
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { phone, isAuthenticated } = useAuth();
  const { me, refresh, refreshing } = useUser() as any;

  // تبدیل عدد به رقم فارسی برای نمایش روزهای باقیمانده
  const toFaNum = (n: number) =>
    String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);

  const [payingKey, setPayingKey] = useState<PlanKey | null>(null);
  const payingRef = useRef(false);
  const [proFlag, setProFlag] = useState(false);

  // هر بار تب سابسکریپشن فوکوس می‌گیرد، فلگ لوکال PRO و اطلاعات کاربر را تازه کن
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

  // وضعیت فعلی اشتراک از سمت سرور + فلگ لوکال
  const now = new Date();
  const rawPlan: string = (me?.plan as string) || "free";
  const planExpiresAt: string | undefined = me?.planExpiresAt as
    | string
    | undefined;

  // ابتدا فقط pro/free را از سرور و فلگ لوکال جمع می‌کنیم
  let baseStatus: "free" | "pro" = "free";
  if (rawPlan === "pro" || rawPlan === "vip") baseStatus = "pro";
  if (proFlag) baseStatus = "pro";

  // چک انقضا فقط اگر فعلاً pro هستیم
  const isExpired =
    !!planExpiresAt && new Date(planExpiresAt).getTime() < now.getTime();

  const effectivePlan: "free" | "pro" | "expired" =
    baseStatus === "pro" ? (isExpired ? "expired" : "pro") : "free";

  // تعداد روزِ تقریبی باقی‌مانده تا پایان اشتراک
  const daysRemaining = useMemo(() => {
    if (!planExpiresAt) return null;
    const diffMs = new Date(planExpiresAt).getTime() - Date.now();
    if (diffMs <= 0) return 0;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24)); // به روز
  }, [planExpiresAt]);

  const niceExpireText = useMemo(() => {
    if (!planExpiresAt) return null;
    const j = formatJalaliDate(planExpiresAt);
    return j ? `تا ${j}` : null;
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
      // ۱) شروع پرداخت
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

      // ۲) باز کردن درگاه (بدون دیپ‌لینک، کاربر خودش برمی‌گرده)
      const result = await WebBrowser.openBrowserAsync(gatewayUrl);
      console.log("[SUB] WebBrowser result", result);

      if (result.type === "cancel") {
        Alert.alert(
          "لغو پرداخت",
          "پرداخت توسط شما لغو شد. هر زمان خواستی می‌توانی دوباره امتحان کنی."
        );
        return;
      }

      // ۳) بعد از برگشت به اپ، مستقیماً verifyPay با همون Authority
      console.log("[SUB] verifyPay request", {
        authority,
        amount: option.amount,
        phone,
      });

      const ver = await verifyPay({
        authority,
        status: "OK", // اگر واقعا پرداخت نشده باشد، زرین‌پال / بک‌اند خطا می‌دهد
        phone: phone!,
        amount: option.amount!,
      });

      console.log("[SUB] verifyPay response", ver);

      if (!ver.ok || !ver.data) {
        Alert.alert(
          "لغو یا نامشخص",
          ver.error ||
            "وضعیت پرداخت مشخص نشد. اگر مبلغ از حسابت کم شد، چند دقیقه بعد وضعیت اشتراک را دوباره چک کن."
        );
        return;
      }

      const data = ver.data;
      const refId = data.refId ?? "—";

      // ✅ مثل paytest: فلگ محلی PRO را تنظیم کن
      if (data.plan === "pro" || data.plan === "vip") {
        await AsyncStorage.setItem(PRO_FLAG_KEY, "1");
        console.log("[SUB] set local PRO flag -> phoenix_is_pro = 1");
      } else {
        await AsyncStorage.removeItem(PRO_FLAG_KEY);
        console.log("[SUB] clear local PRO flag");
      }

      // ✅ اطلاعات کاربر و پلن را از سرور تازه کن
      await refresh().catch(() => {});

      Alert.alert("پرداخت موفق", `کد رهگیری:\n${refId}`, [
        {
          text: "ادامه",
          onPress: () => {
            router.replace("/(tabs)/Phoenix");
          },
        },
      ]);
    } catch (e: any) {
      console.log("[SUB] handleBuy error", e?.message || e);
      Alert.alert(
        "خطا",
        e?.message || "در اتصال به درگاه مشکلی پیش آمد. دوباره امتحان کن."
      );
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
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View
          style={{
            marginTop: 12,
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
            }}
          >
            اشتراک ققنوس
          </Text>
          <Text
            style={{
              color: "#9CA3AF",
              fontSize: 12,
              lineHeight: 18,
            }}
          >
            برای رهایی، برای بازسازی، برای شروع دوباره.
          </Text>

          {/* وضعیت فعلی اشتراک */}
          <View
            style={{
              marginTop: 12,
              padding: 10,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#1F2937",
              backgroundColor: "#030712",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: "#E5E7EB",
                  fontSize: 13,
                  fontWeight: "800",
                }}
              >
                وضعیت اشتراک فعلی
              </Text>
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
                      color: "#6EE7B7",
                      fontSize: 12,
                      marginTop: 4,
                      fontWeight: "800",
                    }}
                  >
                    اشتراک فعال (PRO)
                  </Text>

                  {/* نوع اشتراک */}
                  <Text
                    style={{
                      color: "#D1D5DB",
                      fontSize: 11,
                      marginTop: 2,
                    }}
                  >
                    نوع اشتراک: اشتراک ققنوس (PRO)
                  </Text>

                  {/* تاریخ پایان اشتراک به شمسی */}
                  {niceExpireText && (
                    <Text
                      style={{
                        color: "#9CA3AF",
                        fontSize: 11,
                        marginTop: 2,
                      }}
                    >
                      تاریخ پایان: {niceExpireText}
                    </Text>
                  )}

                  {/* تعداد روزهای باقیمانده */}
                  {typeof daysRemaining === "number" &&
                    daysRemaining > 0 && (
                      <Text
                        style={{
                          color: "#D1FAE5",
                          fontSize: 11,
                          marginTop: 2,
                        }}
                      >
                        حدود {toFaNum(daysRemaining)} روز از اشتراکت باقی
                        مانده.
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
                      }}
                    >
                      تاریخ پایان قبلی: {niceExpireText}
                    </Text>
                  )}
                  <Text
                    style={{
                      color: "#FBBF24",
                      fontSize: 11,
                      marginTop: 2,
                    }}
                  >
                    برای دسترسی دوباره به همهٔ دوره‌ها، یکی از پلن‌ها را تمدید
                    کن.
                  </Text>
                </>
              ) : (
                <Text
                  style={{
                    color: "#9CA3AF",
                    fontSize: 12,
                    marginTop: 4,
                  }}
                >
                  در حال حاضر روی پلن رایگان هستی. با فعال‌کردن اشتراک به همهٔ
                  دوره‌ها، پاکسازی‌ها و برنامه‌های روزانه دسترسی پیدا می‌کنی.
                </Text>
              )}
            </View>

            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor:
                  effectivePlan === "pro" ? "#22C55E33" : "#4B556333",
              }}
            >
              <Text
                style={{
                  color: effectivePlan === "pro" ? "#4ADE80" : "#E5E7EB",
                  fontSize: 11,
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
            }}
          >
            با اشتراک ققنوس به چه چیزهایی می‌رسی؟
          </Text>

          {[
            "دسترسی کامل به تمام دوره‌ها و تکنیک‌ها",
            "مدیتیشن‌ها و پاکسازی‌های اختصاصی",
            "برنامه‌های روزانه و مسیر درمان قدم‌به‌قدم",
            "تست‌های روانشناسی و تحلیل‌های تخصصی",
            "محتوای شبانه و لایوهای ذخیره‌شده",
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
                : border;

            const bgHighlight =
              p.badgeType === "best"
                ? "#111827"
                : p.badgeType === "value"
                ? "#022C22"
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
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text
                      style={{
                        color: "#F9FAFB",
                        fontSize: 14,
                        fontWeight: "800",
                      }}
                    >
                      {p.title}
                    </Text>
                    <Text
                      style={{
                        color: "#9CA3AF",
                        fontSize: 12,
                        marginTop: 4,
                      }}
                    >
                      {p.subtitle}
                    </Text>
                  </View>

                  {p.badge && (
                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 999,
                        backgroundColor:
                          p.badgeType === "best" ? "#F9731633" : "#22C55E33",
                      }}
                    >
                      <Text
                        style={{
                          color:
                            p.badgeType === "best" ? "#FDBA74" : "#6EE7B7",
                          fontSize: 11,
                          fontWeight: "900",
                        }}
                      >
                        {p.badge}
                      </Text>
                    </View>
                  )}
                </View>

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
          <View style={{ flexDirection: "row-reverse", alignItems: "center" }}>
            <Ionicons name="shield-checkmark" size={18} color="#22C55E" />
            <Text
              style={{
                color: "#E5E7EB",
                fontSize: 12,
                marginRight: 6,
              }}
            >
              حریم خصوصی و اطلاعاتت کاملاً محرمانه است.
            </Text>
          </View>

          <View style={{ flexDirection: "row-reverse", alignItems: "center" }}>
            <Ionicons name="lock-closed" size={18} color="#60A5FA" />
            <Text
              style={{
                color: "#E5E7EB",
                fontSize: 12,
                marginRight: 6,
              }}
            >
              پرداخت از طریق درگاه امن و معتبر انجام می‌شود.
            </Text>
          </View>

          <View style={{ flexDirection: "row-reverse", alignItems: "center" }}>
            <Ionicons name="help-circle" size={18} color="#F97316" />
            <Text
              style={{
                color: "#9CA3AF",
                fontSize: 11,
                marginRight: 6,
              }}
            >
              این محصول جایگزین مشاوره و درمان فردی نیست؛ یک ابزار کمک‌درمانی
              برای مسیر رهایی است.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}