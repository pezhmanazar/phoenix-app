// app/(tabs)/_layout.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Tabs } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  AppStateStatus,
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
        backgroundColor: "rgba(8,10,18,0.88)",
        borderTopWidth: 0.7,
        borderTopColor: "rgba(255,255,255,0.10)",
        overflow: "hidden",
      }}
    >
      {/* glow طلایی سمت چپ */}
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

      {/* glow نارنجی سمت راست */}
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

      {/* لایه‌ی شیشه‌ای خیلی ملایم */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(255,255,255,0.025)",
        }}
      />
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

  // mount + هر 20 ثانیه + برگشت از background
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
      // تغییر سایز تب بار //
     screenOptions={{
  headerShown: false,
  tabBarHideOnKeyboard: true,

  tabBarActiveTintColor: "#ffffff",
  tabBarInactiveTintColor: "rgba(255,255,255,0.45)",

  tabBarBackground: () => <TabBarGlassBackground />,

  tabBarStyle: {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  height: 62 + insets.bottom, // قبلاً 56 بود
  paddingTop: 6,              // قبلاً 4 بود
  paddingBottom: insets.bottom > 0 ? insets.bottom : 8, // قبلاً 6 بود
  borderTopWidth: 0,
  backgroundColor: "transparent",
  elevation: 0,
  shadowOpacity: 0,
  overflow: "hidden",
},

tabBarItemStyle: {
  height: 56, // قبلاً 50 بود
  justifyContent: "center",
  alignItems: "center",
  paddingVertical: 0,
  marginVertical: 0,
},

tabBarLabelStyle: {
  fontSize: 10,
  fontWeight: "600",
  marginTop: 1,   // قبلاً 0 بود
  marginBottom: 2,
  lineHeight: 12,
  textAlign: "center",
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
            <Ionicons name="calendar-outline" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
  name="Phoenix"
  options={{
    title: "پروفایل",
    tabBarIcon: ({ color, size }) => (
      <View style={{ position: "relative" }}>
        <Ionicons name="person-circle-outline" color={color} size={size} />

        {hasAppUpdate && (
  <View
    style={{
      position: "absolute",
      top: -6,
      right: -8,
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
)}
      </View>
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
    href: null, // ✅ مخفی در تب‌بار
    title: "نتیجه آزمون",
  }}
/>
    </Tabs>
  );
}