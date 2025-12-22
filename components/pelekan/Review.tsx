// components/pelekan/Review.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    Easing,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import BACKEND_URL from "../../constants/backend";

type Props = {
  me: any;
  state: any;
  onRefresh?: () => Promise<void> | void;
};

type ToastState = {
  visible: boolean;
  title: string;
  message?: string;
  tone: "info" | "success" | "danger";
};

export default function Review({ me, onRefresh }: Props) {
  const phone = me?.phone as string | undefined;

  const [loading, setLoading] = useState(true);
  const [remote, setRemote] = useState<any>(null);
  const [busy, setBusy] = useState<null | "refresh" | "continue">(null);

  // entrance animation
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(10)).current;

  // toast
  const toastY = useRef(new Animated.Value(14)).current;
  const toastA = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    title: "",
    message: "",
    tone: "info",
  });

  const palette = useMemo(
    () => ({
      bg: "#0b0f14",
      text: "#F9FAFB",
      sub: "rgba(231,238,247,.74)",
      faint: "rgba(231,238,247,.55)",
      glass: "rgba(3,7,18,.86)",
      border: "rgba(255,255,255,.10)",
      btnBg: "rgba(255,255,255,.06)",
      btnBorder: "rgba(255,255,255,.14)",
      toastGlass: "rgba(3,7,18,.92)",
      toastBorder: "rgba(255,255,255,.14)",
      toneInfo: "rgba(96,165,250,.22)",
      toneSuccess: "rgba(74,222,128,.22)",
      toneDanger: "rgba(248,113,113,.22)",
    }),
    []
  );

  const showToast = useCallback(
    (next: Omit<ToastState, "visible">, ms = 2400) => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast({ visible: true, ...next });

      toastA.setValue(0);
      toastY.setValue(14);

      Animated.parallel([
        Animated.timing(toastA, {
          toValue: 1,
          duration: 160,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(toastY, {
          toValue: 0,
          duration: 160,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();

      toastTimer.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(toastA, {
            toValue: 0,
            duration: 180,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(toastY, {
            toValue: 10,
            duration: 180,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]).start(() => setToast((t) => ({ ...t, visible: false })));
      }, ms);
    },
    [toastA, toastY]
  );

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

  const STATE_URL = useMemo(() => {
    if (!phone) return null;
    return `${BACKEND_URL}/api/pelekan/review/state?phone=${encodeURIComponent(phone)}`;
  }, [phone]);

  const fetchReviewState = useCallback(async () => {
    if (!STATE_URL) {
      setRemote(null);
      setLoading(false);
      return;
    }
    try {
      setBusy("refresh");
      const res = await fetch(STATE_URL, { headers: { "Cache-Control": "no-store" } });
      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }

      if (!res.ok || !json?.ok) {
        showToast({
          tone: "danger",
          title: "خطا در دریافت وضعیت",
          message: json?.error ? String(json.error) : `HTTP ${res.status}`,
        });
        setRemote(null);
        return;
      }

      setRemote(json.data);
    } catch {
      showToast({
        tone: "danger",
        title: "ارتباط برقرار نشد",
        message: "اینترنت یا دسترسی به سرور را بررسی کن.",
      });
      setRemote(null);
    } finally {
      setLoading(false);
      setBusy(null);
    }
  }, [STATE_URL, showToast]);

  useEffect(() => {
    fetchReviewState();
  }, [fetchReviewState]);

  const session = remote?.session || null;
  const isPro = !!remote?.user?.isPro;
  const status = session?.status || "unknown";
  const currentTest = session?.currentTest ?? null;
  const currentIndex = session?.currentIndex ?? null;

  const onContinue = useCallback(() => {
    // فعلاً endpoint نداریم که سوال/قدم بعدی رو بده.
    // این دکمه رو گذاشتم تا UI کامل باشه و تو تست مسیر گیر نکنی.
    showToast({
      tone: "info",
      title: "قدم بعدی آماده نیست",
      message: "برای ادامه، باید API ارسال جواب/گرفتن سوال‌ها رو به این صفحه وصل کنیم.",
    }, 3200);
  }, [showToast]);

  const toneBorder =
    toast.tone === "success"
      ? palette.toneSuccess
      : toast.tone === "danger"
      ? palette.toneDanger
      : palette.toneInfo;

  if (loading) {
    return (
      <View style={[styles.full, { backgroundColor: palette.bg, alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator />
        <Text style={{ color: palette.sub, marginTop: 10, fontWeight: "800", fontSize: 12 }}>
          در حال بارگذاری بازسنجی…
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.full, { backgroundColor: palette.bg }]}>
      <Animated.View style={[styles.centerWrap, { opacity: fade, transform: [{ translateY: slide }] }]}>
        <View style={[styles.card, { backgroundColor: palette.glass, borderColor: palette.border }]}>
          <Text style={[styles.title, { color: palette.text }]}>بازسنجی رابطه</Text>

          <Text style={[styles.subText, { color: palette.sub }]}>
            اینجا وضعیت سشن بازسنجی از سرور خوانده می‌شود. وقتی API سوال‌ها/ارسال جواب را وصل کنیم،
            همین‌جا تست‌ها اجرا می‌شوند.
          </Text>

          <View style={{ marginTop: 14 }}>
            <Row label="وضعیت" value={String(status)} />
            <Row label="تست جاری" value={currentTest === null ? "—" : String(currentTest)} />
            <Row label="ایندکس" value={currentIndex === null ? "—" : String(currentIndex)} />
            <Row label="پرو" value={isPro ? "بله" : "خیر"} />
          </View>

          <View style={{ marginTop: 14, gap: 10 }}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={fetchReviewState}
              disabled={!!busy}
              style={[
                styles.glassBtn,
                { backgroundColor: palette.btnBg, borderColor: palette.btnBorder, opacity: busy ? 0.7 : 1 },
              ]}
            >
              {busy === "refresh" ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <ActivityIndicator />
                  <Text style={[styles.glassBtnText, { color: palette.text }]}>در حال بروزرسانی…</Text>
                </View>
              ) : (
                <Text style={[styles.glassBtnText, { color: palette.text }]}>رفرش وضعیت</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={onContinue}
              disabled={!!busy}
              style={[
                styles.glassBtn,
                { backgroundColor: "rgba(96,165,250,.10)", borderColor: "rgba(96,165,250,.22)", opacity: busy ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.glassBtnText, { color: palette.text }]}>ادامه</Text>
            </TouchableOpacity>

            {!!onRefresh ? (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => onRefresh?.()}
                disabled={!!busy}
                style={[
                  styles.linkBtn,
                  { opacity: busy ? 0.6 : 1 },
                ]}
              >
                <Text style={{ color: palette.faint, fontWeight: "900", fontSize: 12 }}>
                  رفرش کل پلکان (state)
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </Animated.View>

      {/* Toast */}
      {toast.visible ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toastWrap,
            { opacity: toastA, transform: [{ translateY: toastY }] },
          ]}
        >
          <View style={[styles.toastCard, { backgroundColor: palette.toastGlass, borderColor: palette.toastBorder }]}>
            <View style={[styles.toastTone, { backgroundColor: toneBorder }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.toastTitle, { color: palette.text }]}>{toast.title}</Text>
              {!!toast.message ? (
                <Text style={[styles.toastMsg, { color: palette.sub }]} numberOfLines={3}>
                  {toast.message}
                </Text>
              ) : null}
            </View>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", paddingVertical: 6 }}>
      <Text style={{ color: "rgba(231,238,247,.55)", fontWeight: "900", fontSize: 12 }}>{label}</Text>
      <Text style={{ color: "#F9FAFB", fontWeight: "900", fontSize: 12 }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1 },
  centerWrap: { flex: 1, paddingHorizontal: 16, justifyContent: "center" },
  card: { borderWidth: 1, borderRadius: 18, paddingVertical: 16, paddingHorizontal: 16 },
  title: { fontSize: 18, fontWeight: "900", textAlign: "center" },
  subText: { marginTop: 10, fontSize: 12.5, lineHeight: 19, textAlign: "center", fontWeight: "700" },
  glassBtn: {
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  glassBtnText: { fontSize: 13, fontWeight: "900" },
  linkBtn: { alignItems: "center", paddingVertical: 6 },
  toastWrap: { position: "absolute", left: 14, right: 14, bottom: 18 },
  toastCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  toastTone: { width: 10, height: 40, borderRadius: 8 },
  toastTitle: { fontSize: 13, fontWeight: "900", textAlign: "right" },
  toastMsg: { marginTop: 4, fontSize: 12, fontWeight: "700", textAlign: "right", lineHeight: 18 },
});