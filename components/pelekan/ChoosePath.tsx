// components/pelekan/ChoosePath.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import BACKEND_URL from "../../constants/backend";

type Props = {
  me: any;
  state: any;
  onRefresh?: () => Promise<void> | void;
};

type BusyKind = null | "skip_review" | "review";

export default function ChoosePath({ me, state, onRefresh }: Props) {
  const phone = me?.phone as string | undefined;

  const palette = useMemo(
    () => ({
      bg: "#0b0f14",
      glass: "rgba(3,7,18,.92)",
      glass2: "rgba(255,255,255,.02)",
      border: "rgba(255,255,255,.10)",
      border2: "rgba(255,255,255,.14)",
      text: "#F9FAFB",
      sub: "rgba(231,238,247,.75)",
      sub2: "rgba(231,238,247,.55)",
      gold: "#D4AF37",
      orange: "#E98A15",
      red: "#ef4444",
      lime: "#86efac",
      track: "rgba(231,238,247,.14)",
      mintBorder: "rgba(74, 222, 128, .22)",
      blueBorder: "rgba(96, 165, 250, .22)",
    }),
    []
  );

  const [busy, setBusy] = useState<BusyKind>(null);
  const [err, setErr] = useState<string | null>(null);

  // Entrance animation like other cards
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    fade.setValue(0);
    slide.setValue(10);
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(slide, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, slide]);

  const postJsonSafe = useCallback(async (url: string, body: any) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { res, json, text };
  }, []);

  // ✅ مسیر درست: review/choose
  const CHOOSE_URL = `${BACKEND_URL}/api/pelekan/review/choose`;

  // ✅ NEW: start treatment (will be added in backend next step)
  const START_TREATMENT_URL = `${BACKEND_URL}/api/pelekan/treatment/start`;

  const startTreatment = useCallback(async () => {
    if (!phone) return { ok: false as const, error: "NO_PHONE" };
    const { res, json, text } = await postJsonSafe(START_TREATMENT_URL, { phone });
    if (!res.ok || !json?.ok) {
      const msg =
        json?.error || json?.message || (text ? `HTTP ${res.status}` : "REQUEST_FAILED");
      return { ok: false as const, error: String(msg) };
    }
    return { ok: true as const };
  }, [phone, postJsonSafe, START_TREATMENT_URL]);

  const choose = useCallback(
    async (choice: "skip_review" | "review") => {
      if (!phone) {
        setErr("شماره کاربر پیدا نشد.");
        return;
      }

      setErr(null);
      setBusy(choice);

      try {
        // 1) store choice
        const { res, json, text } = await postJsonSafe(CHOOSE_URL, { phone, choice });
        if (!res.ok || !json?.ok) {
          const msg =
            json?.error || json?.message || (text ? `HTTP ${res.status}` : "REQUEST_FAILED");
          setErr(`ثبت مسیر ناموفق بود: ${String(msg)}`);
          return;
        }

        // 2) if skip_review -> actually start treating (create first progress)
        if (choice === "skip_review") {
          const st = await startTreatment();
          if (!st.ok) {
            setErr(`شروع درمان ناموفق بود: ${st.error}`);
            return;
          }
        }

        // 3) refresh parent (should move tabState to treating or review)
        await onRefresh?.();
      } catch (e: any) {
        setErr("ارتباط با سرور برقرار نشد.");
      } finally {
        setBusy(null);
      }
    },
    [phone, postJsonSafe, CHOOSE_URL, startTreatment, onRefresh]
  );

  const header = "انتخاب مسیر";

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
          <View
            style={[
              styles.card,
              styles.cardFancy,
              { backgroundColor: palette.glass, borderColor: palette.border },
            ]}
          >
            <View style={[styles.accentBarTop, { backgroundColor: palette.gold }]} />

            <Text style={[styles.title, { color: palette.gold, textAlign: "center" }]}>
              {header}
            </Text>

            <Text style={[styles.centerText, { color: palette.sub, marginTop: 10, lineHeight: 20 }]}>
  یک مسیر برای «رها کردن و جلو رفتن»
</Text>

<Text
  style={[
    styles.centerText,
    {
      color: palette.sub,
      marginTop: 4,
      lineHeight: 20,
      fontSize: 12,
      opacity: 0.9,
    },
  ]}
>
  یک مسیر برای «بررسی واقع‌بینانه احتمال ترمیم رابطه»
</Text>

            <View style={{ height: 14 }} />

            {/* Option 1 */}
            <Pressable
              disabled={!!busy}
              onPress={() => choose("skip_review")}
              style={({ pressed }) => [
                styles.choiceCard,
                {
                  borderColor: palette.mintBorder,
                  backgroundColor: "rgba(255,255,255,.04)",
                  opacity: busy && busy !== "skip_review" ? 0.55 : pressed ? 0.92 : 1,
                  transform: [{ scale: pressed ? 0.995 : 1 }],
                },
              ]}
            >
              <Text style={[styles.choiceTitle, { color: palette.text, textAlign: "center" }]}>
                می‌خوام فراموشش کنم
              </Text>
              <Text style={[styles.choiceDesc, { color: palette.sub2, textAlign: "center" }]}>
                ورود به پلکان و شروع مسیر رهایی
              </Text>

              <View style={{ height: 12 }} />

              <View
                style={[
                  styles.btnPrimary,
                  {
                    borderColor: "rgba(212,175,55,.35)",
                    backgroundColor: "rgba(212,175,55,.10)",
                  },
                ]}
              >
                {busy === "skip_review" ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <ActivityIndicator color={palette.gold} />
                    <Text style={[styles.btnText, { color: palette.text }]}>در حال ثبت…</Text>
                  </View>
                ) : (
                  <Text style={[styles.btnText, { color: palette.text }]}>ادامه</Text>
                )}
              </View>
            </Pressable>

            {/* Option 2 */}
            <Pressable
              disabled={!!busy}
              onPress={() => choose("review")}
              style={({ pressed }) => [
                styles.choiceCard,
                {
                  marginTop: 12,
                  borderColor: palette.blueBorder,
                  backgroundColor: "rgba(255,255,255,.04)",
                  opacity: busy && busy !== "review" ? 0.55 : pressed ? 0.92 : 1,
                  transform: [{ scale: pressed ? 0.995 : 1 }],
                },
              ]}
            >
              <Text style={[styles.choiceTitle, { color: palette.text, textAlign: "center" }]}>
                می‌خوام احتمال درست شدن رابطه رو بررسی کنم
              </Text>
              <Text style={[styles.choiceDesc, { color: palette.sub2, textAlign: "center" }]}>
  بازسنجی رابطه با دو آزمون علمی
</Text>

<Text
  style={[
    styles.choiceDesc,
    {
      color: palette.sub2,
      textAlign: "center",
      fontSize: 11,
      marginTop: 4,
      opacity: 0.85,
    },
  ]}
>
  (نتیجه نهایی بعد از خرید اشتراک پرو نمایش داده می‌شود)
</Text>

              <View style={{ height: 12 }} />

              <View
                style={[
                  styles.btnPrimary,
                  {
                    borderColor: "rgba(212,175,55,.35)",
                    backgroundColor: "rgba(212,175,55,.10)",
                  },
                ]}
              >
                {busy === "review" ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <ActivityIndicator color={palette.gold} />
                    <Text style={[styles.btnText, { color: palette.text }]}>در حال ثبت…</Text>
                  </View>
                ) : (
                  <Text style={[styles.btnText, { color: palette.text }]}>ادامه</Text>
                )}
              </View>
            </Pressable>

            {!!err ? (
              <>
                <View style={{ height: 14 }} />
                <Text style={[styles.rtlText, { color: palette.red, textAlign: "center", lineHeight: 20 }]}>
                  {err}
                </Text>
              </>
            ) : null}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  rtlText: { writingDirection: "rtl" as any },
  centerText: { textAlign: "center" as any, writingDirection: "rtl" as any },

  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 28,
    justifyContent: "center",
  },

  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    overflow: "hidden",
  },

  cardFancy: {
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

  title: { fontSize: 18, fontWeight: "900" },

  choiceCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },

  choiceTitle: { fontSize: 14, fontWeight: "900", lineHeight: 20 },
  choiceDesc: { marginTop: 6, fontSize: 12, fontWeight: "700", lineHeight: 18 },

  btnPrimary: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },

  btnText: { fontSize: 13, fontWeight: "900" },
});