// app/splash.tsx
import React, { useEffect, useRef } from "react";
import { View, Text, Image, StyleSheet, Animated } from "react-native";
import { useRouter } from "expo-router";

type Props = {
  // اگر خواستی جایی دستی مجبورش کنی نمایش بده (فعلاً لازم نیست)
  forceShow?: boolean;
  // مدت نمایش (میلی‌ثانیه)
  durationMs?: number;
  // مقصد بعد از اسپلش (اگر نخوای اینجا روت کنی، می‌تونی خاموشش کنی)
  nextRoute?: string;
};

const LOGO = require("../assets/images/logo.png");

export default function Splash({
  forceShow = false,
  durationMs = 900,
  nextRoute,
}: Props) {
  const router = useRouter();

  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    // انیمیشن ورود
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

    // اگر خواستی بعد از مدت مشخص روت کنه
    if (nextRoute && !forceShow) {
      const t = setTimeout(() => {
        router.replace(nextRoute as any);
      }, durationMs);
      return () => clearTimeout(t);
    }
  }, [durationMs, forceShow, nextRoute, opacity, router, scale]);

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.center, { opacity, transform: [{ scale }] }]}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        {/* اگر واقعاً خواستی متن برند هم زیرش باشه، اینو از کامنت دربیار */}
        {/* <Text style={styles.brand}>Qoqnoos</Text> */}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0b0c10",
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
  brand: {
    marginTop: 14,
    fontSize: 20,
    color: "#D4AF37",
    fontWeight: "800",
  },
});