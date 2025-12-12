// app/_layout.tsx
import {
  DarkTheme,
  DefaultTheme,
  Theme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useMemo } from "react";
import { PhoenixProvider, usePhoenix } from "../hooks/PhoenixContext";
import { SafeAreaProvider } from "react-native-safe-area-context";
// ⚠️ فعلاً ترک‌پلیر غیرفعال
// import TrackPlayer from "react-native-track-player";
// if (Platform.OS !== "web") {
//   // @ts-ignore
//   TrackPlayer.registerPlaybackService(() => require("../service"));
// }

// 🔌 ماژول‌های کانتکست‌ها
import * as AuthModule from "../hooks/useAuth";
import * as UserModule from "../hooks/useUser";
import * as PlanModule from "../hooks/usePlanStatus";

/**
 * این سه تا Wrapper باعث می‌شن اگر:
 *  - AuthProvider / UserProvider / PlanStatusProvider به صورت named export باشن، هم کار کنه
 *  - یا اگر default export باشن، باز هم کار کنه
 *  - و اگر به هر دلیلی پیدا نشدن، حداقل بچه‌ها بدون خطا رندر بشن
 */
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

function RootStack() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
  <Stack.Screen name="(auth)" options={{ headerShown: false }} />
  <Stack.Screen name="pay" options={{ headerShown: false }} />
  <Stack.Screen name="modal" options={{ presentation: "modal" }} />
</Stack>
    </>
  );
}

function ThemeBridge() {
  const { navTheme, isDark } = usePhoenix();
  const theme: Theme = useMemo(
    () => navTheme ?? (isDark ? DarkTheme : DefaultTheme),
    [navTheme, isDark]
  );
  return (
    <ThemeProvider value={theme}>
      <RootStack />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PhoenixProvider>
        <AuthProviderWrapper>
          <UserProviderWrapper>
            <PlanStatusProviderWrapper>
              <ThemeBridge />
            </PlanStatusProviderWrapper>
          </UserProviderWrapper>
        </AuthProviderWrapper>
      </PhoenixProvider>
    </SafeAreaProvider>
  );
}