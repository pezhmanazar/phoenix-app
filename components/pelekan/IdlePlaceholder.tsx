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

      glass: "rgba(3,7,18,.78)",
      border: "rgba(255,255,255,.10)",

      // شیشه برای دکمه‌ها
      btnBg: "rgba(255,255,255,.06)",
      btnBorder: "rgba(255,255,255,.14)",
    }),
    []
  );

  const consentSteps =
    state?.baseline?.content?.consentSteps && Array.isArray(state.baseline.content.consentSteps)
      ? state.baseline.content.consentSteps
      : [
        
        ];

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
    // اول mode رو intro کن تا صفحه دوم mount بشه، بعد انیمیت کن
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

  // ✅ حالت ۱: فقط دکمه بزرگ "شروع" وسط صفحه
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
            activeOpacity={0.9}
            onPress={goIntro}
            style={[
              styles.bigStartBtn,
              { backgroundColor: palette.btnBg, borderColor: palette.btnBorder },
            ]}
          >
            <Text style={[styles.bigStartText, { color: palette.text }]}>شروع</Text>
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

          <Text style={[styles.introBody, { color: palette.sub }]}>{introText}</Text>

          <View style={{ marginTop: 12, gap: 10 }}>
            {consentSteps.map((s: any, idx: number) => (
              <View key={String(s?.id || idx)} style={styles.bulletRow}>
                <View
                  style={[
                    styles.bulletDot,
                    {
                      backgroundColor: "rgba(212,175,55,.20)",
                      borderColor: "rgba(212,175,55,.35)",
                    },
                  ]}
                />
                <Text style={[styles.bulletText, { color: palette.sub }]}>{s?.text}</Text>
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
                backgroundColor: palette.btnBg,
                borderColor: palette.btnBorder,
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

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={goStart}
            disabled={busy}
            style={{ marginTop: 12, alignSelf: "flex-start" }}
          >
            <Text style={{ color: palette.faint, fontWeight: "800" }}>بازگشت</Text>
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
  bigStartBtn: {
    width: "86%",
    maxWidth: 420,
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  bigStartText: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.2,
  },

  // ----- intro mode (center card) -----
  introCenterWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center", // ✅ کارت وسط صفحه
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  card: {
    width: "100%",
    maxWidth: 520,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: "900",
    textAlign: "right",
  },

  introBody: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "right",
    fontWeight: "700",
  },

  bulletRow: {
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
  },
});