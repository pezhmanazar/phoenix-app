// components/pelekan/IdlePlaceholder.tsx
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

export default function IdlePlaceholder({ me, state, onRefresh }: Props) {
  const [busy, setBusy] = useState(false);

  // ✅ مرحله‌ی اول: فقط دکمه "شروع"
  // ✅ مرحله‌ی دوم: توضیحات + دکمه "شروع آزمون"
  const [mode, setMode] = useState<"start" | "intro">("start");

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

      // شیشه برای دکمه‌ها
      btnBg: "rgba(255,255,255,.06)",
      btnBorder: "rgba(255,255,255,.14)",

      // ✅ سبز متناسب با تم (نه جیغ)
      startGreen: "#86efac",
      startGreenBg: "rgba(134,239,172,.14)",
      startGreenBorder: "rgba(134,239,172,.42)",
    }),
    []
  );

  const consentSteps =
    state?.baseline?.content?.consentSteps && Array.isArray(state.baseline.content.consentSteps)
      ? state.baseline.content.consentSteps
      : [];

  const introText =
    "برای اینکه یک برنامه‌ی دقیق، اثرگذار و کاملاً متناسب با وضعیت تو ارائه بشه، اول یک آزمون کوتاه می‌گیریم تا نقطه‌ی شروع مشخص بشه.";

  const animateTo = (to: 0 | 1, done?: () => void) => {
    Animated.timing(anim, {
      toValue: to,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => done?.());
  };

  const goIntro = () => {
    setMode("intro");
    requestAnimationFrame(() => animateTo(1));
  };

  const goStart = () => {
    animateTo(0, () => setMode("start"));
  };

  const startBaseline = async () => {
    if (!phone) {
      Alert.alert("خطا", "شماره کاربر پیدا نشد.");
      return;
    }
    try {
      setBusy(true);
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
      await onRefresh?.(); // tabState -> baseline_assessment
    } catch (e) {
      Alert.alert("خطا", "ارتباط با سرور برقرار نشد.");
    } finally {
      setBusy(false);
    }
  };

  // اگر حالت اولیه است، anim باید 0 باشد (برای hot reload / رفرش)
  useEffect(() => {
    if (mode === "start") anim.setValue(0);
    if (mode === "intro") anim.setValue(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------- UI -------------------------
  // ✅ حالت ۱: دکمه دایره بزرگ سبز وسط صفحه
  if (mode === "start") {
    const startOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
    const startTranslate = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });

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
              <Text style={[styles.startCircleText, { color: palette.startGreen }]}>شروع</Text>
            
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  // ✅ حالت ۲: کارت وسط صفحه + توضیحات + دکمه شروع آزمون
  const introOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const introTranslate = anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });

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
        <View style={[styles.card, { backgroundColor: palette.glass, borderColor: palette.border }]}>
          {/* ✅ accent شبیه کارت‌های آزمون */}
          <View style={[styles.accentBarTop, { backgroundColor: palette.gold }]} />

          <Text style={[styles.introBody, { color: palette.sub, textAlign: "center" }]}>{introText}</Text>

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
                  <Text style={[styles.bulletText, { color: palette.sub, textAlign: "center" }]}>{s?.text}</Text>
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
                <Text style={[styles.primaryBtnText, { color: palette.text }]}>در حال شروع…</Text>
              </View>
            ) : (
              <Text style={[styles.primaryBtnText, { color: palette.text }]}>شروع آزمون</Text>
            )}
          </TouchableOpacity>

          {/* ✅ بازگشت زیر کارت، وسط، با فلش */}
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
            <Text style={[styles.backBtnText, { color: palette.faint }]}>→ بازگشت</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1 },

  // ----- start mode -----
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },

  // ✅ دایره شروع
  startCircle: {
    width: 220,
    height: 220,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    // کمی عمق
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
  startCircleSub: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: "800",
    writingDirection: "rtl" as any,
    textAlign: "center" as any,
    opacity: 0.9,
  },

  // ----- intro mode (center card) -----
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
    // عمق شیشه‌ای مثل کارت‌های آزمون
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

  // ✅ کارت‌های آیتم‌ها شبیه سوالات آزمون
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

  // ✅ back button centered under card content
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