// app/(tabs)/_layout.tsx
import React, { useEffect, useState, useCallback } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BACKEND_URL from "../../constants/backend";
import { useUser } from "../../hooks/useUser";
import { AppState, AppStateStatus, View, Text } from "react-native";

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

    console.log("[tabs/_layout] countUnread", type, url);

    const res = await fetch(url);
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    if (!res.ok || !json?.ok || !json.ticket) {
      console.log(
        "[tabs/_layout] countUnread",
        type,
        "→ no ticket / not ok",
        res.status
      );
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

    console.log(
      "[tabs/_layout] countUnread result",
      type,
      "adminMsgs=",
      adminMsgs.length,
      "lastSeenId=",
      lastSeenId,
      "→",
      result
    );

    return result;
  } catch (e) {
    console.log("[tabs/_layout] countUnread error", type, e);
    return 0;
  }
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
        console.log("[tabs/_layout] refreshUnread: no openedById");
        setUnreadCount(0);
        return;
      }

      const [therapyUnread, techUnread] = await Promise.all([
        countUnreadForType("therapy", openedById),
        countUnreadForType("tech", openedById),
      ]);

      const total = therapyUnread + techUnread;

      console.log(
        "[tabs/_layout] refreshUnread raw → therapy=",
        therapyUnread,
        "tech=",
        techUnread,
        "total=",
        total
      );

      setUnreadCount((prev) => {
        if (prev !== total) {
          console.log("[tabs/_layout] refreshUnread APPLY →", total);
        }
        return total;
      });
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

    // بار اول
    run();

    // هر ۵ ثانیه یک‌بار
    intervalId = setInterval(run, 5000);

    // وقتی اپ از background → active میاد
    const sub = AppState.addEventListener("change", (nextState) => {
      const prevState = appState.current;
      appState.current = nextState;
      if (
        prevState.match(/inactive|background/) &&
        nextState === "active"
      ) {
        console.log(
          "[tabs/_layout] AppState active → refreshUnread()"
        );
        run();
      }
    });

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      sub.remove();
    };
  }, [refreshUnread]);

  // وقتی me لود/عوض می‌شود
  useEffect(() => {
    if (!me) return;
    console.log("[tabs/_layout] me changed → refreshUnread()");
    refreshUnread();
  }, [me, refreshUnread]);

  return (
    <Tabs
      initialRouteName="Pelekan"
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: "#C7CBD1",
        tabBarStyle: {
          backgroundColor: "#0F1115",
          borderTopWidth: 0,
          height: 74 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 10,
          flexDirection: "row",
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
      {/* تب index مخفی */}
      <Tabs.Screen name="index" options={{ href: null }} />

      <Tabs.Screen
        name="Pelekan"
        options={{
          title: "پلکان",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trending-up" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="Panahgah"
        options={{
          title: "پناهگاه",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="Mashaal"
        options={{
          title: "مشعل",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flame" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="Panah"
        options={{
          title: "پناه",
          tabBarIcon: ({ color, size }) => (
            <View style={{ position: "relative" }}>
              <Ionicons name="shield" color={color} size={size} />
              {unreadCount > 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -10,
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
            <Ionicons name="calendar" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="Phoenix"
        options={{
          title: "ققنوس من",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle" color={color} size={size} />
          ),
        }}
      />

      {/* تب مخفی اشتراک */}
      <Tabs.Screen
        name="Subscription"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}