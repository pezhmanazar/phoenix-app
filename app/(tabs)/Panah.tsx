// app/(tabs)/Panah.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useUser } from "../../hooks/useUser";
import { getPlanStatus } from "../../lib/plan";

const { height } = Dimensions.get("window");

// همان کلید مشترک با بقیه تب‌ها
const PRO_FLAG_KEY = "phoenix_is_pro";

type PlanView = "free" | "pro" | "expired";
type DebugState =
  | "real"
  | "force-free"
  | "force-pro"
  | "force-pro-near"
  | "force-expired";

export default function Panah() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { me } = useUser();

  const [planView, setPlanView] = useState<PlanView>("free");
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [debugState, setDebugState] = useState<DebugState>("real");
  const [loadingPlan, setLoadingPlan] = useState(true);

  const isProPlan = planView === "pro";
  const isNearExpire =
    planView === "pro" &&
    daysLeft != null &&
    daysLeft > 0 &&
    daysLeft <= 7;

  /** بارگذاری اولیه وضعیت پلن */
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

        // دیباگ
        if (debugState === "force-free") {
          view = "free";
          localDaysLeft = null;
        } else if (debugState === "force-pro") {
          view = "pro";
          localDaysLeft = 30;
        } else if (debugState === "force-pro-near") {
          view = "pro";
          localDaysLeft = 4;
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
        setLoadingPlan(false);
      }
    })();
  }, [me, debugState]);

  /** هر بار تب پناه فوکوس می‌گیرد → دوباره محاسبه */
  useFocusEffect(
    useCallback(() => {
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

          if (debugState === "force-free") {
            view = "free";
            localDaysLeft = null;
          } else if (debugState === "force-pro") {
            view = "pro";
            localDaysLeft = 30;
          } else if (debugState === "force-pro-near") {
            view = "pro";
            localDaysLeft = 4;
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

  if (loadingPlan) {
    return (
      <SafeAreaView
        style={[styles.root, { backgroundColor: colors.background }]}
        edges={["top", "left", "right", "bottom"]}
      >
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text
            style={{
              color: colors.text,
              marginTop: 8,
              fontSize: 12,
            }}
          >
            در حال آماده‌سازی پناه…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: colors.background }]}
      edges={["top", "left", "right", "bottom"]}
    >
      {/* پنل دیباگ حالت پلن */}
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
            حالت نمایش پلن (دیباگ پناه):
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
                { key: "force-free", label: "FREE فیک" },
                { key: "force-pro", label: "PRO فیک" },
                { key: "force-pro-near", label: "PRO فیک (نزدیک انقضا)" },
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

      {/* Header — عنوان سمت راست، بج سمت چپ */}
      <View style={[styles.header, { borderColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          پنــــــــاه
        </Text>
        <View style={{ flexDirection: "row-reverse", alignItems: "center" }}>
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
              styles.badge,
              {
                backgroundColor: badgeBg,
                borderWidth: planView === "free" ? 1 : 0,
                borderColor: planView === "free" ? "#4B5563" : "transparent",
              },
            ]}
          >
            <Text style={styles.badgeText}>{badgeLabel}</Text>
          </View>
        </View>
      </View>

      {/* دو دکمه‌ی بزرگ با تقسیم دقیق ارتفاع */}
      <View
        style={[
          styles.fullArea,
          {
            height: height - (insets.top + insets.bottom + 140),
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.bigBtn, styles.realSupport]}
          onPress={() => router.push("/support/real")}
        >
          <Ionicons name="list" size={28} color="#7C2D12" />
          <Text style={styles.bigBtnText}>پشتیبان واقعی</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.bigBtn, styles.aiSupport]}
          onPress={() => router.push("../support/ai")}
        >
          <Ionicons name="chatbubbles" size={28} color="#1E3A8A" />
          <Text style={styles.bigBtnText}>پشتیبان هوشمند (AI)</Text>
        </TouchableOpacity>
      </View>
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
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: 18, fontWeight: "900" },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#111827",
  },

  fullArea: {
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginVertical: 10,
  },
  bigBtn: {
    height: "48%",
    borderRadius: 22,
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3,
  },
  realSupport: {
    backgroundColor: "#FFEAD5",
  },
  aiSupport: {
    backgroundColor: "#DBEAFE",
  },
  bigBtnText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
    textAlign: "center",
    marginTop: 8,
  },
});