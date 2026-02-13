// app/pelekan/bastan/stage-intro.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useUser } from "../../../hooks/useUser";

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function BastanStageIntroScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { me } = useUser();
  const phone = String(me?.phone || "").trim();

  // ✅ فعلاً همین فایل اینترو (بعداً عوض می‌کنیم)
  const AUDIO_URL = useMemo(() => "https://api.qoqnoos.app/static/audio/bastan-intro.mp3", []);

  // ✅ معیار: فقط وقتی کاربر «بازگشت» زد
  const HEARD_MIN_MS = 5000;

  // ✅ لوکال keys
  const STORAGE_DONE_KEY = useMemo(() => `pelekan:bastan:stage_intro_done:v1:${phone || "no_phone"}`, [phone]);
  const STORAGE_POS_KEY = useMemo(() => `pelekan:bastan:stage_intro_pos_ms:v1:${phone || "no_phone"}`, [phone]);
  // ✅ برای سبز شدن دایره‌ی «بستن» در نقشه
  const MAP_HEARD_KEY = "pelekan:stage_intro:bastan:heard:v1";

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // player
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [posMs, setPosMs] = useState(0);
  const [durMs, setDurMs] = useState(1);

  // ✅ NEW: buffering state (UX)
  const [isBuffering, setIsBuffering] = useState(false);

  const [trackW, setTrackW] = useState(0);

  // restore position
  const restorePosRef = useRef<number | null>(null);

  // prevent double unload/mark
  const leavingRef = useRef(false);

  const readLocal = useCallback(async () => {
    try {
      setErr(null);
      setLoading(true);

      if (!phone) {
        restorePosRef.current = null;
        return;
      }

      // فقط restore position (done بودن اینجا تاثیری روی UI نداره)
      try {
        const posRaw = await AsyncStorage.getItem(STORAGE_POS_KEY);
        const n = posRaw ? Number(posRaw) : 0;
        if (Number.isFinite(n) && n > 0) restorePosRef.current = n;
      } catch {
        restorePosRef.current = null;
      }
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [phone, STORAGE_POS_KEY]);

  const ensureAudioMode = useCallback(async () => {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  }, []);

  const loadIfNeeded = useCallback(async () => {
    if (soundRef.current) return;

    await ensureAudioMode();

    const { sound } = await Audio.Sound.createAsync(
      { uri: AUDIO_URL },
      { shouldPlay: false },
      async (st) => {
        if (!st.isLoaded) return;

        setIsPlaying(!!st.isPlaying);
        setPosMs(Number(st.positionMillis ?? 0));
        setDurMs(Number(st.durationMillis ?? 1));

        // ✅ وقتی واقعاً لود شد، از حالت بافرینگ خارج شو
        setIsBuffering(false);

        // ✅ هیچ “auto-complete” اینجا نداریم.
        // فقط پوزیشن سبک ذخیره می‌کنیم (برای تجربه بهتر)
        const position = Number(st.positionMillis ?? 0);
        const duration = Number(st.durationMillis ?? 0);
        if (duration > 0 && position > 0) {
          try {
            if (position % 3000 < 250) {
              await AsyncStorage.setItem(STORAGE_POS_KEY, String(position));
            }
          } catch {}
        }
      }
    );

    soundRef.current = sound;

    // restore pos
    try {
      const restore = restorePosRef.current;
      if (restore && restore > 0) {
        const st: any = await sound.getStatusAsync();
        const duration = Number(st?.durationMillis ?? 0);
        const safeRestore = duration > 0 ? Math.min(restore, Math.max(0, duration - 1200)) : restore;
        await sound.setPositionAsync(safeRestore);
      }
    } catch {}
  }, [AUDIO_URL, ensureAudioMode, STORAGE_POS_KEY]);

  const togglePlay = useCallback(async () => {
    // ✅ اگر در حال بافرینگ هستیم، دوباره کلیک نکن
    if (isBuffering) return;

    try {
      setErr(null);

      // ✅ اگر هنوز لود نشده، بافرینگ را روشن کن تا آیکن تغییر کند
      if (!soundRef.current) setIsBuffering(true);

      await loadIfNeeded();
      const s = soundRef.current;
      if (!s) {
        setIsBuffering(false);
        return;
      }

      const st: any = await s.getStatusAsync();
      if (!st.isLoaded) {
        setIsBuffering(false);
        return;
      }

      // ✅ آماده‌ایم
      setIsBuffering(false);

      if (st.isPlaying) await s.pauseAsync();
      else await s.playAsync();
    } catch (e: any) {
      setIsBuffering(false);
      setErr(String(e?.message || e));
    }
  }, [loadIfNeeded, isBuffering]);

  const seekTo = useCallback(
    async (ms: number) => {
      try {
        setErr(null);
        await loadIfNeeded();
        const s = soundRef.current;
        if (!s) return;

        const st: any = await s.getStatusAsync();
        if (!st.isLoaded) return;

        const d = Number(st.durationMillis ?? durMs);
        const clamped = Math.max(0, Math.min(ms, Math.max(1, d)));
        await s.setPositionAsync(clamped);
      } catch (e: any) {
        setErr(String(e?.message || e));
      }
    },
    [durMs, loadIfNeeded]
  );

  const stopAndUnload = useCallback(async () => {
    try {
      const s = soundRef.current;
      if (!s) return;

      // ذخیره‌ی پوزیشن قبل از خروج (فقط اگر بالاتر از 0)
      try {
        const st: any = await s.getStatusAsync();
        if (st?.isLoaded) {
          const p = Number(st.positionMillis ?? 0);
          if (p > 0) {
            await AsyncStorage.setItem(STORAGE_POS_KEY, String(p));
          }
        }
      } catch {}

      await s.pauseAsync().catch(() => {});
      await s.stopAsync().catch(() => {});
      await s.unloadAsync().catch(() => {});
    } catch {}

    soundRef.current = null;
    setIsPlaying(false);
    setIsBuffering(false);
  }, [STORAGE_POS_KEY]);

  const onBackPress = useCallback(async () => {
    if (leavingRef.current) return;
    leavingRef.current = true;

    try {
      // ✅ 1) پوزیشن واقعی لحظه خروج را بگیریم
      let listenedMs = posMs;

      try {
        const s = soundRef.current;
        if (s) {
          const st: any = await s.getStatusAsync();
          if (st?.isLoaded) listenedMs = Number(st.positionMillis ?? listenedMs);
        }
      } catch {}

      // ✅ 2) فقط اگر >= 5 ثانیه بود، DONE ثبت شود
      if (phone && listenedMs >= HEARD_MIN_MS) {
  try {
    await AsyncStorage.setItem(STORAGE_DONE_KEY, "1");
  } catch {}

  // ✅ این یکی برای نقشه پلکان
  try {
    await AsyncStorage.setItem(MAP_HEARD_KEY, "1");
  } catch {}
}

      // ✅ 3) بعدش player را unload کنیم
      await stopAndUnload();
    } finally {
      router.back();
    }
  }, [HEARD_MIN_MS, phone, posMs, router, STORAGE_DONE_KEY, stopAndUnload]);

  useEffect(() => {
    readLocal();
    return () => {
      // خروج ناگهانی/فورس: فقط unload
      stopAndUnload();
    };
  }, [readLocal, stopAndUnload]);

  const progressPct = Math.min(1, posMs / Math.max(1, durMs));

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, { paddingTop: insets.top }]} edges={["top", "left", "right"]}>
        <View style={styles.center}>
          <ActivityIndicator color="#D4AF37" />
          <Text style={styles.muted}>در حال بارگذاری…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { paddingTop: insets.top }]} edges={["top", "left", "right"]}>
      <View pointerEvents="none" style={styles.glowTop} />
      <View pointerEvents="none" style={styles.glowBottom} />

      {err ? (
        <View style={styles.errBox}>
          <Text style={styles.errText}>خطا: {err}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={readLocal} activeOpacity={0.9}>
            <Text style={styles.retryText}>تلاش مجدد</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.content}>
        <TouchableOpacity activeOpacity={0.9} onPress={togglePlay} style={styles.bigPlayWrap}>
          {isBuffering ? (
            <ActivityIndicator color="#0b0f14" />
          ) : (
            <Ionicons
              name={isPlaying ? "pause" : "play"}
              size={72}
              color="#0b0f14"
              style={{ marginLeft: isPlaying ? 0 : 6 }}
            />
          )}
        </TouchableOpacity>

        <Text style={styles.title}>معرفی مرحله بستن</Text>
        <Text style={styles.desc}>این ویس کوتاه، مرحله «بستن» رو معرفی می‌کنه.</Text>

        <View style={styles.progressTrack} onLayout={(e) => setTrackW(e?.nativeEvent?.layout?.width ?? 0)}>
          <TouchableOpacity
            activeOpacity={0.9}
            style={{ flex: 1 }}
            onPress={(e) => {
              if (!trackW) return;
              const x = e.nativeEvent.locationX;
              const pct = Math.max(0, Math.min(1, x / trackW));
              seekTo(Math.floor(pct * durMs));
            }}
          >
            <View style={[styles.progressFill, { width: `${Math.round(progressPct * 100)}%` }]} />
          </TouchableOpacity>
        </View>

        <Text style={styles.timeText}>
          {fmt(posMs)} / {fmt(durMs)}
        </Text>

        <TouchableOpacity activeOpacity={0.9} style={styles.backBtn} onPress={onBackPress}>
          <Text style={styles.backText}>بازگشت</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b0f14" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: "rgba(231,238,247,.75)", marginTop: 10, fontSize: 12, textAlign: "center" },

  glowTop: {
    position: "absolute",
    top: -10,
    left: -80,
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: "rgba(212,175,55,.14)",
    transform: [{ rotate: "12deg" }],
  },
  glowBottom: {
    position: "absolute",
    bottom: -40,
    right: -90,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: "rgba(233,138,21,.10)",
  },

  errBox: { paddingHorizontal: 16, paddingBottom: 6 },
  errText: { color: "#FCA5A5", fontWeight: "800", textAlign: "right" },
  retryBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.16)",
  },
  retryText: { color: "#F9FAFB", fontWeight: "800" },

  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 10,
  },

  bigPlayWrap: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#D4AF37",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },

  title: { color: "#F9FAFB", fontSize: 22, fontWeight: "900", textAlign: "center", marginTop: 6 },
  desc: { color: "rgba(231,238,247,.75)", fontSize: 13, textAlign: "center", lineHeight: 20, marginBottom: 6 },

  progressTrack: {
    width: "100%",
    maxWidth: 320,
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,.10)",
    overflow: "hidden",
    marginTop: 6,
  },
  progressFill: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#E98A15",
  },
  timeText: { color: "rgba(231,238,247,.65)", fontSize: 12, marginBottom: 14 },

  backBtn: {
    width: "100%",
    maxWidth: 280,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#E98A15",
    alignItems: "center",
    marginTop: 4,
  },
  backText: { color: "#0b0f14", fontWeight: "900", fontSize: 15 },
});