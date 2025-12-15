// app/_layout.tsx
import {
  DarkTheme,
  DefaultTheme,
  Theme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo } from "react";
import { Text, TextInput } from "react-native";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";

import { PhoenixProvider, usePhoenix } from "../hooks/PhoenixContext";
import { SafeAreaProvider } from "react-native-safe-area-context";

// 🔌 Context modules
import * as AuthModule from "../hooks/useAuth";
import * as UserModule from "../hooks/useUser";
import * as PlanModule from "../hooks/usePlanStatus";

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
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        {/* ✅ Splash route */}
        <Stack.Screen name="splash" />

        {/* ✅ Gate route (همون index فعلی‌ات رو منتقل می‌کنیم به gate) */}
        <Stack.Screen name="gate" />

        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />

        {/* ✅ pay درست */}
        <Stack.Screen name="pay/index" />
        <Stack.Screen name="pay/result" />

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

/* ---------------- Root Layout ---------------- */

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "Anjoman-Regular": require("../assets/fonts/Anjoman-Regular.ttf"),
    "Anjoman-Medium": require("../assets/fonts/Anjoman-Medium.ttf"),
    "Anjoman-Bold": require("../assets/fonts/Anjoman-Bold.ttf"),
  });

  // ✅ امن: بعد از mount شدن runtime — فقط prevent، نه hide
  useEffect(() => {
    SplashScreen.preventAutoHideAsync().catch(() => {});
    console.log("🟢 SPLASH PREVENT (SAFE)");
  }, []);

  // فونت پیش‌فرض برای Text / TextInput
  useEffect(() => {
    if (!fontsLoaded) return;

    const oldTextRender = (Text as any).render;
    (Text as any).render = function (...args: any[]) {
      const origin = oldTextRender.call(this, ...args);
      return React.cloneElement(origin, {
        style: [{ fontFamily: "Anjoman-Regular" }, origin.props.style],
      });
    };

    const oldInputRender = (TextInput as any).render;
    (TextInput as any).render = function (...args: any[]) {
      const origin = oldInputRender.call(this, ...args);
      return React.cloneElement(origin, {
        style: [{ fontFamily: "Anjoman-Regular" }, origin.props.style],
      });
    };
  }, [fontsLoaded]);

  // تا آماده شدن فونت‌ها چیزی رندر نشود (Native splash می‌ماند)
  if (!fontsLoaded) return null;

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