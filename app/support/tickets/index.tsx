// app/support/tickets/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@react-navigation/native";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  I18nManager,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BACKEND_URL from "../../../constants/backend";
import { useUser } from "../../../hooks/useUser";

type Ticket = {
  id: string;
  title: string;
  description: string;
  contact?: string | null;
  status: "open" | "pending" | "closed";
  type: "tech" | "therapy";
  createdAt: string;
  updatedAt: string;
};

type TicketType = "tech" | "therapy";

export default function TicketList() {
  const { colors } = useTheme();
  const router = useRouter();
  const rtl = I18nManager.isRTL;
  const { me } = useUser();

  const [data, setData] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [opening, setOpening] = useState<TicketType | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/tickets`);
      const json = await res.json();
      if (json?.ok) {
        const sorted: Ticket[] = (json.tickets || [])
          .slice()
          .sort(
            (a: Ticket, b: Ticket) =>
              new Date(b.createdAt).getTime() -
              new Date(a.createdAt).getTime()
          );
        setData(sorted);
      }
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData();
    }, [fetchData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

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

  const renderItem = ({ item }: { item: Ticket }) => {
    const statusColor =
      item.status === "closed"
        ? "#22C55E"
        : item.status === "pending"
        ? "#F59E0B"
        : colors.primary;
    const typeLabel = item.type === "therapy" ? "درمانگر" : "فنی";
    const typeColor = item.type === "therapy" ? "#A855F7" : "#3B82F6";
    return (
      <TouchableOpacity
        onPress={() => router.push(`/support/tickets/${item.id}`)}
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            flexDirection: rtl ? "row-reverse" : "row",
          },
        ]}
        activeOpacity={0.85}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name="pricetags-outline" size={18} color={colors.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{ color: colors.text, fontWeight: "800" }}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <Text style={{ color: "#8E8E93", fontSize: 12 }} numberOfLines={1}>
            {item.description}
          </Text>
        </View>
        <View
          style={{
            alignItems: rtl ? "flex-start" : "flex-end",
            gap: 6,
          }}
        >
          {/* وضعیت */}
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: statusColor + "22",
            }}
          >
            <Text
              style={{ color: statusColor, fontSize: 11, fontWeight: "800" }}
            >
              {item.status === "open"
                ? "باز"
                : item.status === "pending"
                ? "در انتظار"
                : "بسته"}
            </Text>
          </View>
          {/* نوع تیکت */}
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: typeColor + "22",
            }}
          >
            <Text
              style={{ color: typeColor, fontSize: 11, fontWeight: "800" }}
            >
              {typeLabel}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const HeaderActions = ({
    onOpen,
  }: {
    onOpen: (type: TicketType) => void;
  }) => (
    <View style={[styles.actionsRow, { direction: rtl ? "rtl" : "ltr" }]}>
      <TouchableOpacity
        onPress={() => onOpen("tech")}
        style={[
          styles.actionChip,
          { borderColor: "#2563EB33", backgroundColor: "#2563EB22" },
        ]}
        activeOpacity={0.9}
        disabled={opening === "tech"}
      >
        <Ionicons name="hardware-chip-outline" size={16} color="#93C5FD" />
        <Text style={styles.actionText}>
          {opening === "tech" ? "در حال باز کردن…" : "پشتیبانی فنی"}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => onOpen("therapy")}
        style={[
          styles.actionChip,
          { borderColor: "#7C3AED33", backgroundColor: "#7C3AED22" },
        ]}
        activeOpacity={0.9}
        disabled={opening === "therapy"}
      >
        <Ionicons name="heart-circle-outline" size={16} color="#D8B4FE" />
        <Text style={styles.actionText}>
          {opening === "therapy" ? "در حال باز کردن…" : "ارتباط با درمانگر"}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator />
          <Text style={{ color: "#8E8E93", marginTop: 8 }}>
            در حال بارگذاری…
          </Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{
            padding: 16,
            gap: 10,
            direction: rtl ? "rtl" : "ltr",
          }}
          ListHeaderComponent={
            <HeaderActions onOpen={openOrCreateTicket} />
          }
          data={data}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View
              style={[
                styles.empty,
                { borderColor: colors.border, backgroundColor: colors.card },
              ]}
            >
              <Ionicons name="mail-unread-outline" size={22} color="#8E8E93" />
              <Text style={{ color: "#8E8E93", marginTop: 6 }}>
                هنوز تیکتی ثبت نشده.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 12,
    alignItems: "center",
  },
  empty: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 10,
  },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
  },
  actionText: { color: "#E5E7EB", fontWeight: "800", fontSize: 13 },
});