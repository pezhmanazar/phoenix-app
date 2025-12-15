// app/splash.tsx
import React, { useEffect, useRef, useCallback } from "react";
import { View, Image, StyleSheet, Animated } from "react-native";
import { useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";

const LOGO = require("../assets/images/logo-splash.png");

type Props = {
  durationMs?: number;
  nextRoute?: string;
};

export default function Splash({ durationMs = 900, nextRoute = "/gate" }: Props) {
  const router = useRouter();

  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  // برای اینکه hide و navigate دوبار اجرا نشه
  const didStart = useRef(false);
  const didHideNative = useRef(false);

  // ✅ مهم‌ترین بخش ضد چشمک: فقط وقتی این صفحه واقعاً رندر/چیدمان شد، اسپلش نیتیو رو hide کن
  const onLayoutRoot = useCallback(async () => {
    if (didHideNative.current) return;
    didHideNative.current = true;
    try {
      await SplashScreen.hideAsync();
    } catch {}
  }, []);

  useEffect(() => {
    if (didStart.current) return;
    didStart.current = true;

    // ورود نرم
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();

    // خروج نرم + ناوبری
    const t = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        // یک فریم فرصت برای جلوگیری از پرش
        requestAnimationFrame(() => {
          router.replace(nextRoute as any);
        });
      });
    }, durationMs);

    return () => clearTimeout(t);
  }, [durationMs, nextRoute, opacity, router, scale]);

  return (
    <View style={styles.root} onLayout={onLayoutRoot}>
      <Animated.View style={[styles.center, { opacity, transform: [{ scale }] }]}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0b0f14",
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 160,
    height: 160,
  },
});