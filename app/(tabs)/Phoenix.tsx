// app/(tabs)/Phoenix.tsx
import { Ionicons } from "@expo/vector-icons";
import { useTheme, useFocusEffect } from "@react-navigation/native";
import Constants from "expo-constants";
import { StatusBar } from "expo-status-bar";
import { toJalaali } from "jalaali-js";
import React, { useEffect, useState, useCallback } from "react";
import {
  Alert,
  I18nManager,
  Image,
  Text,
  TouchableOpacity,
  View,
  Linking,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import Screen from "../../components/Screen";
import { usePhoenix } from "../../hooks/PhoenixContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../../hooks/useAuth";
import { useRouter } from "expo-router";
import { useUser } from "../../hooks/useUser";
import { getPlanStatus, PRO_FLAG_KEY } from "../../lib/plan";
import EditProfileModal from "../../components/EditProfileModal";

type PlanView = "free" | "pro" | "expiring" | "expired";

/* ---------- helpers ---------- */
const toPersianDigits = (s: string | number) =>
  String(s).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);

function ProgressBar({
  value = 0,
  color = "#FF6B00",
  track = "#ECEEF2",
}: {
  value: number;
  color?: string;
  track?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <View
      style={{
        height: 10,
        borderRadius: 999,
        backgroundColor: track,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: `${clamped}%`,
          height: "100%",
          backgroundColor: color,
          borderRadius: 999,
        }}
      />
    </View>
  );
}

/* ---------- Circular Gauge ---------- */
function CircularGauge({
  value = 0,
  size = 64,
  strokeWidth = 7,
  color = "#FF6B00",
  track = "#E4E6EB",
  label,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  track?: string;
  label?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const offset = C * (1 - pct / 100);
  return (
    <View style={{ alignItems: "center" }}>
      <View
        style={{ width: size, height: size, transform: [{ rotate: "-90deg" }] }}
      >
        <Svg width={size} height={size}>
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            stroke={track}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${C} ${C}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </Svg>
      </View>
      <View
        style={{
          position: "absolute",
          alignItems: "center",
          justifyContent: "center",
          height: size,
        }}
      >
        <Text style={{ fontWeight: "800", fontSize: 13 }}>
          {toPersianDigits(Math.round(pct))}%
        </Text>
        {!!label && (
          <Text style={{ fontSize: 10, color: "#8E8E93", marginTop: 2 }}>
            {label}
          </Text>
        )}
      </View>
    </View>
  );
}

/* ---------- NoContactCard ---------- */
function NoContactCard() {
  const { colors } = useTheme();
  const { noContactStreak, canLogNoContactToday, incNoContact, resetNoContact } =
    usePhoenix();

  const onLogToday = () => {
    const ok = incNoContact();
    if (!ok) console.log("امروز قبلاً ثبت شده است.");
  };

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 10,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>
        شمارنده قطع تماس
      </Text>
      <Text
        style={{
          fontSize: 28,
          fontWeight: "800",
          color: colors.text,
          textAlign: "center",
        }}
      >
        {toPersianDigits(noContactStreak)} روز
      </Text>
      <View
        style={{ flexDirection: "row", gap: 10, justifyContent: "center" }}
      >
        <TouchableOpacity
          onPress={onLogToday}
          disabled={!canLogNoContactToday}
          activeOpacity={0.85}
          style={{
            backgroundColor: canLogNoContactToday ? colors.primary : "#5B5D63",
            paddingVertical: 10,
            paddingHorizontal: 18,
            borderRadius: 12,
            minWidth: 150,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>
            امروز انجام شد (+۱)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={resetNoContact}
          activeOpacity={0.85}
          style={{
            backgroundColor: colors.background,
            paddingVertical: 10,
            paddingHorizontal: 18,
            borderRadius: 12,
            minWidth: 120,
            alignItems: "center",
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "800" }}>
            ریست به صفر
          </Text>
        </TouchableOpacity>
      </View>
      <Text
        style={{
          fontSize: 12,
          color: "#8E8E93",
          textAlign: "center",
        }}
      >
        هر روز که تماس/چک نکردی، «امروز انجام شد» را بزن. اگر شکستی، «ریست به
        صفر».
        {canLogNoContactToday ? "" : " (امروز ثبت شده—فردا دوباره فعال می‌شود)"}
      </Text>
    </View>
  );
}

/* ---------- TechniqueStreakCard ---------- */
function TechniqueStreakCard() {
  const { colors } = useTheme();
  const { streakDays, bestStreak, incrementStreak, resetStreak } =
    usePhoenix();

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 10,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>
        استریک تکنیک‌ها
      </Text>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View>
          <Text
            style={{
              fontSize: 28,
              fontWeight: "900",
              color: colors.text,
            }}
          >
            {toPersianDigits(streakDays)} روز
          </Text>
          <Text style={{ fontSize: 12, color: "#8E8E93", marginTop: 2 }}>
            بهترین رکورد: {toPersianDigits(bestStreak)} روز
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity
            onPress={incrementStreak}
            activeOpacity={0.85}
            style={{
              backgroundColor: colors.primary,
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 12,
              minWidth: 110,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#FFF", fontWeight: "800" }}>
              امروز انجام شد
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={resetStreak}
            activeOpacity={0.85}
            style={{
              backgroundColor: colors.background,
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 12,
              minWidth: 80,
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "800" }}>ریست</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/* ---------- BadgesCard ---------- */
function BadgesCard() {
  const { colors } = useTheme();
  const { points, streakDays, noContactStreak } = usePhoenix();

  const badges = [
    {
      key: "points50",
      title: "۵۰ امتیاز",
      desc: "جمع امتیازها ≥ ۵۰",
      icon: <Ionicons name="trophy" size={20} color="#FF8A33" />,
      unlocked: points >= 50,
    },
    {
      key: "streak3",
      title: "استریک ۳ روزه",
      desc: "تکنیک‌ها ≥ ۳ روز",
      icon: <Ionicons name="flame" size={20} color="#A855F7" />,
      unlocked: streakDays >= 3,
    },
    {
      key: "nocontact3",
      title: "قطع‌تماس ۳ روزه",
      desc: "قطع تماس ≥ ۳ روز",
      icon: <Ionicons name="shield-checkmark" size={20} color="#3B82F6" />,
      unlocked: noContactStreak >= 3,
    },
  ];

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 12,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>
          امتیازها و مدال‌ها
        </Text>
        <Text style={{ fontSize: 12, color: "#8E8E93" }}>
          مجموع امتیاز:{" "}
          <Text style={{ color: colors.text, fontWeight: "800" }}>
            {toPersianDigits(points)}
          </Text>
        </Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {badges.map((b) => (
          <View
            key={b.key}
            style={{
              width: "31.5%",
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.background,
              alignItems: "center",
              paddingVertical: 12,
              opacity: b.unlocked ? 1 : 0.45,
            }}
          >
            <View
              style={{
                height: 44,
                width: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                marginBottom: 6,
              }}
            >
              {b.icon}
            </View>
            <Text
              style={{
                color: colors.text,
                fontSize: 12,
                fontWeight: "800",
              }}
            >
              {b.title}
            </Text>
            <Text
              style={{
                color: "#8E8E93",
                fontSize: 10,
                marginTop: 2,
                textAlign: "center",
              }}
            >
              {b.desc}
            </Text>
            {!b.unlocked && (
              <View
                style={{
                  marginTop: 6,
                  backgroundColor: "#E2E3E8",
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    color: "#5B5D63",
                    fontWeight: "800",
                  }}
                >
                  قفل
                </Text>
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

/* ---------- AboutCard ---------- */
function AboutCard() {
  const { colors } = useTheme();
  const version =
    (Constants?.expoConfig as any)?.version ||
    (Constants?.manifest as any)?.version ||
    "1.0.0";

  const openSite = () => {
    Linking.openURL("https://example.com/phoenix");
  };

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 8,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>
        دربارهٔ برنامه
      </Text>
      <Text style={{ color: "#8E8E93", fontSize: 12 }}>
        ققنوس — ابزار خودیاری و رشد فردی.
      </Text>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginTop: 8,
        }}
      >
        <Text style={{ color: colors.text, fontSize: 12 }}>
          نسخه: {toPersianDigits(version)}
        </Text>
        <TouchableOpacity
          onPress={openSite}
          activeOpacity={0.8}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Ionicons name="open-outline" size={16} color={colors.primary} />
          <Text
            style={{
              color: colors.primary,
              fontSize: 12,
              fontWeight: "800",
            }}
          >
            وب‌سایت
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ================== Phoenix Screen ================== */
export default function Phoenix() {
  const rtl = I18nManager.isRTL;
  const { colors } = useTheme();
  const {
    profileName,
    avatarUrl,
    pelekanProgress,
    dayProgress,
    points,
    streakDays,
    setPelekanProgress,
    setDayProgress,
    addPoints,
    incrementStreak,
    isDark,
    setProfileName,
    setAvatarUrl,
  } = usePhoenix();
  const router = useRouter();
  const { signOut } = useAuth();
  const { me, refresh } = useUser() as any;

  // وضعیت پلن
  const [planView, setPlanView] = useState<PlanView>("free");
  const [expiringDaysLeft, setExpiringDaysLeft] = useState<number | null>(null);

  const syncPlanView = useCallback(async () => {
    try {
      const flag = await AsyncStorage.getItem(PRO_FLAG_KEY);
      const status = getPlanStatus(me);
      const flagIsPro = flag === "1";

      let view: PlanView = "free";
      let expDays: number | null = null;

      if (status.rawExpiresAt) {
        if (status.isExpired) {
          view = "expired";
          expDays = 0;
        } else if (status.isPro || flagIsPro) {
          const d =
            typeof status.daysLeft === "number" ? status.daysLeft : null;
          if (d != null && d > 0 && d <= 7) {
            view = "expiring";
            expDays = d;
          } else {
            view = "pro";
            expDays = d;
          }
        } else {
          view = "free";
        }
      } else {
        view = status.isPro || flagIsPro ? "pro" : "free";
      }

      setPlanView(view);
      setExpiringDaysLeft(expDays);
    } catch (e) {
      console.log("PHOENIX PLAN ERR", e);
      setPlanView("free");
      setExpiringDaysLeft(null);
    }
  }, [me]);

  useEffect(() => {
    refresh().catch(() => {});
    syncPlanView();
  }, [refresh, syncPlanView]);

  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => {});
      syncPlanView();
      return () => {};
    }, [refresh, syncPlanView])
  );

  // سینک نام/آواتار با سرور
  useEffect(() => {
    if (me?.fullName && me.fullName !== profileName)
      setProfileName(me.fullName as string);
    if (me?.avatarUrl && me.avatarUrl !== avatarUrl)
      setAvatarUrl(me.avatarUrl as string);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.fullName, me?.avatarUrl]);

  const [editVisible, setEditVisible] = useState(false);
  useEffect(() => {
    return () => setEditVisible(false);
  }, []);

  const g = new Date();
  const { jy, jm, jd } = toJalaali(g);
  const weekdays = [
    "یکشنبه",
    "دوشنبه",
    "سه‌شنبه",
    "چهارشنبه",
    "پنجشنبه",
    "جمعه",
    "شنبه",
  ];
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
  const dateText = `${weekdays[g.getDay()]} ${toPersianDigits(
    jd
  )} ${months[jm - 1]} ${toPersianDigits(jy)}`;

  const bumpPelekan = () => setPelekanProgress(pelekanProgress + 5);
  const bumpDay = () => setDayProgress(dayProgress + 10);

  const onDoneTechnique = () => {
    incrementStreak();
    addPoints(10);
    setDayProgress(Math.min(100, dayProgress + 20));
  };

  const renderProfileAvatar = () => {
    if (typeof avatarUrl === "string" && avatarUrl.startsWith("icon:")) {
      const which = avatarUrl.split(":")[1];
      const iconName = which === "woman" ? "woman" : "man";
      const color = which === "woman" ? "#A855F7" : "#3B82F6";
      return (
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: color + "22",
            borderWidth: 1,
            borderColor: color,
          }}
        >
          <Ionicons name={iconName as any} size={44} color={color} />
        </View>
      );
    }
    const isValidUri =
      typeof avatarUrl === "string" &&
      /^(file:|content:|https?:)/.test(avatarUrl);
    if (isValidUri) {
      return (
        <Image
          source={{ uri: avatarUrl! }}
          style={{ width: 64, height: 64, borderRadius: 32 }}
        />
      );
    }
    return (
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#3B82F622",
          borderWidth: 1,
          borderColor: "#3B82F6",
        }}
      >
        <Ionicons name="person" size={44} color="#3B82F6" />
      </View>
    );
  };

  async function onSignOut() {
    try {
      if (editVisible) {
        setEditVisible(false);
        await new Promise((r) => setTimeout(r, 0));
      }

      await AsyncStorage.multiRemove([
        "profile_completed_flag",
        "phoenix_profile",
      ]);

      await signOut();
      router.replace("/(auth)/login");
    } catch (e: any) {
      Alert.alert("خطا", e?.message || "خروج ناموفق بود.");
    }
  }

  const uiPlanView: PlanView = planView;
  const uiDaysLeft: number | null = expiringDaysLeft;

  const isProLikePlan =
    uiPlanView === "pro" || uiPlanView === "expiring";

  const badgeBg =
    uiPlanView === "pro"
      ? "#F59E0B"
      : uiPlanView === "expiring"
      ? "#F97316"
      : uiPlanView === "expired"
      ? "#DC2626"
      : "#4B5563";

  const badgeLabel =
    uiPlanView === "pro" || uiPlanView === "expiring"
      ? "PRO"
      : uiPlanView === "expired"
      ? "EXPIRED"
      : "FREE";

  const showExpiring =
    uiPlanView === "expiring" && uiDaysLeft != null && uiDaysLeft > 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar
        style={isDark ? "light" : "dark"}
        backgroundColor={colors.background}
        animated
      />

      <Screen
        contentContainerStyle={{
          rowGap: 12,
          direction: rtl ? "rtl" : "ltr",
        }}
        backgroundColor={colors.background}
      >
        {/* هدر بالا */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "flex-start",
          }}
        >
          <View>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "800",
                color: colors.text,
              }}
            >
              سلام، {profileName}
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: "#8E8E93",
                marginTop: 2,
              }}
            >
              {dateText}
            </Text>
          </View>
        </View>

        {/* کارت پروفایل */}
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 16,
            padding: 12,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 10,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            {renderProfileAvatar()}

            <View style={{ flex: 1 }}>
              <View
                style={{
                  flexDirection: "row-reverse",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  gap: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "700",
                    color: colors.text,
                  }}
                >
                  {profileName}
                </Text>

                {/* بج پلن */}
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 999,
                    backgroundColor: badgeBg,
                  }}
                >
                  <Text
                    style={{
                      color: "#ffffff",
                      fontWeight: "900",
                      fontSize: 11,
                    }}
                  >
                    {badgeLabel}
                  </Text>
                </View>

                {showExpiring && (
                  <Text
                    style={{
                      fontSize: 11,
                      color: "#F97316",
                      fontWeight: "900",
                    }}
                  >
                    {toPersianDigits(uiDaysLeft!)} روز تا پایان اشتراک
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* دکمه‌ها */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: 8,
              marginTop: 4,
            }}
          >
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/Subscription")}
              activeOpacity={0.8}
              style={{
                backgroundColor: isProLikePlan ? "#0f766e" : "#10b981",
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Ionicons name="card" size={16} color="#fff" />
              <Text
                style={{
                  color: "#FFFFFF",
                  fontWeight: "700",
                  fontSize: 13,
                }}
              >
                {isProLikePlan ? "مدیریت / تمدید اشتراک" : "ارتقا به PRO"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setEditVisible(true)}
              activeOpacity={0.8}
              style={{
                backgroundColor: colors.primary,
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Ionicons name="create" size={16} color="#fff" />
              <Text
                style={{
                  color: "#FFFFFF",
                  fontWeight: "700",
                  fontSize: 13,
                }}
              >
                ویرایش
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* نمودار پیشرفت */}
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 16,
            padding: 14,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 14,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "800",
              color: colors.text,
            }}
          >
            نمودار پیشرفت
          </Text>

          <View style={{ gap: 6 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space_between" as any,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: colors.text,
                }}
              >
                پیشرفت پلکان
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: "#8E8E93",
                }}
              >
                {toPersianDigits(pelekanProgress)}٪
              </Text>
            </View>
            <ProgressBar
              value={pelekanProgress}
              color={colors.primary}
              track={colors.border}
            />
            <TouchableOpacity
              onPress={bumpPelekan}
              style={{
                alignSelf: "flex-end",
                paddingVertical: 6,
                paddingHorizontal: 10,
              }}
            >
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                +۵٪ تست
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ gap: 6 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space_between" as any,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: colors.text,
                }}
              >
                پیشرفت امروز
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: "#8E8E93",
                }}
              >
                {toPersianDigits(dayProgress)}٪
              </Text>
            </View>
            <ProgressBar
              value={dayProgress}
              color={colors.primary}
              track={colors.border}
            />
            <TouchableOpacity
              onPress={bumpDay}
              style={{
                alignSelf: "flex-end",
                paddingVertical: 6,
                paddingHorizontal: 10,
              }}
            >
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                +۱۰٪ تست
              </Text>
            </TouchableOpacity>
          </View>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 8,
            }}
          >
            <CircularGauge
              value={pelekanProgress}
              label="پلکان"
              color={colors.primary}
              track={colors.border}
              size={72}
              strokeWidth={7}
            />
            <CircularGauge
              value={dayProgress}
              label="امروز"
              color={colors.primary}
              track={colors.border}
              size={72}
              strokeWidth={7}
            />
            <View style={{ width: 72 }} />
          </View>
        </View>

        <NoContactCard />
        <TechniqueStreakCard />
        <BadgesCard />
        <AboutCard />

        {/* خروج */}
        <TouchableOpacity
          onPress={onSignOut}
          style={{
            backgroundColor: "#ef4444",
            borderRadius: 16,
            paddingVertical: 14,
            alignItems: "center",
          }}
          activeOpacity={0.85}
        >
          <Text
            style={{
              color: "#fff",
              fontWeight: "800",
            }}
          >
            خروج از حساب
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onDoneTechnique}
          style={{
            backgroundColor: colors.text,
            borderRadius: 16,
            paddingVertical: 14,
            alignItems: "center",
          }}
          activeOpacity={0.8}
        >
          <Text
            style={{
              color: colors.background,
              fontWeight: "800",
            }}
          >
            ✅ انجام یک تکنیک (تست)
          </Text>
        </TouchableOpacity>
      </Screen>

      {editVisible && <EditProfileModal onClose={() => setEditVisible(false)} />}
    </View>
  );
}