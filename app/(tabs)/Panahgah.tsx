// app/(tabs)/Panahgah.tsx
import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { allScenarios } from "@/lib/panahgah/registry";
import { useUser } from "../../hooks/useUser";
import { getPlanStatus, PRO_FLAG_KEY } from "../../lib/plan";

type PlanView = "free" | "pro" | "expired" | "expiring";

export default function Panahgah() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { me } = useUser();

  const [q, setQ] = useState("");
  const [planView, setPlanView] = useState<PlanView>("free");
  const [expiringDaysLeft, setExpiringDaysLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const isProPlan = planView === "pro" || planView === "expiring";
  const isNearExpire =
    planView === "expiring" &&
    expiringDaysLeft != null &&
    expiringDaysLeft > 0;

  /** سینک وضعیت پلن از سرور + فلگ لوکال */
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
        // بدون تاریخ انقضا → فقط اگر پلن یا فلگ نشان بده پرویی
        if (status.isPro || flagIsPro) {
          view = "pro";
        } else {
          view = "free";
        }
      }

      setPlanView(view);
      setExpiringDaysLeft(expDays);
    } catch (e) {
      console.log("PANAHGAH PLAN ERR", e);
      setPlanView("free");
      setExpiringDaysLeft(null);
    }
  }, [me]);

  /** بارگذاری اولیه */
  useEffect(() => {
    (async () => {
      setLoading(true);
      await syncPlanView();
      setLoading(false);
    })();
  }, [syncPlanView]);

  /** هر بار فوکوس → دوباره محاسبه (بدون لودینگ فول‌اسکرین) */
  useFocusEffect(
    useCallback(() => {
      syncPlanView();
    }, [syncPlanView])
  );

  const data = useMemo(() => {
    const items = allScenarios();
    if (!q.trim()) return items;
    const qq = q.trim();
    return items.filter(
      (s) =>
        s.title.includes(qq) || s.id.includes(qq.replace(/\s+/g, "-"))
    );
  }, [q]);

  /** هنگام تپ روی سناریو */
  const onTapScenario = (id: string) => {
    if (planView === "expired") {
      Alert.alert(
        "اشتراک منقضی شده",
        "اشتراکت منقضی شده و پناهگاه فعلاً برات قفله.\n\n" +
          "پناهگاه جاییه برای وقتی که یهو حالت بد میشه یا وسوسه‌ می‌شی پیام بدی، یا احساساتت بهت هجوم میارن.\n\n" +
          "برای اینکه دوباره به همه‌ی سناریوهای اورژانسی و مسیرهای نجات دسترسی داشته باشی، پلن ققنوس رو تمدید کن."
      );
      return;
    }
    if (!isProPlan) {
      Alert.alert(
        "نسخه رایگان",
        "برای باز شدن کامل پناهگاه و استفاده از سناریوهای اورژانسی باید پلن PRO را فعال کنی."
      );
      return;
    }
    router.push(`/panahgah/${id}`);
  };

  const renderItem = ({ item }: any) => (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onTapScenario(item.id)}
      style={[
        styles.card,
        { borderColor: colors.border, backgroundColor: colors.card },
      ]}
    >
      <View style={styles.row}>
        <Ionicons name="heart" size={18} color={colors.primary} />
        <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
        <Ionicons
          name="chevron-back"
          size={18}
          color={colors.text}
          style={{ transform: [{ scaleX: -1 }], opacity: 0.7 }}
        />
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.root, { backgroundColor: colors.background }]}
      >
        <View style={[styles.center, { paddingBottom: insets.bottom }]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ color: colors.text, marginTop: 8, fontSize: 12 }}>
            در حال آماده‌سازی پناهگاه…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const badgeBg =
    planView === "pro"
      ? "#F59E0B"
      : planView === "expiring"
      ? "#F97316"
      : planView === "expired"
      ? "#DC2626"
      : "#9CA3AF";

  const badgeLabel =
    planView === "pro" || planView === "expiring"
      ? "PRO"
      : planView === "expired"
      ? "EXPIRED"
      : "FREE";

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: colors.background }]}
      edges={["top", "left", "right", "bottom"]}
    >
      {/* Header */}
      <View style={[styles.header, { borderColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          پناهگاه
        </Text>
        <View style={styles.headerBadgeRow}>
          {isNearExpire && (
            <Text
              style={{
                color: "#FACC15",
                fontSize: 11,
                fontWeight: "900",
                marginLeft: 8,
              }}
            >
              {expiringDaysLeft} روز تا پایان اشتراک
            </Text>
          )}
          <View style={[styles.headerBadge, { backgroundColor: badgeBg }]}>
            <Text style={styles.headerBadgeText}>{badgeLabel}</Text>
          </View>
        </View>
      </View>

      {/* صفحه قفل‌شده → FREE یا EXPIRED */}
      {!isProPlan ? (
        <View
          style={{
            flex: 1,
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 16 + insets.bottom,
          }}
        >
          <View
            style={[
              styles.lockCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {planView === "expired" ? (
              <>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 15,
                    fontWeight: "900",
                    textAlign: "right",
                    lineHeight: 24,
                  }}
                >
                  اشتراکت منقضی شده و پناهگاه فعلاً برات قفله.
                </Text>

                <Text
                  style={{
                    color: colors.text,
                    opacity: 0.8,
                    fontSize: 13,
                    textAlign: "right",
                    marginTop: 12,
                    lineHeight: 22,
                  }}
                >
                  پناهگاه جاییه برای وقتی که یهو حالت بد میشه، یا وسوسه می‌شی
                  پیام بدی، یا احساساتت ناگهانی بهت هجوم میارن.
                  {"\n\n"}
                  برای اینکه دوباره به همه‌ی سناریوهای اورژانسی و مسیرهای نجات
                  دسترسی داشته باشی، پلن ققنوس رو تمدید کن.
                </Text>
              </>
            ) : (
              <>
                <View
                  style={{
                    flexDirection: "row-reverse",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Ionicons
                    name="shield-checkmark"
                    size={22}
                    color={colors.primary}
                  />
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: "900",
                      fontSize: 15,
                      textAlign: "right",
                    }}
                  >
                    پناهگاه مخصوص لحظه‌های اورژانسی بعد از جداییه
                  </Text>
                </View>

                <Text
                  style={{
                    color: colors.text,
                    opacity: 0.8,
                    marginTop: 10,
                    fontSize: 13,
                    textAlign: "right",
                    lineHeight: 20,
                  }}
                >
                  هر موقع ناگهانی وسوسه پیام دادن، چک کردن، گریه‌های شدید یا
                  تنهایی سنگین میاد سراغت… اینجا دقیقاً همون‌جاست که باید بیای.
                </Text>
              </>
            )}
          </View>
        </View>
      ) : (
        <>
          {/* Search */}
          <View
            style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 }}
          >
            <View
              style={[
                styles.searchBox,
                { borderColor: colors.border, backgroundColor: colors.card },
              ]}
            >
              <Ionicons
                name="search"
                size={18}
                color={colors.text}
                style={{ opacity: 0.6 }}
              />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="جست‌وجوی موقعیت…"
                placeholderTextColor={colors.text + "99"}
                style={{ flex: 1, textAlign: "right", color: colors.text }}
              />
            </View>
          </View>

          {/* لیست سناریوها */}
          <FlatList
            data={data}
            keyExtractor={(it) => it.id}
            renderItem={renderItem}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingBottom: 16 + insets.bottom,
              paddingTop: 6,
            }}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: 18, fontWeight: "900" },
  headerBadgeRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },

  headerBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  headerBadgeText: {
    color: "#ffffffff",
    fontWeight: "900",
    fontSize: 11,
  },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  card: { borderWidth: 1, borderRadius: 16, padding: 14 },

  row: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },

  title: { flex: 1, textAlign: "right", fontWeight: "900" },

  lockCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    flex: 1,
  },

  bulletRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
  },
  bulletText: {
    fontSize: 13,
    textAlign: "right",
  },
});