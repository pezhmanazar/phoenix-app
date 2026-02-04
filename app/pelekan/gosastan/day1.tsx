// app/pelekan/gosastan/day1.tsx

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

export default function GosastanDay1Placeholder() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const copy = useMemo(() => {
    return {
      title: "گسستن : روز یک",
      badge: "در حال توسعه",
      headline: "این بخش به‌زودی اضافه می‌شه.",
      body: [
        "ما «گسستن» رو نصفه‌نیمه منتشر نمی‌کنیم؛ چون اگه ناقص باشه، به‌جای کمک کردن ممکنه دوباره آدم رو بندازه توی درگیری و وسواس فکری.",
        "تو آپدیت‌های بعدی، ویس‌ها و تمرین‌های روزهای گسستن کامل میاد و دقیقاً از همین نقطه ادامه می‌دی؛ بدون اینکه چیزی از مسیرت کم بشه.",
        "فعلاً بهترین کار اینه که «بستن» رو کامل جلو ببری. وقتی گسستن آماده شد، همین‌جا باز می‌شه و مسیرت یک‌دست ادامه پیدا می‌کنه.",
      ],
      note: "اگه پیشنهاد داری، از بخش پشتیبانی بهمون بگو روی چی حساس‌تری یا چی رو بیشتر لازم داری.",
      back: "بازگشت به پلکان",
      goBastan: "رفتن به مرحله بستن",
      support: "ارسال پیام به بخش پشتیبانی",
    };
  }, []);

  const goSupport = () => {
    // ✅ مسیر درست تب پشتیبانی
    router.push("/(tabs)/Panah" as any);
  };

  return (
    <SafeAreaView style={[styles.root, { paddingTop: insets.top }]} edges={["top", "left", "right"]}>
      <View pointerEvents="none" style={styles.glowTop} />
      <View pointerEvents="none" style={styles.glowBottom} />

      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <View style={styles.iconCircle}>
            <Ionicons name="link" size={22} color="#FFFFFF" />
          </View>

          <View style={styles.badge}>
            <Text style={styles.badgeText}>{copy.badge}</Text>
          </View>
        </View>

        {/* ✅ عناوین وسط‌چین */}
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.headline}>{copy.headline}</Text>

        <View style={styles.card}>
          {copy.body.map((t, idx) => (
            <View key={idx} style={styles.bulletRow}>
              {/* ✅ نقطه سمت راست */}
              <View style={styles.dot} />
              {/* ✅ متن‌ها راست‌چین */}
              <Text style={styles.desc}>{t}</Text>
            </View>
          ))}

          <View style={styles.divider} />

          <View style={styles.noteRow}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color="rgba(231,238,247,.78)" />
            <Text style={styles.noteText}>{copy.note}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.btn, styles.btnPrimary]}
            onPress={() => router.push("/pelekan/bastan" as any)}
          >
            <Ionicons name="folder" size={18} color="#0b0f14" />
            <Text style={[styles.btnText, styles.btnTextPrimary]}>{copy.goBastan}</Text>
          </TouchableOpacity>

          {/* ✅ ارسال پیشنهاد -> تب پناه (پشتیبانی) */}
          <TouchableOpacity activeOpacity={0.9} style={[styles.btn, styles.btnSecondary]} onPress={goSupport}>
            <Ionicons name="paper-plane-outline" size={18} color="#F9FAFB" />
            <Text style={[styles.btnText, styles.btnTextSecondary]}>{copy.support}</Text>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.9} style={[styles.btn, styles.btnGhost]} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={18} color="rgba(231,238,247,.85)" />
            <Text style={[styles.btnText, styles.btnTextGhost]}>{copy.back}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b0f14" },

  glowTop: {
    position: "absolute",
    top: -10,
    left: -80,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: "rgba(212,175,55,.14)",
    transform: [{ rotate: "12deg" }],
  },
  glowBottom: {
    position: "absolute",
    bottom: -40,
    right: -90,
    width: 300,
    height: 300,
    borderRadius: 999,
    backgroundColor: "rgba(233,138,21,.10)",
  },

  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  iconWrap: { alignItems: "center", marginBottom: 10 },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 999,
    backgroundColor: "rgba(3,7,18,.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(233,138,21,.16)",
    borderWidth: 1,
    borderColor: "rgba(233,138,21,.35)",
  },
  badgeText: { color: "#E98A15", fontSize: 11, fontWeight: "900" },

  /* ✅ عناوین وسط‌چین */
  title: { color: "#F9FAFB", fontSize: 22, fontWeight: "900", textAlign: "center", marginTop: 6 },
  headline: {
    color: "rgba(231,238,247,.85)",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 10,
    maxWidth: 360,
  },

  card: {
    width: "100%",
    maxWidth: 440,
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(3,7,18,.82)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
  },

  // ✅ RTL bullet row: dot باید سمت راست باشد
  bulletRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    columnGap: 10, // RN جدید
    marginBottom: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    marginTop: 7,
    backgroundColor: "rgba(212,175,55,.85)",
  },

  /* ✅ متن‌ها راست‌چین */
  desc: {
    flex: 1,
    color: "rgba(231,238,247,.75)",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "right",
    writingDirection: "rtl",
  },

  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,.08)",
    marginVertical: 10,
  },

  // ✅ آیکن چپ، متن راست‌چین: با row-reverse بهتر در RTL
  noteRow: { flexDirection: "row-reverse", alignItems: "center", columnGap: 10 },

  noteText: {
    flex: 1,
    color: "rgba(231,238,247,.70)",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "right",
    writingDirection: "rtl",
  },

  actions: { width: "100%", maxWidth: 440, marginTop: 14, rowGap: 10 },

  btn: {
    width: "100%",
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    columnGap: 10,
  },

  btnPrimary: { backgroundColor: "#E98A15" },
  btnSecondary: {
    backgroundColor: "rgba(255,255,255,.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.14)",
  },
  btnGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
  },

  btnText: { fontSize: 14, fontWeight: "900" },
  btnTextPrimary: { color: "#0b0f14" },
  btnTextSecondary: { color: "#F9FAFB" },
  btnTextGhost: { color: "rgba(231,238,247,.85)" },
});