// components/pelekan/ChoosePath.tsx
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
import BACKEND_URL from "../../constants/backend";

type Props = {
  me: any;
  state?: any;
  onRefresh?: () => Promise<void> | void;
};

type BusyKind = null | "skip_review" | "review";

export default function ChoosePath({ me, onRefresh }: Props) {
  const [busy, setBusy] = useState<BusyKind>(null);

  // --- nice modal instead of Android Alert ---
  const [err, setErr] = useState<null | { title: string; message: string }>(null);

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

      danger: "rgba(248,113,113,.18)",
      dangerBorder: "rgba(248,113,113,.35)",
    }),
    []
  );

  const phone = (me?.phone as string | undefined) || undefined;

  // ✅ real endpoint we already tested with curl:
  // POST /api/pelekan/review/choose { phone, choice: "review" | "skip_review" }
  const CHOOSE_URL = `${BACKEND_URL}/api/pelekan/review/choose`;

  const safeParseJson = (text: string) => {
    try {
      return text ? JSON.parse(text) : null;
    } catch {
      return null;
    }
  };

  const postChoose = async (choice: "review" | "skip_review") => {
    const res = await fetch(CHOOSE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, choice }),
    });

    const text = await res.text();
    const json = safeParseJson(text);
    return { res, json, text };
  };

  const showNiceError = (title: string, message: string) => {
    setErr({ title, message });
  };

  const handleHttpError = (res: Response, text: string) => {
    if (res.status === 404) {
      showNiceError(
        "هنوز آماده نیست",
        "این بخش روی سرور پیدا نشد. احتمالاً روت هنوز دیپلوی نشده یا آدرس بک‌اند اشتباه است."
      );
      return;
    }
    if (res.status === 401 || res.status === 403) {
      showNiceError("عدم دسترسی", "اجازه دسترسی ندارید. یک‌بار از حساب خارج و دوباره وارد شوید.");
      return;
    }
    showNiceError(
      "خطا",
      `درخواست ناموفق بود (HTTP ${res.status}).\n${
        text ? text.slice(0, 160) : "پاسخی از سرور دریافت نشد."
      }`
    );
  };

  const choose = async (choice: "review" | "skip_review") => {
    if (!phone) {
      showNiceError("مشکل حساب", "شماره کاربر پیدا نشد. اول وارد حساب شو و دوباره امتحان کن.");
      return;
    }

    try {
      setBusy(choice);

      const { res, json, text } = await postChoose(choice);

      if (!res.ok) {
        handleHttpError(res, text);
        return;
      }

      if (!json?.ok) {
        showNiceError("خطا", "پاسخ سرور معتبر نبود. لطفاً دوباره تلاش کن.");
        return;
      }

      // ✅ refresh state so tabState changes (review flow / treating flow)
      await onRefresh?.();
    } catch (e: any) {
      showNiceError(
        "ارتباط برقرار نشد",
        "اتصال به سرور برقرار نشد. اینترنت/فیلترشکن/آدرس API را بررسی کن."
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={[styles.full, { backgroundColor: palette.bg }]}>
      <Animated.View
        style={[
          styles.centerWrap,
          { opacity: fade, transform: [{ translateY: slide }] },
        ]}
      >
        <View style={[styles.card, { backgroundColor: palette.glass, borderColor: palette.border }]}>
          <Text style={[styles.title, { color: palette.text }]}>انتخاب مسیر</Text>

          <Text style={[styles.subText, { color: palette.sub }]}>
            دو انتخاب داری: یا وارد مسیر «فراموشی و درمان» بشی، یا «واقع‌بینانه رابطه رو بازسنجی کنی».
          </Text>

          {/* Option 1: skip review -> go to treatment */}
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
            <Text style={[styles.choiceTitle, { color: palette.text }]}>
              می‌خوام فراموشش کنم
            </Text>
            <Text style={[styles.choiceDesc, { color: palette.faint }]}>
              ورود به پلکان و شروع مسیر درمان
            </Text>

            <View style={{ marginTop: 12 }}>
              <View style={[styles.glassBtn, { backgroundColor: palette.btnBg, borderColor: palette.btnBorder }]}>
                {busy === "skip_review" ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <ActivityIndicator />
                    <Text style={[styles.glassBtnText, { color: palette.text }]}>در حال شروع…</Text>
                  </View>
                ) : (
                  <Text style={[styles.glassBtnText, { color: palette.text }]}>شروع مسیر</Text>
                )}
              </View>
            </View>
          </TouchableOpacity>

          {/* Option 2: review */}
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
              بازسنجی رابطه + آزمون دوم (نتیجه‌ی نهایی بعد از PRO نمایش داده می‌شود)
            </Text>

            <View style={{ marginTop: 12 }}>
              <View style={[styles.glassBtn, { backgroundColor: palette.btnBg, borderColor: palette.btnBorder }]}>
                {busy === "review" ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <ActivityIndicator />
                    <Text style={[styles.glassBtnText, { color: palette.text }]}>در حال شروع…</Text>
                  </View>
                ) : (
                  <Text style={[styles.glassBtnText, { color: palette.text }]}>شروع بازسنجی</Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ✅ glass error modal */}
      {err && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: palette.glass, borderColor: palette.dangerBorder }]}>
            <Text style={[styles.modalTitle, { color: palette.text }]}>{err.title}</Text>
            <Text style={[styles.modalBody, { color: palette.sub }]}>{err.message}</Text>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setErr(null)}
              style={[
                styles.modalBtn,
                { backgroundColor: palette.btnBg, borderColor: palette.btnBorder },
              ]}
            >
              <Text style={[styles.modalBtnText, { color: palette.text }]}>باشه</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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

  modalOverlay: {
    position: "absolute",
    top: 0, right: 0, bottom: 0, left: 0,
    backgroundColor: "rgba(0,0,0,.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  modalCard: {
    width: "100%",
    maxWidth: 440,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  modalTitle: { fontSize: 16, fontWeight: "900", textAlign: "right" },
  modalBody: { marginTop: 10, fontSize: 13, lineHeight: 20, textAlign: "right", fontWeight: "700" },
  modalBtn: { marginTop: 14, borderRadius: 14, paddingVertical: 12, alignItems: "center", borderWidth: 1 },
  modalBtnText: { fontSize: 13, fontWeight: "900" },
});