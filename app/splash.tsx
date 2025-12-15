// app/splash.tsx
import React, { useEffect, useRef } from "react";
import { View, Image, StyleSheet, Animated } from "react-native";
import { useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";

const LOGO = require("../assets/images/logo.png");

type Props = {
  durationMs?: number;
  nextRoute?: string;
};

export default function Splash({
  durationMs = 900,
  nextRoute = ("/gate"),
}: Props) {
  const router = useRouter();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    // 1) انیمیشن ورود
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();

    // 2) بعد از مدت مشخص: اول اسپلش نیتیو را ببند، بعد روت کن
    const t = setTimeout(async () => {
      try {
        await SplashScreen.hideAsync();
      } catch {}
      router.replace(nextRoute as any);
    }, durationMs);

    return () => clearTimeout(t);
  }, [durationMs, nextRoute, opacity, router, scale]);

  return (
    <View style={styles.root}>
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