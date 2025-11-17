// app/(tabs)/Subscription.tsx
import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../hooks/useAuth";
import { useUser } from "../../hooks/useUser";

// پرداخت
import { startPay, verifyPay } from "../../api/pay";
import * as WebBrowser from "expo-web-browser";
import * as LinkingExpo from "expo-linking";
import { makeRedirectUri } from "expo-auth-session";
import { toJalaali } from "jalaali-js";

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

export default function SubscriptionScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { phone, isAuthenticated } = useAuth();
  const { me, refresh, refreshing } = useUser() as any;

  const [payingKey, setPayingKey] = useState<PlanKey | null>(null);
  const payingRef = useRef(false);

  // وضعیت فعلی اشتراک از سمت سرور
  const now = new Date();
  const rawPlan: string = (me?.plan as string) || "free";
  const planExpiresAt: string | undefined = me?.planExpiresAt as string | undefined;

  const isExpired =
    !!planExpiresAt && new Date(planExpiresAt).getTime() < now.getTime();

  const effectivePlan =
    rawPlan === "pro" || rawPlan === "vip"
      ? isExpired
        ? "expired"
        : "pro"
      : "free";

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

    try {
      payingRef.current = true;
      setPayingKey(option.key);

      // شروع پرداخت
      const start = await startPay({
        phone: phone!,
        amount: option.amount,
      } as any);

      if (!(start as any)?.gatewayUrl) {
        Alert.alert("خطا", "آدرس درگاه پرداخت دریافت نشد.");
        return;
      }

      const gatewayUrl = (start as any).gatewayUrl as string;
      const redirectUrl = makeRedirectUri({ path: "pay" });

      const sub = LinkingExpo.addEventListener("url", async (ev) => {
        try {
          const u = LinkingExpo.parse(ev.url);
          const qAuthority = String(
            (u.queryParams as any)?.Authority ||
              (u.queryParams as any)?.authority ||
              ""
          );
          const qStatus = String(
            (u.queryParams as any)?.Status ||
              (u.queryParams as any)?.status ||
              ""
          );
          if (!qAuthority) return;

          const ver = await verifyPay({
            authority: qAuthority,
            status: (qStatus || "NOK") as any,
            phone: phone!,
            amount: option.amount!,
          } as any);

          if (!(ver as any)?.ok) {
            Alert.alert(
              "پرداخت ناموفق",
              String((ver as any).error || "VERIFY_FAILED")
            );
            return;
          }

          const refId =
            (ver as any).refId || (ver as any).data?.refId || "—";
          // بک‌اند الان خودش plan و planExpiresAt را در /api/user ست می‌کند
          await refresh().catch(() => {});

          Alert.alert(
            "پرداخت موفق",
            `کد رهگیری:\n${refId}`,
            [
              {
                text: "ادامه",
                onPress: () => {
                  router.replace("/(tabs)/Phoenix");
                },
              },
            ]
          );
        } finally {
          sub.remove();
          payingRef.current = false;
          setPayingKey(null);
        }
      });

      await WebBrowser.openBrowserAsync(
        `${gatewayUrl}?cb=${encodeURIComponent(redirectUrl)}`
      );
    } catch (e: any) {
      console.log("[Subscription][pay][ERR]", e?.message || e);
      Alert.alert("خطا", "در اتصال به درگاه مشکلی پیش آمد. دوباره امتحان کن.");
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
                <Text style={{ color: "#9CA3AF", fontSize: 12, marginTop: 4 }}>
                  در حال به‌روزرسانی…
                </Text>
              ) : effectivePlan === "pro" ? (
                <>
                  <Text
                    style={{
                      color: "#6EE7B7",
                      fontSize: 12,
                      marginTop: 4,
                    }}
                  >
                    اشتراک فعال (PRO)
                  </Text>
                  {niceExpireText && (
                    <Text
                      style={{
                        color: "#9CA3AF",
                        fontSize: 11,
                        marginTop: 2,
                      }}
                    >
                      {niceExpireText}
                    </Text>
                  )}
                </>
              ) : effectivePlan === "expired" ? (
                <Text
                  style={{
                    color: "#F97373",
                    fontSize: 12,
                    marginTop: 4,
                  }}
                >
                  اشتراک قبلی منقضی شده؛ می‌توانی تمدید کنی.
                </Text>
              ) : (
                <Text
                  style={{
                    color: "#9CA3AF",
                    fontSize: 12,
                    marginTop: 4,
                  }}
                >
                  در حال حاضر روی پلن رایگان هستی.
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
                          {p.amount
                            ? effectivePlan === "pro"
                              ? "تغییر / تمدید پلن"
                              : "شروع اشتراک"
                            : "به‌زودی"}
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