import React, { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAnnouncements } from "../hooks/useAnnouncements";

type Props = {
  // ارتفاع هدرهای داخل اپت (تقریبی). اگر بعدا خواستی دقیقش کنیم، اندازه‌گیری می‌کنیم.
  headerHeight?: number;
};

export default function TopBanner({ headerHeight = 64 }: Props) {
  const insets = useSafeAreaInsets();
  const { topBanners, markSeen, dismissLocal } = useAnnouncements();

  // فقط اولین بنر با بالاترین priority
  const banner = topBanners?.[0] ?? null;

  // اگر چیزی نیست، هیچ
  if (!banner) return null;

  const tone = useMemo(() => {
    if (banner.level === "critical") return "critical";
    if (banner.level === "warning") return "warning";
    return "info";
  }, [banner.level]);

  const top = insets.top + headerHeight; // ✅ زیر StatusBar + زیر Header

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top }]}>
      <View style={[styles.card, toneStyles[tone].card]}>
        {/* نوار accent بالا */}
        <View style={[styles.accent, toneStyles[tone].accent]} />

        <View style={styles.row}>
          <View style={styles.textCol}>
            {!!banner.title ? (
              <Text numberOfLines={1} style={styles.title}>
                {banner.title}
              </Text>
            ) : null}

            <Text numberOfLines={2} style={styles.msg}>
              {banner.message}
            </Text>
          </View>

          <View style={styles.actions}>
            {/* دکمه خواندم */}
            <Pressable
              onPress={async () => {
                // اجباری‌ها (dismissible=false) باید seen شوند تا دیگر نیایند
                await markSeen(banner.id);
                // و همون لحظه از UI جمع شود
                dismissLocal(banner.id);
              }}
              style={({ pressed }) => [
                styles.btn,
                styles.btnPrimary,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={styles.btnTextPrimary}>خواندم</Text>
            </Pressable>

            {/* دکمه بستن فقط اگر dismissible=true */}
            {banner.dismissible ? (
              <Pressable
                onPress={() => dismissLocal(banner.id)}
                style={({ pressed }) => [
                  styles.btnIcon,
                  pressed && { opacity: 0.7 },
                ]}
                hitSlop={10}
              >
                <Text style={styles.x}>×</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

const toneStyles = {
  info: StyleSheet.create({
    card: { borderColor: "rgba(212,175,55,0.28)" },
    accent: { backgroundColor: "rgba(212,175,55,0.85)" },
  }),
  warning: StyleSheet.create({
    card: { borderColor: "rgba(233,138,21,0.30)" },
    accent: { backgroundColor: "rgba(233,138,21,0.90)" },
  }),
  critical: StyleSheet.create({
    card: { borderColor: "rgba(239,68,68,0.35)" },
    accent: { backgroundColor: "rgba(239,68,68,0.95)" },
  }),
};

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 9999,
  },
  card: {
    backgroundColor: "rgba(11,15,20,0.92)", // #0b0f14
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",

    // حس گلس
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },

    elevation: 8,
  },
  accent: {
    height: 3,
    width: "100%",
  },
  row: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  textCol: {
    flex: 1,
    alignItems: "flex-end",
  },
  title: {
    fontSize: 13,
    fontWeight: "800",
    color: "rgba(255,255,255,0.95)",
    marginBottom: 2,
    textAlign: "right",
  },
  msg: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.80)",
    textAlign: "right",
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  btn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  btnPrimary: {
    backgroundColor: "rgba(212,175,55,0.22)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)",
  },
  btnTextPrimary: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 12,
    fontWeight: "800",
  },
  btnIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  x: {
    fontSize: 22,
    lineHeight: 22,
    fontWeight: "900",
    color: "rgba(255,255,255,0.85)",
    marginTop: Platform.OS === "android" ? -2 : 0,
  },
});