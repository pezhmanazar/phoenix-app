// app/onboarding.tsx
import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  Pressable,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const KEY = "hasOnboarded_v1";
const { width } = Dimensions.get("window");

type Slide = {
  t: string;
  d: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: "gold" | "orange" | "green" | "blue";
};

export default function Onboarding() {
  const slides = useMemo<Slide[]>(
    () => [
      {
        t: "پلکان ققنوس: مسیر روزانه برای عبور از جدایی  و شكست عشقی",
        d: "هر روز یک قدم کوچک و مشخص؛ بدون سردرگمی، بدون ول کردن وسط راه.",
        icon: "flame-outline",
        accent: "gold",
      },
      {
        t: "پناهگاه: وقتی ناگهانی حالت بد شد",
        d: "اگر یهو «اکست رو دیدی» یا موج اضطراب اومد، سریع میای پناهگاه؛ یک سناریوی آماده اجرا می‌کنی تا بدنت آروم بشه و ذهنت از هم نپاشه.",
        icon: "shield-checkmark-outline",
        accent: "orange",
      },
      {
        t: "ارتباط مستقیم با درمانگر",
        d: "وقتی گیر می‌کنی یا نیاز به راهنمایی داری، می‌تونی مستقیم با درمانگر ارتباط بگیری و مسیرت رو دقیق‌تر تنظیم کنی.",
        icon: "chatbubbles-outline",
        accent: "blue",
      },
      {
        t: "تمرین‌های کوتاه با توضیح علمی",
        d: "شفاف، کاربردی، قابل انجام حتی وقتی بی‌انرژی هستی. تکنیک‌ها با زبان ساده و پشتوانه علمی.",
        icon: "pulse-outline",
        accent: "green",
      },
    ],
    []
  );

  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);

  async function finish() {
    await AsyncStorage.setItem(KEY, "1");
    router.replace("/");
  }

  function next() {
    const nxt = Math.min(index + 1, slides.length - 1);
    listRef.current?.scrollToIndex({ index: nxt, animated: true });
  }

  const current = slides[index];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" />
      <View style={styles.root}>
        {/* پس‌زمینه گِرِدیِنت-طور ساده و سبک */}
        <View style={styles.bgGlow1} />
        <View style={styles.bgGlow2} />

        {/* Top bar */}
        <View style={styles.topRow}>
          <Pressable onPress={finish} hitSlop={10} style={styles.skipBtn}>
            <Text style={styles.skip}>رد کردن</Text>
          </Pressable>
        </View>

        {/* Slides */}
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
              <View style={styles.card}>
                <View style={styles.iconWrap}>
                  <View style={[styles.iconBadge, accentStyle(item.accent).badge]}>
                    <Ionicons
                      name={item.icon}
                      size={28}
                      color={accentStyle(item.accent).icon}
                    />
                  </View>
                </View>

                <Text style={styles.title}>{item.t}</Text>
                <Text style={styles.desc}>{item.d}</Text>

                {/* یک ریز-هایلایت کوتاه برای حس “برند” */}
                <View style={styles.highlightRow}>
                  <View style={[styles.pill, accentStyle(item.accent).pill]}>
                    <Text style={styles.pillText}>سریع | ساده | قابل اجرا</Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        />

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.dots}>
            {slides.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === index && styles.dotActive,
                  i === index && accentStyle(current.accent).dotActive,
                ]}
              />
            ))}
          </View>

          <Pressable
            onPress={index === slides.length - 1 ? finish : next}
            style={[styles.cta, accentStyle(current.accent).cta]}
          >
            <Text style={styles.ctaText}>
              {index === slides.length - 1 ? "شروع" : "بعدی"}
            </Text>
            <Ionicons
              name={index === slides.length - 1 ? "sparkles-outline" : "arrow-forward-outline"}
              size={18}
              color="#e8eef7"
              style={{ marginLeft: 8 }}
            />
          </Pressable>

          <Text style={styles.hint}>
            با «شروع» وارد مرحله ورود و دریافت کد می‌شی.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

function accentStyle(accent: Slide["accent"]) {
  // رنگ‌های برند ققنوس + چند حالت نرم
  switch (accent) {
    case "gold":
      return {
        icon: "#D4AF37",
        badge: { borderColor: "rgba(212,175,55,.45)", backgroundColor: "rgba(212,175,55,.10)" },
        cta: { borderColor: "rgba(212,175,55,.45)", backgroundColor: "rgba(212,175,55,.16)" },
        dotActive: { backgroundColor: "#D4AF37" },
        pill: { borderColor: "rgba(212,175,55,.35)", backgroundColor: "rgba(212,175,55,.10)" },
      };
    case "orange":
      return {
        icon: "#E98A15",
        badge: { borderColor: "rgba(233,138,21,.45)", backgroundColor: "rgba(233,138,21,.10)" },
        cta: { borderColor: "rgba(233,138,21,.45)", backgroundColor: "rgba(233,138,21,.14)" },
        dotActive: { backgroundColor: "#E98A15" },
        pill: { borderColor: "rgba(233,138,21,.35)", backgroundColor: "rgba(233,138,21,.10)" },
      };
    case "green":
      return {
        icon: "#22c55e",
        badge: { borderColor: "rgba(34,197,94,.45)", backgroundColor: "rgba(34,197,94,.10)" },
        cta: { borderColor: "rgba(34,197,94,.45)", backgroundColor: "rgba(34,197,94,.14)" },
        dotActive: { backgroundColor: "#22c55e" },
        pill: { borderColor: "rgba(34,197,94,.35)", backgroundColor: "rgba(34,197,94,.10)" },
      };
    case "blue":
    default:
      return {
        icon: "#60a5fa",
        badge: { borderColor: "rgba(96,165,250,.45)", backgroundColor: "rgba(96,165,250,.10)" },
        cta: { borderColor: "rgba(96,165,250,.45)", backgroundColor: "rgba(96,165,250,.14)" },
        dotActive: { backgroundColor: "#60a5fa" },
        pill: { borderColor: "rgba(96,165,250,.35)", backgroundColor: "rgba(96,165,250,.10)" },
      };
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b0f14" },
  root: { flex: 1, backgroundColor: "#0b0f14" },

  bgGlow1: {
    position: "absolute",
    width: 520,
    height: 520,
    borderRadius: 520,
    left: -260,
    top: -260,
    backgroundColor: "rgba(212,175,55,.10)",
  },
  bgGlow2: {
    position: "absolute",
    width: 560,
    height: 560,
    borderRadius: 560,
    right: -280,
    bottom: -280,
    backgroundColor: "rgba(233,138,21,.10)",
  },

  topRow: {
    paddingHorizontal: 18,
    paddingTop: 6,
    alignItems: "flex-end",
  },
  skipBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(255,255,255,.04)",
  },
  skip: { color: "rgba(231,238,247,.80)", fontSize: 13, fontWeight: "800" },

  slide: {
    paddingHorizontal: 18,
    justifyContent: "center",
    alignItems: "center",
  },

  card: {
    width: "100%",
    borderRadius: 24,
    paddingVertical: 22,
    paddingHorizontal: 18,
    backgroundColor: "rgba(255,255,255,.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 6,
    alignItems: "center",
  },

  iconWrap: { marginBottom: 14 },
  iconBadge: {
    width: 62,
    height: 62,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  title: {
    color: "#e8eef7",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
    lineHeight: 30,
    marginBottom: 10,
  },
  desc: {
    color: "rgba(231,238,247,.72)",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    paddingHorizontal: 6,
  },

  highlightRow: { marginTop: 14 },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: {
    color: "rgba(231,238,247,.88)",
    fontSize: 12,
    fontWeight: "800",
  },

  footer: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    gap: 12,
  },

  dots: { flexDirection: "row", gap: 8, justifyContent: "center" },
  dot: { width: 8, height: 8, borderRadius: 99, backgroundColor: "rgba(255,255,255,.18)" },
  dotActive: { width: 20 },

  cta: {
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    borderWidth: 1,
  },
  ctaText: { color: "#e8eef7", fontSize: 14, fontWeight: "900" },

  hint: {
    textAlign: "center",
    fontSize: 12,
    color: "rgba(231,238,247,.55)",
  },
});