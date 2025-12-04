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
import { getPlanStatus, PRO_FLAG_KEY } from "../../lib/plan";

const { height } = Dimensions.get("window");

type PlanView = "free" | "pro" | "expired";

export default function Panah() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { me } = useUser();

  const [planView, setPlanView] = useState<PlanView>("free");
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);

  const isProPlan = planView === "pro";
  const isNearExpire =
    planView === "pro" && daysLeft != null && daysLeft > 0 && daysLeft <= 7;

  /** بارگذاری اولیه وضعیت پلن (با در نظر گرفتن PRO_FLAG_KEY) */
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
            // اگر قبلاً پرو/وی‌آی‌پی بوده و حالا منقضی شده → expired
            view =
              status.rawPlan === "pro" || status.rawPlan === "vip"
                ? "expired"
                : "free";
          } else if (status.isPro || flagIsPro) {
            view = "pro";
          } else {
            view = "free";
          }
        } else {
          view = status.isPro || flagIsPro ? "pro" : "free";
        }

        setPlanView(view);
        setDaysLeft(localDaysLeft ?? null);

        //console.log("PANAH INIT", {
          //rawPlan: status.rawPlan,
         // rawExpiresAt: status.rawExpiresAt,
         // isExpired: status.isExpired,
        //  daysLeft: status.daysLeft,
         // flag,
         // planView: view,
         // localDaysLeft,
        //});
      } catch (e) {
        console.log("PANAH INIT ERR", e);
        setPlanView("free");
        setDaysLeft(null);
      } finally {
        setLoadingPlan(false);
      }
    })();
  }, [me]);

  /** هر بار تب پناه فوکوس می‌گیرد → دوباره محاسبه (با فلگ پرو) */
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
              view =
                status.rawPlan === "pro" || status.rawPlan === "vip"
                  ? "expired"
                  : "free";
            } else if (status.isPro || flagIsPro) {
              view = "pro";
            } else {
              view = "free";
            }
          } else {
            view = status.isPro || flagIsPro ? "pro" : "free";
          }

          if (!cancelled) {
            setPlanView(view);
            setDaysLeft(localDaysLeft ?? null);
            //console.log("PANAH FOCUS", {
              //flag,
              //planView: view,
              //localDaysLeft,
              //daysLeftReal: status.daysLeft,
              //isExpired: status.isExpired,
           // });
          }
        } catch (e) {
          //console.log("PANAH FOCUS ERR", e);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [me])
  );

  // 🎯 سیستم بج هماهنگ با تب Subscription:
  // FREE: پس‌زمینه تیره، متن روشن
  // PRO: سبز تیره + متن سبز نئونی
  // PRO نزدیک انقضا (از روی daysLeft): قهوه‌ای تیره + متن زرد
  // EXPIRED: قرمز تیره + متن صورتی روشن
  let badgeBg = "#111827";
  let badgeTextColor = "#E5E7EB";
  let badgeLabel: "FREE" | "PRO" | "EXPIRED" = "FREE";

  if (planView === "pro") {
    if (isNearExpire) {
      // پرو نزدیک انقضا
      badgeBg = "#451A03";
      badgeTextColor = "#FBBF24";
    } else {
      // پرو عادی
      badgeBg = "#064E3B";
      badgeTextColor = "#4ADE80";
    }
    badgeLabel = "PRO";
  } else if (planView === "expired") {
    badgeBg = "#7F1D1D";
    badgeTextColor = "#FCA5A5";
    badgeLabel = "EXPIRED";
  }

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
              },
            ]}
          >
            <Text style={[styles.badgeText, { color: badgeTextColor }]}>
              {badgeLabel}
            </Text>
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