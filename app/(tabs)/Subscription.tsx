// app/(tabs)/Subscription.tsx
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useTheme } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { useUser } from "../../hooks/useUser";

import * as WebBrowser from "expo-web-browser";
import { toJalaali } from "jalaali-js";
import { startPay } from "../../api/pay"; // ✅ فقط startPay
import { getPlanStatus } from "../../lib/plan";

type PlanKey = "trial15" | "p30" | "p90" | "p180";

type PlanOption = {
  key: PlanKey;
  title: string;
  subtitle: string;
  price: string;        // قیمت نهایی
  oldPrice?: string;    // قیمت قبل (خط‌خورده)
  amount?: number;      // مبلغ نهایی برای پرداخت
  badge?: string;
  badgeType?: "best" | "value" | "premium";
};

type PayResultState = {
  visible: boolean;
  success: boolean;
  refId?: string | null;
  message?: string | null;
};

// نمای نمایش پلن برای UI (هم‌راستا با تب پلکان / ققنوس)
type PlanView = "free" | "pro" | "expiring" | "expired";

const plans: PlanOption[] = [
  {
    key: "p30",
    title: "اشتراک ۳۰ روزه",
    subtitle: "برای عبور اولیه از رابطه قبلی",
    price: "۳۹۹,۰۰۰ تومان",
    amount: 399000,
    badge: "پیشنهادی",
    badgeType: "best",
  },
  {
    key: "p90",
    title: "اشتراک ۹۰ روزه",
    subtitle: "برای عبور عمیق‌تر و تثبیت تغییر رفتاری",
    oldPrice: "۱,۱۹۷,۰۰۰ تومان",
    price: "۸۹۹,۰۰۰ تومان",
    amount: 899000,
    badge: "پرفروش‌ترین",
    badgeType: "value",
  },
  {
    key: "p180",
    title: "اشتراک ۱۸۰ روزه",
    subtitle: "برای بازسازی کامل و مسیر بی‌وقفه تا انتها",
    oldPrice: "۲,۳۹۴,۰۰۰ تومان",
    price: "۱,۴۹۹,۰۰۰ تومان",
    amount: 1499000,
    badge: "بیشترین صرفه اقتصادی",
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

export default function SubscriptionScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { phone, isAuthenticated } = useAuth();
  const { me, refresh, refreshing } = useUser() as any;

  const toFaNum = (n: number) =>
    String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);

  const [payingKey, setPayingKey] = useState<PlanKey | null>(null);
  const payingRef = useRef(false);

  const [payResult, setPayResult] = useState<PayResultState>({
    visible: false,
    success: false,
    refId: null,
    message: null,
  });
  const handledFromPayRef = useRef(false);
  const [waitingForPayRefresh, setWaitingForPayRefresh] = useState(false);

  const [showMoreChanges, setShowMoreChanges] = useState(false);
  const [showMoreAccess, setShowMoreAccess] = useState(false);

  // هر بار ورود به تب → فقط از سرور می‌خوانیم
  useFocusEffect(
    useCallback(() => {
      // 👈 اگر از پرداخت برگشتیم (فورس رفرش واقعی)
      if (params?._forceReloadUser && !handledFromPayRef.current) {
        handledFromPayRef.current = true;
        setWaitingForPayRefresh(true);

        refresh({ force: true })
          .catch(() => {})
          .finally(() => {
            setWaitingForPayRefresh(false);
            // 2️⃣ بعدش خود تب رو بدون پارامتر replace کن = جلوگیری از حلقه
            router.replace("/(tabs)/Subscription");
          });

        return;
      }

      // ورود عادی به تب
      refresh().catch(() => {});
    }, [refresh, params?._forceReloadUser])
  );

  // 🔍 منبع واحد وضعیت پلن: فقط دیتابیس (getPlanStatus)
  const status = getPlanStatus(me);

  let planView: PlanView = "free";
  let daysRemaining: number | null = null;
  let expireAt: string | null = status.rawExpiresAt ?? null;

  // اگر پلن قبلاً پرو بوده و الان تاریخش گذشته ⇒ expired
  if (status.isExpired && (status.rawPlan === "pro" || status.rawPlan === "vip")) {
    planView = "expired";
    daysRemaining = 0;
  } else if (status.isPro) {
    // پرو یا VIP فعال
    const d = typeof status.daysLeft === "number" ? status.daysLeft : null;
    if (d != null && d > 0 && d <= 7) {
      planView = "expiring";
      daysRemaining = d;
    } else {
      planView = "pro";
      daysRemaining = d;
    }
  } else {
    // هیچ پلن فعالی نداریم
    planView = "free";
    daysRemaining = null;
  }

  const niceExpireText = useMemo(() => {
    if (!expireAt) return null;
    return formatJalaliDate(expireAt);
  }, [expireAt]);

  const isAlmostExpired = planView === "expiring";
  const isProActive = planView === "pro" || planView === "expiring";

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
      // --- ۱) شروع پرداخت ---
      const months =
        option.key === "p30" ? 1 :
        option.key === "p90" ? 3 :
        option.key === "p180" ? 6 : 1;

      const start = await startPay({
        phone: phone!,
        amount: option.amount,
        months,        // ✅ خیلی مهم
        plan: "pro",   // ✅ صریح
      });

      if (!start.ok) {
        Alert.alert("خطا", start.error || "در اتصال به سرور مشکلی پیش آمد.");
        return;
      }

      if (!start.data) {
        Alert.alert("خطا", "در اتصال به سرور مشکلی پیش آمد.");
        return;
      }

      const { gatewayUrl, authority } = start.data;
      if (!gatewayUrl || !authority) {
        Alert.alert("خطا", "اطلاعات درگاه پرداخت ناقص است.");
        return;
      }

      // --- ۲) باز کردن درگاه ---
      const redirectUrl = "phoenix://pay/result"; // ✅ باید با APP_DEEPLINK_BASE هم‌راستا باشد
      await WebBrowser.openAuthSessionAsync(gatewayUrl, redirectUrl);

      router.replace(
        {
          pathname: "/pay/result",
          params: {
            authority, // 👈 کلید اصلی
          },
        } as any
      );

      return;

    } catch (e: any) {
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

  const headerBg = "#0b0f14";
  const cardBg = "rgba(255,255,255,.04)";
  const border = "rgba(255,255,255,.10)";

  // رنگ و متن بج وضعیت بالا (دست نخورده)
  const badgeBg =
    planView === "expired"
      ? "#7f1d1d55"
      : planView === "expiring"
      ? "#fbbf2455"
      : planView === "pro"
      ? "#16a34a33"
      : "#4B556333";

  const badgeTextColor =
    planView === "expired"
      ? "#F87171"
      : planView === "expiring"
      ? "#FBBF24"
      : planView === "pro"
      ? "#4ADE80"
      : "#E5E7EB";

  const badgeLabel =
    planView === "expired"
      ? "EXPIRED"
      : planView === "pro" || planView === "expiring"
      ? "PRO"
      : "FREE";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: headerBg }} edges={["top", "left", "right", "bottom"]}>
      <View style={{ flex: 1 }}>
        {/* گلو شبیه تب‌های دیگه */}
        <View pointerEvents="none" style={styles.bgGlow1} />
        <View pointerEvents="none" style={styles.bgGlow2} />

        {/* هدر بالا: ضربدر چپ + عنوان راست با آیکن */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => router.replace("/(tabs)/Pelekan")}
            activeOpacity={0.85}
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={18} color="#E5E7EB" />
          </TouchableOpacity>

          <View style={styles.titleRow}>
            <Ionicons name="card" size={18} color="#D4AF37" />
            <Text style={styles.topTitle}>اشتراک ققنوس</Text>
          </View>

          {/* اسپیس برای بالانس چپ/راست */}
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 24,
            paddingTop: 8,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* کارت معرفی */}
          <View style={[styles.glassCard, { borderRadius: 22, padding: 16 }]}>
            <Text style={styles.heroSubtitle}>
              برای رهایی، برای بازسازی، برای شروع دوباره.
            </Text>

            {/* وضعیت فعلی اشتراک */}
            <View style={styles.statusCard}>
              <View style={{ flex: 1, marginLeft: 12 }}>
                {refreshing || waitingForPayRefresh ? (
                  <Text style={styles.mutedText}>در حال به‌روزرسانی…</Text>
                ) : isProActive ? (
                  <>
                    <Text
                      style={[
                        styles.statusTitle,
                        { color: isAlmostExpired ? "#FBBF24" : "#6EE7B7" },
                      ]}
                    >
                      اشتراک ققنوسِ تو فعاله
                    </Text>

                    {niceExpireText && (
                      <Text
                        style={[
                          styles.smallText,
                          { color: isAlmostExpired ? "#FBBF24" : "#9CA3AF" },
                        ]}
                      >
                        پایان اشتراک: {niceExpireText}
                      </Text>
                    )}

                    {typeof daysRemaining === "number" && daysRemaining > 0 && (
                      <Text
                        style={[
                          styles.smallText,
                          { color: isAlmostExpired ? "#FBBF24" : "#D1FAE5" },
                        ]}
                      >
                        {toFaNum(daysRemaining)} روز از اشتراکت باقی مانده.
                      </Text>
                    )}
                  </>
                ) : planView === "expired" ? (
                  <>
                    <Text style={[styles.statusTitle, { color: "#F97373" }]}>
                      اشتراک منقضی شده
                    </Text>
                    {niceExpireText && (
                      <Text style={[styles.smallText, { color: "#FCA5A5" }]}>
                        تاریخ انقضا: {niceExpireText}
                      </Text>
                    )}
                    <Text style={[styles.smallText, { color: "#ff5100ff" }]}>
                      همه بخش‌های حالت پرو الان از دسترس تو خارج شده
                    </Text>
                  </>
                ) : (
                  <Text style={styles.mutedText}>
                    در حال حاضر روی پلن رایگان هستی. با فعال‌کردن اشتراک به همهٔ
                    دوره‌ها، پاکسازی‌ها و برنامه‌های روزانه دسترسی پیدا می‌کنی.
                  </Text>
                )}
              </View>

              {/* بج وضعیت (دست نخورده) */}
              <View
                style={{
                  paddingHorizontal: 18,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: badgeBg,
                }}
              >
                <Text style={{ color: badgeTextColor, fontSize: 13, fontWeight: "900" }}>
                  {badgeLabel}
                </Text>
              </View>
            </View>
          </View>

         {/* باکس ارزش اشتراک */}
<View style={[styles.glassCard, { marginTop: 16, borderRadius: 22, padding: 16 }]}>

  {/* بخش اول: تغییر واقعی */}
  <View style={styles.sectionTitleRow}>
    <Ionicons name="sparkles" size={16} color="#E98A15" />
    <Text style={styles.sectionTitle}>
      با اشتراک ققنوس چه تغییری در تو آغاز می‌شه؟
    </Text>
  </View>

  {(() => {
    const items = [
      "شروع واقعی عبور از وابستگی عاطفی، نه فقط تلاش‌های مقطعی برای فراموش کردن",
      "شکستن چرخه برگشت‌های مکرر و کاهش وسوسه تماس یا چک کردن",
      "کاهش نشخوار فکری و آزاد شدن ذهن از درگیری دائمی با گذشته",
      "بازگشت تدریجی ثبات هیجانی و کنترل تصمیم‌های احساسی",
      "کاهش آشفتگی ذهنی و بازگشت نظم به خواب، تمرکز و برنامه روزانه",
      "تقویت حس ارزشمندی و توانایی ساختن آینده بدون وابستگی به رابطه قبلی",
      "افزایش امید، انگیزه و توان شروع دوباره",
    ];

    const visible = showMoreChanges ? items : items.slice(0, 2);

    return (
      <>
        {visible.map((item) => (
          <View key={item} style={styles.bulletRow}>
            <Ionicons
              name="arrow-up-circle"
              size={18}
              color="#D4AF37"
              style={{ marginLeft: 6 }}
            />
            <Text style={styles.bulletText}>{item}</Text>
          </View>
        ))}

        {items.length > 2 && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setShowMoreChanges((v) => !v)}
            style={styles.moreRow}
          >
            <Ionicons
              name={showMoreChanges ? "remove-circle" : "add-circle"}
              size={18}
              color="#E98A15"
              style={{ marginLeft: 6 }}
            />
            <Text style={styles.moreText}>
              {showMoreChanges ? "بستن موارد بیشتر" : "دیدن موارد بیشتر"}
            </Text>
          </TouchableOpacity>
        )}
      </>
    );
  })()}

  <View style={{ height: 18 }} />

  {/* بخش دوم: ابزار و دسترسی‌ها */}
  <View style={styles.sectionTitleRow}>
    {/* ✅ به جای lock-open (ممکنه تو Ionicons تایپی گیر بده) */}
    <Ionicons name="key" size={16} color="#10B981" />
    <Text style={styles.sectionTitle}>
      با اشتراک ققنوس به چه چیزهایی دسترسی داری؟
    </Text>
  </View>

  {(() => {
    const items = [
      "باز شدن کامل مسیر «پلکان» یعنی مسیر هفت‌مرحله‌ای بازسازی بعد از جدایی با ساختار روزمحور",
      "تکنیک‌های «پناهگاه» برای مدیریت فوری موج‌های وسوسه، خشم، اضطراب و دلتنگی",
      "محتوا‌های تخصصی «مشعل» برای بازسازی شناختی و اصلاح الگوهای تکراری رابطه",
      "امکان پیام مستقیم و نامحدود به درمانگر واقعی برای دریافت راهنمایی شخصی‌سازی‌شده",
      "سیستم پیشرفت و امتیازدهی برای تثبیت تغییر رفتاری و استمرار تمرین‌ها",
    ];

    const visible = showMoreAccess ? items : items.slice(0, 2);

    return (
      <>
        {visible.map((item) => (
          <View key={item} style={styles.bulletRow}>
            <Ionicons
              name="checkmark-circle"
              size={18}
              color="#10B981"
              style={{ marginLeft: 6 }}
            />
            <Text style={styles.bulletText}>{item}</Text>
          </View>
        ))}

        {items.length > 2 && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setShowMoreAccess((v) => !v)}
            style={styles.moreRow}
          >
            <Ionicons
              name={showMoreAccess ? "remove-circle" : "add-circle"}
              size={18}
              color="#10B981"
              style={{ marginLeft: 6 }}
            />
            <Text style={styles.moreText}>
              {showMoreAccess ? "بستن موارد بیشتر" : "دیدن موارد بیشتر"}
            </Text>
          </TouchableOpacity>
        )}
      </>
    );
  })()}

  <View style={{ marginTop: 16 }}>
    <Text style={styles.subscriptionStrong}>
      ققنوس برای ماندن در گذشته طراحی نشده؛ برای عبور ساختارمند از اون ساخته شده.
    </Text>
  </View>

</View>

          {/* پلن‌ها */}
          <View style={{ marginTop: 18 }}>
            {/* ✅ آیکن سمت راست + عنوان */}
            <View style={styles.sectionTitleRow}>
              <Ionicons name="list" size={16} color="#D4AF37" />
              <Text style={styles.sectionTitle}>انتخاب پلن اشتراک</Text>
            </View>

            {plans.map((p) => {
              const isLoading = payingKey === p.key;
              const disabled = !p.amount || isLoading;

              // ✅ رنگ دور باکس‌ها حفظ شد
              const borderColor =
                p.badgeType === "best"
                  ? "#F97316"
                  : p.badgeType === "value"
                  ? "#22C55E"
                  : p.badgeType === "premium"
                  ? "#C8A951"
                  : border;

              // فقط کمی شیشه‌ای‌تر مثل تب‌های دیگه
              const bgHighlight =
                p.badgeType === "best"
                  ? "rgba(17,24,39,.70)"
                  : p.badgeType === "value"
                  ? "rgba(2,44,34,.70)"
                  : p.badgeType === "premium"
                  ? "rgba(26,26,16,.70)"
                  : "rgba(255,255,255,.03)";

              let ctaLabel = "شروع اشتراک";
              if (p.amount) {
                if (planView === "pro" || planView === "expiring") {
                  ctaLabel = "تغییر  یا  تمدید اشتراک";
                } else if (planView === "expired") {
                  ctaLabel = "تمدید اشتراک";
                } else {
                  ctaLabel = "شروع اشتراک";
                }
              } else {
                ctaLabel = "به‌زودی";
              }

              const showOld = !!p.oldPrice && p.oldPrice !== p.price;

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

                  <Text style={{ color: "#9CA3AF", fontSize: 12, marginTop: 4, textAlign: "right" }}>
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
                    {/* ✅ قیمت: قدیمی خط‌خورده + جدید */}
                    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
                      {showOld && (
                        <Text style={styles.oldPriceText}>
                          {p.oldPrice}
                        </Text>
                      )}

                      <Text
                        style={[
                          styles.priceText,
                          { color: p.amount ? "#FBBF24" : "#9CA3AF" },
                        ]}
                      >
                        {p.price}
                      </Text>
                    </View>

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
                          <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "800" }}>
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

          {/* اعتمادسازی پایین صفحه */}
          <View style={[styles.glassCard, { marginTop: 18, borderRadius: 22, padding: 14, gap: 8 }]}>
            <View style={{ flexDirection: "row-reverse", alignItems: "center" }}>
              <Ionicons name="shield-checkmark" size={18} color="#22C55E" />
              <Text style={styles.trustText}>
                حریم خصوصی و اطلاعاتت داخل ققنوس کاملاً محرمانه‌ست.
              </Text>
            </View>

            <View style={{ flexDirection: "row-reverse", alignItems: "center" }}>
              <Ionicons name="lock-closed" size={18} color="#60A5FA" />
              <Text style={styles.trustText}>
                پرداخت از طریق درگاه امن و معتبر انجام میشه.
              </Text>
            </View>

            <View style={{ flexDirection: "row-reverse", alignItems: "center" }}>
              <Ionicons name="help-circle" size={18} color="#F97316" />
              <Text style={[styles.trustText, { color: "#9CA3AF", fontSize: 11 }]}>
                این محصول یک ابزار کمک‌درمانی برای رهایی از زخم جداییه.
              </Text>
            </View>
          </View>

          <View style={{ height: 80 }} />
        </ScrollView>

        {/* بنر نتیجه پرداخت (همون قبلی—فقط برای خطاهای شبکه) */}
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
              <View style={{ flexDirection: "row-reverse", alignItems: "center", marginBottom: 8 }}>
                <Ionicons
                  name={payResult.success ? "checkmark-circle" : "close-circle"}
                  size={28}
                  color={payResult.success ? "#22C55E" : "#F97373"}
                  style={{ marginLeft: 8 }}
                />
                <Text style={{ color: "#F9FAFB", fontSize: 18, fontWeight: "900", textAlign: "right", flex: 1 }}>
                  {payResult.success ? "پرداخت موفق" : "پرداخت ناموفق"}
                </Text>
              </View>

              {payResult.refId && (
                <View style={{ marginTop: 4 }}>
                  <Text style={{ color: "#9CA3AF", fontSize: 12, textAlign: "right" }}>کد رهگیری:</Text>
                  <Text style={{ color: "#E5E7EB", fontSize: 14, fontWeight: "800", marginTop: 2, textAlign: "left" }}>
                    {payResult.refId}
                  </Text>
                </View>
              )}

              {payResult.message && (
                <Text style={{ color: "#D1D5DB", fontSize: 12, textAlign: "right", marginTop: 8 }}>
                  {payResult.message}
                </Text>
              )}

              <TouchableOpacity
                onPress={() => setPayResult((prev) => ({ ...prev, visible: false }))}
                style={{
                  alignSelf: "flex-start",
                  marginTop: 14,
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: "#4B5563",
                }}
              >
                <Text style={{ color: "#E5E7EB", fontSize: 13, fontWeight: "800" }}>
                  بستن
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bgGlow1: {
    position: "absolute",
    top: -240,
    left: -220,
    width: 520,
    height: 520,
    borderRadius: 999,
    backgroundColor: "rgba(212,175,55,.14)",
  },
  bgGlow2: {
    position: "absolute",
    bottom: -260,
    right: -260,
    width: 560,
    height: 560,
    borderRadius: 999,
    backgroundColor: "rgba(233,138,21,.10)",
  },

  topBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(255,255,255,.04)",
  },

  titleRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  topTitle: {
    color: "#F9FAFB",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "right",
  },

  glassCard: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(255,255,255,.04)",
    overflow: "hidden",
  },

  heroSubtitle: {
    color: "#9CA3AF",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "right",
  },

  statusCard: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
    backgroundColor: "rgba(3,7,18,.72)",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },

  statusTitle: {
    fontSize: 13,
    fontWeight: "900",
    textAlign: "right",
  },
  smallText: {
    fontSize: 11,
    marginTop: 2,
    textAlign: "right",
  },
  mutedText: {
    color: "#9CA3AF",
    fontSize: 12,
    marginTop: 4,
    textAlign: "right",
  },

  sectionTitleRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    color: "#E5E7EB",
    fontSize: 15,
    fontWeight: "900",
    textAlign: "right",
  },

  bulletRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginBottom: 6,
  },
  bulletText: {
    color: "#D1D5DB",
    fontSize: 12,
    textAlign: "right",
    flex: 1,
  },

  trustText: {
    color: "#E5E7EB",
    fontSize: 12,
    marginRight: 6,
    textAlign: "right",
    flex: 1,
  },

  // ✅ قیمت خط‌خورده / قیمت نهایی
  oldPriceText: {
    color: "#9CA3AF",
    fontSize: 12,
    textDecorationLine: "line-through",
  },
  priceText: {
    fontSize: 14,
    fontWeight: "900",
    textAlign: "right",
  },

  subscriptionNote: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    color: "#9CA3AF",
    textAlign: "right",
  },

  subscriptionStrong: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 22,
    color: "#E98A15",
    fontWeight: "900",
    textAlign: "right",
  },
  moreRow: {
  marginTop: 6,
  flexDirection: "row-reverse",
  alignItems: "center",
},

moreText: {
  color: "#9CA3AF",
  fontSize: 12,
  fontWeight: "800",
  textAlign: "right",
},
});