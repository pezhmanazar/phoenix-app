// app/notifications.tsx

import {
  AppNotification,
  getNotifications,
  hideNotification,
  hideReadNotifications,
  markNotificationRead,
} from "../api/notifications";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import AppBannerModal from "../components/ui/AppBannerModal";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  DeviceEventEmitter,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BACKEND_URL } from "../constants/backend";
import { useAuth } from "../hooks/useAuth";

function formatNotificationDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      timeZone: "Asia/Tehran",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return "";
  }
}

function getRoute(notification: AppNotification): string | null {
  const route = notification.data?.route;

  return typeof route === "string" && route.trim() ? route.trim() : null;
}

function getExternalUrl(notification: AppNotification): string | null {
  const externalUrl = notification.data?.externalUrl;

  if (typeof externalUrl !== "string" || !externalUrl.trim()) {
    return null;
  }

  const normalized = externalUrl.trim();

  if (!normalized.startsWith("https://") && !normalized.startsWith("http://")) {
    return null;
  }

  return normalized;
}

export default function NotificationsScreen() {
  const { token } = useAuth();

  const [items, setItems] = useState<AppNotification[]>([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [clearingRead, setClearingRead] = useState(false);

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const [feedback, setFeedback] = useState<{
    visible: boolean;
    kind: "success" | "error" | "warning" | "info";
    title: string;
    message: string;
  }>({
    visible: false,
    kind: "info",
    title: "",
    message: "",
  });

  const load = useCallback(async () => {
    try {
      setError("");

      const result = await getNotifications();

      setItems(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در دریافت اعلان‌ها");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(() => {
      void load();
    });

    return () => {
      subscription.remove();
    };
  }, [load]);

  const refresh = () => {
    setRefreshing(true);
    void load();
  };

  const markAsRead = useCallback(
    async (notification: AppNotification) => {
      const isSupportNotification = notification.type === "ticket_reply";

      const rawTicketId = notification.data?.ticketId;
      const ticketId =
        typeof rawTicketId === "string" && rawTicketId.trim()
          ? rawTicketId.trim()
          : null;

      /*
       * 1) اگر نوتیف مربوط به پناه است،
       * اول اعلان سیستم‌عامل را همان لحظه حذف کن.
       */
      if (isSupportNotification && ticketId) {
        const dismissPresented = async () => {
          try {
            const presented =
              await Notifications.getPresentedNotificationsAsync();

            const relatedPresented = presented.filter(
              (presentedNotification) => {
                const data = presentedNotification.request.content.data as {
                  type?: string;
                  ticketId?: string;
                  notificationId?: string;
                };

                return (
                  data?.type === "ticket_reply" &&
                  (String(data?.notificationId || "") ===
                    String(notification.id) ||
                    String(data?.ticketId || "") === ticketId)
                );
              },
            );

            await Promise.all(
              relatedPresented.map((presentedNotification) =>
                Notifications.dismissNotificationAsync(
                  presentedNotification.request.identifier,
                ),
              ),
            );
          } catch {
            // پاک نشدن tray نباید read state را خراب کند
          }
        };

        /*
         * بار اول فوری
         */
        await dismissPresented();

        /*
         * retry کوتاه برای بعضی دستگاه‌های Android/Samsung
         */
        await new Promise((resolve) => setTimeout(resolve, 150));
        await dismissPresented();
      }

      /*
       * 2) UI خود Notification Center فوراً read شود
       */
      setItems((prev) =>
        prev.map((item) =>
          item.id === notification.id
            ? {
                ...item,
                readAt: item.readAt || new Date().toISOString(),
              }
            : item,
        ),
      );

      try {
        /*
         * 3) خود Notification در Backend
         */
        await markNotificationRead(notification.id);

        /*
         * 4) فقط برای نوتیف‌های پناه،
         * پیام تیکت هم در Backend seen شود.
         */
        if (isSupportNotification && ticketId && token) {
          const res = await fetch(
            `${BACKEND_URL}/api/public/tickets/${encodeURIComponent(
              ticketId,
            )}?ts=${Date.now()}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Cache-Control": "no-store",
              },
            },
          );

          if (res.ok) {
            DeviceEventEmitter.emit("supportUnreadChanged");
          }
        }
      } catch (error) {
        console.warn("[notifications] mark read failed:", error);
      }
    },
    [token],
  );

  const hideOne = useCallback(async (notificationId: string) => {
    setDeletingId(notificationId);

    try {
      await hideNotification(notificationId);

      setItems((prev) =>
        prev.filter((notification) => notification.id !== notificationId),
      );

      setDeleteTargetId(null);
    } catch (error) {
      console.warn("[notifications] hide failed:", error);

      setFeedback({
        visible: true,
        kind: "error",
        title: "حذف انجام نشد",
        message: "در حذف اعلان مشکلی پیش آمد. دوباره تلاش کن.",
      });
    } finally {
      setDeletingId(null);
    }
  }, []);

  const clearRead = useCallback(async () => {
    setClearingRead(true);

    try {
      const hiddenCount = await hideReadNotifications();

      setItems((prev) => prev.filter((notification) => !notification.readAt));

      setClearConfirmOpen(false);

      setFeedback({
        visible: true,
        kind: "success",
        title: "پاکسازی انجام شد",
        message:
          hiddenCount > 0
            ? `${hiddenCount} اعلان خوانده‌شده از مرکز اعلان‌ها پاک شد.`
            : "اعلان خوانده‌شده‌ای برای پاکسازی وجود نداشت.",
      });
    } catch (error) {
      console.warn("[notifications] hide read failed:", error);

      setFeedback({
        visible: true,
        kind: "error",
        title: "پاکسازی انجام نشد",
        message: "در پاکسازی اعلان‌های خوانده‌شده مشکلی پیش آمد.",
      });
    } finally {
      setClearingRead(false);
    }
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        {items.some((item) => Boolean(item.readAt)) ? (
          <Pressable
            disabled={clearingRead}
            onPress={() => setClearConfirmOpen(true)}
            style={({ pressed }) => [
              styles.clearReadHeaderButton,
              pressed && { opacity: 0.7 },
              clearingRead && { opacity: 0.45 },
            ]}
          >
            {clearingRead ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <Ionicons name="trash-outline" size={21} color="#EF4444" />
            )}
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>اعلان‌های ققنوس</Text>
        </View>

        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-forward" size={23} color="#F4F4F5" />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />

          <Text style={styles.loadingText}>در حال دریافت اعلان‌ها...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} />
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
                <Text style={styles.retryText}>تلاش دوباره</Text>
              </Pressable>
            </View>
          ) : null}

          {!error && items.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>هنوز اعلانی نداری</Text>

              <Text style={styles.emptyText}>
                پیام‌ها و اطلاع‌رسانی‌های ققنوس اینجا نگهداری می‌شوند.
              </Text>
            </View>
          ) : null}

          {items.map((item) => {
            const route = getRoute(item);
            const externalUrl = getExternalUrl(item);

            return (
              <Pressable
                key={item.id}
                style={({ pressed }) => [
                  styles.card,
                  !item.readAt && styles.unreadCard,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={async () => {
                  await markAsRead(item);

                  if (externalUrl) {
                    try {
                      await Linking.openURL(externalUrl);
                    } catch (error) {
                      console.warn(
                        "[notifications] external url open failed:",
                        error,
                      );
                    }

                    return;
                  }

                  if (route) {
                    requestAnimationFrame(() => {
                      router.push(route as any);
                    });
                  }
                }}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.statusRow}>
                    <View style={styles.readStatusWrap}>
                      {!item.readAt ? (
                        <Pressable
                          onPress={async (event) => {
                            event.stopPropagation();
                            await markAsRead(item);
                          }}
                          style={styles.readButtonTop}
                        >
                          <Ionicons
                            name="checkmark-circle-outline"
                            size={14}
                            color="#D4AF37"
                          />

                          <Text style={styles.readButtonTopText}>خواندم</Text>
                        </Pressable>
                      ) : (
                        <>
                          <Pressable
                            disabled={deletingId === item.id}
                            onPress={(event) => {
                              event.stopPropagation();
                              setDeleteTargetId(item.id);
                            }}
                            style={({ pressed }) => [
                              styles.deleteButton,
                              pressed && { opacity: 0.7 },
                              deletingId === item.id && {
                                opacity: 0.45,
                              },
                            ]}
                          >
                            {deletingId === item.id ? (
                              <ActivityIndicator size="small" color="#9CA3AF" />
                            ) : (
                              <Ionicons
                                name="trash-outline"
                                size={14}
                                color="#9CA3AF"
                              />
                            )}
                          </Pressable>

                          <View style={styles.readBadge}>
                            <Ionicons
                              name="checkmark-done-outline"
                              size={13}
                              color="#6B7280"
                            />

                            <Text style={styles.readBadgeText}>خوانده‌شده</Text>
                          </View>
                        </>
                      )}
                    </View>

                    <View>
                      {!item.readAt ? (
                        <View style={styles.unreadBadge}>
                          <Text style={styles.unreadBadgeText}>جدید</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  <Text style={styles.title}>{item.title}</Text>

                  <Text style={styles.date}>
                    {formatNotificationDate(item.createdAt)}
                  </Text>
                </View>

                <Text style={styles.body}>{item.body}</Text>

                {route || externalUrl ? (
                  <View style={styles.routeButton}>
                    <Text style={styles.routeText}>
                      {externalUrl ? "باز کردن لینک" : "رفتن به بخش مرتبط"}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      <AppBannerModal
        visible={Boolean(deleteTargetId)}
        kind="warning"
        title="حذف اعلان"
        message="این اعلان فقط از مرکز اعلان‌های تو پاک می‌شود و دیگر در این صفحه نمایش داده نخواهد شد."
        closeText="لغو"
        confirmText="حذف"
        confirmKind="danger"
        confirmLoading={Boolean(deletingId)}
        onClose={() => {
          if (!deletingId) {
            setDeleteTargetId(null);
          }
        }}
        onConfirm={() => {
          if (deleteTargetId) {
            void hideOne(deleteTargetId);
          }
        }}
      />

      <AppBannerModal
        visible={clearConfirmOpen}
        kind="warning"
        title="پاک کردن اعلان‌های خوانده‌شده"
        message={`همه اعلان‌های خوانده‌شده از مرکز اعلان‌های تو پاک شوند؟`}
        closeText="لغو"
        confirmText="پاک کردن"
        confirmKind="danger"
        confirmLoading={clearingRead}
        onClose={() => {
          if (!clearingRead) {
            setClearConfirmOpen(false);
          }
        }}
        onConfirm={() => {
          void clearRead();
        }}
      />

      <AppBannerModal
        visible={feedback.visible}
        kind={feedback.kind}
        title={feedback.title}
        message={feedback.message}
        closeText="باشه"
        onClose={() =>
          setFeedback((prev) => ({
            ...prev,
            visible: false,
          }))
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0b0f14",
  },

  header: {
    height: 62,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,.07)",
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,.045)",
  },

  headerTitleWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },
  headerSpacer: {
    width: 42,
    height: 42,
  },

  clearReadHeaderButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239,68,68,.08)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,.20)",
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
  unreadCard: {
    borderColor: "rgba(212,175,55,.55)",
    backgroundColor: "#151b21",
  },

  unreadBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(212,175,55,.14)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,.35)",
  },

  unreadBadgeText: {
    color: "#D4AF37",
    fontSize: 10,
    fontWeight: "900",
  },

  statusRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  readBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(107,114,128,.10)",
    borderWidth: 1,
    borderColor: "rgba(107,114,128,.25)",
  },

  readBadgeText: {
    color: "#6B7280",
    fontSize: 10,
    fontWeight: "700",
  },
  readButtonTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(212,175,55,.12)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,.35)",
  },

  readButtonTopText: {
    color: "#D4AF37",
    fontSize: 10,
    fontWeight: "800",
  },

  readStatusWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(107,114,128,.25)",
    backgroundColor: "rgba(107,114,128,.08)",
    alignItems: "center",
    justifyContent: "center",
  },
});
