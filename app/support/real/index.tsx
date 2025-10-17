// app/support/real/index.tsx

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@react-navigation/native";
import { useRouter, Stack } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BACKEND_URL from "../../../constants/backend";

type Message = {
  id: string;
  text?: string | null;
  createdAt?: string;
  ts?: string;
};

type Ticket = {
  id: string;
  title: string;
  type: "tech" | "therapy";
  contact?: string | null; // 👈 برای نام کاربر
  messages?: Message[];
};

const STORE_KEY = "phoenix:defaultTickets";
const PROFILE_NAME_KEY = "phoenix:profileName";

const DEFAULT_TITLES: Record<Ticket["type"], string> = {
  tech: "پشتیبانی فنی ققنوس",
  therapy: "پشتیبانی درمانی ققنوس",
};

// تاریخ آخرین پیام
function formatTime(d?: string) {
  if (!d) return "";
  const date = new Date(d);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("fa-IR", { weekday: "short" });
}

function lastMessageInfo(t?: Ticket) {
  const msgs = t?.messages || [];
  if (!msgs.length) return { when: "", text: "" };
  const last = msgs[msgs.length - 1];
  return {
    when: formatTime(last.createdAt || last.ts),
    text: (last.text || "").trim(),
  };
}

// گرفتن نام کاربر از پروفایل یا کش
async function getProfileName(): Promise<string | null> {
  try {
    const cached = await AsyncStorage.getItem(PROFILE_NAME_KEY);
    if (cached) return cached;
  } catch {}

  const candidates = ["/api/me", "/api/profile", "/api/users/me"];
  for (const path of candidates) {
    try {
      const res = await fetch(`${BACKEND_URL}${path}`);
      if (!res.ok) continue;
      const js = await res.json();
      const name =
        js?.name ||
        js?.displayName ||
        js?.fullName ||
        js?.user?.name ||
        js?.profile?.name ||
        null;
      if (name) {
        try {
          await AsyncStorage.setItem(PROFILE_NAME_KEY, String(name));
        } catch {}
        return String(name);
      }
    } catch {}
  }
  return null;
}

export default function RealSupport() {
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tech, setTech] = useState<Ticket | null>(null);
  const [therapy, setTherapy] = useState<Ticket | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);

  const getTicket = async (id: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/tickets/${id}`);
      const js = await res.json();
      if (res.ok && js?.ok && js.ticket) return js.ticket as Ticket;
    } catch {}
    return null;
  };

  const createTicket = async (type: "tech" | "therapy", contact?: string | null) => {
    const payload = {
      title: DEFAULT_TITLES[type],
      type,
      contact: contact ?? undefined,
      description: "تیکت کاربر برای پشتیبانی ققنوس",
    };

    let res = await fetch(`${BACKEND_URL}/api/public/tickets`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    let js: any = null;
    try {
      js = await res.json();
    } catch {}
    if (res.ok && js?.ok && js.ticket) return js.ticket as Ticket;

    res = await fetch(`${BACKEND_URL}/api/tickets`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    try {
      js = await res.json();
    } catch {}
    if (res.ok && js?.ok && js.ticket) return js.ticket as Ticket;

    throw new Error(js?.error || "ticket_create_failed");
  };

  const ensureAndLoad = useCallback(async () => {
    setLoading(true);
    try {
      const [name, raw] = await Promise.all([
        getProfileName(),
        AsyncStorage.getItem(STORE_KEY),
      ]);
      setProfileName(name);

      let techId: string | undefined;
      let therapyId: string | undefined;
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          techId = parsed?.techId;
          therapyId = parsed?.therapyId;
        } catch {}
      }

      const [tTech, tTherapy] = await Promise.all([
        techId ? getTicket(techId) : Promise.resolve(null),
        therapyId ? getTicket(therapyId) : Promise.resolve(null),
      ]);

      if (tTech) setTech(tTech);
      if (tTherapy) setTherapy(tTherapy);
    } catch (e: any) {
      alert(e?.message || "خطا در آماده‌سازی پشتیبانی واقعی");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    ensureAndLoad();
  }, [ensureAndLoad]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const raw = await AsyncStorage.getItem(STORE_KEY);
      const ids = raw ? JSON.parse(raw) : {};
      const tTech = ids?.techId ? await getTicket(ids.techId) : tech;
      const tTherapy = ids?.therapyId ? await getTicket(ids.therapyId) : therapy;
      if (tTech) setTech(tTech);
      if (tTherapy) setTherapy(tTherapy);
    } finally {
      setRefreshing(false);
    }
  };

  const gotoOrCreate = async (type: "tech" | "therapy", existing: Ticket | null) => {
    try {
      let t = existing;
      if (!t) {
        t = await createTicket(type, profileName || null);
        const raw = (await AsyncStorage.getItem(STORE_KEY)) || "{}";
        let prev: any = {};
        try {
          prev = JSON.parse(raw);
        } catch {}
        const key = type === "tech" ? "techId" : "therapyId";
        prev[key] = t.id;
        await AsyncStorage.setItem(STORE_KEY, JSON.stringify(prev));
        if (type === "tech") setTech(t);
        else setTherapy(t);
      }
      router.push(`/support/tickets/${t.id}`);
    } catch (e: any) {
      alert(e?.message || "ساخت یا باز کردن تیکت ناموفق بود");
    }
  };

  // 👇 در این نسخه همیشه به‌جای عنوان، نام کاربر را نمایش می‌دهیم
  const Cell = ({
    t,
    type,
    iconName,
    iconColor,
    subtitleText,
  }: {
    t: Ticket | null;
    type: "tech" | "therapy";
    iconName: any;
    iconColor: string;
    subtitleText: string;
  }) => {
    const info = lastMessageInfo(t || undefined);
    const subtitle = info.text ? info.text : "—";

    const displayTitle =
      (t?.contact && String(t.contact).trim()) ||
      (profileName && String(profileName).trim()) ||
      DEFAULT_TITLES[type];

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={[
          styles.cell,
          { borderColor: colors.border, backgroundColor: colors.card },
        ]}
        onPress={() => gotoOrCreate(type, t)}
      >
        <View style={styles.row}>
          <Ionicons name={iconName} size={22} color={iconColor} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {displayTitle}
            </Text>
            <Text
              style={[styles.subtitle, { color: dark ? "#8E8E93" : "#6b7280" }]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          </View>
          <Text style={[styles.time, { color: dark ? "#8E8E93" : "#6b7280" }]}>
            {info.when}
          </Text>
        </View>
        <Text
          style={[
            styles.description,
            { color: dark ? "#bdbdbd" : "#6b7280" },
          ]}
        >
          {subtitleText}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView
      style={[
        styles.root,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <View
        style={[
          styles.headerBar,
          { backgroundColor: colors.background, borderBottomColor: colors.border },
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

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.text} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 14 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* درمانی */}
          <Cell
            t={therapy}
            type="therapy"
            iconName="person"
            iconColor="#A855F7"
            subtitleText="در صورت نیاز به ارتباط با یک روان‌درمانگر، سؤال یا پیام خودت را به این چت بفرست."
          />

          {/* فنی */}
          <Cell
            t={tech}
            type="tech"
            iconName="bug"
            iconColor="#F59E0B"
            subtitleText="در صورت هر گونه مشکل یا سؤال در استفاده از برنامه، پیام خودت را به این چت بفرست."
          />
        </ScrollView>
      )}
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
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },

  cell: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontWeight: "900", fontSize: 15 },
  subtitle: { marginTop: 2, fontSize: 12, textAlign: "right" },
  time: { marginLeft: 6, fontSize: 12 },
  description: {
    fontSize: 12,
    marginTop: 8,
    textAlign: "right",
    lineHeight: 18,
  },
});