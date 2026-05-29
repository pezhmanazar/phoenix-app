//phoenix-app-git-sourse\app\pelekan\bastan\stage-intro.tsx
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

  const AUDIO_URL = useMemo(() => {
    return mediaUrl(AUDIO_KEYS.bastanIntro);
  }, []);

  const HEARD_MIN_MS = 5000;

  const STORAGE_DONE_KEY = useMemo(
    () => `pelekan:bastan:stage_intro_done:v1:${phone || "no_phone"}`,
    [phone]
  );
  const STORAGE_POS_KEY = useMemo(
    () => `pelekan:bastan:stage_intro_pos_ms:v1:${phone || "no_phone"}`,
    [phone]
  );
  const MAP_HEARD_KEY = "pelekan:stage_intro:bastan:heard:v1";

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const playerRef = useRef<AudioPlayer | null>(null);
  const mountedRef = useRef(true);
  const opLockRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [, setIsLoaded] = useState(false);
  const [posMs, setPosMs] = useState(0);
  const [durMs, setDurMs] = useState(1);
  const [isBuffering, setIsBuffering] = useState(false);

  const [trackW, setTrackW] = useState(0);

  const restorePosRef = useRef<number | null>(null);
  const leavingRef = useRef(false);

  const lock = async <T,>(fn: () => Promise<T>) => {
    if (opLockRef.current) return null as T;
    opLockRef.current = true;
    try {
      return await fn();
    } finally {
      opLockRef.current = false;
    }
  };

  const readLocal = useCallback(async () => {
    try {
      setErr(null);
      setLoading(true);

      if (!phone) {
        restorePosRef.current = null;
        return;
      }

      try {
        const posRaw = await AsyncStorage.getItem(STORAGE_POS_KEY);
        const n = posRaw ? Number(posRaw) : 0;
        if (Number.isFinite(n) && n > 0) restorePosRef.current = n;
        else restorePosRef.current = null;
      } catch {
        restorePosRef.current = null;
      }
    } catch {
      setErr("پخش مقدمه با مشکل مواجه شد، لطفاً دوباره تلاش کن");
    } finally {
      setLoading(false);
    }
  }, [phone, STORAGE_POS_KEY]);

  const attachStatusListener = useCallback(
    (player: AudioPlayer) => {
      player.addListener("playbackStatusUpdate", async (st: AudioStatus) => {
        if (!mountedRef.current) return;
        if (!st.isLoaded) return;

        setIsLoaded(true);
        setIsPlaying(!!st.playing);
        setPosMs(Math.max(0, Math.floor((st.currentTime || 0) * 1000)));
        setDurMs(Math.max(1, Math.floor((st.duration || 0) * 1000)));
        setIsBuffering(!!st.isBuffering);

        const position = Math.max(0, Math.floor((st.currentTime || 0) * 1000));
        const duration = Math.max(0, Math.floor((st.duration || 0) * 1000));

        if (duration > 0 && position > 0) {
          try {
            if (position % 3000 < 250) {
              await AsyncStorage.setItem(STORAGE_POS_KEY, String(position));
            }
          } catch {}
        }
      });
    },
    [STORAGE_POS_KEY]
  );

  const ensureAudioMode = useCallback(async () => {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: "duckOthers",
      shouldRouteThroughEarpiece: false,
    });
  }, []);

  const loadIfNeeded = useCallback(async () => {
    if (playerRef.current) return;

    await ensureAudioMode();

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

    try {
      const restore = restorePosRef.current;
      if (restore && restore > 0) {
        const duration = Math.max(0, Math.floor((player.duration || 0) * 1000));
        const safeRestore =
          duration > 0 ? Math.min(restore, Math.max(0, duration - 1200)) : restore;
        await player.seekTo(safeRestore / 1000).catch(() => {});
      }
    } catch {}
  }, [AUDIO_URL, attachStatusListener, ensureAudioMode]);

  const togglePlay = useCallback(async () => {
  if (isBuffering) return;

  try {
    setErr(null);

    if (!playerRef.current) setIsBuffering(true);

    await lock(async () => {
      await loadIfNeeded();

      const p = playerRef.current;
      if (!p) {
        if (mountedRef.current) setIsBuffering(false);
        return;
      }

      for (let i = 0; i < 25 && !p.isLoaded; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      if (!p.isLoaded) {
        if (mountedRef.current) setIsBuffering(false);
        return;
      }

      if (p.playing) {
        p.pause();
        if (mountedRef.current) setIsBuffering(false);
        return;
      }

      p.play();
      if (mountedRef.current) setIsBuffering(false);
    });
  } catch {
    setIsBuffering(false);
    setErr("پخش مقدمه با مشکل مواجه شد، لطفاً دوباره تلاش کن");
  }
}, [isBuffering, loadIfNeeded]);

  const seekTo = useCallback(
    async (ms: number) => {
      try {
        setErr(null);

        await lock(async () => {
          await loadIfNeeded();
          const p = playerRef.current;
          if (!p || !p.isLoaded) return;

          const d = Math.max(1, Math.floor((p.duration || durMs) * 1000));
          const clamped = Math.max(0, Math.min(ms, d));
          await p.seekTo(clamped / 1000).catch(() => {});
        });
      } catch {
        setErr("پخش مقدمه با مشکل مواجه شد، لطفاً دوباره تلاش کن");
      }
    },
    [durMs, loadIfNeeded]
  );

  const stopAndUnload = useCallback(async () => {
    try {
      const p = playerRef.current;
      if (!p) return;

      try {
        if (p.isLoaded) {
          const currentMs = Math.max(0, Math.floor((p.currentTime || 0) * 1000));
          if (currentMs > 0) {
            await AsyncStorage.setItem(STORAGE_POS_KEY, String(currentMs));
          }
        }
      } catch {}

      try {
        p.pause();
      } catch {}
      try {
        p.seekTo(0);
      } catch {}
      try {
        p.remove();
      } catch {}
    } catch {}

    playerRef.current = null;

    if (!mountedRef.current) return;
    setIsPlaying(false);
    setIsBuffering(false);
    setPosMs(0);
    setDurMs(1);
  }, [STORAGE_POS_KEY]);

  const onBackPress = useCallback(async () => {
    if (leavingRef.current) return;
    leavingRef.current = true;

    try {
      let listenedMs = posMs;

      try {
        const p = playerRef.current;
        if (p?.isLoaded) {
          listenedMs = Math.max(0, Math.floor((p.currentTime || 0) * 1000));
        }
      } catch {}

      if (phone && listenedMs >= HEARD_MIN_MS) {
        try {
          await AsyncStorage.setItem(STORAGE_DONE_KEY, "1");
        } catch {}

        try {
          await AsyncStorage.setItem(MAP_HEARD_KEY, "1");
        } catch {}
      }

      await stopAndUnload();
    } finally {
      router.back();
    }
  }, [HEARD_MIN_MS, phone, posMs, router, STORAGE_DONE_KEY, stopAndUnload]);

  useEffect(() => {
    mountedRef.current = true;
    readLocal();

    return () => {
      mountedRef.current = false;
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
