// app/pelekan/gosastan/stage-intro.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

// ✅ لوکال: تیک معرفی گسستن
const KEY_GOSASTAN_STAGE_AUDIO_V1 = "pelekan:stage_intro:gosastan:heard:v1";

export default function GosastanStageIntroScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // ✅ فعلاً همان فایل بستن
  const AUDIO_URL = useMemo(() => "https://api.qoqnoos.app/static/audio/bastan-intro.mp3", []);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // player
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const [posMs, setPosMs] = useState(0);
  const [durMs, setDurMs] = useState(1);

  const [trackW, setTrackW] = useState(0);

  // ✅ برای اینکه فقط موقع بازگشت ثبت کنیم
  const maxPosRef = useRef(0);
  const SAVED_MIN_MS = 5000;

  const unload = useCallback(async () => {
    try {
      const s = soundRef.current;
      if (s) {
        await s.stopAsync().catch(() => {});
        await s.unloadAsync().catch(() => {});
      }
    } catch {}
    soundRef.current = null;
    setIsLoaded(false);
    setIsPlaying(false);
  }, []);

  const loadIfNeeded = useCallback(async () => {
    if (soundRef.current) return;

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });

    const { sound } = await Audio.Sound.createAsync(
      { uri: AUDIO_URL },
      { shouldPlay: false },
      async (st) => {
        if (!st.isLoaded) return;

        setIsLoaded(true);
        setIsPlaying(st.isPlaying);
        setPosMs(st.positionMillis ?? 0);
        setDurMs(st.durationMillis ?? 1);

        const p = Number(st.positionMillis ?? 0);
        if (p > maxPosRef.current) maxPosRef.current = p;
      }
    );

    soundRef.current = sound;
  }, [AUDIO_URL]);

  const togglePlay = useCallback(async () => {
    try {
      await loadIfNeeded();
      const s = soundRef.current;
      if (!s) return;

      const st: any = await s.getStatusAsync();
      if (!st.isLoaded) return;

      if (st.isPlaying) await s.pauseAsync();
      else await s.playAsync();
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  }, [loadIfNeeded]);

  const seekTo = useCallback(
    async (ms: number) => {
      try {
        await loadIfNeeded();
        const s = soundRef.current;
        if (!s) return;

        const st: any = await s.getStatusAsync();
        if (!st.isLoaded) return;

        const d = Number(st.durationMillis ?? durMs);
        const clamped = Math.max(0, Math.min(ms, Math.max(1, d)));
        await s.setPositionAsync(clamped);
        if (clamped > maxPosRef.current) maxPosRef.current = clamped;
      } catch (e: any) {
        setErr(String(e?.message || e));
      }
    },
    [durMs, loadIfNeeded]
  );

  const onBack = useCallback(async () => {
    try {
      // ✅ فقط وقتی برگشت می‌زند، اگر >= ۵ ثانیه گوش کرده بود تیک بزن
      const listenedMs = Math.max(maxPosRef.current, posMs);
      if (listenedMs >= SAVED_MIN_MS) {
        await AsyncStorage.setItem(KEY_GOSASTAN_STAGE_AUDIO_V1, "1");
      }
    } catch {}
    await unload();
    router.back();
  }, [posMs, unload, router]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setErr(null);
        setLoading(true);
        // ✅ فقط تست دسترسی فایل (تا 404 را سریع بفهمیم)
        // اگر خواستی حذفش می‌کنیم، ولی برای لانچ بهتره همین باشه.
        await loadIfNeeded();
      } catch (e: any) {
        if (!alive) return;
        setErr(String(e?.message || e));
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
      unload();
    };
  }, [loadIfNeeded, unload]);

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
          <Text style={styles.errText}>{String(err)}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => router.replace("/pelekan/gosastan/stage-intro" as any)}>
            <Text style={styles.retryText}>تلاش مجدد</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.content}>
        <TouchableOpacity activeOpacity={0.9} onPress={togglePlay} style={styles.bigPlayWrap}>
          <Ionicons name={isPlaying ? "pause" : "play"} size={72} color="#0b0f14" style={{ marginLeft: isPlaying ? 0 : 6 }} />
        </TouchableOpacity>

        <Text style={styles.title}>معرفی مرحله گسستن</Text>
        <Text style={styles.desc}>کافیه چند ثانیه گوش بدی و برگردی.</Text>

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

        <TouchableOpacity activeOpacity={0.9} style={styles.backBtn} onPress={onBack}>
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

  errBox: { padding: 16 },
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
  retryText: { color: "#F9FAFB", fontWeight: "900" },

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