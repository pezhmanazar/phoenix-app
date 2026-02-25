// app/(tabs)/Panah.tsx

import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useNavigation, useTheme } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import PlanStatusBadge from "../../components/PlanStatusBadge";
import BACKEND_URL from "../../constants/backend";
import { useUser } from "../../hooks/useUser";

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

async function countUnreadForType(type: "tech" | "therapy", openedById: string): Promise<number> {
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

/* ------------------------------ Modal تم‌دار (بدون Alert) ------------------------------ */

function ThemedSoonModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        {/* Stop propagation */}
        <Pressable style={styles.modalCard} onPress={() => {}}>

          {/* Glow */}
          <View pointerEvents="none" style={styles.modalGlowGold} />
          <View pointerEvents="none" style={styles.modalGlowOrange} />

          <View style={styles.modalHeaderRow}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="sparkles" size={18} color="#D4AF37" />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>به‌زودی</Text>
              <Text style={styles.modalSubtitle}>
                پشتیبان هوشمند، در آپدیت‌های آینده فعال میشه.
              </Text>
            </View>
          </View>

          <View style={styles.modalDivider} />

          <TouchableOpacity activeOpacity={0.9} onPress={onClose} style={styles.modalBtn}>
            <Text style={styles.modalBtnText}>باشه</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function Panah() {
  const { colors } = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { me } = useUser();
  const [unreadCount, setUnreadCount] = useState(0);

  // ✅ NEW: مودال تم‌دار برای AI
  const [soonOpen, setSoonOpen] = useState(false);

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

  // ✅ NEW: فعلاً AI غیرفعال → مودال تم‌دار
  const onPressAI = () => setSoonOpen(true);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: "#0b0f14" }]} edges={["top"]}>
      <View style={styles.root}>
        {/* ✅ پس‌زمینه‌ی گلو/شیپ مثل انبوردینگ */}
        <View pointerEvents="none" style={styles.bgGlow1} />
        <View pointerEvents="none" style={styles.bgGlow2} />

        {/* ✅ مودال تم‌دار */}
        <ThemedSoonModal visible={soonOpen} onClose={() => setSoonOpen(false)} />

        {/* Header — عنوان سمت راست، بج سمت چپ */}
        <View style={[styles.header, { paddingTop: Math.max(10, insets.top * 0.15) }]}>
          <Text style={styles.headerTitle}>پنــــــــاه</Text>
          <PlanStatusBadge me={me} showExpiringText />
        </View>

        {/* دو کارت بزرگ */}
        <View style={[styles.fullArea, { height: height - (insets.top + insets.bottom + 140) }]}>
          {/* کارت پشتیبان واقعی */}
          <TouchableOpacity
            activeOpacity={0.92}
            style={[styles.card, styles.cardReal]}
            onPress={() => router.push("/support/real")}
          >
            <View pointerEvents="none" style={styles.cardHighlight} />
            <View pointerEvents="none" style={[styles.cardShape, styles.cardShapeReal]} />

            <View style={styles.cardIconWrap}>
              <Ionicons name="list" size={26} color="#F59E0B" />
            </View>

            <Text style={styles.cardTitle}>پشتیبان واقعی</Text>
            <Text style={styles.cardSubtitle}>ارتباط با تیم پشتیبانی، پیگیری مشکلات و سوالات تخصصی.</Text>

            <View style={styles.cardCtaRow}>
              <Text style={styles.cardCtaText}>ورود</Text>
              <Ionicons name="arrow-back" size={18} color="#F9FAFB" />
            </View>
          </TouchableOpacity>

          {/* کارت پشتیبان هوشمند */}
          <TouchableOpacity
            activeOpacity={0.92}
            style={[styles.card, styles.cardAI]}
            onPress={onPressAI}
          >
            <View pointerEvents="none" style={styles.cardHighlight} />
            <View pointerEvents="none" style={[styles.cardShape, styles.cardShapeAI]} />

            <View style={styles.cardIconWrap}>
              <Ionicons name="chatbubbles" size={24} color="#60A5FA" />
            </View>

            <Text style={styles.cardTitle}>پشتیبان هوشمند (AI)</Text>
            <Text style={styles.cardSubtitle}>پاسخ سریع، تمرین‌های کوتاه و راهنمایی لحظه‌ای.</Text>

            <View style={styles.cardCtaRow}>
              <Text style={styles.cardCtaText}>به‌زودی</Text>
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

  /* ✅ هدر */
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

  /* ✅ کارت‌ها */
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

  /* ---------------- Modal theme ---------------- */

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  modalCard: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 18,
    padding: 14,
    backgroundColor: "rgba(3,7,18,.95)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "android" ? 0.35 : 0.22,
    shadowOffset: { width: 0, height: 14 },
    shadowRadius: 22,
    elevation: 10,
  },
  modalGlowGold: {
    position: "absolute",
    top: -120,
    left: -120,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: "rgba(212,175,55,.16)",
  },
  modalGlowOrange: {
    position: "absolute",
    bottom: -140,
    right: -140,
    width: 320,
    height: 320,
    borderRadius: 999,
    backgroundColor: "rgba(233,138,21,.10)",
  },
  modalHeaderRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 10,
  },
  modalIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    marginTop: 2,
  },
  modalTitle: {
    color: "#F9FAFB",
    fontSize: 14,
    fontWeight: "900",
    textAlign: "right",
  },
  modalSubtitle: {
    marginTop: 6,
    color: "rgba(231,238,247,.78)",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    textAlign: "right",
  },
  modalDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,.08)",
    marginTop: 12,
    marginBottom: 12,
  },
  modalBtn: {
    alignSelf: "stretch",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "rgba(212,175,55,.92)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,.35)",
  },
  modalBtnText: {
    color: "#0b0f14",
    fontWeight: "900",
    fontSize: 13,
  },
});