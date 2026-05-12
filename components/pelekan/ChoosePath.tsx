// components/pelekan/ChoosePath.tsx
import { useAuth } from "@/hooks/useAuth";
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
import { BACKEND_URL } from "../../constants/backend";

type Props = {
  me: any;
  state: any;
  onRefresh?: () => Promise<void> | void;
};

type BusyKind = null | "skip_review" | "review";

export default function ChoosePath({ me, state, onRefresh }: Props) {
  const { token, loading: authLoading } = useAuth();

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

  const postJsonSafe = useCallback(
    async (url: string, body: any) => {
      if (authLoading) {
        throw new Error("AUTH_NOT_READY");
      }

      if (!token) {
        throw new Error("NO_AUTH_TOKEN");
      }

      console.log("CHOOSE_PATH_POST:", {
        url,
        body,
        hasToken: !!token,
      });

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const text = await res.text();

      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }

      console.log("CHOOSE_PATH_RESPONSE_STATUS:", res.status);
      console.log("CHOOSE_PATH_RESPONSE_JSON:", json);
      console.log("CHOOSE_PATH_RESPONSE_TEXT:", text);

      return { res, json, text };
    },
    [token, authLoading]
  );

  const CHOOSE_URL = `${BACKEND_URL}/api/pelekan/review/choose`;

  const choose = useCallback(
    async (choice: "skip_review" | "review") => {
      if (authLoading) {
        setErr("لطفاً کمی صبر کنید...");
        return;
      }

      if (!token) {
        setErr("نشست کاربر معتبر نیست. لطفاً دوباره وارد شوید.");
        return;
      }

      setErr(null);
      setBusy(choice);

      try {
        // backend باید کاربر را از روی token بشناسد
        const { res, json, text } = await postJsonSafe(CHOOSE_URL, { choice });

        if (!res.ok || !json?.ok) {
          const msg =
            json?.error ||
            json?.message ||
            json?.detail ||
            json?.data?.error ||
            json?.data?.message ||
            (res.status === 401
              ? "UNAUTHORIZED"
              : text
              ? `HTTP ${res.status}`
              : "REQUEST_FAILED");

          if (res.status === 401) {
            setErr("دسترسی نامعتبر است. لطفاً یک‌بار از حساب خارج و دوباره وارد شوید.");
            return;
          }

          if (res.status === 403) {
            setErr("شما مجاز به انجام این عملیات نیستید.");
            return;
          }

          setErr(`ثبت مسیر ناموفق بود: ${String(msg)}`);
          return;
        }

        await onRefresh?.();
      } catch (e: any) {
        console.log("CHOOSE_PATH_ERROR:", e);

        const raw = String(e?.message || "");

        if (raw === "AUTH_NOT_READY") {
          setErr("احراز هویت هنوز آماده نیست. چند لحظه دیگر دوباره تلاش کنید.");
          return;
        }

        if (raw === "NO_AUTH_TOKEN") {
          setErr("توکن احراز هویت یافت نشد. لطفاً دوباره وارد شوید.");
          return;
        }

        setErr("ارتباط با سرور برقرار نشد.");
      } finally {
        setBusy(null);
      }
    },
    [authLoading, token, postJsonSafe, CHOOSE_URL, onRefresh]
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

            <Pressable
              disabled={!!busy || authLoading}
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

            <Pressable
              disabled={!!busy || authLoading}
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