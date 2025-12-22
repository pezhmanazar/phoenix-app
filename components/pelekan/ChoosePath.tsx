// components/pelekan/ChoosePath.tsx
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
import BACKEND_URL from "../../constants/backend";

type Props = {
  me: any;
  state: any;
  onRefresh?: () => Promise<void> | void;
};

export default function ChoosePath({ me, onRefresh }: Props) {
  const [busy, setBusy] = useState<null | "treatment" | "review">(null);

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
    }),
    []
  );

  const phone = me?.phone as string | undefined;

  // ✅ فعلاً این‌ها وجود ندارن؛ بعداً در بک‌اند می‌سازیم
  const START_TREATMENT_URL = `${BACKEND_URL}/api/pelekan/treatment/start`;
  const START_REVIEW_URL = `${BACKEND_URL}/api/pelekan/review/start`;

  const post = async (url: string) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });

    // بعضی وقت‌ها 404/500 برمی‌گرده و JSON نیست؛ اینجا امنش می‌کنیم
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    return { res, json, text };
  };

  const handleNotReady = (res: Response, text: string) => {
    // اگر روت وجود ندارد یا پاسخ JSON نبود، پیام درست بده
    if (res.status === 404) {
      Alert.alert("هنوز آماده نیست", "این مسیر هنوز در بک‌اند پیاده‌سازی نشده.");
      return;
    }
    // اگر JSON ok=false یا هر چیز دیگر
    Alert.alert(
      "خطا",
      `درخواست ناموفق بود. (HTTP ${res.status})${
        text ? `\n\n${text.slice(0, 120)}` : ""
      }`
    );
  };

  const startTreatment = async () => {
    if (!phone) return Alert.alert("خطا", "شماره کاربر پیدا نشد.");
    try {
      setBusy("treatment");
      const { res, json, text } = await post(START_TREATMENT_URL);

      if (!res.ok) return handleNotReady(res, text);
      if (!json?.ok) return Alert.alert("خطا", "پاسخ سرور معتبر نبود.");

      await onRefresh?.();
    } catch (e: any) {
      Alert.alert("خطا", "ارتباط با سرور برقرار نشد.");
    } finally {
      setBusy(null);
    }
  };

  const startReview = async () => {
    if (!phone) return Alert.alert("خطا", "شماره کاربر پیدا نشد.");
    try {
      setBusy("review");
      const { res, json, text } = await post(START_REVIEW_URL);

      if (!res.ok) return handleNotReady(res, text);
      if (!json?.ok) return Alert.alert("خطا", "پاسخ سرور معتبر نبود.");

      await onRefresh?.();
    } catch (e: any) {
      Alert.alert("خطا", "ارتباط با سرور برقرار نشد.");
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
        <View
          style={[
            styles.card,
            { backgroundColor: palette.glass, borderColor: palette.border },
          ]}
        >
          <Text style={[styles.title, { color: palette.text }]}>انتخاب مسیر</Text>

          <Text style={[styles.subText, { color: palette.sub }]}>
            یکی برای «رها کردن و جلو رفتن»، یکی برای «بررسی واقع‌بینانه احتمال ترمیم رابطه».
          </Text>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={startTreatment}
            disabled={!!busy}
            style={[
              styles.choiceCard,
              {
                borderColor: palette.mintBorder,
                backgroundColor: "rgba(255,255,255,.04)",
                opacity: busy && busy !== "treatment" ? 0.6 : 1,
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
              <View
                style={[
                  styles.glassBtn,
                  {
                    backgroundColor: palette.btnBg,
                    borderColor: palette.btnBorder,
                  },
                ]}
              >
                {busy === "treatment" ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <ActivityIndicator />
                    <Text style={[styles.glassBtnText, { color: palette.text }]}>
                      در حال شروع…
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.glassBtnText, { color: palette.text }]}>
                    شروع مسیر
                  </Text>
                )}
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={startReview}
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
              بازسنجی رابطه با آزمون‌ها (نتیجه می‌تونه PRO-locked باشه)
            </Text>

            <View style={{ marginTop: 12 }}>
              <View
                style={[
                  styles.glassBtn,
                  {
                    backgroundColor: palette.btnBg,
                    borderColor: palette.btnBorder,
                  },
                ]}
              >
                {busy === "review" ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <ActivityIndicator />
                    <Text style={[styles.glassBtnText, { color: palette.text }]}>
                      در حال شروع…
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.glassBtnText, { color: palette.text }]}>
                    شروع بازسنجی
                  </Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </Animated.View>
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
});