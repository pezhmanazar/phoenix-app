// app/pelekan/bastan/index.tsx
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

export default function BastanIndexRedirect() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // این صفحه فقط ورودی "مرحله بستن" است و همیشه باید برود به ویس
    router.replace("/pelekan/bastan/intro" as any);
  }, [router]);

  return (
    <SafeAreaView style={[styles.root, { paddingTop: insets.top }]} edges={["top", "left", "right"]}>
      {/* Glow ها */}
      <View pointerEvents="none" style={styles.glowTop} />
      <View pointerEvents="none" style={styles.glowBottom} />

      <View style={styles.center}>
        <ActivityIndicator color="#D4AF37" />
        <Text style={styles.muted}>در حال انتقال…</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b0f14" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: "rgba(231,238,247,.75)", marginTop: 10, fontSize: 12, textAlign: "center" },

  glowTop: {
    position: "absolute",
    top: -10,
    left: -80,
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: "rgba(212,175,55,.14)",
    transform: [{ rotate: "12deg" }],
  },
  glowBottom: {
    position: "absolute",
    bottom: -40,
    right: -90,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: "rgba(233,138,21,.10)",
    transform: [{ rotate: "-10deg" }],
  },
});