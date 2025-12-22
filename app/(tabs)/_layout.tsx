// app/(tabs)/_layout.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@react-navigation/native";
import { Tabs } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  AppState,
  AppStateStatus,
  I18nManager,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BACKEND_URL from "../../constants/backend";
import { useUser } from "../../hooks/useUser";

/* ===== helpers برای unread ===== */
const SEEN_KEY = (type: "tech" | "therapy") => `support:lastSeenAdmin:${type}`;

type Message = {
  id: string;
  sender: "user" | "admin";
  createdAt?: string;
  text?: string | null;
};

type TicketWithMessages = {
  id: string;
  type: "tech" | "therapy";
  updatedAt: string;
  messages: Message[];
};

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
    if (!openedById) {
      console.log("[tabs/_layout] countUnread", type, "→ no openedById");
      return 0;
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
      return 0;
    }

    const t: TicketWithMessages = json.ticket;
    const msgs = Array.isArray(t.messages) ? t.messages : [];
    const adminMsgs = msgs.filter((m) => m.sender === "admin");

    const lastSeenId = await AsyncStorage.getItem(SEEN_KEY(type));

    const result = (() => {
      if (!adminMsgs.length) return 0;
      if (!lastSeenId) return adminMsgs.length;
      const idx = adminMsgs.findIndex((m) => m.id === lastSeenId);
      if (idx === -1) return adminMsgs.length;
      return Math.max(0, adminMsgs.length - (idx + 1));
    })();

    return result;
  } catch (e) {
    console.log("[tabs/_layout] countUnread error", type, e);
    return 0;
  }
}

/* ===== Background شیشه‌ای + گلو برای tabBar ===== */
function TabBarGlassBackground() {
  return (
    <View
      pointerEvents="none"
      style={{
        flex: 1,
        backgroundColor: "rgba(3,7,18,.94)",
        borderTopWidth: 1,
        borderTopColor: "rgba(255,255,255,.08)",
      }}
    >
      {/* glow left/top */}
      <View
        style={{
          position: "absolute",
          top: -40,
          left: -70,
          width: 170,
          height: 170,
          borderRadius: 999,
          backgroundColor: "rgba(212,175,55,.14)",
        }}
      />
      {/* glow right/bottom */}
      <View
        style={{
          position: "absolute",
          bottom: -60,
          right: -90,
          width: 240,
          height: 240,
          borderRadius: 999,
          backgroundColor: "rgba(233,138,21,.10)",
        }}
      />
    </View>
  );
}

/* ===== خود layout تب‌ها ===== */
export default function TabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { me } = useUser();

  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnread = useCallback(async () => {
    try {
      const openedById = getOpenedById(me);
      if (!openedById) {
        setUnreadCount(0);
        return;
      }

      const [therapyUnread, techUnread] = await Promise.all([
        countUnreadForType("therapy", openedById),
        countUnreadForType("tech", openedById),
      ]);

      const total = therapyUnread + techUnread;

      setUnreadCount((prev) => (prev !== total ? total : prev));
    } catch (e) {
      console.log("[tabs/_layout] refreshUnread error", e);
    }
  }, [me]);

  // mount + هر ۵ ثانیه + برگشت از background
  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const appState = { current: AppState.currentState as AppStateStatus };

    const run = async () => {
      if (cancelled) return;
      await refreshUnread();
    };

    run();
    intervalId = setInterval(run, 5000);

    const sub = AppState.addEventListener("change", (nextState) => {
      const prevState = appState.current;
      appState.current = nextState;
      if (prevState.match(/inactive|background/) && nextState === "active") {
        run();
      }
    });

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      sub.remove();
    };
  }, [refreshUnread]);

  useEffect(() => {
    if (!me) return;
    refreshUnread();
  }, [me, refreshUnread]);

  return (
    <Tabs
      initialRouteName="Pelekan"
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,

        // ✅ تم رنگی ثابت و هماهنگ با برند
        tabBarActiveTintColor: "#D4AF37",
        tabBarInactiveTintColor: "rgba(231,238,247,.55)",

        // ✅ شیشه‌ای + گلو
        tabBarBackground: () => <TabBarGlassBackground />,

        tabBarStyle: {
          backgroundColor: "transparent",
          borderTopWidth: 0,

          // ✅ FIX: حذف نوار اضافه
          // فقط ارتفاع را با safe-area تنظیم می‌کنیم؛ paddingBottom را صفر می‌کنیم
          height: 70 + insets.bottom,
          paddingBottom: 0,

          paddingTop: 10,
        },

        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "800",
          marginTop: 2,
          textAlign: "center",
          writingDirection: "auto",
        },
      }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />

      <Tabs.Screen
        name="Pelekan"
        options={{
          title: "پلکان",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trending-up-outline" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="Panahgah"
        options={{
          title: "پناهگاه",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="shield-checkmark-outline"
              color={color}
              size={size}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="Mashaal"
        options={{
          title: "مشعل",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flame-outline" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="Panah"
        options={{
          title: "پناه",
          tabBarIcon: ({ color, size }) => (
            <View style={{ position: "relative" }}>
              <Ionicons name="chatbubbles-outline" color={color} size={size} />

              {unreadCount > 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: -4,
                    ...(I18nManager.isRTL ? { left: -10 } : { right: -10 }),
                    minWidth: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: "#EF4444",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 3,
                  }}
                >
                  <Text
                    style={{
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: "900",
                    }}
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="Rooznegar"
        options={{
          title: "روزنگار",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="Phoenix"
        options={{
          title: "پروفایل",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="Subscription"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}