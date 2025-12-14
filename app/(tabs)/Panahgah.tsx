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
import PlanStatusBadge from "../../components/PlanStatusBadge";

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
          const d = typeof status.daysLeft === "number" ? status.daysLeft : null;
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

      //console.log("PANAHGAH PLAN INIT", {
      //rawPlan: status.rawPlan,
      //rawExpiresAt: status.rawExpiresAt,
      //isExpired: status.isExpired,
      //daysLeft: status.daysLeft,
      //flag,
      //planView: view,
      //expDays,
      //});
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
    return items.filter((s) => s.title.includes(qq) || s.id.includes(qq.replace(/\s+/g, "-")));
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
      style={[styles.card, { borderColor: "rgba(255,255,255,.08)", backgroundColor: "rgba(255,255,255,.04)" }]}
    >
      <View style={styles.row}>
        <Ionicons name="heart" size={18} color="#D4AF37" />
        <Text style={[styles.title, { color: "#F9FAFB" }]}>{item.title}</Text>
        <Ionicons
          name="chevron-back"
          size={18}
          color="#E5E7EB"
          style={{ transform: [{ scaleX: -1 }], opacity: 0.7 }}
        />
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: "#0b0f14" }]} edges={["top"]}>
        <View pointerEvents="none" style={styles.bgGlowTop} />
        <View pointerEvents="none" style={styles.bgGlowBottom} />
        <View style={[styles.center, { paddingBottom: insets.bottom }]}>
          <ActivityIndicator color="#D4AF37" />
          <Text style={{ color: "#E5E7EB", marginTop: 8, fontSize: 12 }}>
            در حال آماده‌سازی پناهگاه…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: "#0b0f14" }]}
      edges={["top", "left", "right", "bottom"]}
    >
      {/* ✅ پس‌زمینه گلو مثل بقیه تب‌ها */}
      <View pointerEvents="none" style={styles.bgGlowTop} />
      <View pointerEvents="none" style={styles.bgGlowBottom} />

      {/* Header (شیشه‌ای) — عنوان سمت راست، بج سمت چپ از PlanStatusBadge */}
      <View style={[styles.header, { paddingTop: Math.max(10, insets.top * 0.15) }]}>
        <Text style={styles.headerTitle}>پناهگاه</Text>

        {/* ✅ بج و متن نزدیک انقضا از خود کامپوننت */}
        <PlanStatusBadge me={me} showExpiringText />
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
          <View style={[styles.lockCard]}>
            {planView === "expired" ? (
              <>
                <Text
                  style={{
                    color: "#F9FAFB",
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
                    color: "rgba(231,238,247,.80)",
                    fontSize: 13,
                    textAlign: "right",
                    marginTop: 12,
                    lineHeight: 22,
                    fontWeight: "700",
                  }}
                >
                  پناهگاه جاییه برای وقتی که یهو حالت بد میشه، یا وسوسه می‌شی پیام بدی، یا احساساتت ناگهانی بهت هجوم میارن.
                  {"\n\n"}
                  برای اینکه دوباره به همه‌ی سناریوهای اورژانسی و مسیرهای نجات دسترسی داشته باشی، پلن ققنوس رو تمدید کن.
                </Text>
              </>
            ) : (
              <>
                <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
                  <Ionicons name="shield-checkmark" size={22} color="#D4AF37" />
                  <Text
                    style={{
                      color: "#F9FAFB",
                      fontWeight: "900",
                      fontSize: 15,
                      textAlign: "right",
                      flex: 1,
                    }}
                  >
                    پناهگاه مخصوص لحظه‌های اورژانسی بعد از جداییه
                  </Text>
                </View>

                <Text
                  style={{
                    color: "rgba(231,238,247,.80)",
                    marginTop: 10,
                    fontSize: 13,
                    textAlign: "right",
                    lineHeight: 20,
                    fontWeight: "700",
                  }}
                >
                  هر موقع ناگهانی وسوسه پیام دادن، چک کردن، گریه‌های شدید یا تنهایی سنگین میاد سراغت… اینجا دقیقاً همون‌جاست که باید بیای.
                </Text>
              </>
            )}
          </View>
        </View>
      ) : (
        <>
          {/* Search */}
          <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 }}>
            <View style={styles.searchBox}>
              <Ionicons
                name="search"
                size={18}
                color="#E5E7EB"
                style={{ opacity: 0.6 }}
              />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="جست‌وجوی موقعیت…"
                placeholderTextColor="rgba(231,238,247,.55)"
                style={{ flex: 1, textAlign: "right", color: "#F9FAFB" }}
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

  /* ✅ گلو / شیپ مثل بقیه */
  bgGlowTop: {
    position: "absolute",
    top: -260,
    left: -240,
    width: 480,
    height: 480,
    borderRadius: 999,
    backgroundColor: "rgba(212,175,55,.14)",
  },
  bgGlowBottom: {
    position: "absolute",
    bottom: -280,
    right: -260,
    width: 560,
    height: 560,
    borderRadius: 999,
    backgroundColor: "rgba(233,138,21,.10)",
  },

  /* ✅ هدر شیشه‌ای هماهنگ */
  header: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(3,7,18,.92)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: 18, fontWeight: "900", color: "#F9FAFB" },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderColor: "rgba(255,255,255,.08)",
    backgroundColor: "rgba(255,255,255,.04)",
  },

  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    borderColor: "rgba(255,255,255,.08)",
    backgroundColor: "rgba(255,255,255,.04)",
  },
  row: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  title: { flex: 1, textAlign: "right", fontWeight: "900" },

  lockCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    flex: 1,
    borderColor: "rgba(255,255,255,.08)",
    backgroundColor: "rgba(255,255,255,.04)",
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