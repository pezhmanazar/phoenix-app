// app/support/real/index.tsx
import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, useFocusEffect } from "@react-navigation/native";
import { useRouter, Stack } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BACKEND_URL from "../../../constants/backend";
import { useUser } from "../../../hooks/useUser";
import PlanStatusBadge from "../../../components/PlanStatusBadge";

const DEFAULT_TITLES = {
  tech: "پشتیبانی فنی ققنوس",
  therapy: "پشتیبانی درمانی ققنوس",
} as const;

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

type TicketSummary = {
  hasTicket: boolean;
  lastText: string | null;
  lastFromAdmin: boolean;
  lastAdminMsgId: string | null;
  lastAdminMsgAt: string | null;
  lastMsgAt: string | null;
};

const SEEN_KEY = (type: "tech" | "therapy") => `support:lastSeenAdmin:${type}`;

// HH:MM فارسی
function formatTime(input?: string | null) {
  if (!input) return null;
  const d = new Date(input);
  if (isNaN(d.getTime())) return null;
  try {
    return d.toLocaleTimeString("fa-IR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return null;
  }
}

export default function RealSupport() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { me } = useUser();

  const [therapySummary, setTherapySummary] = useState<TicketSummary | null>(null);
  const [techSummary, setTechSummary] = useState<TicketSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastSeenAdminIds, setLastSeenAdminIds] = useState<{
    therapy: string | null;
    tech: string | null;
  }>({ therapy: null, tech: null });

  const goTo = (type: "tech" | "therapy") => {
    router.push(`/support/tickets/${type}`);
  };

  const getOpenedById = () => {
    const phone = (me as any)?.phone;
    const id = (me as any)?.id;
    return String(phone || id || "").trim();
  };

  const fetchSummaryForType = useCallback(
    async (type: "tech" | "therapy"): Promise<TicketSummary | null> => {
      try {
        const openedById = getOpenedById();
        if (!openedById) {
          return {
            hasTicket: false,
            lastText: null,
            lastFromAdmin: false,
            lastAdminMsgId: null,
            lastAdminMsgAt: null,
            lastMsgAt: null,
          };
        }

        const qs: string[] = [];
        qs.push(`type=${encodeURIComponent(type)}`);
        qs.push(`openedById=${encodeURIComponent(openedById)}`);
        qs.push(`ts=${Date.now()}`);
        const url = `${BACKEND_URL}/api/public/tickets/open?${qs.join("&")}`;

        const res = await fetch(url);
        let json: any = null;
        try {
          json = await res.json();
        } catch {
          json = null;
        }

        if (!res.ok || !json?.ok || !json.ticket) {
          return {
            hasTicket: false,
            lastText: null,
            lastFromAdmin: false,
            lastAdminMsgId: null,
            lastAdminMsgAt: null,
            lastMsgAt: null,
          };
        }

        const t: TicketWithMessages = json.ticket;
        const msgs = Array.isArray(t.messages) ? t.messages : [];

        if (!msgs.length) {
          return {
            hasTicket: true,
            lastText: null,
            lastFromAdmin: false,
            lastAdminMsgId: null,
            lastAdminMsgAt: null,
            lastMsgAt: null,
          };
        }

        const last = msgs[msgs.length - 1];
        const lastAdmin = [...msgs].reverse().find((m) => m.sender === "admin") || null;

        const rawText = (last.text || "").trim();
        let baseSnippet: string;
        if (rawText.length > 0) {
          baseSnippet = rawText.length > 36 ? rawText.slice(0, 36) : rawText;
        } else {
          baseSnippet = last.sender === "admin" ? "پیام جدید از پشتیبانی" : "پیام ارسال شده";
        }

        const snippet = baseSnippet + "…";

        return {
          hasTicket: true,
          lastText: snippet,
          lastFromAdmin: last.sender === "admin",
          lastAdminMsgId: lastAdmin ? lastAdmin.id : null,
          lastAdminMsgAt: lastAdmin?.createdAt ?? null,
          lastMsgAt: last.createdAt ?? null,
        };
      } catch (e) {
        console.log("[real-support] fetchSummary error", type, e);
        return null;
      }
    },
    [me]
  );

  const loadSeenIds = useCallback(async () => {
    try {
      const [therapySeen, techSeen] = await Promise.all([
        AsyncStorage.getItem(SEEN_KEY("therapy")),
        AsyncStorage.getItem(SEEN_KEY("tech")),
      ]);
      setLastSeenAdminIds({
        therapy: therapySeen || null,
        tech: techSeen || null,
      });
    } catch (e) {
      console.log("[real-support] loadSeenIds error", e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const load = async () => {
        setLoading(true);
        const [therapy, tech] = await Promise.all([
          fetchSummaryForType("therapy"),
          fetchSummaryForType("tech"),
        ]);
        await loadSeenIds();
        if (!cancelled) {
          if (therapy) setTherapySummary(therapy);
          if (tech) setTechSummary(tech);
          setLoading(false);
        }
      };
      load();
      return () => {
        cancelled = true;
      };
    }, [fetchSummaryForType, loadSeenIds])
  );

  const markSeenAndOpen = async (type: "tech" | "therapy", summary?: TicketSummary | null) => {
    if (summary?.lastAdminMsgId) {
      try {
        await AsyncStorage.setItem(SEEN_KEY(type), summary.lastAdminMsgId);
        setLastSeenAdminIds((prev) => ({ ...prev, [type]: summary.lastAdminMsgId }));
      } catch (e) {
        console.log("[real-support] markSeen error", type, e);
      }
    }
    goTo(type);
  };

  const Cell = ({
    type,
    rank,
    iconName,
    iconBg,
    iconColor,
    subtitleText,
    summary,
    lastSeenAdminId,
  }: {
    type: "tech" | "therapy";
    rank: 1 | 2;
    iconName: any;
    iconBg: string;
    iconColor: string;
    subtitleText: string;
    summary?: TicketSummary | null;
    lastSeenAdminId: string | null;
  }) => {
    const title = DEFAULT_TITLES[type];
    const hasAdminMsg = !!summary?.lastAdminMsgId;
    const isUnread = hasAdminMsg && summary!.lastAdminMsgId !== lastSeenAdminId;

    const subtitleLine =
      summary && summary.hasTicket && summary.lastText
        ? summary.lastText
        : "هنوز پیامی در این گفتگو رد و بدل نشده…";

    const timeLabel = summary?.lastMsgAt && formatTime(summary.lastMsgAt);

    const rankLabel = rank === 1 ? "اولویت ۱" : "اولویت ۲";
    const rankBg = rank === 1 ? "rgba(168,85,247,.16)" : "rgba(245,158,11,.14)";
    const rankFg = rank === 1 ? "#C4B5FD" : "#FCD34D";

    return (
      <TouchableOpacity
        activeOpacity={0.92}
        style={[
          styles.card,
          {
            borderColor: "rgba(255,255,255,.10)",
            backgroundColor: "rgba(255,255,255,.03)",
          },
        ]}
        onPress={() => markSeenAndOpen(type, summary)}
      >
        {/* subtle highlight shape */}
        <View
          pointerEvents="none"
          style={[
            styles.cardGlow,
            { backgroundColor: rank === 1 ? "rgba(168,85,247,.14)" : "rgba(245,158,11,.12)" },
          ]}
        />

        {/* top row: rank chip + unread */}
        <View style={styles.topRow}>
          <View style={[styles.rankChip, { backgroundColor: rankBg, borderColor: "rgba(255,255,255,.08)" }]}>
            <Text style={[styles.rankText, { color: rankFg }]}>{rankLabel}</Text>
          </View>

          {isUnread && (
            <View style={styles.unreadPill}>
              <View style={styles.unreadDot} />
              <Text style={styles.unreadText}>جدید</Text>
            </View>
          )}
        </View>

        {/* icon + title */}
        <View style={styles.titleWrap}>
          <View style={[styles.iconBubble, { backgroundColor: iconBg, borderColor: "rgba(255,255,255,.10)" }]}>
            <Ionicons name={iconName} size={22} color={iconColor} />
          </View>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {title}
          </Text>
        </View>

        {/* summary row */}
        <View style={styles.summaryRow}>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitleLine}
          </Text>

          {!!timeLabel && <Text style={styles.timeLabel}>{timeLabel}</Text>}
        </View>

        {/* description */}
        <Text style={styles.description}>{subtitleText}</Text>

        {/* CTA */}
        <View style={styles.ctaRow}>
          <View style={styles.ctaBtn}>
            <Text style={styles.ctaText}>ورود به گفتگو</Text>
            <Ionicons name="chevron-back" size={16} color="#E5E7EB" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: "#0b0f14" }]} edges={["top", "left", "right", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* background glows (like onboarding) */}
      <View pointerEvents="none" style={styles.bgGlowTop} />
      <View pointerEvents="none" style={styles.bgGlowBottom} />

      {/* Header (safe area respected) */}
      <View style={[styles.headerBar, { paddingTop: 10 }]}>
        <TouchableOpacity style={styles.backBtn} activeOpacity={0.7} onPress={() => router.back()}>
          <Ionicons name="arrow-forward" size={22} color="#E5E7EB" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>پشتیبانی واقعی</Text>
        </View>

        {/* plan badge top-left inside header */}
        <View style={styles.headerLeft}>
          <PlanStatusBadge
            me={me}
            showExpiringText
            expiringText={(d) => `تا انقضا ${String(d).replace(/\d/g, (x) => "۰۱۲۳۴۵۶۷۸۹"[Number(x)])} روز`}
          />
        </View>
      </View>

      {/* Body */}
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: Math.max(18, insets.bottom + 14),
          gap: 14,
        }}
        showsVerticalScrollIndicator={false}
      >
        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#D4AF37" />
            <Text style={styles.loadingText}>در حال به‌روزرسانی…</Text>
          </View>
        )}

        <Cell
          type="therapy"
          rank={1}
          iconName="person"
          iconBg="rgba(168,85,247,.16)"
          iconColor="#C4B5FD"
          subtitleText={"برای راهنمایی درمانی، پیام خودت رو اینجا بفرست.\n(پاسخ توسط تیم روانشناسان ارسال میشه)"}
          summary={therapySummary}
          lastSeenAdminId={lastSeenAdminIds.therapy}
        />

        <Cell
          type="tech"
          rank={2}
          iconName="bug"
          iconBg="rgba(245,158,11,.14)"
          iconColor="#FCD34D"
          subtitleText={"اگر مشکلی در اپ دیدی یا سوال فنی داری، اینجا پیام بده.\n(ترجیحاً اسکرین‌شات هم بفرست)"}
          summary={techSummary}
          lastSeenAdminId={lastSeenAdminIds.tech}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  /* onboarding-like background glows */
  bgGlowTop: {
    position: "absolute",
    top: -240,
    left: -220,
    width: 440,
    height: 440,
    borderRadius: 999,
    backgroundColor: "rgba(212,175,55,.14)",
  },
  bgGlowBottom: {
    position: "absolute",
    bottom: -260,
    right: -240,
    width: 520,
    height: 520,
    borderRadius: 999,
    backgroundColor: "rgba(233,138,21,.10)",
  },

  headerBar: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,.08)",
    backgroundColor: "#030712",
    paddingHorizontal: 12,
    paddingBottom: 12,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 40,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
  },
  headerCenter: {
  flex: 1,
  alignItems: "flex-start",
  justifyContent: "center", // ✅ این خط
  paddingHorizontal: 10,
},
  headerTitle: {
  color: "#F9FAFB",
  fontSize: 16,
  fontWeight: "900",
  textAlign: "right",         // ✅ قبلاً center بود
  alignSelf: "stretch",       // ✅ تا راست‌چین واقعی بشه
},
  headerSub: {
    marginTop: 3,
    color: "rgba(231,238,247,.70)",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  headerLeft: {
    width: 140,
    alignItems: "flex-start",
    justifyContent: "flex-end",
  },

  loadingRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 6,
  },
  loadingText: {
    color: "rgba(231,238,247,.72)",
    fontSize: 12,
    fontWeight: "800",
  },

  card: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    overflow: "hidden",
  },
  cardGlow: {
    position: "absolute",
    top: -90,
    right: -110,
    width: 220,
    height: 220,
    borderRadius: 999,
  },

  topRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  rankChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  rankText: {
    fontSize: 11,
    fontWeight: "900",
  },

  unreadPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(249,115,22,.12)",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,.25)",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F97316",
  },
  unreadText: {
    color: "#FDBA74",
    fontSize: 11,
    fontWeight: "900",
  },

  titleWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  cardTitle: {
    color: "#E5E7EB",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },

  summaryRow: {
    marginTop: 10,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  subtitle: {
    flex: 1,
    color: "rgba(231,238,247,.74)",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
  },
  timeLabel: {
    color: "rgba(231,238,247,.60)",
    fontSize: 11,
    fontWeight: "800",
  },

  description: {
    marginTop: 10,
    color: "rgba(231,238,247,.60)",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    fontWeight: "700",
  },

  ctaRow: {
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(212,175,55,.14)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,.30)",
  },
  ctaText: {
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "900",
  },
});