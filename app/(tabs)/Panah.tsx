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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, useFocusEffect, useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useUser } from "../../hooks/useUser";
import BACKEND_URL from "../../constants/backend";
import PlanStatusBadge from "../../components/PlanStatusBadge";

const { height } = Dimensions.get("window");

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

const SEEN_KEY = (type: "tech" | "therapy") => `support:lastSeenAdmin:${type}`;

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
  const [unreadCount, setUnreadCount] = useState(0);

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

  // ✅ اگر هنوز me نیومده، یک لودینگ سبک
  if (!me) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: "#0b0f14" }]} edges={["top"]}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ color: "#E5E7EB", marginTop: 8, fontSize: 12 }}>
            در حال آماده‌سازی پناه…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: "#0b0f14" }]} edges={["top"]}>
      <View style={styles.root}>
        {/* ✅ پس‌زمینه‌ی گلو/شیپ مثل انبوردینگ */}
        <View pointerEvents="none" style={styles.bgGlow1} />
        <View pointerEvents="none" style={styles.bgGlow2} />

        {/* Header — عنوان سمت راست، بج سمت چپ */}
        <View style={[styles.header, { paddingTop: Math.max(10, insets.top * 0.15) }]}>
          <Text style={styles.headerTitle}>پنــــــــاه</Text>

          {/* ✅ فقط از خود PlanStatusBadge متن نزدیک انقضا را بگیر (بدون expiringText سفارشی) */}
          <PlanStatusBadge me={me} showExpiringText />
        </View>

        {/* دو کارت بزرگ */}
        <View
          style={[
            styles.fullArea,
            { height: height - (insets.top + insets.bottom + 140) },
          ]}
        >
          {/* کارت پشتیبان واقعی */}
          <TouchableOpacity
            activeOpacity={0.92}
            style={[styles.card, styles.cardReal]}
            onPress={() => router.push("/support/real")}
          >
            {/* هایلایت داخلی */}
            <View pointerEvents="none" style={styles.cardHighlight} />
            {/* شیپ گوشه‌ای */}
            <View pointerEvents="none" style={[styles.cardShape, styles.cardShapeReal]} />

            <View style={styles.cardIconWrap}>
              <Ionicons name="list" size={26} color="#F59E0B" />
            </View>

            <Text style={styles.cardTitle}>پشتیبان واقعی</Text>
            <Text style={styles.cardSubtitle}>
              ارتباط با تیم پشتیبانی، پیگیری مشکلات و سوالات تخصصی.
            </Text>

            <View style={styles.cardCtaRow}>
              <Text style={styles.cardCtaText}>ورود</Text>
              <Ionicons name="arrow-back" size={18} color="#F9FAFB" />
            </View>
          </TouchableOpacity>

          {/* کارت پشتیبان هوشمند */}
          <TouchableOpacity
            activeOpacity={0.92}
            style={[styles.card, styles.cardAI]}
            onPress={() => router.push("../support/ai")}
          >
            <View pointerEvents="none" style={styles.cardHighlight} />
            <View pointerEvents="none" style={[styles.cardShape, styles.cardShapeAI]} />

            <View style={styles.cardIconWrap}>
              <Ionicons name="chatbubbles" size={24} color="#60A5FA" />
            </View>

            <Text style={styles.cardTitle}>پشتیبان هوشمند (AI)</Text>
            <Text style={styles.cardSubtitle}>
              پاسخ سریع، تمرین‌های کوتاه و راهنمایی لحظه‌ای.
            </Text>

            <View style={styles.cardCtaRow}>
              <Text style={styles.cardCtaText}>شروع</Text>
              <Ionicons name="arrow-back" size={18} color="#F9FAFB" />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  /* ✅ بک‌گراند گلو مثل انبوردینگ */
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

  /* ✅ هدر: هم‌خانواده Verify/EditProfile + خوانایی نوار وضعیت */
  header: {
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(3,7,18,.92)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#F9FAFB",
  },

  fullArea: {
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginVertical: 12,
    gap: 14,
  },

  /* ✅ کارت‌ها: شیشه‌ای + رنک بهتر */
  card: {
    flex: 1,
    borderRadius: 26,
    padding: 18,
    justifyContent: "center",
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    elevation: 6,
  },
  cardReal: {
    backgroundColor: "rgba(255, 237, 213, .92)",
    borderColor: "rgba(124,45,18,.18)",
  },
  cardAI: {
    backgroundColor: "rgba(219, 234, 254, .92)",
    borderColor: "rgba(30,58,138,.18)",
  },
  cardHighlight: {
    position: "absolute",
    top: -120,
    left: -120,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,.28)",
  },
  cardShape: {
    position: "absolute",
    bottom: -140,
    right: -160,
    width: 360,
    height: 360,
    borderRadius: 999,
  },
  cardShapeReal: {
    backgroundColor: "rgba(245,158,11,.18)",
  },
  cardShapeAI: {
    backgroundColor: "rgba(59,130,246,.14)",
  },
  cardIconWrap: {
    alignSelf: "center",
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: "rgba(17,24,39,.10)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,.10)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
    textAlign: "center",
    marginTop: 2,
  },
  cardSubtitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(17,24,39,.70)",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  cardCtaRow: {
    marginTop: 14,
    alignSelf: "center",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(17,24,39,.82)",
  },
  cardCtaText: {
    color: "#F9FAFB",
    fontSize: 12,
    fontWeight: "900",
  },
});