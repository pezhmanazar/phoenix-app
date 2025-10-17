// app/_layout.tsx
import { DarkTheme, DefaultTheme, Theme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useMemo } from "react";
import { PhoenixProvider, usePhoenix } from "../hooks/PhoenixContext";
import { SafeAreaProvider } from "react-native-safe-area-context";

// ⬇️ اضافه‌ها برای رجیستر سرویس
import { Platform } from "react-native";
import TrackPlayer from "react-native-track-player";

// ⚠️ رجیستر باید در اسکوپ ماژول و فقط روی native انجام شود
if (Platform.OS !== "web") {
  // اگر service.js در ریشهٔ پروژه است و این فایل داخل /app است، مسیر زیر درسته:
  // @ts-ignore - service.js ما CommonJS است و تایپ ندارد
  TrackPlayer.registerPlaybackService(() => require("../service"));
}

function RootStack() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
        <ThemeBridge />
      </PhoenixProvider>
    </SafeAreaProvider>
  );
}