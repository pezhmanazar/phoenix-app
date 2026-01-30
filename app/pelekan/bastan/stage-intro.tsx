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

// ✅ لوکال: تیک معرفی مرحله بستن
const KEY_BASTAN_STAGE_AUDIO_V1 = "pelekan:stage_intro:bastan:heard:v1";
const HEARD_AFTER_MS = 5000;

// ✅ آدرس فایل صوتی معرفی مرحله بستن (می‌تونی لوکال require کنی)
const AUDIO_URL = "https://api.qoqnoos.app/static/audio/bastan-stage-intro.mp3";

export default function BastanStageIntroScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { me } = useUser();
  const phone = String(me?.phone || "").trim();

  const STORAGE_POS_KEY = useMemo(() => `bastan_stage_intro_pos_ms:${phone || "no_phone"}`, [phone]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [heardDone, setHeardDone] = useState(false);

  // player
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [posMs, setPosMs] = useState(0);
  const [durMs, setDurMs] = useState(1);

  const restorePosRef = useRef<number | null>(null);
  const markingRef = useRef(false);

  const loadLocalState = useCallback(async () => {
    try {
      setLoading(true);
      setErr(null);

      const v = await AsyncStorage.getItem(KEY_BASTAN_STAGE_AUDIO_V1);
      setHeardDone(v === "1");

      // restore pos only if not done
      if (v !== "1") {
        try {
          const raw = await AsyncStorage.getItem(STORAGE_POS_KEY);
          const n = raw ? Number(raw) : 0;
          if (Number.isFinite(n) && n > 0) restorePosRef.current = n;
        } catch {}
      } else {
        restorePosRef.current = null;
      }
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [STORAGE_POS_KEY]);

  const markHeard = useCallback(async () => {
    if (heardDone) return;
    if (markingRef.current) return;
    markingRef.current = true;
    try {
      await AsyncStorage.setItem(KEY_BASTAN_STAGE_AUDIO_V1, "1");
      setHeardDone(true);
      try {
        await AsyncStorage.removeItem(STORAGE_POS_KEY);
      } catch {}
    } finally {
      markingRef.current = false;
    }
  }, [heardDone, STORAGE_POS_KEY]);

  const unload = useCallback(async () => {
    try {
      const s = soundRef.current;
      if (s) {
        try {
          const st: any = await s.getStatusAsync();
          if (st?.isLoaded && !heardDone) {
            const p = Number(st.positionMillis ?? 0);
            if (p > 0) await AsyncStorage.setItem(STORAGE_POS_KEY, String(p));
          }
        } catch {}
        await s.stopAsync().catch(() => {});
        await s.unloadAsync().catch(() => {});
      }
    } catch {}
    soundRef.current = null;
    setIsLoaded(false);
    setIsPlaying(false);
  }, [heardDone, STORAGE_POS_KEY]);

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

        const position = Number(st.positionMillis ?? 0);
        const duration = Number(st.durationMillis ?? 0);
        const nearEnd = duration > 0 && duration - position <= 800;

        // ✅ همین شرط: چند ثانیه گوش کرد => تیک
        if (!heardDone && position >= HEARD_AFTER_MS) {
          try {
            await markHeard();
          } catch {}
        }

        // اگر تا آخر رفت یا نزدیک آخر شد، قطعاً done
        if (!heardDone && (st.didJustFinish || nearEnd)) {
          try {
            await markHeard();
          } catch {}
          setIsPlaying(false);
        }

        // ذخیره سبک پوزیشن
        if (!heardDone && duration > 0 && position > 0) {
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
      if (restore && restore > 0 && !heardDone) {
        const st: any = await sound.getStatusAsync();
        const duration = Number(st?.durationMillis ?? 0);
        const safeRestore = duration > 0 ? Math.min(restore, Math.max(0, duration - 1200)) : restore;
        await sound.setPositionAsync(safeRestore);
      }
    } catch {}
  }, [heardDone, markHeard, STORAGE_POS_KEY]);

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

  useEffect(() => {
    loadLocalState();
    return () => {
      unload();
    };
  }, [loadLocalState, unload]);

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
          <TouchableOpacity style={styles.retryBtn} onPress={loadLocalState}>
            <Text style={styles.retryText}>تلاش مجدد</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.content}>
        <TouchableOpacity activeOpacity={0.9} onPress={togglePlay} style={styles.bigPlayWrap}>
          <Ionicons name={isPlaying ? "pause" : "play"} size={72} color="#0b0f14" style={{ marginLeft: isPlaying ? 0 : 6 }} />
        </TouchableOpacity>

        <Text style={styles.title}>معرفی مرحله بستن</Text>
        <Text style={styles.desc}>
          {heardDone ? "این ویس ثبت شد. هر وقت خواستی دوباره گوش کن." : "چند ثانیه گوش بده تا این مرحله برایت تیک بخورد."}
        </Text>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progressPct * 100)}%` }]} />
        </View>

        <Text style={styles.timeText}>
          {fmt(posMs)} / {fmt(durMs)}
        </Text>

        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.continueBtn}
          onPress={() => {
            router.back();
          }}
        >
          <Text style={styles.continueText}>بازگشت</Text>
        </TouchableOpacity>

        {!heardDone ? <Text style={styles.warningText}>برای تیک خوردن، چند ثانیه گوش دادن کافیست.</Text> : null}
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
  errText: { color: "#FCA5A5", fontWeight: "700", textAlign: "right" },
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

  continueBtn: {
    width: "100%",
    maxWidth: 280,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#E98A15",
    alignItems: "center",
    marginTop: 4,
  },
  continueText: { color: "#0b0f14", fontWeight: "900", fontSize: 15 },

  warningText: {
    marginTop: 10,
    color: "rgba(252,165,165,.90)",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
});