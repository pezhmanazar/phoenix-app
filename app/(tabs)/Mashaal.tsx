// app/(tabs)/Mashaal.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import SharedInlineAudioPlayer from "../../components/pelekan/SharedInlineAudioPlayer";
import PlanStatusBadge from "../../components/PlanStatusBadge";
import { AUDIO_KEYS, mediaUrl } from "../../constants/media";
import { useUser } from "../../hooks/useUser";
import { getPlanStatus, PRO_FLAG_KEY } from "../../lib/plan";

type PlanView = "free" | "pro" | "expired";

/* ----------------------------- UI ----------------------------- */

const palette = {
  bg: "#0b0f14",
  text: "#F9FAFB",
  sub2: "rgba(231,238,247,.70)",
  border2: "rgba(255,255,255,.10)",
  glass: "rgba(255,255,255,.04)",
  glass2: "rgba(3,7,18,.92)",
  gold: "#D4AF37",
  orange: "#E98A15",
};

/* ------------------ تب مشعل ------------------ */

export default function Mashaal() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { me } = useUser();

  const [planView, setPlanView] = useState<PlanView>("free");
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [expandedAudioKey, setExpandedAudioKey] = useState<string | null>(null);
  const [activeAudioKey, setActiveAudioKey] = useState<string | null>(null);

  const isProPlan = planView === "pro";

  const MASHAAL_INTRO_URL = useMemo(() => mediaUrl(AUDIO_KEYS.mashaal.intro), []);

const mashaalLessons = useMemo(
  () => [
    { id: "21", key: AUDIO_KEYS.mashaal.lesson21, title: "این رابطه چرا تموم شد؟" },
    { id: "22", key: AUDIO_KEYS.mashaal.lesson22, title: "امکان بازگشت؟" },
    { id: "23", key: AUDIO_KEYS.mashaal.lesson23, title: "عشق سالم یا وابستگی؟" },
    { id: "24", key: AUDIO_KEYS.mashaal.lesson24, title: "مرزهای رابطه سالم" },
    { id: "25", key: AUDIO_KEYS.mashaal.lesson25, title: "تصمیم‌گیری برای مسیر پیش رو" },

    { id: "01", key: AUDIO_KEYS.mashaal.lesson01, title: "شکست عشقی چیست؟" },
    { id: "02", key: AUDIO_KEYS.mashaal.lesson02, title: "نقش مغز در درد شکست عشقی" },
    { id: "03", key: AUDIO_KEYS.mashaal.lesson03, title: "چه چیزی رو از دست دادم؟" },
    { id: "04", key: AUDIO_KEYS.mashaal.lesson04, title: "مغز عاشق و مغز محروم" },
    { id: "05", key: AUDIO_KEYS.mashaal.lesson05, title: "سوگ عاطفی" },
    { id: "06", key: AUDIO_KEYS.mashaal.lesson06, title: "اعتیاد به رابطه" },
    { id: "07", key: AUDIO_KEYS.mashaal.lesson07, title: "چرا نمی‌تونم رهایش کنم؟" },
    { id: "08", key: AUDIO_KEYS.mashaal.lesson08, title: "انواع وابستگی" },
    { id: "09", key: AUDIO_KEYS.mashaal.lesson09, title: "معرفی سبک‌های دلبستگی" },
    { id: "10", key: AUDIO_KEYS.mashaal.lesson10, title: "نقش طرحواره‌ها در شکست عشقی" },
    { id: "11", key: AUDIO_KEYS.mashaal.lesson11, title: "معرفی سایر طرحواره‌ها" },
    { id: "12", key: AUDIO_KEYS.mashaal.lesson12, title: "چرا این رابطه برای من این‌قدر مهم بود؟" },
    { id: "13", key: AUDIO_KEYS.mashaal.lesson13, title: "خطاهای شناختی" },
    { id: "14", key: AUDIO_KEYS.mashaal.lesson14, title: "نشخوار فکری" },
    { id: "15", key: AUDIO_KEYS.mashaal.lesson15, title: "چراهای بعد از شکست" },
    { id: "16", key: AUDIO_KEYS.mashaal.lesson16, title: "باورهای اشتباه رایج" },
    { id: "17", key: AUDIO_KEYS.mashaal.lesson17, title: "خیانت از نگاه روان‌شناختی" },
    { id: "18", key: AUDIO_KEYS.mashaal.lesson18, title: "زخم طرد" },
    { id: "19", key: AUDIO_KEYS.mashaal.lesson19, title: "شرم، مقایسه، خودسرزنشی" },
    { id: "20", key: AUDIO_KEYS.mashaal.lesson20, title: "عزت‌نفس بعد از شکست" },
  ].map((item) => ({
    ...item,
    url: mediaUrl(item.key),
  })),
  []
);

  const activateAudio = useCallback((key: string) => {
  setActiveAudioKey(key);
  setExpandedAudioKey(key);
}, []);

const deactivateAudio = useCallback((key: string) => {
  setActiveAudioKey((prev) => (prev === key ? null : prev));
  setExpandedAudioKey((prev) => (prev === key ? null : prev));
}, []);

  const syncPlan = useCallback(async () => {
    try {
      const flag = await AsyncStorage.getItem(PRO_FLAG_KEY);
      const status = getPlanStatus(me);
      const flagIsPro = flag === "1";

      let view: PlanView = "free";

      if (status.rawExpiresAt) {
        if (status.isExpired) view = "expired";
        else if (status.isPro || flagIsPro) view = "pro";
        else view = "free";
      } else {
        view = status.isPro || flagIsPro ? "pro" : "free";
      }

      setPlanView(view);
    } catch {
      setPlanView("free");
    }
  }, [me]);

  useEffect(() => {
    (async () => {
      setLoadingPlan(true);
      await syncPlan();
      setLoadingPlan(false);
    })();
  }, [syncPlan]);

  useFocusEffect(
  useCallback(() => {
    syncPlan();

    return () => {
      setActiveAudioKey(null);
      setExpandedAudioKey(null);
    };
  }, [syncPlan])
);

  const goToSubscription = () => {
    router.push("/Subscription");
  };

  if (loadingPlan) {
    return (
      <SafeAreaView edges={["top"]} style={styles.root}>
        <View pointerEvents="none" style={styles.bgGlowTop} />
        <View pointerEvents="none" style={styles.bgGlowBottom} />

        <View style={styles.center}>
          <ActivityIndicator color={palette.gold} />
          <Text style={styles.centerText}>در حال آماده‌سازی مشعل…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.root}>
      <View pointerEvents="none" style={styles.bgGlowTop} />
      <View pointerEvents="none" style={styles.bgGlowBottom} />

      <View style={[styles.headerBar, { paddingTop: 10 }]}>
        <View style={styles.headerLeft}>
          <PlanStatusBadge me={me} showExpiringText />
        </View>

        <View style={styles.headerCenter} pointerEvents="none">
          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              مــــــشعل
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <View style={{ width: 120 }} />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: 10,
          paddingBottom: Math.max(18, insets.bottom + 120),
        }}
        showsVerticalScrollIndicator={false}
      >
        {!isProPlan ? (
          <View style={styles.lockCard}>
            {planView === "expired" ? (
              <>
                <Text style={styles.lockTitle}>اشتراکت منقضی شده و مشعل فعلاً برات قفله.</Text>

                <Text style={styles.lockBody}>
                  مشعل جاییه که ویدیوها و ویس‌های آموزشی عمیقِ شکست عشقی جمع شده؛ برای فهمیدن مغزت، الگوها، و ساختن
                  مهارت‌های جدید.
                  {"\n\n"}
                  برای این‌که دوباره به همهٔ درس‌ها و مسیرهای آموزشی دسترسی داشته باشی، پلن ققنوس رو تمدید کن و ادامه بده.
                </Text>

                <View style={{ height: 14 }} />
                <Text style={styles.lockHintText}>معرفی کوتاه مشعل (صوتی):</Text>
                <View style={{ height: 10 }} />
                <SharedInlineAudioPlayer
  url={MASHAAL_INTRO_URL}
  storageKey={"mashaal:introLocked:v1"}
  expanded={expandedAudioKey === "mashaal:introLocked:v1"}
  isActive={activeAudioKey === "mashaal:introLocked:v1"}
  onPlayRequest={() => activateAudio("mashaal:introLocked:v1")}
  onPauseRequest={() => deactivateAudio("mashaal:introLocked:v1")}
  onPlaybackFinish={() => deactivateAudio("mashaal:introLocked:v1")}
  palette={{
    border2: palette.border2,
    text: palette.text,
    sub2: palette.sub2,
    gold: palette.gold,
    glass2: palette.glass2,
  }}
/>
                <View style={{ height: 14 }} />

                <TouchableOpacity activeOpacity={0.9} onPress={goToSubscription} style={styles.proBtn}>
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons name="card" size={18} color={palette.bg} />
                    <Text style={styles.proBtnText}>تمدید / خرید اشتراک پرو</Text>
                  </View>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
                  <Ionicons name="school" size={22} color="#D4AF37" />
                  <Text style={styles.lockTitle}>
                    اینجا «مشعل»ـه؛ جایی که ویدیوها و ویس‌های آموزشی عمیق و کاربردی‌ات قرار می‌گیره.
                  </Text>
                </View>

                <Text style={[styles.lockBody, { marginTop: 10 }]}>
                  این تب برای این ساخته شده که فقط حالِت کمی بهتر نشه؛ واقعاً مهارت بسازی برای مدیریت احساس، وسواس فکری،
                  ترس از تنهایی و بازسازی عزت‌نفس بعد از جدایی.
                </Text>

                <View style={{ marginTop: 14, gap: 6 }}>
                  <View style={styles.bulletRow}>
                    <Ionicons name="play-outline" size={16} color="#D4AF37" />
                    <Text style={styles.bulletText}>ویدیوهای کوتاه و کاربردی با مثال‌های واقعی از مراجعان</Text>
                  </View>
                  <View style={styles.bulletRow}>
                    <Ionicons name="mic-outline" size={16} color="#D4AF37" />
                    <Text style={styles.bulletText}>ویس‌هایی که هر وقت حوصله تصویر نداری، می‌تونی گوش کنی</Text>
                  </View>
                  <View style={styles.bulletRow}>
                    <Ionicons name="trail-sign-outline" size={16} color="#D4AF37" />
                    <Text style={styles.bulletText}>مسیرهای آموزشی مرحله‌به‌مرحله برای عبور سالم از شکست عشقی</Text>
                  </View>
                </View>

                <View style={styles.lockHintBox}>
                  <Text style={styles.lockHintText}>
                    برای باز شدن کامل «مشعل» و دسترسی به همه‌ی ویدیوها و ویس‌های آموزشی، باید پلن PRO را از تب پرداخت فعال کنی.
                  </Text>
                </View>

                <View style={{ height: 14 }} />
                <Text style={styles.lockHintText}>قبل از تصمیم، این معرفی کوتاه رو گوش کن:</Text>
                <View style={{ height: 10 }} />
                <SharedInlineAudioPlayer
  url={MASHAAL_INTRO_URL}
  storageKey={"mashaal:introLocked:v1"}
  expanded={expandedAudioKey === "mashaal:introLocked:v1"}
  isActive={activeAudioKey === "mashaal:introLocked:v1"}
  onPlayRequest={() => activateAudio("mashaal:introLocked:v1")}
  onPauseRequest={() => deactivateAudio("mashaal:introLocked:v1")}
  onPlaybackFinish={() => deactivateAudio("mashaal:introLocked:v1")}
  palette={{
    border2: palette.border2,
    text: palette.text,
    sub2: palette.sub2,
    gold: palette.gold,
    glass2: palette.glass2,
  }}
/>
                <View style={{ height: 14 }} />

                <TouchableOpacity activeOpacity={0.9} onPress={goToSubscription} style={styles.proBtn}>
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons name="rocket" size={18} color={palette.bg} />
                    <Text style={styles.proBtnText}>خرید اشتراک پرو</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : (
          <View style={[styles.lockCard, { marginTop: 6 }]}>
  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
    <Ionicons name="play-circle" size={22} color={palette.gold} />
    <Text style={styles.lockTitle}>درس‌های مشعل</Text>
  </View>

  <View style={{ height: 12 }} />

  <View style={{ gap: 12 }}>
    {mashaalLessons.map((lesson) => {
      const audioKey = `mashaal:${lesson.id}:v1`;

      return (
        <View key={lesson.id}>
          <Text
            style={{
              color: palette.text,
              fontSize: 13,
              fontWeight: "800",
              textAlign: "right",
              marginBottom: 8,
            }}
          >
            {lesson.title}
          </Text>

          <SharedInlineAudioPlayer
  url={lesson.url}
  storageKey={audioKey}
  expanded={expandedAudioKey === audioKey}
  isActive={activeAudioKey === audioKey}
  onPlayRequest={() => activateAudio(audioKey)}
  onPauseRequest={() => deactivateAudio(audioKey)}
  onPlaybackFinish={() => deactivateAudio(audioKey)}
  palette={{
    border2: palette.border2,
    text: palette.text,
    sub2: palette.sub2,
    gold: palette.gold,
    glass2: palette.glass2,
  }}
/>
        </View>
      );
    })}
  </View>
</View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ----------------------------- Styles ----------------------------- */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b0f14" },

  bgGlowTop: {
    position: "absolute",
    top: -260,
    left: -240,
    width: 480,
    height: 480,
    borderRadius: 999,
    backgroundColor: "rgba(212,175,55,.14)",
  },
  bgGlowBottom: {
    position: "absolute",
    bottom: -280,
    right: -260,
    width: 560,
    height: 560,
    borderRadius: 999,
    backgroundColor: "rgba(233,138,21,.10)",
  },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  centerText: {
    marginTop: 8,
    color: "rgba(231,238,247,.72)",
    fontSize: 12,
    fontWeight: "800",
  },

  headerBar: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,.08)",
    backgroundColor: "#030712",
    paddingHorizontal: 12,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  headerLeft: {
    minWidth: 120,
    alignItems: "flex-start",
    justifyContent: "flex-end",
  },

  headerCenter: {
    position: "absolute",
    left: 12,
    right: 12,
    top: 10,
    bottom: 10,
    justifyContent: "center",
    alignItems: "flex-end",
    paddingRight: 0,
  },

  headerTitleBox: {
    maxWidth: "92%",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "transparent",
    alignSelf: "flex-end",
  },

  headerTitle: {
    color: "#F9FAFB",
    fontSize: 15,
    fontWeight: "900",
    textAlign: "right",
  },

  headerActions: {
    marginLeft: "auto",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    minWidth: 120,
    justifyContent: "flex-end",
  },

  lockCard: {
    borderWidth: 1,
    borderRadius: 16,
    borderColor: "rgba(255,255,255,.08)",
    backgroundColor: "rgba(255,255,255,.04)",
    padding: 16,
    marginHorizontal: 16,
    marginTop: 6,
  },

  lockTitle: {
    color: "#F9FAFB",
    fontSize: 15,
    fontWeight: "900",
    textAlign: "right",
    lineHeight: 24,
    flex: 1,
  },

  lockBody: {
    color: "rgba(231,238,247,.80)",
    marginTop: 10,
    fontSize: 13,
    textAlign: "right",
    lineHeight: 20,
    fontWeight: "700",
  },

  lockHintBox: {
    marginTop: 16,
    padding: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
  },

  lockHintText: {
    color: "rgba(231,238,247,.82)",
    fontSize: 12,
    textAlign: "right",
    lineHeight: 18,
    fontWeight: "700",
  },

  bulletRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
  },

  bulletText: {
    fontSize: 13,
    textAlign: "right",
    flex: 1,
    color: "#E5E7EB",
    fontWeight: "700",
    lineHeight: 19,
  },

  proBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: "rgba(212,175,55,.92)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,.35)",
    marginTop: 10,
  },

  proBtnText: {
    color: "#0b0f14",
    fontWeight: "900",
    fontSize: 13,
    textAlign: "center",
  },

  proNote: {
    color: "rgba(231,238,247,.55)",
    fontSize: 11,
    textAlign: "right",
    lineHeight: 18,
    fontWeight: "800",
  },
});
