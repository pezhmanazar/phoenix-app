// app/(tabs)/_layout.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Tabs } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  AppStateStatus,
  Image,
  Text,
  View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BACKEND_URL } from "../../constants/backend";
import { useUser } from "../../hooks/useUser";
import { checkAppUpdate } from "../../lib/appUpdate";

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

function countUnreadFromTicket(
  ticket: TicketWithMessages | null | undefined,
  lastSeenId: string | null
): number {
  if (!ticket) return 0;

  const msgs = Array.isArray(ticket.messages) ? ticket.messages : [];
  const adminMsgs = msgs.filter((m) => m.sender === "admin");

  if (!adminMsgs.length) return 0;
  if (!lastSeenId) return adminMsgs.length;

  const idx = adminMsgs.findIndex((m) => m.id === lastSeenId);
  if (idx === -1) return adminMsgs.length;

  return Math.max(0, adminMsgs.length - (idx + 1));
}

async function countUnreadBatch(
  openedById: string
): Promise<{ therapy: number; tech: number }> {
  try {
    if (!openedById) {
      return { therapy: 0, tech: 0 };
    }

    const url = `${BACKEND_URL}/api/public/tickets/open-batch?openedById=${encodeURIComponent(
      openedById
    )}`;

    const res = await fetch(url);

    let json: any = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    if (!res.ok || !json?.ok || !json?.tickets) {
      return { therapy: 0, tech: 0 };
    }

    const [therapyLastSeenId, techLastSeenId] = await Promise.all([
      AsyncStorage.getItem(SEEN_KEY("therapy")),
      AsyncStorage.getItem(SEEN_KEY("tech")),
    ]);

    const therapyTicket = json.tickets.therapy as TicketWithMessages | null;
    const techTicket = json.tickets.tech as TicketWithMessages | null;

    return {
      therapy: countUnreadFromTicket(therapyTicket, therapyLastSeenId),
      tech: countUnreadFromTicket(techTicket, techLastSeenId),
    };
  } catch {
    return { therapy: 0, tech: 0 };
  }
}

/* ===== Background شیشه‌ای + گلو برای tabBar ===== */
function TabBarGlassBackground() {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(24,26,34,0.98)",
        borderTopWidth: 1,
        borderTopColor: "rgba(212,175,55,0.26)",
        overflow: "hidden",
      }}
    >
      <View
        style={{
          position: "absolute",
          width: 140,
          height: 140,
          borderRadius: 999,
          left: -45,
          top: 4,
          backgroundColor: "rgba(212,175,55,0.10)",
        }}
      />

      <View
        style={{
          position: "absolute",
          width: 180,
          height: 180,
          borderRadius: 999,
          right: -70,
          bottom: -65,
          backgroundColor: "rgba(249,115,22,0.08)",
        }}
      />

      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(255,255,255,0.075)",
        }}
      />
    </View>
  );
}

/* ===== wrapper برای آیکن تب ===== */
function TabIconBox({
  focused,
  source,
  badge,
}: {
  focused: boolean;
  source: any;
  badge?: React.ReactNode;
}) {
  return (
    <View
      style={{
        width: 48,
        height: 48,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: focused ? "rgba(212,175,55,0.14)" : "rgba(255,255,255,0.025)",
        borderWidth: focused ? 1 : 0,
        borderColor: focused ? "rgba(212,175,55,0.28)" : "transparent",
        position: "relative",
      }}
    >
      <Image
        source={source}
        style={{
          width: 39,
          height: 39,
          resizeMode: "contain",
          opacity: focused ? 1 : 0.76,
        }}
      />
      {badge}
    </View>
  );
}

/* ===== خود layout تب‌ها ===== */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { me } = useUser();

  const [unreadCount, setUnreadCount] = useState(0);
  const [hasAppUpdate, setHasAppUpdate] = useState(false);
  const isCheckingUpdateRef = useRef(false);
  const isRefreshingRef = useRef(false);

  const refreshUnread = useCallback(async () => {
    if (isRefreshingRef.current) return;

    isRefreshingRef.current = true;

    try {
      const openedById = getOpenedById(me);
      if (!openedById) {
        setUnreadCount(0);
        return;
      }

      const unread = await countUnreadBatch(openedById);
      const total = unread.therapy + unread.tech;

      setUnreadCount((prev) => (prev !== total ? total : prev));
    } catch {
      // silent fail
    } finally {
      isRefreshingRef.current = false;
    }
  }, [me]);

  const refreshAppUpdate = useCallback(async () => {
    if (isCheckingUpdateRef.current) return;

    isCheckingUpdateRef.current = true;

    try {
      const result = await checkAppUpdate();
      setHasAppUpdate(!!result.hasUpdate);
    } catch {
      setHasAppUpdate(false);
    } finally {
      isCheckingUpdateRef.current = false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const appState = { current: AppState.currentState as AppStateStatus };

    const run = async () => {
      if (cancelled) return;
      await refreshUnread();
    };

    const stopInterval = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const startInterval = () => {
      stopInterval();
      intervalId = setInterval(run, 20000);
    };

    if (appState.current === "active") {
      run();
      startInterval();
    }

    const sub = AppState.addEventListener("change", (nextState) => {
      appState.current = nextState;

      if (nextState === "active") {
        run();
        startInterval();
      } else {
        stopInterval();
      }
    });

    return () => {
      cancelled = true;
      stopInterval();
      sub.remove();
    };
  }, [refreshUnread]);

  useEffect(() => {
    if (!me) return;
    refreshUnread();
  }, [me, refreshUnread]);

  useEffect(() => {
    refreshAppUpdate();

    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        refreshAppUpdate();
      }
    });

    return () => {
      sub.remove();
    };
  }, [refreshAppUpdate]);

  return (
    <Tabs
      initialRouteName="Pelekan"
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true, 
        tabBarShowLabel: true, // متن تب بارها
        tabBarLabelStyle: {
       fontSize: 11,
      },
        tabBarActiveTintColor: "#ffffff",
        tabBarInactiveTintColor: "rgba(255,255,255,0.45)",
        tabBarBackground: () => <TabBarGlassBackground />,
        tabBarStyle: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 74 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
          borderTopWidth: 0,
          backgroundColor: "transparent",
          elevation: 0,
          shadowOpacity: 0,
          overflow: "hidden",
        },
        tabBarItemStyle: {
          height: 62,
          justifyContent: "center",
          alignItems: "center",
          paddingVertical: 0,
          marginVertical: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="Pelekan"
        options={{
          title: "پلکان",
          tabBarIcon: ({ focused }) => (
            <TabIconBox
              focused={focused}
              source={require("../../assets/images/pelekan-icon.png")}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="Panahgah"
        options={{
          title: "پناهگاه",
          tabBarIcon: ({ focused }) => (
            <TabIconBox
              focused={focused}
              source={require("../../assets/images/panahgah-icon.png")}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="Mashaal"
        options={{
          title: "مشعل",
          tabBarIcon: ({ focused }) => (
            <TabIconBox
              focused={focused}
              source={require("../../assets/images/mashaal-icon.png")}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="Panah"
        options={{
          title: "پناه",
          tabBarIcon: ({ focused }) => (
            <TabIconBox
              focused={focused}
              source={require("../../assets/images/panah-icon.png")}
              badge={
                unreadCount > 0 ? (
                  <View
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 2,
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
                ) : null
              }
            />
          ),
        }}
      />

      <Tabs.Screen
        name="Rooznegar"
        options={{
          title: "روزنگار",
          tabBarIcon: ({ focused }) => (
            <TabIconBox
              focused={focused}
              source={require("../../assets/images/rooznegar-icon.png")}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="Phoenix"
        options={{
          title: "پروفایل",
          tabBarIcon: ({ focused }) => (
            <TabIconBox
              focused={focused}
              source={require("../../assets/images/phoenix-icon.png")}
              badge={
                hasAppUpdate ? (
                  <View
                    style={{
                      position: "absolute",
                      top: 2,
                      right: 1,
                      width: 16,
                      height: 16,
                      borderRadius: 8,
                      backgroundColor: "#D4AF37",
                      borderWidth: 1.5,
                      borderColor: "#0b0f14",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="arrow-up" size={10} color="#0b0f14" />
                  </View>
                ) : null
              }
            />
          ),
        }}
      />

      <Tabs.Screen
        name="Subscription"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="ReviewResult"
        options={{
          href: null,
          title: "نتیجه آزمون",
        }}
      />
      <Tabs.Screen
      name="mood-chart"
      options={{
      href: null,
      }}
     />
    </Tabs>
  );
}
