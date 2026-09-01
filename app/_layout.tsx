// app/_layout.tsx
import {
  DarkTheme,
  DefaultTheme,
  Theme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo } from "react";
import {
  I18nManager,
  Linking,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PhoenixProvider, usePhoenix } from "../hooks/PhoenixContext";
// 🔌 Context modules
import * as Notifications from "expo-notifications";
import * as AuthModule from "../hooks/useAuth";
import * as PlanModule from "../hooks/usePlanStatus";
import * as UserModule from "../hooks/useUser";
import { getPaymentProvider } from "../lib/payments/getPaymentProvider";
import {
  markNotificationOpened,
  markNotificationRead,
} from "../api/notifications";
import NotificationPermissionGate from "../components/notifications/NotificationPermissionGate";
import XpJourneyWatcher from "../components/xp/XpJourneyWatcher";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/* ---------------- Providers ---------------- */
const AuthProviderWrapper: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const Comp =
    (AuthModule as any).AuthProvider ??
    (AuthModule as any).default ??
    React.Fragment;
  return <Comp>{children}</Comp>;
};
const UserProviderWrapper: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const Comp =
    (UserModule as any).UserProvider ??
    (UserModule as any).default ??
    React.Fragment;
  return <Comp>{children}</Comp>;
};
const PlanStatusProviderWrapper: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const Comp =
    (PlanModule as any).PlanStatusProvider ??
    (PlanModule as any).default ??
    React.Fragment;
  return <Comp>{children}</Comp>;
};
/* ---------------- Navigation ---------------- */
function RootStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="gate" options={{ animation: "fade" }} />
      <Stack.Screen name="onboarding" options={{ animation: "fade" }} />
      <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
      <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
      <Stack.Screen name="modal" options={{ presentation: "modal" }} />
    </Stack>
  );
}
function ThemeBridge() {
  const { navTheme, isDark } = usePhoenix();
  const theme: Theme = useMemo(
    () => navTheme ?? (isDark ? DarkTheme : DefaultTheme),
    [navTheme, isDark],
  );
  return (
    <ThemeProvider value={theme}>
      <StatusBar style="auto" />
      <RootStack />
    </ThemeProvider>
  );
}
/* ---------------- Root Layout ---------------- */
export default function RootLayout() {


  useEffect(() => {
    if (I18nManager.isRTL) {
      I18nManager.allowRTL(false);
      I18nManager.forceRTL(false);
    }
  }, []);

  useEffect(() => {
    SplashScreen.preventAutoHideAsync().catch(() => {});
  }, []);

  useEffect(() => {
  SplashScreen.hideAsync().catch(() => {});
}, []);

  useEffect(() => {
    (async () => {
      await getPaymentProvider();
    })();
  }, []);

  useEffect(() => {
    const handledResponseIds = new Set<string>();

    const handleNotificationResponse = async (
      response: Notifications.NotificationResponse,
    ) => {
      const requestId = response.notification.request.identifier;

      // جلوگیری از پردازش دوباره همان tap
      if (requestId && handledResponseIds.has(requestId)) {
        return;
      }

      if (requestId) {
        handledResponseIds.add(requestId);
      }

      const data = response.notification.request.content.data as {
        type?: string;
        ticketId?: string;
        route?: string;
        externalUrl?: string;
        notificationId?: string;
      };

      // ثبت Open واقعی Push
      if (
        typeof data?.notificationId === "string" &&
        data.notificationId.trim()
      ) {
        const notificationId = data.notificationId.trim();

        try {
          await Promise.all([
            markNotificationOpened(notificationId),
            markNotificationRead(notificationId),
          ]);
        } catch (error) {
          console.warn(
            "[notifications] mark opened/read failed:",
            error instanceof Error ? error.message : error,
          );
        }
      }

      // پاسخ درمانگر
      if (data?.type === "ticket_reply" && data?.ticketId) {
        router.push(`/support/tickets/${data.ticketId}`);

        return;
      }

      // لینک خارجی
      if (typeof data?.externalUrl === "string" && data.externalUrl.trim()) {
        const externalUrl = data.externalUrl.trim();

        if (
          externalUrl.startsWith("https://") ||
          externalUrl.startsWith("http://")
        ) {
          try {
            await Linking.openURL(externalUrl);
          } catch (error) {
            console.warn(
              "[notifications] external url open failed:",
              error instanceof Error ? error.message : error,
            );
          }

          return;
        }
      }

      // مقصد عمومی
      if (typeof data?.route === "string" && data.route.trim()) {
        router.push(data.route as any);
      }
    };

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        void handleNotificationResponse(response);
      },
    );

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          void handleNotificationResponse(response);
        }
      })
      .catch((error) => {
        console.warn(
          "[notifications] last response failed:",
          error instanceof Error ? error.message : error,
        );
      });

    return () => {
      subscription.remove();
    };
  }, []);
  return (
    <SafeAreaProvider>
      <PhoenixProvider>
        <AuthProviderWrapper>
          <UserProviderWrapper>
            <PlanStatusProviderWrapper>
              <NotificationPermissionGate />
              <XpJourneyWatcher />
              <ThemeBridge />
            </PlanStatusProviderWrapper>
          </UserProviderWrapper>
        </AuthProviderWrapper>
      </PhoenixProvider>
    </SafeAreaProvider>
  );
}
