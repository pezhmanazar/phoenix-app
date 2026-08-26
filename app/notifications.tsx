// app/notifications.tsx

import {
  AppNotification,
  getNotifications,
} from "../api/notifications";
import { router } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function formatNotificationDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat(
      "fa-IR-u-ca-persian",
      {
        timeZone: "Asia/Tehran",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }
    ).format(date);
  } catch {
    return "";
  }
}

function getRoute(
  notification: AppNotification
): string | null {
  const route = notification.data?.route;

  return typeof route === "string" &&
    route.trim()
    ? route.trim()
    : null;
}

export default function NotificationsScreen() {
  const [items, setItems] = useState<
    AppNotification[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const load = useCallback(async () => {
    try {
      setError("");

      const result =
        await getNotifications();

      setItems(result);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "خطا در دریافت اعلان‌ها"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = () => {
    setRefreshing(true);
    void load();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>
            بازگشت
          </Text>
        </Pressable>

        <Text style={styles.headerTitle}>
          اعلان‌های ققنوس
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />

          <Text style={styles.loadingText}>
            در حال دریافت اعلان‌ها...
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={
            styles.content
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
            />
          }
        >
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>
                دریافت اعلان‌ها با خطا مواجه شد.
              </Text>

              <Pressable
                onPress={() => {
                  setLoading(true);
                  void load();
                }}
                style={styles.retryButton}
              >
                <Text style={styles.retryText}>
                  تلاش دوباره
                </Text>
              </Pressable>
            </View>
          ) : null}

          {!error && items.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>
                هنوز اعلانی نداری
              </Text>

              <Text style={styles.emptyText}>
                پیام‌ها و اطلاع‌رسانی‌های ققنوس
                اینجا نگهداری می‌شوند.
              </Text>
            </View>
          ) : null}

          {items.map((item) => {
            const route = getRoute(item);

            return (
              <View
                key={item.id}
                style={styles.card}
              >
                <View
                  style={
                    styles.cardHeader
                  }
                >
                  <Text
                    style={styles.title}
                  >
                    {item.title}
                  </Text>

                  <Text
                    style={styles.date}
                  >
                    {formatNotificationDate(
                      item.createdAt
                    )}
                  </Text>
                </View>

                <Text style={styles.body}>
                  {item.body}
                </Text>

                {route ? (
                  <Pressable
                    onPress={() =>
                      router.push(
                        route as any
                      )
                    }
                    style={
                      styles.routeButton
                    }
                  >
                    <Text
                      style={
                        styles.routeText
                      }
                    >
                      رفتن به بخش مرتبط
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0b0f14",
  },

  header: {
    minHeight: 58,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },

  backButton: {
    minWidth: 64,
    paddingVertical: 8,
  },

  backText: {
    color: "#d8a95c",
    fontSize: 13,
  },

  headerTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },

  headerSpacer: {
    width: 64,
  },

  content: {
    padding: 16,
    paddingBottom: 40,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },

  loadingText: {
    color: "#9ca3af",
    fontSize: 13,
  },

  card: {
    backgroundColor: "#111820",
    borderWidth: 1,
    borderColor: "#202936",
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
  },

  cardHeader: {
    gap: 5,
    marginBottom: 10,
  },

  title: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "right",
  },

  date: {
    color: "#7f8a99",
    fontSize: 11,
    textAlign: "right",
  },

  body: {
    color: "#d1d5db",
    fontSize: 14,
    lineHeight: 24,
    textAlign: "right",
  },

  routeButton: {
    marginTop: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#8b6b36",
    paddingVertical: 9,
    alignItems: "center",
  },

  routeText: {
    color: "#e5bd76",
    fontSize: 12,
    fontWeight: "700",
  },

  emptyBox: {
    paddingVertical: 70,
    alignItems: "center",
  },

  emptyTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },

  emptyText: {
    color: "#8b95a3",
    fontSize: 13,
    marginTop: 8,
    textAlign: "center",
  },

  errorBox: {
    borderWidth: 1,
    borderColor: "#7f1d1d",
    backgroundColor: "#2a0b10",
    padding: 14,
    borderRadius: 12,
  },

  errorText: {
    color: "#fecaca",
    textAlign: "center",
  },

  retryButton: {
    marginTop: 12,
    alignSelf: "center",
  },

  retryText: {
    color: "#e5bd76",
    fontWeight: "700",
  },
});