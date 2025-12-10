// app/support/real/index.tsx
import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@react-navigation/native";
import { useRouter, Stack } from "expo-router";
import BACKEND_URL from "../../../constants/backend";
import { useUser } from "../../../hooks/useUser";

const DEFAULT_TITLES = {
  tech: "پشتیبانی فنی ققنوس",
  therapy: "پشتیبانی درمانی ققنوس",
} as const;

type TicketType = "tech" | "therapy";

export default function RealSupport() {
  const { colors, dark } = useTheme();
  const router = useRouter();
  const { me } = useUser();
  const [opening, setOpening] = useState<TicketType | null>(null);

  const openOrCreateTicket = useCallback(
    async (type: TicketType) => {
      if (!me?.phone && !me?.id) {
        Alert.alert(
          "نیاز به پروفایل",
          "برای استفاده از پشتیبانی، ابتدا باید شماره موبایل و نامت در پروفایل ققنوس تکمیل شده باشد."
        );
        return;
      }

      const phone = me.phone || "";
      const openedById = me.id || phone || "";
      const openedByName = (me.fullName || phone || "کاربر").trim() || "کاربر";

      setOpening(type);
      try {
        const res = await fetch(
          `${BACKEND_URL}/api/public/tickets/open-or-create`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              type,
              openedById,
              openedByName,
              contact: phone || openedById,
            }),
          }
        );

        let json: any = null;
        try {
          json = await res.json();
        } catch {
          json = null;
        }

        // اگر دسترسی درمانگر به خاطر پلن بلاک شد، بفرست روی صفحه لاک‌شده
        if (res.status === 403 && json?.error === "therapy_requires_pro") {
          router.push("/support/tickets/therapy");
          return;
        }

        if (!res.ok || !json?.ok || !json.ticket?.id) {
          throw new Error(
            typeof json?.error === "string"
              ? json.error
              : "باز کردن چت ناموفق بود."
          );
        }

        const ticketId = String(json.ticket.id);
        router.push(`/support/tickets/${ticketId}`);
      } catch (e: any) {
        Alert.alert(
          "خطا",
          e?.message || "در باز کردن گفت‌وگو مشکلی پیش آمد. دوباره تلاش کن."
        );
      } finally {
        setOpening(null);
      }
    },
    [me, router]
  );

  const Cell = ({
    type,
    iconName,
    iconColor,
    subtitleText,
  }: {
    type: TicketType;
    iconName: any;
    iconColor: string;
    subtitleText: string;
  }) => {
    const title = DEFAULT_TITLES[type];
    const isLoading = opening === type;

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={[
          styles.cell,
          { borderColor: colors.border, backgroundColor: colors.card },
        ]}
        onPress={() => openOrCreateTicket(type)}
        disabled={isLoading}
      >
        <View style={styles.row}>
          <Ionicons name={iconName} size={22} color={iconColor} />
          <View style={{ flex: 1 }}>
            <Text
              style={[styles.title, { color: colors.text }]}
              numberOfLines={1}
            >
              {title}
            </Text>
            <Text
              style={[
                styles.subtitle,
                { color: dark ? "#8E8E93" : "#6b7280" },
              ]}
              numberOfLines={1}
            >
              {/* فعلاً آخرین پیام نداریم، فقط یک خط راهنما */}
              —
            </Text>
          </View>
          {/* جای ساعت / لودر */}
          <View
            style={{
              width: 40,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : null}
          </View>
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
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* هدر */}
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

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        {/* درمانی */}
        <Cell
          type="therapy"
          iconName="person"
          iconColor="#A855F7"
          subtitleText="در صورت نیاز به ارتباط با یک روان‌درمانگر، سؤال یا پیام خودت را به این چت بفرست."
        />
        {/* فنی */}
        <Cell
          type="tech"
          iconName="bug"
          iconColor="#F59E0B"
          subtitleText="در صورت هر گونه مشکل یا سؤال در استفاده از برنامه، پیام خودت را به این چت بفرست."
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