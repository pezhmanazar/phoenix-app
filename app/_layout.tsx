// app/_layout.tsx
import {
  DarkTheme,
  DefaultTheme,
  Theme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo } from "react";
import { StyleSheet, Text, TextInput } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PhoenixProvider, usePhoenix } from "../hooks/PhoenixContext";

// 🔌 Context modules
import * as AuthModule from "../hooks/useAuth";
import * as PlanModule from "../hooks/usePlanStatus";
import * as UserModule from "../hooks/useUser";

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
        <Stack.Screen name="splash" options={{ animation: "none" }} />
        <Stack.Screen name="gate" options={{ animation: "fade" }} />
        <Stack.Screen name="onboarding" options={{ animation: "fade" }} />
        <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
        <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
        <Stack.Screen name="pay/index" options={{ animation: "fade" }} />
        <Stack.Screen name="pay/result" options={{ animation: "fade" }} />
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

  useEffect(() => {
    SplashScreen.preventAutoHideAsync().catch(() => {});
    console.log("🟢 SPLASH PREVENT (SAFE)");
  }, []);

  useEffect(() => {
    if (!fontsLoaded) return;

    const pickFamily = (style: any) => {
      const s = StyleSheet.flatten(style) || {};
      const fw = String(s.fontWeight ?? "").trim();

      // اگر جایی fontFamily دستی ست شده، دست نزن
      if (s.fontFamily) return { family: s.fontFamily, forceNormalWeight: false };

      const w = parseInt(fw, 10);
      if (!Number.isNaN(w)) {
        if (w >= 700) return { family: "Anjoman-Bold", forceNormalWeight: true };
        if (w >= 500) return { family: "Anjoman-Medium", forceNormalWeight: true };
        return { family: "Anjoman-Regular", forceNormalWeight: true };
      }

      if (fw === "bold") return { family: "Anjoman-Bold", forceNormalWeight: true };

      return { family: "Anjoman-Regular", forceNormalWeight: true };
    };

    const patchRender = (Comp: any) => {
      const oldRender = Comp.render;
      Comp.render = function (...args: any[]) {
        const origin = oldRender.call(this, ...args);
        const { family, forceNormalWeight } = pickFamily(origin?.props?.style);

        return React.cloneElement(origin, {
          style: [
            origin.props.style,
            {
              fontFamily: family,
              ...(forceNormalWeight ? { fontWeight: "normal" } : null),
            },
          ],
        });
      };
    };

    patchRender(Text as any);
    patchRender(TextInput as any);

    // چون خودت prevent کردی، بعد از لود فونت‌ها آزادش کن
    SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

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