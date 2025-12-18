import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAnnouncements } from "../hooks/useAnnouncements";

type Props = {
  headerHeight?: number;
  /** ✅ فقط وقتی وارد اپ شدی و UI آماده بود true کن */
  enabled?: boolean;
};

type Tone = "info" | "warning" | "critical";
const AnimatedView = Animated.View as unknown as React.ComponentType<any>;

export default function TopBanner({ headerHeight = 64, enabled = false }: Props) {
  const insets = useSafeAreaInsets();

  // ✅ مهم: وقتی enabled=false هیچ fetch و هیچ render
  const { topBanners, markSeen, dismissLocal } = useAnnouncements({ enabled });

  const banner = topBanners?.[0] ?? null;

  const tone: Tone = useMemo(() => {
    if (!banner) return "info";
    if (banner.level === "critical") return "critical";
    if (banner.level === "warning") return "warning";
    return "info";
  }, [banner]);

  // ✅ زیر StatusBar + زیر Header
  const top = Math.max(0, insets.top + headerHeight + 8);

  const translateY = useRef(new Animated.Value(-18)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const [visibleId, setVisibleId] = useState<string | null>(null);
  const animatingRef = useRef(false);

  useEffect(() => {
    // اگر هنوز فعال نیستیم، هیچ چیز نشان نده
    if (!enabled) {
      setVisibleId(null);
      opacity.setValue(0);
      translateY.setValue(-18);
      return;
    }

    if (!banner) {
      setVisibleId(null);
      return;
    }

    if (visibleId !== banner.id) {
      setVisibleId(banner.id);
      translateY.setValue(-18);
      opacity.setValue(0);

      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, banner?.id]);

  async function closeWithAnim(opts: { seen?: boolean }) {
    if (!banner) return;
    if (animatingRef.current) return;

    animatingRef.current = true;

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -14,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(async () => {
      try {
        if (opts.seen) await markSeen(banner.id);
      } catch {}
      dismissLocal(banner.id);
      animatingRef.current = false;
      setVisibleId(null);
    });
  }

  // ✅ وقتی enabled نیست یا بنر نداریم، هیچی
  if (!enabled || !banner) return null;

  const accent = toneStyles[tone];

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top }]}>
      <AnimatedView
        style={{
          ...styles.container,
          opacity,
          transform: [{ translateY }],
        }}
      >
        <View style={[styles.card, { borderColor: accent.border }]}>
          {/* glow */}
          <View
            pointerEvents="none"
            style={[
              styles.glow,
              { borderColor: accent.glowBorder, shadowColor: accent.glowShadow },
            ]}
          />
          {/* accent line */}
          <View style={[styles.accent, { backgroundColor: accent.accent }]} />

          <View style={styles.row}>
            <View style={styles.textCol}>
              {banner.title ? (
                <Text numberOfLines={1} style={styles.title}>
                  {banner.title}
                </Text>
              ) : null}
              <Text numberOfLines={2} style={styles.msg}>
                {banner.message}
              </Text>
            </View>

            <View style={styles.actions}>
              {!banner.dismissible ? (
                <Pressable
                  onPress={() => closeWithAnim({ seen: true })}
                  style={({ pressed }) => [
                    styles.btn,
                    { borderColor: accent.btnBorder, backgroundColor: accent.btnBg },
                    pressed ? { opacity: 0.82 } : null,
                  ]}
                >
                  <Text style={styles.btnText}>متوجه شدم</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => closeWithAnim({ seen: false })}
                  style={({ pressed }) => [
                    styles.btnIcon,
                    pressed ? { opacity: 0.75 } : null,
                  ]}
                  hitSlop={10}
                >
                  <Text style={styles.x}>×</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </AnimatedView>
    </View>
  );
}

const toneStyles: Record<Tone, any> = {
  info: {
    border: "rgba(212,175,55,0.28)",
    accent: "rgba(212,175,55,0.95)",
    glowShadow: "rgba(212,175,55,0.55)",
    glowBorder: "rgba(212,175,55,0.10)",
    btnBg: "rgba(212,175,55,0.18)",
    btnBorder: "rgba(212,175,55,0.35)",
  },
  warning: {
    border: "rgba(233,138,21,0.30)",
    accent: "rgba(233,138,21,0.95)",
    glowShadow: "rgba(233,138,21,0.55)",
    glowBorder: "rgba(233,138,21,0.10)",
    btnBg: "rgba(233,138,21,0.18)",
    btnBorder: "rgba(233,138,21,0.35)",
  },
  critical: {
    border: "rgba(239,68,68,0.35)",
    accent: "rgba(239,68,68,0.98)",
    glowShadow: "rgba(239,68,68,0.55)",
    glowBorder: "rgba(239,68,68,0.10)",
    btnBg: "rgba(239,68,68,0.16)",
    btnBorder: "rgba(239,68,68,0.35)",
  },
};

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 9999,
  },
  container: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 520,
  },
  card: {
    backgroundColor: "rgba(11,15,20,0.94)",
    borderWidth: 1,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  glow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1,
    borderRadius: 18,
    shadowOpacity: Platform.OS === "android" ? 0.4 : 0.55,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
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
  },
  textCol: {
    flex: 1,
    alignItems: "flex-end",
    paddingLeft: 10,
  },
  title: {
    fontSize: 13,
    fontWeight: "900",
    color: "rgba(255,255,255,0.95)",
    marginBottom: 2,
    textAlign: "right",
  },
  msg: {
    fontSize: 12.2,
    fontWeight: "600",
    color: "rgba(255,255,255,0.82)",
    textAlign: "right",
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row-reverse",
    alignItems: "center",
  },
  btn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  btnText: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 12,
    fontWeight: "900",
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
    color: "rgba(255,255,255,0.86)",
    marginTop: Platform.OS === "android" ? -2 : 0,
  },
});