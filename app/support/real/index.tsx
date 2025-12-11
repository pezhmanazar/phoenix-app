// app/support/real/index.tsx
import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, useFocusEffect } from "@react-navigation/native";
import { useRouter, Stack } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BACKEND_URL from "../../../constants/backend";
import { useUser } from "../../../hooks/useUser";

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

const SEEN_KEY = (type: "tech" | "therapy") =>
  `support:lastSeenAdmin:${type}`;

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
  const { colors, dark } = useTheme();
  const router = useRouter();
  const { me } = useUser();

  const [therapySummary, setTherapySummary] = useState<TicketSummary | null>(
    null
  );
  const [techSummary, setTechSummary] = useState<TicketSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const [lastSeenAdminIds, setLastSeenAdminIds] = useState<{
    therapy: string | null;
    tech: string | null;
  }>({
    therapy: null,
    tech: null,
  });

  const goTo = (type: "tech" | "therapy") => {
    router.push(`/support/tickets/${type}`);
  };

  const getOpenedById = () => {
    const phone = me?.phone;
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
        console.log("[real-support] fetchSummary", type, url);

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
        const lastAdmin =
          [...msgs].reverse().find((m) => m.sender === "admin") || null;

        const rawText = (last.text || "").trim();
        let baseSnippet: string;
        if (rawText.length > 0) {
          baseSnippet = rawText.length > 32 ? rawText.slice(0, 32) : rawText;
        } else {
          baseSnippet =
            last.sender === "admin"
              ? "پیام جدید از پشتیبانی"
              : "پیام ارسال شده";
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

  const markSeenAndOpen = async (
    type: "tech" | "therapy",
    summary?: TicketSummary | null
  ) => {
    if (summary?.lastAdminMsgId) {
      try {
        await AsyncStorage.setItem(SEEN_KEY(type), summary.lastAdminMsgId);
        setLastSeenAdminIds((prev) => ({
          ...prev,
          [type]: summary.lastAdminMsgId,
        }));
      } catch (e) {
        console.log("[real-support] markSeen error", type, e);
      }
    }
    goTo(type);
  };

  const Cell = ({
    type,
    iconName,
    iconColor,
    subtitleText,
    summary,
    lastSeenAdminId,
  }: {
    type: "tech" | "therapy";
    iconName: any;
    iconColor: string;
    subtitleText: string;
    summary?: TicketSummary | null;
    lastSeenAdminId: string | null;
  }) => {
    const title = DEFAULT_TITLES[type];

    const hasAdminMsg = !!summary?.lastAdminMsgId;
    const isUnread =
      hasAdminMsg && summary!.lastAdminMsgId !== lastSeenAdminId;

    const subtitleLine =
      summary && summary.hasTicket && summary.lastText
        ? summary.lastText
        : "هنوز پیامی در این گفتگو رد و بدل نشده…";

    const timeLabel = summary?.lastMsgAt && formatTime(summary.lastMsgAt);

    const bgColor = dark
      ? type === "therapy"
        ? "#1F2937"
        : "#020617"
      : type === "therapy"
      ? "#FFE4D6"
      : "#DBEAFE";

    const subtitleColor = dark ? "#E5E7EB" : "#4B5563";
    const timeColor = dark ? "#E5E7EB" : "#6B7280";

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={[
          styles.cell,
          {
            borderColor: colors.border,
            backgroundColor: bgColor,
          },
        ]}
        onPress={() => markSeenAndOpen(type, summary)}
      >
        {/* آیکن + عنوان (وسط) */}
        <View style={styles.rowTop}>
          <Ionicons name={iconName} size={28} color={iconColor} />
          <Text
            style={[styles.title, { color: colors.text }]}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>

        {/* ردیف: بج + خلاصه + ساعت */}
        <View style={styles.rowSummary}>
          {isUnread && (
            <View style={styles.unreadDotWrapper}>
              <View style={styles.unreadDot} />
              <Text style={styles.unreadDotText}>جدید</Text>
            </View>
          )}

          <Text
            style={[styles.subtitle, { color: subtitleColor }]}
            numberOfLines={1}
          >
            {subtitleLine}
          </Text>

          {timeLabel && (
            <Text style={[styles.timeLabel, { color: timeColor }]}>
              {timeLabel}
            </Text>
          )}
        </View>

        {/* متن توضیحی دو خطی، وسط‌چین */}
        <Text
          style={[
            styles.description,
            { color: dark ? "#D1D5DB" : "#6B7280" },
          ]}
        >
          {subtitleText}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <View
        style={[
          styles.headerBar,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.7}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          پشتیبانی واقعی
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          gap: 18,
          flexGrow: 1,
          justifyContent: "space-between",
        }}
      >
        <Cell
          type="therapy"
          iconName="person"
          iconColor="#A855F7"
          subtitleText={
            "در صورت نیاز به ارتباط با یک روان‌درمانگر،\nسؤال یا پیام خودت را به این چت بفرست."
          }
          summary={therapySummary}
          lastSeenAdminId={lastSeenAdminIds.therapy}
        />

        <Cell
          type="tech"
          iconName="bug"
          iconColor="#F59E0B"
          subtitleText={
            "در صورت هر گونه مشکل یا سؤال در استفاده از برنامه،\nپیام خودت رو به این چت بفرست."
          }
          summary={techSummary}
          lastSeenAdminId={lastSeenAdminIds.tech}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 6,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "900" },

  cell: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flex: 1,
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  rowTop: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    rowGap: 8,
  },

  rowSummary: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 8,
  },

  title: {
    fontWeight: "900",
    fontSize: 16,
    textAlign: "center",
  },

  subtitle: {
    flex: 1,
    fontSize: 13,
    textAlign: "right",
  },

  description: {
    fontSize: 12,
    marginTop: 10,
    textAlign: "center",
    lineHeight: 19,
  },

  timeLabel: {
    fontSize: 11,
    fontWeight: "700",
  },

  unreadDotWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#F973161A",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F97316",
  },
  unreadDotText: {
    color: "#F97316",
    fontSize: 10,
    fontWeight: "800",
  },
});