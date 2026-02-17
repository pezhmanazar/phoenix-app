// app/(tabs)/Panahgah.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { Audio } from "expo-av";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { allScenarios } from "@/lib/panahgah/registry";
import PlanStatusBadge from "../../components/PlanStatusBadge";
import { useUser } from "../../hooks/useUser";
import { getPlanStatus, PRO_FLAG_KEY } from "../../lib/plan";

import { AUDIO_KEYS, mediaUrl } from "../../constants/media";

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

type PlanView = "free" | "pro" | "expired" | "expiring";

/* --------------------------- Inline Audio Player --------------------------- */

function formatMs(ms: number) {
  const safe = Number.isFinite(ms) ? ms : 0;
  const s = Math.max(0, Math.floor(safe / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function InlineAudioPlayer({
  url,
  palette,
}: {
  url: string;
  palette: {
    border2: string;
    text: string;
    sub2: string;
    gold: string;
    glass2: string;
  };
}) {
  const soundRef = useRef<Audio.Sound | null>(null);

  const opLockRef = useRef(false); // ✅ جلوگیری از دابل‌تپ/ریس‌کاندیشن
  const mountedRef = useRef(true);

  const [playing, setPlaying] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false); // ✅ NEW
  const [posMs, setPosMs] = useState(0);
  const [durMs, setDurMs] = useState(0);

  const progress = useMemo(() => {
    const d = durMs > 0 ? durMs : 0;
    const p = d > 0 ? posMs / d : 0;
    return Math.max(0, Math.min(1, p));
  }, [posMs, durMs]);

  const lock = async <T,>(fn: () => Promise<T>) => {
    if (opLockRef.current) return null as any;
    opLockRef.current = true;
    try {
      return await fn();
    } finally {
      opLockRef.current = false;
    }
  };

  const unload = useCallback(async () => {
    const s = soundRef.current;
    soundRef.current = null;

    try {
      if (s) {
        await s.stopAsync().catch(() => {});
        await s.unloadAsync().catch(() => {});
      }
    } finally {
      if (!mountedRef.current) return;
      setPlaying(false);
      setLoadingAudio(false);
      setPosMs(0);
      setDurMs(0);
    }
  }, []);

  const ensureLoaded = useCallback(async () => {
    if (soundRef.current) return;

    setLoadingAudio(true);

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    }).catch(() => {});

    const { sound } = await Audio.Sound.createAsync(
      { uri: url },
      { shouldPlay: false, isLooping: false },
      (st) => {
        if (!st?.isLoaded) return;
        if (!mountedRef.current) return;

        setPlaying(!!st.isPlaying);
        setPosMs(Number(st.positionMillis || 0));
        setDurMs(Number(st.durationMillis || 0));

        if (st.didJustFinish) {
          setPlaying(false);
        }
      }
    );

    soundRef.current = sound;

    if (!mountedRef.current) return;
    setLoadingAudio(false);
  }, [url]);

  const togglePlayPause = useCallback(() => {
    return lock(async () => {
      if (!soundRef.current) {
        await ensureLoaded();
      }

      const s = soundRef.current;
      if (!s) return;

      setLoadingAudio(true);

      const st = await s.getStatusAsync().catch(() => null);
      if (!st || !st.isLoaded) {
        if (mountedRef.current) setLoadingAudio(false);
        return;
      }

      if (st.isPlaying) {
        await s.pauseAsync().catch(() => {});
        if (!mountedRef.current) return;
        setPlaying(false);
        setLoadingAudio(false);
        return;
      }

      if (Number(st.positionMillis || 0) >= Number(st.durationMillis || 0) - 250) {
        await s.setPositionAsync(0).catch(() => {});
      }

      await s.playAsync().catch(() => {});
      if (!mountedRef.current) return;
      setPlaying(true);
      setLoadingAudio(false);
    });
  }, [ensureLoaded]);

  const seekTo = useCallback(
    (ratio: number) => {
      return lock(async () => {
        const s = soundRef.current;
        if (!s) return;

        const st = await s.getStatusAsync().catch(() => null);
        if (!st || !st.isLoaded) return;

        const d = Number(st.durationMillis || durMs || 0);
        if (d <= 0) return;

        const target = Math.max(0, Math.min(d, Math.floor(d * ratio)));
        await s.setPositionAsync(target).catch(() => {});
      });
    },
    [durMs]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      unload();
    };
  }, [unload]);

  return (
    <View style={[styles.audioRow, { borderColor: palette.border2, backgroundColor: palette.glass2 }]}>
      {/* ✅ Row order (with row-reverse): Time goes RIGHT, Play goes LEFT */}
      <View style={styles.audioInnerRow}>
        {/* ✅ Time: right */}
        <Text style={[styles.audioTimeInline, { color: palette.sub2 }]}>
          {formatMs(posMs)} / {formatMs(durMs)}
        </Text>

        {/* ✅ Bar: middle */}
        <View style={styles.audioBarCol}>
          <SeekBar progress={progress} palette={palette} onSeek={seekTo} />
        </View>

        {/* ✅ Play: left */}
        <Pressable
          style={({ pressed }) => [
            styles.audioPlayBtn,
            { opacity: pressed ? 0.85 : 1, borderColor: "rgba(255,255,255,.10)" },
          ]}
          onPress={togglePlayPause}
          hitSlop={10}
          disabled={loadingAudio && !playing}
        >
          {loadingAudio && !playing ? (
            <ActivityIndicator size="small" color={palette.text} />
          ) : (
            <Ionicons name={playing ? "pause" : "play"} size={18} color={palette.text} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

/**
 * ✅ SeekBar دقیق با onLayout (برای tap-to-seek درست)
 */
function SeekBar({
  progress,
  palette,
  onSeek,
}: {
  progress: number;
  palette: { border2: string; gold: string };
  onSeek: (ratio: number) => void;
}) {
  const wRef = useRef(1);

  return (
    <View
      onLayout={(e) => {
        wRef.current = Math.max(1, e.nativeEvent.layout.width || 1);
      }}
    >
      <Pressable
        onPress={(e) => {
          const x = Math.max(0, Math.min(wRef.current, e.nativeEvent.locationX || 0));
          onSeek(x / wRef.current);
        }}
      >
        <View style={[styles.audioBarWrap, { borderColor: palette.border2 }]}>
          <View
            style={[
              styles.audioBarFill,
              { width: `${Math.round(progress * 100)}%`, backgroundColor: palette.gold },
            ]}
          />
        </View>
      </Pressable>
    </View>
  );
}

/* ----------------------------- Screen ----------------------------- */

export default function Panahgah() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { me } = useUser();

  const [q, setQ] = useState("");
  const [planView, setPlanView] = useState<PlanView>("free");
  const [expiringDaysLeft, setExpiringDaysLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const isProPlan = planView === "pro" || planView === "expiring";

  const AUDIO_URL = useMemo(() => mediaUrl(AUDIO_KEYS.panahgahIntro), []);

  /** سینک وضعیت پلن از سرور + فلگ لوکال */
  const syncPlanView = useCallback(async () => {
    try {
      const flag = await AsyncStorage.getItem(PRO_FLAG_KEY);
      const status = getPlanStatus(me);
      const flagIsPro = flag === "1";

      let view: PlanView = "free";
      let expDays: number | null = null;

      if (status.rawExpiresAt) {
        if (status.isExpired) {
          view = "expired";
          expDays = 0;
        } else if (status.isPro || flagIsPro) {
          const d = typeof status.daysLeft === "number" ? status.daysLeft : null;
          if (d != null && d > 0 && d <= 7) {
            view = "expiring";
            expDays = d;
          } else {
            view = "pro";
            expDays = d;
          }
        } else {
          view = "free";
        }
      } else {
        if (status.isPro || flagIsPro) {
          view = "pro";
        } else {
          view = "free";
        }
      }

      setPlanView(view);
      setExpiringDaysLeft(expDays);
    } catch (e) {
      console.log("PANAHGAH PLAN ERR", e);
      setPlanView("free");
      setExpiringDaysLeft(null);
    }
  }, [me]);

  /** بارگذاری اولیه */
  useEffect(() => {
    (async () => {
      setLoading(true);
      await syncPlanView();
      setLoading(false);
    })();
  }, [syncPlanView]);

  /** هر بار فوکوس → دوباره محاسبه (بدون لودینگ فول‌اسکرین) */
  useFocusEffect(
    useCallback(() => {
      syncPlanView();
    }, [syncPlanView])
  );

  const data = useMemo(() => {
    const items = allScenarios();
    if (!q.trim()) return items;
    const qq = q.trim();
    return items.filter((s) => s.title.includes(qq) || s.id.includes(qq.replace(/\s+/g, "-")));
  }, [q]);

  /** هنگام تپ روی سناریو */
  const onTapScenario = (id: string) => {
    if (planView === "expired") {
      Alert.alert(
        "اشتراک منقضی شده",
        "اشتراکت منقضی شده و پناهگاه فعلاً برات قفله.\n\n" +
          "پناهگاه جاییه برای وقتی که یهو حالت بد میشه یا وسوسه‌ می‌شی پیام بدی، یا احساساتت بهت هجوم میارن.\n\n" +
          "برای اینکه دوباره به همه‌ی سناریوهای اورژانسی و مسیرهای نجات دسترسی داشته باشی، پلن ققنوس رو تمدید کن."
      );
      return;
    }
    if (!isProPlan) {
      Alert.alert("نسخه رایگان", "برای باز شدن کامل پناهگاه و استفاده از سناریوهای اورژانسی باید پلن PRO رو فعال کنی.");
      return;
    }
    router.push(`/panahgah/${id}`);
  };

  const renderItem = ({ item }: any) => (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onTapScenario(item.id)}
      style={[styles.card, { borderColor: "rgba(255,255,255,.08)", backgroundColor: "rgba(255,255,255,.04)" }]}
    >
      <View style={styles.row}>
        <Ionicons name="heart" size={18} color={palette.gold} />
        <Text style={[styles.title, { color: palette.text }]}>{item.title}</Text>
        <Ionicons
          name="chevron-back"
          size={18}
          color="#E5E7EB"
          style={{ transform: [{ scaleX: -1 }], opacity: 0.7 }}
        />
      </View>
    </TouchableOpacity>
  );

  const goToSubscription = () => {
    router.push("/Subscription");
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: palette.bg }]} edges={["top"]}>
        <View pointerEvents="none" style={styles.bgGlowTop} />
        <View pointerEvents="none" style={styles.bgGlowBottom} />
        <View style={[styles.center, { paddingBottom: insets.bottom }]}>
          <ActivityIndicator color={palette.gold} />
          <Text style={{ color: "#E5E7EB", marginTop: 8, fontSize: 12 }}>در حال آماده‌سازی پناهگاه…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.bg }]} edges={["top", "left", "right", "bottom"]}>
      <View pointerEvents="none" style={styles.bgGlowTop} />
      <View pointerEvents="none" style={styles.bgGlowBottom} />

      <View style={[styles.header, { paddingTop: Math.max(10, insets.top * 0.15) }]}>
        <Text style={styles.headerTitle}>پناهگاه</Text>
        <PlanStatusBadge me={me} showExpiringText />
      </View>

      {!isProPlan ? (
        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 + insets.bottom }}>
          <View style={styles.lockCard}>
            {planView === "expired" ? (
              <>
                <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
                  <Ionicons name="lock-closed" size={20} color="rgba(231,238,247,.80)" />
                  <Text style={styles.lockH1}>اشتراکت منقضی شده و پناهگاه فعلاً برات قفله.</Text>
                </View>

                <Text style={styles.lockP}>
                  پناهگاه فقط «یک لیست» نیست.
                  {"\n"}اینجا برای لحظه‌هاییه که موج میاد: وسوسه‌ی پیام دادن، چک کردن، فروپاشی شبانه، یا حمله‌ی خاطره‌ها.
                  {"\n\n"}
                  برای اینکه دوباره به سناریوهای اورژانسی و مسیرهای نجات دسترسی داشته باشی، باید اشتراک رو تمدید کنی.
                </Text>

                <View style={{ height: 12 }} />

                <Text style={styles.lockSmall}>معرفی کوتاه پناهگاه (صوتی):</Text>
                <View style={{ height: 10 }} />
                <InlineAudioPlayer
                  url={AUDIO_URL}
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

                {/* ✅ وسط‌چین طبق درخواست */}
                <Text style={[styles.lockTiny, styles.centerText, { marginTop: 10 }]}>
                  این دکمه تو رو می‌بره به صفحه اشتراک: انتخاب پلن و فعال‌سازی.
                </Text>
              </>
            ) : (
              <>
                <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
                  <Ionicons name="shield-checkmark" size={22} color={palette.gold} />
                  <Text style={styles.lockH1}>پناهگاه مخصوص لحظه‌های اورژانسی بعد از جداییه</Text>
                </View>

                <Text style={styles.lockP}>
                  اینجا جاییه که وقتی مغزت می‌گه «فقط یه پیام کوچیک بده»، تو به جای لغزش میای اینجا و یک مسیر نجات آماده رو انجام میدی.
                  {"\n\n"}
                  پناهگاه چندتا سناریو داره که هر کدوم برای یک موقعیت طراحی شدن:
                  {"\n"}- شبِ تنهایی و فروپاشی
                  {"\n"}- وسوسه‌ی چک کردن یا پیام دادن
                  {"\n"}- حمله‌ی خاطره‌ها و عکس‌ها
                  {"\n"}- اضطراب شدید و بی‌قراری
                  {"\n\n"}
                  نسخه رایگان، فقط پیش‌نمایشه. برای باز شدن کامل، باید PRO رو فعال کنی.
                </Text>

                <View style={{ height: 12 }} />

                <Text style={styles.lockSmall}>قبل از تصمیم، این معرفی کوتاه رو گوش کن:</Text>
                <View style={{ height: 10 }} />
                <InlineAudioPlayer
                  url={AUDIO_URL}
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

                {/* ✅ وسط‌چین طبق درخواست */}
                <Text style={[styles.lockTiny, styles.centerText, { marginTop: 10 }]}>
                  بعد از فعال‌سازی PRO، همه سناریوها باز می‌شن {"\n"} و می‌تونی وارد همه موقعیت‌های اورژانسی بشی.
                </Text>
              </>
            )}
          </View>
        </View>
      ) : (
        <>
          <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 }}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color="#E5E7EB" style={{ opacity: 0.6 }} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="جست‌وجوی موقعیت…"
                placeholderTextColor="rgba(231,238,247,.55)"
                style={{ flex: 1, textAlign: "right", color: palette.text, fontWeight: "800" }}
              />
            </View>
          </View>

          <FlatList
            data={data}
            keyExtractor={(it) => it.id}
            renderItem={renderItem}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingBottom: 16 + insets.bottom,
              paddingTop: 6,
            }}
          />
        </>
      )}
    </SafeAreaView>
  );
}

/* ----------------------------- Styles ----------------------------- */

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

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

  header: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(3,7,18,.92)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: 18, fontWeight: "900", color: "#F9FAFB" },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderColor: "rgba(255,255,255,.08)",
    backgroundColor: "rgba(255,255,255,.04)",
  },

  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    borderColor: "rgba(255,255,255,.08)",
    backgroundColor: "rgba(255,255,255,.04)",
  },
  row: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  title: { flex: 1, textAlign: "right", fontWeight: "900" },

  lockCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    flex: 1,
    borderColor: "rgba(255,255,255,.08)",
    backgroundColor: "rgba(255,255,255,.04)",
  },

  lockH1: {
    color: "#F9FAFB",
    fontSize: 15,
    fontWeight: "900",
    textAlign: "right",
    lineHeight: 24,
    flex: 1,
  },

  lockP: {
    color: "rgba(231,238,247,.82)",
    fontSize: 13,
    textAlign: "right",
    marginTop: 12,
    lineHeight: 22,
    fontWeight: "700",
  },

  lockSmall: {
    color: "rgba(231,238,247,.78)",
    fontSize: 12,
    textAlign: "right",
    fontWeight: "800",
  },

  lockTiny: {
    color: "rgba(231,238,247,.60)",
    fontSize: 11,
    textAlign: "right",
    lineHeight: 18,
    fontWeight: "700",
  },

  centerText: {
    textAlign: "center",
  },

  proBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: "rgba(212,175,55,.92)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,.35)",
  },

  proBtnText: {
    color: "#0b0f14",
    fontWeight: "900",
    fontSize: 13,
    textAlign: "center",
  },

  /* ---------------- Inline Audio styles ---------------- */

  audioRow: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },

  audioInnerRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },

  audioPlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,.06)",
    borderWidth: 1,
  },

  audioBarCol: {
    flex: 1,
    justifyContent: "center",
  },

  audioTimeInline: {
    width: 86,
    textAlign: "center",
    fontWeight: "900",
    fontSize: 11,
  },

  audioBarWrap: {
    height: 10,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,.04)",
    overflow: "hidden",
  },

  audioBarFill: {
    height: "100%",
    borderRadius: 999,
  },
});