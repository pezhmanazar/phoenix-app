// app/(tabs)/Mashaal.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { Audio } from "expo-av";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import PlanStatusBadge from "../../components/PlanStatusBadge";
import { useUser } from "../../hooks/useUser";
import { getPlanStatus, PRO_FLAG_KEY } from "../../lib/plan";

import { AUDIO_KEYS, mediaUrl } from "../../constants/media";

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

/* --------------------------- Inline Audio Player (مثل پناهگاه + ذخیره پیشرفت) --------------------------- */

function formatMs(ms: number) {
  const safe = Number.isFinite(ms) ? ms : 0;
  const s = Math.max(0, Math.floor(safe / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

type AudioPalette = {
  border2: string;
  text: string;
  sub2: string;
  gold: string;
  glass2: string;
};

function InlineAudioPlayer({
  url,
  storageKey,
  palette,
}: {
  url: string;
  storageKey: string;
  palette: {
    border2: string;
    text: string;
    sub2: string;
    gold: string;
    glass2: string;
  };
}) {
  const soundRef = useRef<Audio.Sound | null>(null);

  const opLockRef = useRef(false);
  const mountedRef = useRef(true);

  const resumeFromRef = useRef<number>(0);
  const lastSaveRef = useRef<number>(0);

  const [playing, setPlaying] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);

  // ✅ این دو تا باید قبل از Play هم پر باشن
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

  const maybeSaveProgress = useCallback(
    async (positionMillis: number, durationMillis: number, force?: boolean) => {
      const now = Date.now();
      if (!force && now - lastSaveRef.current < 1200) return;
      lastSaveRef.current = now;

      AsyncStorage.setItem(
        storageKey,
        JSON.stringify({
          positionMillis: Number(positionMillis || 0),
          durationMillis: Number(durationMillis || 0),
          updatedAt: now,
        })
      ).catch(() => {});
    },
    [storageKey]
  );

  // ✅ 1) هیدریت اولیه از AsyncStorage: قبل از Play هم UI پر باشه
  const hydrateFromStorage = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      if (!raw) {
        resumeFromRef.current = 0;
        return;
      }

      const parsed = JSON.parse(raw || "{}") || {};
      const p = Number(parsed.positionMillis || 0);
      const d = Number(parsed.durationMillis || 0);

      // ✅ روی UI همون لحظه نشون بده
      if (mountedRef.current) {
        setPosMs(Math.max(0, p));
        setDurMs(Math.max(0, d));
      }

      // ✅ منطق ادامه/تکمیل
      if (d > 0) {
        if (p > 0 && p < d - 1500) {
          resumeFromRef.current = p; // وسط → ادامه
        } else {
          resumeFromRef.current = Math.min(d, Math.max(0, p)); // آخر/نزدیک آخر → همون آخر بماند
        }
      } else {
        resumeFromRef.current = Math.max(0, p);
      }
    } catch {
      resumeFromRef.current = 0;
    }
  }, [storageKey]);

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
      // ✅ اینجا ریست نمی‌کنیم به 0، چون می‌خوایم حتی بعد برگشت هم پیشرفت معلوم باشه
      // setPosMs(0);
      // setDurMs(0);
    }
  }, []);

  const ensureLoaded = useCallback(async () => {
    if (soundRef.current) return;

    setLoadingAudio(true);

    // ✅ قبل از load هم حتماً از استوریج بخون (برای resumeFromRef + UI)
    await hydrateFromStorage();

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

        const p = Number(st.positionMillis || 0);
        const d = Number(st.durationMillis || 0);

        setPlaying(!!st.isPlaying);
        setPosMs(p);
        setDurMs(d);

        maybeSaveProgress(p, d, !!st.didJustFinish);

        if (st.didJustFinish) {
          setPlaying(false);
        }
      }
    );

    soundRef.current = sound;

    // ✅ بعد از load برو به نقطه ذخیره‌شده (حتی اگر آخر باشد)
    const target = Math.max(0, Math.floor(resumeFromRef.current || 0));
    if (target > 0) {
      await sound.setPositionAsync(target).catch(() => {});
      // ✅ برای اطمینان UI هم همان لحظه درست شود
      if (mountedRef.current) setPosMs(target);
    }

    if (!mountedRef.current) return;
    setLoadingAudio(false);
  }, [url, hydrateFromStorage, maybeSaveProgress]);

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

      // ✅ اگر ته فایل بود، با Play برگرد اول
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
        await maybeSaveProgress(target, d, true);

        if (mountedRef.current) setPosMs(target);
      });
    },
    [durMs, maybeSaveProgress]
  );

  // ✅ 2) فقط با mount شدن کامپوننت، پیشرفت رو هیدریت کن (بدون load فایل)
  useEffect(() => {
    mountedRef.current = true;
    hydrateFromStorage();
    return () => {
      mountedRef.current = false;
      unload();
    };
  }, [hydrateFromStorage, unload]);

  return (
    <View style={[styles.audioRow, { borderColor: palette.border2, backgroundColor: palette.glass2 }]}>
      <View style={styles.audioInnerRow}>
        {/* تایمر راست */}
        <Text style={[styles.audioTimeInline, { color: palette.sub2 }]}>
          {formatMs(posMs)} / {formatMs(durMs)}
        </Text>

        {/* بار وسط */}
        <View style={styles.audioBarCol}>
          <SeekBar progress={progress} palette={{ border2: palette.border2, gold: palette.gold }} onSeek={seekTo} />
        </View>

        {/* پلی چپ */}
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

function SeekBar({
  progress,
  palette,
  onSeek,
}: {
  progress: number;
  palette: Pick<AudioPalette, "border2" | "gold">;
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
          const x = Math.max(0, Math.min(wRef.current, (e as any).nativeEvent.locationX || 0));
          onSeek(x / wRef.current);
        }}
      >
        <View style={[styles.audioBarWrap, { borderColor: palette.border2 }]}>
          <View style={[styles.audioBarFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: palette.gold }]} />
        </View>
      </Pressable>
    </View>
  );
}

/* ------------------ تب مشعل ------------------ */

export default function Mashaal() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { me } = useUser();

  const [planView, setPlanView] = useState<PlanView>("free");
  const [loadingPlan, setLoadingPlan] = useState(true);

  const isProPlan = planView === "pro";

  const MASHAAAL_INTRO_URL = useMemo(() => mediaUrl(AUDIO_KEYS.mashaalIntroLocked), []);
  const MASHAAAL_01_URL = useMemo(() => mediaUrl(AUDIO_KEYS.mashaal01), []);

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

      {/* Header: بج سمت چپ + عنوان راست‌چین */}
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
        {/* اگر پلن پرو نیست → صفحه قفل‌شده (متن/آیکن‌ها دست‌نخورده) */}
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

                {/* ✅ NEW: ویس معرفی + دکمه اشتراک */}
                <View style={{ height: 14 }} />
                <Text style={styles.lockHintText}>معرفی کوتاه مشعل (صوتی):</Text>
                <View style={{ height: 10 }} />
                <InlineAudioPlayer
                  url={MASHAAAL_INTRO_URL}
                  storageKey={"mashaal:introLocked:v1"}
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

                {/* ✅ NEW: ویس معرفی + دکمه اشتراک */}
                <View style={{ height: 14 }} />
                <Text style={styles.lockHintText}>قبل از تصمیم، این معرفی کوتاه رو گوش کن:</Text>
                <View style={{ height: 10 }} />
                <InlineAudioPlayer
                  url={MASHAAAL_INTRO_URL}
                  storageKey={"mashaal:introLocked:v1"}
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
          /* ✅ PRO: فعلاً فقط یک «ویس شروع» + ادامه از همانجا (با حفظ حس completion) */
          <View style={[styles.lockCard, { marginTop: 6 }]}>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
              <Ionicons name="play-circle" size={22} color={palette.gold} />
              <Text style={styles.lockTitle}>شروع مشعل</Text>
            </View>

            <View style={{ height: 12 }} />
            <InlineAudioPlayer
              url={MASHAAAL_01_URL}
              storageKey={"mashaal:01:v1"}
              palette={{
                border2: palette.border2,
                text: palette.text,
                sub2: palette.sub2,
                gold: palette.gold,
                glass2: palette.glass2,
              }}
            />
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
  centerText: { marginTop: 8, color: "rgba(231,238,247,.72)", fontSize: 12, fontWeight: "800" },

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

  bulletRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
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