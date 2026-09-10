// components/pelekan/IdlePlaceholder.tsx

import { useAuth } from "@/hooks/useAuth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AppBannerModal from "../ui/AppBannerModal";

type Props = {
  me: any;
  state: any; // PelekanState
  onRefresh?: () => Promise<void> | void;
  onBaselineStart?: () => Promise<void> | void;
};

const KEY_START_GATE = "pelekan:idle:start_gate:v1";
const API_BASE = "https://api.qoqnoos.app";

export default function IdlePlaceholder({
  me,
  state,
  onRefresh,
  onBaselineStart,
}: Props) {
  const { token, loading: authLoading } = useAuth();

  const [busy, setBusy] = useState(false);

  const [appModal, setAppModal] = useState<{
    visible: boolean;
    kind: "error" | "warning" | "success" | "info";
    title: string;
    message: string;
  }>({
    visible: false,
    kind: "info",
    title: "",
    message: "",
  });

  const showAppModal = (
    kind: "error" | "warning" | "success" | "info",
    title: string,
    message: string,
  ) => {
    setAppModal({
      visible: true,
      kind,
      title,
      message,
    });
  };

  const [mode, setMode] = useState<"start" | "intro">("start");
  const [gateBoot, setGateBoot] = useState(true);
  const [gateReady, setGateReady] = useState(false);

  const anim = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  const palette = useMemo(
    () => ({
      bg: "#0b0f14",
      text: "#F9FAFB",
      sub: "rgba(231,238,247,.72)",
      faint: "rgba(231,238,247,.55)",
      gold: "#D4AF37",
      orange: "#E98A15",
      red: "#ef4444",
      lime: "#86efac",

      glass: "rgba(3,7,18,.78)",
      glass2: "rgba(255,255,255,.02)",
      border: "rgba(255,255,255,.10)",
      border2: "rgba(255,255,255,.14)",

      btnBg: "rgba(255,255,255,.06)",
      btnBorder: "rgba(255,255,255,.14)",

      startGreen: "#86efac",
      startGreenBg: "rgba(134,239,172,.14)",
      startGreenBorder: "rgba(134,239,172,.42)",
    }),
    [],
  );

  const introText =
    "برای اینکه یک برنامه‌ی دقیق، اثرگذار و کاملاً متناسب با وضعیت تو ارائه بشه، اول یک آزمون کوتاه بده تا وضعیتت مشخص بشه.";

  const animateTo = (to: 0 | 1, done?: () => void) => {
    Animated.timing(anim, {
      toValue: to,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => done?.());
  };

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const v = await AsyncStorage.getItem(KEY_START_GATE);
        if (!alive) return;

        const ok = v === "1";
        setGateReady(ok);

        if (ok) {
          setMode("intro");
          anim.setValue(1);
        } else {
          setMode("start");
          anim.setValue(0);
        }
      } catch {
        if (!alive) return;
        setGateReady(false);
        setMode("start");
        anim.setValue(0);
      } finally {
        if (!alive) return;
        setGateBoot(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [anim]);

  useEffect(() => {
    if (mode !== "start") return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();

    return () => {
      loop.stop();
      pulse.setValue(0);
    };
  }, [mode, pulse]);

  const goIntro = async () => {
    try {
      await AsyncStorage.setItem(KEY_START_GATE, "1");
      setGateReady(true);
    } catch {}
    setMode("intro");
    requestAnimationFrame(() => animateTo(1));
  };

  const goStart = async () => {
    animateTo(0, () => setMode("start"));
  };

  const startBaseline = async () => {
    if (busy) return;

    if (authLoading) {
      showAppModal(
        "info",
        "کمی صبر کن",
        "در حال آماده‌سازی اطلاعات ورود هستیم.",
      );
      return;
    }

    if (!token) {
      showAppModal(
        "error",
        "نیاز به ورود",
        "نشست کاربری شما پیدا نشد. لطفاً دوباره وارد شوید.",
      );
      return;
    }

    if (!gateReady) {
      showAppModal("warning", "توجه", "اول روی دکمه «شروع» بزن.");
      return;
    }

    try {
      setBusy(true);
      const res = await fetch(`${API_BASE}/api/pelekan/baseline/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const rawText = await res.text();
      let json: any = null;

      try {
        json = rawText ? JSON.parse(rawText) : null;
      } catch {
        json = null;
      }
      if (!res.ok) {
        if (res.status === 401) {
          showAppModal(
            "error",
            "نشست نامعتبر است",
            "نشست کاربری شما منقضی شده یا معتبر نیست. لطفاً دوباره وارد شوید.",
          );
          return;
        }

        if (res.status === 403) {
          showAppModal(
            "error",
            "دسترسی مجاز نیست",
            "اجازه شروع این بخش برای این کاربر صادر نشده است.",
          );
          return;
        }

        showAppModal(
          "error",
          "شروع آزمون انجام نشد",
          json?.message || json?.error || "سرور درخواست شروع آزمون را نپذیرفت.",
        );
        return;
      }

      if (!json?.ok) {
        showAppModal(
          "error",
          "شروع آزمون انجام نشد",
          json?.message || json?.error || "شروع آزمون ناموفق بود.",
        );
        return;
      }

      await onBaselineStart?.();
      await onRefresh?.();
    } catch (e: any) {
      showAppModal(
        "error",
        "ارتباط برقرار نشد",
        e?.message || "ارتباط با سرور برقرار نشد.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (gateBoot || authLoading) {
    return (
      <>
        <View style={[styles.full, { backgroundColor: palette.bg }]}>
          <View style={[styles.centerWrap, { paddingHorizontal: 18 }]}>
            <ActivityIndicator color={palette.gold} />
            <Text style={{ color: palette.faint, marginTop: 10, fontSize: 12 }}>
              در حال آماده‌سازی…
            </Text>
          </View>
        </View>

        <AppBannerModal
          visible={appModal.visible}
          kind={appModal.kind}
          title={appModal.title}
          message={appModal.message}
          onClose={() =>
            setAppModal((prev) => ({
              ...prev,
              visible: false,
            }))
          }
        />
      </>
    );
  }

  if (mode === "start") {
    const startOpacity = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0],
    });

    const startTranslate = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -12],
    });

    const haloScale = pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.16],
    });

    const haloOpacity = pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.5, 0.1],
    });

    const innerGlowOpacity = pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.22, 0.46],
    });

    return (
      <>
        <View style={[styles.full, { backgroundColor: palette.bg }]}>
          <Animated.View
            style={[
              styles.centerWrap,
              {
                opacity: startOpacity,
                transform: [{ translateY: startTranslate }],
              },
            ]}
          >
            <View style={styles.startStage}>
              {/* هاله بیرونی متحرک */}
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.startHalo,
                  {
                    opacity: haloOpacity,
                    transform: [{ scale: haloScale }],
                  },
                ]}
              />

              {/* هاله داخلی */}
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.startGlow,
                  {
                    opacity: innerGlowOpacity,
                  },
                ]}
              />

              <Animated.View
                style={{
                  transform: [{ scale: pressScale }],
                }}
              >
                <TouchableOpacity
                  activeOpacity={1}
                  onPressIn={() => {
                    Animated.spring(pressScale, {
                      toValue: 0.96,
                      friction: 6,
                      tension: 160,
                      useNativeDriver: true,
                    }).start();
                  }}
                  onPressOut={() => {
                    Animated.spring(pressScale, {
                      toValue: 1,
                      friction: 6,
                      tension: 140,
                      useNativeDriver: true,
                    }).start();
                  }}
                  onPress={goIntro}
                  style={styles.startCirclePremium}
                >
                  <View style={styles.startCircleInnerPremium}>
                    <Text style={styles.startCircleTextPremium}>شــروع</Text>

                    <Text style={styles.startCircleSubText}>
                      آغاز مسیر درمان
                    </Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </Animated.View>
        </View>

        <AppBannerModal
          visible={appModal.visible}
          kind={appModal.kind}
          title={appModal.title}
          message={appModal.message}
          onClose={() =>
            setAppModal((prev) => ({
              ...prev,
              visible: false,
            }))
          }
        />
      </>
    );
  }

  const introOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const introTranslate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0],
  });

  return (
    <>
      <View style={[styles.full, { backgroundColor: palette.bg }]}>
        <Animated.View
          style={[
            styles.introCenterWrap,
            {
              opacity: introOpacity,
              transform: [{ translateY: introTranslate }],
            },
          ]}
        >
          <View
            style={[
              styles.card,
              { backgroundColor: palette.glass, borderColor: palette.border },
            ]}
          >
            <View
              style={[styles.accentBarTop, { backgroundColor: palette.gold }]}
            />

            <Text
              style={[
                styles.introBody,
                { color: palette.sub, textAlign: "center" },
              ]}
            >
              {introText}
            </Text>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={startBaseline}
              disabled={busy || authLoading}
              style={[
                styles.primaryBtnGlass,
                {
                  backgroundColor: "rgba(212,175,55,.10)",
                  borderColor: "rgba(212,175,55,.35)",
                  opacity: busy || authLoading ? 0.6 : 1,
                },
              ]}
            >
              {busy ? (
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <ActivityIndicator />
                  <Text
                    style={[styles.primaryBtnText, { color: palette.text }]}
                  >
                    در حال شروع…
                  </Text>
                </View>
              ) : (
                <Text style={[styles.primaryBtnText, { color: palette.text }]}>
                  شروع آزمون
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={goStart}
              disabled={busy}
              style={[
                styles.backBtn,
                {
                  borderColor: palette.border,
                  backgroundColor: "rgba(255,255,255,.04)",
                  opacity: busy ? 0.55 : 1,
                },
              ]}
            >
              <Text style={[styles.backBtnText, { color: palette.faint }]}>
                → بازگشت
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>

      <AppBannerModal
        visible={appModal.visible}
        kind={appModal.kind}
        title={appModal.title}
        message={appModal.message}
        onClose={() =>
          setAppModal((prev) => ({
            ...prev,
            visible: false,
          }))
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1 },

  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },

  startStage: {
    width: 320,
    height: 320,
    alignItems: "center",
    justifyContent: "center",
  },

  startHalo: {
    position: "absolute",

    width: 294,
    height: 294,
    borderRadius: 999,

    borderWidth: 1.5,
    borderColor: "rgba(234,175,72,.58)",

    backgroundColor: "rgba(233,138,21,.08)",

    shadowColor: "#E98A15",
    shadowOpacity: 0.58,
    shadowRadius: 28,
    shadowOffset: {
      width: 0,
      height: 0,
    },

    elevation: 12,
  },

  startGlow: {
    position: "absolute",

    width: 262,
    height: 262,
    borderRadius: 999,

    backgroundColor: "rgba(233,138,21,.28)",

    shadowColor: "#E98A15",
    shadowOpacity: 0.5,
    shadowRadius: 22,
    shadowOffset: {
      width: 0,
      height: 0,
    },

    elevation: 8,
  },

  startCirclePremium: {
    width: 242,
    height: 242,
    borderRadius: 999,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "rgba(11,15,20,.94)",

    borderWidth: 1.8,
    borderColor: "rgba(234,175,72,.88)",

    shadowColor: "#E98A15",
    shadowOpacity: 0.6,
    shadowRadius: 30,
    shadowOffset: {
      width: 0,
      height: 7,
    },

    elevation: 16,
  },

  startCircleInnerPremium: {
  width: 208,
  height: 208,
  borderRadius: 999,

  alignItems: "center",
  justifyContent: "center",

  backgroundColor: "rgba(134,239,172,.055)",

  borderWidth: 1,
  borderColor: "rgba(134,239,172,.28)",
},

  startCircleTextPremium: {
    color: "#F3CA69",

    fontSize: 30,
    lineHeight: 42,
    fontWeight: "900",

    textAlign: "center",

    textShadowColor: "rgba(233,138,21,.35)",
    textShadowRadius: 10,

    writingDirection: "rtl" as any,
  },

  startCircleSubText: {
    marginTop: 10,

    color: "#86EFAC",

    fontSize: 12.5,
    lineHeight: 20,
    fontWeight: "700",

    textAlign: "center",

    writingDirection: "rtl" as any,
  },
  introCenterWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },

  card: {
    width: "100%",
    maxWidth: 520,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },

  accentBarTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.95,
  },

  introBody: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "right",
    fontWeight: "700",
    writingDirection: "rtl" as any,
  },

  stepCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  stepHeaderRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 10,
  },
  bulletDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginTop: 6,
    borderWidth: 1,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "right",
    fontWeight: "700",
    writingDirection: "rtl" as any,
  },

  primaryBtnGlass: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: "900",
    writingDirection: "rtl" as any,
  },

  backBtn: {
    marginTop: 12,
    alignSelf: "center",
    minWidth: 160,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: "900",
    writingDirection: "rtl" as any,
  },
});
