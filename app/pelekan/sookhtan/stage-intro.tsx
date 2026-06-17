//app/pelekan/sookhtan/stage-intro.tsx
import { AUDIO_KEYS, mediaUrl } from "@/constants/media";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioStatus,
} from "expo-audio";
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

const KEY_SOOKHTAN_STAGE_AUDIO_V1 = "pelekan:stage_intro:sookhtan:heard:v1";

export default function SookhtanStageIntroScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const AUDIO_URL = useMemo(() => {
    return mediaUrl(AUDIO_KEYS.sookhtanIntro);
  }, []);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const playerRef = useRef<AudioPlayer | null>(null);
  const statusSubscriptionRef = useRef<{ remove: () => void } | null>(null);
  const mountedRef = useRef(true);
  const opLockRef = useRef(false);

  const [, setIsLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [posMs, setPosMs] = useState(0);
  const [durMs, setDurMs] = useState(1);
  const [trackW, setTrackW] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  const maxPosRef = useRef(0);
  const SAVED_MIN_MS = 5000;

  const lock = async <T,>(fn: () => Promise<T>) => {
    if (opLockRef.current) return null as T;
    opLockRef.current = true;
    try {
      return await fn();
    } finally {
      opLockRef.current = false;
    }
  };

  const unload = useCallback(async () => {
  try {
    const p = playerRef.current;
    playerRef.current = null;

    try {
      statusSubscriptionRef.current?.remove?.();
      statusSubscriptionRef.current = null;
    } catch {}

    if (p) {
      try {
        p.pause();
      } catch {}
      try {
        p.seekTo(0);
      } catch {}
      try {
        p.remove();
      } catch {}
    }
  } catch {}

  if (!mountedRef.current) return;
  setIsLoaded(false);
  setIsPlaying(false);
  setIsBuffering(false);
  setLoadStatus("idle");
  setPosMs(0);
  setDurMs(1);
}, []);

  const attachStatusListener = useCallback((player: AudioPlayer) => {
  try {
    statusSubscriptionRef.current?.remove?.();
    statusSubscriptionRef.current = null;
  } catch {}

  statusSubscriptionRef.current = player.addListener("playbackStatusUpdate", (st: AudioStatus) => {
    if (!mountedRef.current) return;
    if (!st.isLoaded) return;

    setIsLoaded(true);
    setIsPlaying(!!st.playing);
    setPosMs(Math.max(0, Math.floor((st.currentTime || 0) * 1000)));
    setDurMs(Math.max(1, Math.floor((st.duration || 0) * 1000)));
    setIsBuffering(!!st.isBuffering);

    if (st.isLoaded) {
      setLoadStatus((prev) => (prev === "loading" ? "ready" : prev));
    }

    if (st.didJustFinish) {
      setLoadStatus("idle");
    }

    const p = Math.max(0, Math.floor((st.currentTime || 0) * 1000));
    if (p > maxPosRef.current) maxPosRef.current = p;
  });
}, []);

  const loadIfNeeded = useCallback(async () => {
    if (playerRef.current) return;

    setLoadStatus("loading");
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: "duckOthers",
      shouldRouteThroughEarpiece: false,
    });

    const player = createAudioPlayer({ uri: AUDIO_URL }, { updateInterval: 250 });
    player.loop = false;
    player.volume = 1;

    attachStatusListener(player);
    playerRef.current = player;

    if (mountedRef.current) {
      setIsLoaded(!!player.isLoaded);
      setIsPlaying(!!player.playing);
      setPosMs(Math.max(0, Math.floor((player.currentTime || 0) * 1000)));
      setDurMs(Math.max(1, Math.floor((player.duration || 0) * 1000)));
    }
  }, [AUDIO_URL, attachStatusListener]);

     const togglePlay = useCallback(async () => {
    if (isBuffering) return;

    try {
      if (!playerRef.current) {
        setIsBuffering(true);
        setLoadStatus("loading");
      }

      await lock(async () => {
        await loadIfNeeded();

        const p = playerRef.current;
        if (!p) {
          if (mountedRef.current) {
            setIsBuffering(false);
            setIsPlaying(false);
            setLoadStatus("error");
          }
          return;
        }

        for (let i = 0; i < 25 && !p.isLoaded; i += 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        if (!p.isLoaded) {
          if (mountedRef.current) {
            setIsBuffering(false);
            setIsPlaying(false);
            setLoadStatus("loading");
          }
          return;
        }

        if (p.playing) {
          p.pause();
          if (mountedRef.current) {
            setIsPlaying(false);
            setIsBuffering(false);
            setLoadStatus("idle");
          }
          return;
        }

        p.play();

        let started = !!p.playing;
        for (let i = 0; i < 15 && !started; i += 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          started = !!p.playing;
        }

        if (!mountedRef.current) return;
        setIsPlaying(started);
        setIsBuffering(false);
        setLoadStatus(started ? "idle" : "ready");
      });
    } catch {
      setIsBuffering(false);
      setIsPlaying(false);
      setLoadStatus("error");
      setErr("پخش مقدمه مرحله سوختن با مشکل مواجه شد، لطفاً دوباره تلاش کن");
    }
  }, [loadIfNeeded, isBuffering]);



  const seekTo = useCallback(
    async (ms: number) => {
      try {
        await lock(async () => {
          await loadIfNeeded();
          const p = playerRef.current;
          if (!p || !p.isLoaded) return;

          const d = Math.max(1, Math.floor((p.duration || durMs) * 1000));
          const clamped = Math.max(0, Math.min(ms, d));
          await p.seekTo(clamped / 1000).catch(() => {});
          if (clamped > maxPosRef.current) maxPosRef.current = clamped;
        });
      } catch {
        setErr("پخش مقدمه مرحله سوختن با مشکل مواجه شد، لطفاً دوباره تلاش کن");
      }
    },
    [durMs, loadIfNeeded]
  );

  const onBack = useCallback(async () => {
    try {
      const livePos = playerRef.current?.isLoaded
        ? Math.max(0, Math.floor((playerRef.current.currentTime || 0) * 1000))
        : 0;

      const listenedMs = Math.max(maxPosRef.current, posMs, livePos);
      if (listenedMs >= SAVED_MIN_MS) {
        await AsyncStorage.setItem(KEY_SOOKHTAN_STAGE_AUDIO_V1, "1");
      }
    } catch {}

    await unload();
    router.back();
  }, [posMs, unload, router]);

    useEffect(() => {
    mountedRef.current = true;
    setErr(null);
    setLoading(false);

    return () => {
      mountedRef.current = false;
      void unload();
    };
  }, [unload]);

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
          <TouchableOpacity style={styles.retryBtn} onPress={() => router.replace("/pelekan/sookhtan/stage-intro" as any)}>
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

        <Text style={styles.title}>معرفی مرحله سوختن</Text>

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

        {loadStatus !== "idle" && (
          <Text
            style={[
              styles.audioLoadStatus,
              { color: loadStatus === "error" ? "#FCA5A5" : "#D4AF37" },
            ]}
          >
            {loadStatus === "loading" && "در حال آماده‌سازی فایل..."}
            {loadStatus === "ready" && "فایل آماده پخشه"}
            {loadStatus === "error" && "خطا در دریافت فایل؛ اینترنت رو چک کن"}
          </Text>
        )}

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

  audioLoadStatus: {
    marginTop: -6,
    marginBottom: 10,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },

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