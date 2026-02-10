// components/pelekan/IdlePlaceholder.tsx

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type Props = {
  me: any;
  state: any; // PelekanState
  onRefresh?: () => Promise<void> | void;
};

// ✅ کلید گیت: تا وقتی کاربر دایره "شروع" رو نزده، وارد معرفی/آزمون نشیم
const KEY_START_GATE = "pelekan:idle:start_gate:v1";

export default function IdlePlaceholder({ me, state, onRefresh }: Props) {
  const [busy, setBusy] = useState(false);

  // ✅ مرحله‌ی اول: فقط دکمه "شروع"
  // ✅ مرحله‌ی دوم: توضیحات + دکمه "شروع آزمون"
  const [mode, setMode] = useState<"start" | "intro">("start");

  // ✅ گیت
  const [gateBoot, setGateBoot] = useState(true);
  const [gateReady, setGateReady] = useState(false);

  // ✅ انیمیشن انتقال
  const anim = useRef(new Animated.Value(0)).current; // 0 => start, 1 => intro

  const phone = me?.phone as string | undefined;

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
    []
  );

  const consentSteps =
    state?.baseline?.content?.consentSteps &&
    Array.isArray(state.baseline.content.consentSteps)
      ? state.baseline.content.consentSteps
      : [];

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

  // ✅ گیت را از AsyncStorage بخوان
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const v = await AsyncStorage.getItem(KEY_START_GATE);
        if (!alive) return;
        const ok = v === "1";
        setGateReady(ok);

        // اگر قبلاً گیت زده شده، مستقیم برو intro
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goIntro = async () => {
    // ✅ اینجا گیت را ست می‌کنیم تا از این به بعد مستقیم intro بیاد
    try {
      await AsyncStorage.setItem(KEY_START_GATE, "1");
      setGateReady(true);
    } catch {}

    setMode("intro");
    requestAnimationFrame(() => animateTo(1));
  };

  const goStart = async () => {
    // ⚠️ این دکمه «بازگشت» فقط به حالت start برمی‌گرده
    // گیت رو ریست نمی‌کنیم (چون تجربه‌ت می‌گه نباید هر بار برگرده)
    animateTo(0, () => setMode("start"));
  };

  // ✅ اگر می‌خوای بازگشت، گیت رو هم ریست کنه (فعلاً خاموش)
  // const goStartAndResetGate = async () => {
  //   try {
  //     await AsyncStorage.removeItem(KEY_START_GATE);
  //   } catch {}
  //   setGateReady(false);
  //   animateTo(0, () => setMode("start"));
  // };

  const startBaseline = async () => {
    if (!phone) {
      Alert.alert("خطا", "شماره کاربر پیدا نشد.");
      return;
    }

    try {
      setBusy(true);

      // ✅ ضدگلوله: تا وقتی کاربر «شروع» نزده، حق نداره startBaseline بزنه
      if (!gateReady) {
        Alert.alert("توجه", "اول روی دکمه «شروع» بزن.");
        return;
      }

      const res = await fetch(`https://qoqnoos.app/api/pelekan/baseline/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      const json = await res.json();
      if (!json?.ok) {
        Alert.alert("خطا", "شروع آزمون ناموفق بود.");
        return;
      }

      await onRefresh?.(); // tabState -> baseline_assessment (یا هرچی سرور می‌گه)
    } catch {
      Alert.alert("خطا", "ارتباط با سرور برقرار نشد.");
    } finally {
      setBusy(false);
    }
  };

  // ✅ Loader هنگام خواندن گیت
  if (gateBoot) {
    return (
      <View style={[styles.full, { backgroundColor: palette.bg }]}>
        <View style={[styles.centerWrap, { paddingHorizontal: 18 }]}>
          <ActivityIndicator color={palette.gold} />
          <Text style={{ color: palette.faint, marginTop: 10, fontSize: 12 }}>
            در حال آماده‌سازی…
          </Text>
        </View>
      </View>
    );
  }

  // ------------------------- UI -------------------------
  // ✅ حالت ۱: دکمه دایره بزرگ سبز وسط صفحه
  if (mode === "start") {
    const startOpacity = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0],
    });
    const startTranslate = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -12],
    });

    return (
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
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={goIntro}
            style={[
              styles.startCircle,
              {
                backgroundColor: palette.startGreenBg,
                borderColor: palette.startGreenBorder,
              },
            ]}
          >
            <View
              style={[
                styles.startCircleInner,
                {
                  backgroundColor: "rgba(3,7,18,.60)",
                  borderColor: "rgba(134,239,172,.25)",
                },
              ]}
            >
              <Text
                style={[styles.startCircleText, { color: palette.startGreen }]}
              >
                شروع
              </Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  // ✅ حالت ۲: کارت وسط صفحه + توضیحات + دکمه شروع آزمون
  const introOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const introTranslate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0],
  });

  return (
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
          <View style={[styles.accentBarTop, { backgroundColor: palette.gold }]} />

          <Text
            style={[
              styles.introBody,
              { color: palette.sub, textAlign: "center" },
            ]}
          >
            {introText}
          </Text>

          <View style={{ marginTop: 14, gap: 10 }}>
            {consentSteps.map((s: any, idx: number) => (
              <View
                key={String(s?.id || idx)}
                style={[
                  styles.stepCard,
                  {
                    borderColor: palette.border2,
                    backgroundColor: palette.glass2,
                  },
                ]}
              >
                <View style={styles.stepHeaderRow}>
                  <View
                    style={[
                      styles.bulletDot,
                      {
                        backgroundColor: "rgba(212,175,55,.20)",
                        borderColor: "rgba(212,175,55,.35)",
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.bulletText,
                      { color: palette.sub, textAlign: "center" },
                    ]}
                  >
                    {s?.text}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={startBaseline}
            disabled={busy}
            style={[
              styles.primaryBtnGlass,
              {
                backgroundColor: "rgba(212,175,55,.10)",
                borderColor: "rgba(212,175,55,.35)",
                opacity: busy ? 0.6 : 1,
              },
            ]}
          >
            {busy ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ActivityIndicator />
                <Text style={[styles.primaryBtnText, { color: palette.text }]}>
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

  startCircle: {
    width: 220,
    height: 220,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  startCircleInner: {
    width: 192,
    height: 192,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  startCircleText: {
    fontSize: 22,
    fontWeight: "900",
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