// app/onboarding.tsx
import React, { useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, Dimensions, Pressable } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

const KEY = "hasOnboarded_v1";
const { width } = Dimensions.get("window");

export default function Onboarding() {
  const slides = useMemo(
    () => [
      { t: "برنامه روزانه برای عبور از جدایی", d: "هر روز یک قدم کوچک، بدون سردرگمی." },
      { t: "تمرین‌های کوتاه با توضیح علمی", d: "شفاف، کاربردی، قابل انجام حتی وقتی بی‌انرژی هستی." },
      { t: "پیگیری پیشرفت و حس کنترل", d: "می‌فهمی کجایی و قدم بعدی چیه." },
    ],
    []
  );

  const listRef = useRef<FlatList>(null);
  const [index, setIndex] = useState(0);

  async function finish() {
    await AsyncStorage.setItem(KEY, "1");
    router.replace("/(auth)/login");
  }

  function next() {
    const nxt = Math.min(index + 1, slides.length - 1);
    listRef.current?.scrollToIndex({ index: nxt, animated: true });
  }

  return (
    <View style={styles.root}>
      <View style={styles.topRow}>
        <Pressable onPress={finish} hitSlop={10}>
          <Text style={styles.skip}>رد کردن</Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / width);
          setIndex(i);
        }}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <Text style={styles.title}>{item.t}</Text>
            <Text style={styles.desc}>{item.d}</Text>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>

        <Pressable
          onPress={index === slides.length - 1 ? finish : next}
          style={styles.cta}
        >
          <Text style={styles.ctaText}>
            {index === slides.length - 1 ? "شروع" : "بعدی"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b0f14" },
  topRow: { paddingTop: 22, paddingHorizontal: 18, alignItems: "flex-end" },
  skip: { color: "rgba(231,238,247,.75)", fontSize: 14, fontWeight: "700" },

  slide: { paddingHorizontal: 22, justifyContent: "center" },
  title: { color: "#e8eef7", fontSize: 22, fontWeight: "900", marginBottom: 10 },
  desc: { color: "rgba(231,238,247,.7)", fontSize: 14, lineHeight: 22 },

  footer: { paddingHorizontal: 18, paddingBottom: 22, gap: 14 },
  dots: { flexDirection: "row", gap: 8, justifyContent: "center" },
  dot: { width: 8, height: 8, borderRadius: 99, backgroundColor: "rgba(255,255,255,.18)" },
  dotActive: { width: 20, backgroundColor: "#D4AF37" },

  cta: {
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(212,175,55,.16)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,.35)",
  },
  ctaText: { color: "#e8eef7", fontSize: 14, fontWeight: "900" },
});