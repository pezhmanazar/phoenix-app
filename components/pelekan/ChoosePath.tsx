// components/pelekan/ChoosePath.tsx
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
  state: any; // <-- مهم: این باید از parent پاس داده بشه
  onRefresh?: () => Promise<void> | void;
};

type BusyKind = null | "skip_review" | "review";

type ToastState = {
  visible: boolean;
  title: string;
  message?: string;
  tone: "info" | "success" | "danger";
};

export default function ChoosePath({ me, state, onRefresh }: Props) {
  const [busy, setBusy] = useState<BusyKind>(null);

  // entrance animation
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(10)).current;

  // toast animation
  const toastY = useRef(new Animated.Value(14)).current;
  const toastA = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [toast, setToast] = useState<ToastState>({
    visible: false,
    title: "",
    message: "",
    tone: "info",
  });

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

  // ✅ فقط برای دیباگ (اختیاری)
  useEffect(() => {
    if (!state) return;
    console.log("[ChoosePath] state.tabState =", state?.tabState);
    console.log("[ChoosePath] state.review =", state?.review?.session);
    console.log("[ChoosePath] state.paywall =", state?.ui?.paywall);
  }, [state]);

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
      mintBorder: "rgba(74, 222, 128, .22)",
      blueBorder: "rgba(96, 165, 250, .22)",
      toastGlass: "rgba(3,7,18,.92)",
      toastBorder: "rgba(255,255,255,.14)",
      toneInfo: "rgba(96,165,250,.22)",
      toneSuccess: "rgba(74,222,128,.22)",
      toneDanger: "rgba(248,113,113,.22)",
    }),
    []
  );

  const phone = me?.phone as string | undefined;

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
        ]).start(() => {
          setToast((t) => ({ ...t, visible: false }));
        });
      }, ms);
    },
    [toastA, toastY]
  );

  const postJsonSafe = async (url: string, body: any) => {
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
  };

  const handleBadResponse = (res: Response, json: any, text: string) => {
    if (res.status === 404) {
      showToast(
        { tone: "info", title: "هنوز آماده نیست", message: "این بخش هنوز روی سرور فعال نشده." },
        2800
      );
      return;
    }

    if (json && typeof json === "object") {
      const err = json.error || json.message || "REQUEST_FAILED";
      showToast(
        { tone: "danger", title: "درخواست ناموفق بود", message: `(${res.status}) ${String(err)}` },
        3200
      );
      return;
    }

    showToast(
      { tone: "danger", title: "خطای ارتباط", message: `پاسخ معتبر نبود. (HTTP ${res.status})` },
      3200
    );
  };

  // ✅ مسیر درست: review/choose
  const CHOOSE_URL = `${BACKEND_URL}/api/pelekan/review/choose`;

  const choose = async (choice: "skip_review" | "review") => {
    if (!phone) {
      showToast({ tone: "danger", title: "خطا", message: "شماره کاربر پیدا نشد." }, 2800);
      return;
    }

    try {
      setBusy(choice);
      const { res, json, text } = await postJsonSafe(CHOOSE_URL, { phone, choice });

      if (!res.ok || !json?.ok) {
        return handleBadResponse(res, json, text);
      }

      showToast(
        {
          tone: "success",
          title: "ثبت شد",
          message: choice === "review" ? "می‌ریم برای بازسنجی رابطه." : "می‌ریم برای شروع مسیر فراموش کردن.",
        },
        1800
      );

      await onRefresh?.();

      // ✅ دیباگ بعد از refresh (اگر parent سریع state رو آپدیت کنه)
      console.log("[ChoosePath] after refresh -> expecting tabState='review' when choice=review");
    } catch (e) {
      showToast(
        { tone: "danger", title: "ارتباط برقرار نشد", message: "اینترنت یا دسترسی به سرور را بررسی کن و دوباره بزن." },
        3200
      );
    } finally {
      setBusy(null);
    }
  };

  const toneBorder =
    toast.tone === "success" ? palette.toneSuccess : toast.tone === "danger" ? palette.toneDanger : palette.toneInfo;

  return (
    <View style={[styles.full, { backgroundColor: palette.bg }]}>
      <Animated.View style={[styles.centerWrap, { opacity: fade, transform: [{ translateY: slide }] }]}>
        <View style={[styles.card, { backgroundColor: palette.glass, borderColor: palette.border }]}>
          <Text style={[styles.title, { color: palette.text }]}>انتخاب مسیر</Text>
          <Text style={[styles.subText, { color: palette.sub }]}>
            یکی برای «رها کردن و جلو رفتن»، یکی برای «بررسی واقع‌بینانه احتمال ترمیم رابطه».
          </Text>

          {/* گزینه ۱: فراموش کردن */}
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => choose("skip_review")}
            disabled={!!busy}
            style={[
              styles.choiceCard,
              {
                borderColor: palette.mintBorder,
                backgroundColor: "rgba(255,255,255,.04)",
                opacity: busy && busy !== "skip_review" ? 0.6 : 1,
              },
            ]}
          >
            <Text style={[styles.choiceTitle, { color: palette.text }]}>می‌خوام فراموشش کنم</Text>
            <Text style={[styles.choiceDesc, { color: palette.faint }]}>ورود به پلکان و شروع مسیر درمان</Text>
            <View style={{ marginTop: 12 }}>
              <View style={[styles.glassBtn, { backgroundColor: palette.btnBg, borderColor: palette.btnBorder }]}>
                {busy === "skip_review" ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <ActivityIndicator />
                    <Text style={[styles.glassBtnText, { color: palette.text }]}>در حال ثبت…</Text>
                  </View>
                ) : (
                  <Text style={[styles.glassBtnText, { color: palette.text }]}>ادامه</Text>
                )}
              </View>
            </View>
          </TouchableOpacity>

          {/* گزینه ۲: بازسنجی رابطه */}
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => choose("review")}
            disabled={!!busy}
            style={[
              styles.choiceCard,
              {
                marginTop: 12,
                borderColor: palette.blueBorder,
                backgroundColor: "rgba(255,255,255,.04)",
                opacity: busy && busy !== "review" ? 0.6 : 1,
              },
            ]}
          >
            <Text style={[styles.choiceTitle, { color: palette.text }]}>
              می‌خوام احتمال درست شدن رابطه رو بررسی کنم
            </Text>
            <Text style={[styles.choiceDesc, { color: palette.faint }]}>
              بازسنجی رابطه با آزمون‌ها (نتیجه نهایی بعد از PRO نمایش داده می‌شود)
            </Text>
            <View style={{ marginTop: 12 }}>
              <View style={[styles.glassBtn, { backgroundColor: palette.btnBg, borderColor: palette.btnBorder }]}>
                {busy === "review" ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <ActivityIndicator />
                    <Text style={[styles.glassBtnText, { color: palette.text }]}>در حال ثبت…</Text>
                  </View>
                ) : (
                  <Text style={[styles.glassBtnText, { color: palette.text }]}>ادامه</Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Toast */}
      {toast.visible ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toastWrap,
            {
              opacity: toastA,
              transform: [{ translateY: toastY }],
            },
          ]}
        >
          <View
            style={[
              styles.toastCard,
              {
                backgroundColor: palette.toastGlass,
                borderColor: palette.toastBorder,
              },
            ]}
          >
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

const styles = StyleSheet.create({
  full: { flex: 1 },
  centerWrap: { flex: 1, paddingHorizontal: 16, justifyContent: "center" },
  card: { borderWidth: 1, borderRadius: 18, paddingVertical: 16, paddingHorizontal: 16 },
  title: { fontSize: 18, fontWeight: "900", textAlign: "center" },
  subText: { marginTop: 10, fontSize: 13, lineHeight: 20, textAlign: "center", fontWeight: "700" },
  choiceCard: { borderRadius: 16, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 14 },
  choiceTitle: { fontSize: 14, fontWeight: "900", textAlign: "right", lineHeight: 20 },
  choiceDesc: { marginTop: 6, fontSize: 12, fontWeight: "700", textAlign: "right", lineHeight: 18 },
  glassBtn: { paddingVertical: 12, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  glassBtnText: { fontSize: 13, fontWeight: "900" },
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