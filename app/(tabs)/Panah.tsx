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
import {
  useTheme,
  useFocusEffect,
  useNavigation,
} from "@react-navigation/native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useUser } from "../../hooks/useUser";
import { getPlanStatus, PRO_FLAG_KEY } from "../../lib/plan";
import BACKEND_URL from "../../constants/backend";

const { height } = Dimensions.get("window");

type PlanView = "free" | "pro" | "expired";

type Message = {
  id: string;
  sender: "user" | "admin";
  text?: string | null;
  createdAt?: string;
};

type TicketWithMessages = {
  id: string;
  type: "tech" | "therapy";
  updatedAt: string;
  messages: Message[];
};

const SEEN_KEY = (type: "tech" | "therapy") =>
  `support:lastSeenAdmin:${type}`;

function getOpenedById(me: any) {
  const phone = me?.phone;
  const id = me?.id;
  return String(phone || id || "").trim();
}

async function countUnreadForType(
  type: "tech" | "therapy",
  openedById: string
): Promise<number> {
  try {
    if (!openedById) return 0;

    const qs: string[] = [];
    qs.push(`type=${encodeURIComponent(type)}`);
    qs.push(`openedById=${encodeURIComponent(openedById)}`);
    qs.push(`ts=${Date.now()}`);

    const url = `${BACKEND_URL}/api/public/tickets/open?${qs.join("&")}`;
    console.log("[panah] countUnread", type, url);

    const res = await fetch(url);
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    if (!res.ok || !json?.ok || !json.ticket) return 0;

    const t: TicketWithMessages = json.ticket;
    const msgs = Array.isArray(t.messages) ? t.messages : [];
    const adminMsgs = msgs.filter((m) => m.sender === "admin");
    if (!adminMsgs.length) return 0;

    const lastSeenId = await AsyncStorage.getItem(SEEN_KEY(type));

    // اگر هیچ‌وقت این چت باز نشده → همهٔ پیام‌های ادمین نخوانده‌اند
    if (!lastSeenId) return adminMsgs.length;

    const idx = adminMsgs.findIndex((m) => m.id === lastSeenId);

    // اگر شناسه پیدا نشد → همه را نخوانده فرض کن
    if (idx === -1) return adminMsgs.length;

    // تعداد پیام‌های بعد از آخرین پیام دیده‌شده
    return Math.max(0, adminMsgs.length - (idx + 1));
  } catch (e) {
    console.log("[panah] countUnread error", type, e);
    return 0;
  }
}

export default function Panah() {
  const { colors } = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { me } = useUser();

  const [planView, setPlanView] = useState<PlanView>("free");
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);

  const [unreadCount, setUnreadCount] = useState(0);

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
      } catch (e) {
        console.log("PANAH INIT ERR", e);
        setPlanView("free");
        setDaysLeft(null);
      } finally {
        setLoadingPlan(false);
      }
    })();
  }, [me]);

  /** هر بار تب پناه فوکوس می‌گیرد → دوباره محاسبه پلن (با فلگ پرو) */
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
          }
        } catch (e) {
          console.log("PANAH FOCUS ERR", e);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [me])
  );

  /** هر بار فوکوس → تعداد پیام‌های نخوانده (ادمین) را حساب کن و در unreadCount بگذار */
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const loadUnread = async () => {
        const openedById = getOpenedById(me);
        if (!openedById) {
          if (!cancelled) setUnreadCount(0);
          return;
        }

        const [therapyUnread, techUnread] = await Promise.all([
          countUnreadForType("therapy", openedById),
          countUnreadForType("tech", openedById),
        ]);

        if (!cancelled) {
          setUnreadCount(therapyUnread + techUnread);
        }
      };

      loadUnread();

      return () => {
        cancelled = true;
      };
    }, [me])
  );

  /** تنظیم بج تب پناه بر اساس unreadCount */
  useEffect(() => {
    (navigation as any)?.setOptions?.({
      tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
    });
  }, [navigation, unreadCount]);

  // 🎯 سیستم بج پلن هماهنگ با تب Subscription
  let badgeBg = "#111827";
  let badgeTextColor = "#E5E7EB";
  let badgeLabel: "FREE" | "PRO" | "EXPIRED" = "FREE";

  if (planView === "pro") {
    if (isNearExpire) {
      badgeBg = "#451A03";
      badgeTextColor = "#FBBF24";
    } else {
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