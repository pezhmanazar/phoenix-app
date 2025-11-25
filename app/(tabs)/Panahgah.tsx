// app/(tabs)/Panahgah.tsx
import React, { useMemo, useState, useEffect } from "react";
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
import { getPlanStatus } from "../../lib/plan";

type PlanView = "free" | "pro" | "expired";
type DebugState =
  | "real"
  | "force-pro"
  | "force-pro-near"
  | "force-free"
  | "force-expired";

const PRO_FLAG_KEY = "phoenix_is_pro";

export default function Panahgah() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { me } = useUser();

  const [q, setQ] = useState("");
  const [planView, setPlanView] = useState<PlanView>("free");
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [debugState, setDebugState] = useState<DebugState>("real");
  const [loading, setLoading] = useState(true);

  const isProPlan = planView === "pro";
  const isNearExpire =
    planView === "pro" &&
    daysLeft != null &&
    daysLeft > 0 &&
    daysLeft <= 7;

  /** بارگذاری اولیه + محاسبه وضعیت پلن */
  useEffect(() => {
    (async () => {
      try {
        const flag = await AsyncStorage.getItem(PRO_FLAG_KEY);
        const status = getPlanStatus(me);
        const flagIsPro = flag === "1";

        let view: PlanView = "free";
        let localDaysLeft: number | null = status.daysLeft;

        if (status.rawExpiresAt) {
          if (status.isExpired) {
            view = "expired";
          } else if (status.isPro || flagIsPro) {
            view = "pro";
          } else {
            view = "free";
          }
        } else {
          view = status.isPro || flagIsPro ? "pro" : "free";
        }

        // Debug override
        if (debugState === "force-pro") {
          view = "pro";
          localDaysLeft = 30;
        } else if (debugState === "force-pro-near") {
          view = "pro";
          localDaysLeft = 4;
        } else if (debugState === "force-free") {
          view = "free";
          localDaysLeft = null;
        } else if (debugState === "force-expired") {
          view = "expired";
          localDaysLeft = 0;
        }

        setPlanView(view);
        setDaysLeft(localDaysLeft ?? null);

        console.log("PANAH INIT", {
          rawPlan: status.rawPlan,
          rawExpiresAt: status.rawExpiresAt,
          isExpired: status.isExpired,
          daysLeft: status.daysLeft,
          flag,
          debugState,
          planView: view,
          localDaysLeft,
        });
      } catch (e) {
        console.log("PANAH INIT ERR", e);
        setPlanView("free");
        setDaysLeft(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [me, debugState]);

  /** هر بار فوکوس → دوباره محاسبه */
  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const flag = await AsyncStorage.getItem(PRO_FLAG_KEY);
          const status = getPlanStatus(me);
          const flagIsPro = flag === "1";

          let view: PlanView = "free";
          let localDaysLeft: number | null = status.daysLeft;

          if (status.rawExpiresAt) {
            if (status.isExpired) {
              view = "expired";
            } else if (status.isPro || flagIsPro) {
              view = "pro";
            } else {
              view = "free";
            }
          } else {
            view = status.isPro || flagIsPro ? "pro" : "free";
          }

          if (debugState === "force-pro") {
            view = "pro";
            localDaysLeft = 30;
          } else if (debugState === "force-pro-near") {
            view = "pro";
            localDaysLeft = 4;
          } else if (debugState === "force-free") {
            view = "free";
            localDaysLeft = null;
          } else if (debugState === "force-expired") {
            view = "expired";
            localDaysLeft = 0;
          }

          if (!cancelled) {
            setPlanView(view);
            setDaysLeft(localDaysLeft ?? null);
            console.log("PANAH FOCUS", {
              flag,
              debugState,
              planView: view,
              localDaysLeft,
              daysLeftReal: status.daysLeft,
              isExpired: status.isExpired,
            });
          }
        } catch (e) {
          console.log("PANAH FOCUS ERR", e);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [me, debugState])
  );

  const data = useMemo(() => {
    const items = allScenarios();
    if (!q.trim()) return items;
    const qq = q.trim();
    return items.filter(
      (s) =>
        s.title.includes(qq) ||
        s.id.includes(qq.replace(/\s+/g, "-"))
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
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
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
      ? isNearExpire
        ? "#EA580C"
        : "#F59E0B"
      : planView === "expired"
      ? "#DC2626"
      : "#9CA3AF";

  const badgeLabel =
    planView === "pro"
      ? "PRO"
      : planView === "expired"
      ? "EXPIRED"
      : "FREE";

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: colors.background }]}
      edges={["top", "left", "right", "bottom"]}
    >
      {/* پنل دیباگ */}
      <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
        <View
          style={{
            padding: 8,
            borderRadius: 10,
            backgroundColor: "#020617",
            borderWidth: 1,
            borderColor: "#1F2937",
            marginBottom: 8,
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
            حالت نمایش پلن (دیباگ):
          </Text>

          <View style={{ flexDirection: "row-reverse", gap: 6 }}>
            {(
              [
                { key: "real", label: "داده واقعی" },
                { key: "force-free", label: "FREE فیک" },
                { key: "force-pro", label: "PRO فیک" },
                { key: "force-pro-near", label: "PRO فیک (در حال انقضا)" },
                { key: "force-expired", label: "EXPIRED فیک" },
              ] as { key: DebugState; label: string }[]
            ).map((opt) => {
              const active = debugState === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => setDebugState(opt.key)}
                  style={{
                    flex: 1,
                    paddingVertical: 5,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: active ? "#2563EB" : "#4B5563",
                    backgroundColor: active ? "#1D4ED8" : "#020617",
                  }}
                >
                  <Text
                    style={{
                      color: active ? "#E5E7EB" : "#9CA3AF",
                      fontSize: 10,
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
      </View>

      {/* Header */}
      <View style={[styles.header, { borderColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>پناهگاه</Text>
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
              {daysLeft} روز تا پایان اشتراک
            </Text>
          )}
          <View
            style={[
              styles.headerBadge,
              { backgroundColor: badgeBg },
            ]}
          >
            <Text style={styles.headerBadgeText}>{badgeLabel}</Text>
          </View>
        </View>
      </View>

      {/* صفحه قفل‌شده → FREE یا EXPIRED */}
      {planView !== "pro" ? (
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
                  پناهگاه جاییه برای وقتی که یهو حالت بد میشه، یا وسوسه می‌شی پیام
                  بدی، یا احساساتت ناگهانی بهت هجوم میارن.
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
          <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 }}>
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

          {/* لیست */}
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
  headerBadgeRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },

  headerBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  headerBadgeText: {
    color: "#111827",
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