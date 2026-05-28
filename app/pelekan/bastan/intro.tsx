// app/pelekan/bastan/intro.tsx
import { AUDIO_KEYS, mediaUrl } from "@/constants/media";
import { useAuth } from "@/hooks/useAuth";
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

type PlanStatus = "free" | "pro" | "expiring" | "expired";

type BastanStateResponse = {
  ok: boolean;
  data?: {
    user: { planStatus: PlanStatus; daysLeft: number };
    intro: { completedAt: string | null; paywallNeededAfterIntro: boolean };
    start?: { completedAt: string | null; locked: boolean; paywallNeededAfterIntro: boolean };
  };
  error?: string;
};

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function BastanIntroScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, loading: authLoading } = useAuth();

  const apiBase = "https://api.qoqnoos.app";

  const AUDIO_URL = useMemo(() => mediaUrl(AUDIO_KEYS.introOverall), []);

  const STORAGE_POS_KEY = useMemo(() => {
    const suffix = token ? String(token).slice(-16) : "no_token";
    return `bastan_intro_pos_ms:${suffix}`;
  }, [token]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [introDone, setIntroDone] = useState(false);
  const [, setPaywallAfterIntro] = useState(false);

  const [planStatus, setPlanStatus] = useState<PlanStatus>("free");
  const isPro = planStatus === "pro" || planStatus === "expiring";

  const playerRef = useRef<AudioPlayer | null>(null);
  const mountedRef = useRef(true);
  const opLockRef = useRef(false);

  const [, setIsLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [posMs, setPosMs] = useState(0);
  const [durMs, setDurMs] = useState(1);
  const [isBuffering, setIsBuffering] = useState(false);
  const [trackW, setTrackW] = useState(0);

  const restorePosRef = useRef<number | null>(null);
  const completingRef = useRef(false);

  const canContinue = true;

  const lock = async <T,>(fn: () => Promise<T>) => {
    if (opLockRef.current) return null as T;
    opLockRef.current = true;
    try {
      return await fn();
    } finally {
      opLockRef.current = false;
    }
  };

  const fetchIntroState = useCallback(async () => {
    if (authLoading) return;

    if (!token) {
      setErr("UNAUTHORIZED");
      setLoading(false);
      return;
    }

    try {
      setErr(null);
      setLoading(true);

      const res = await fetch(`${apiBase}/api/pelekan/bastan/state`, {
        method: "GET",
        headers: {
          "Cache-Control": "no-store",
          Authorization: `Bearer ${token}`,
        },
      });

      let json: BastanStateResponse | null = null;

      try {
        json = (await res.json()) as BastanStateResponse;
      } catch {
        json = null;
      }

      if (!res.ok || !json?.ok || !json.data) {
        setErr(json?.error || `HTTP_${res.status}`);
        return;
      }

      setPlanStatus(json.data.user?.planStatus ?? "free");

      const completedAt =
        json.data.start?.completedAt ??
        json.data.intro?.completedAt ??
        null;

      const paywall =
        json.data.start?.paywallNeededAfterIntro ??
        json.data.intro?.paywallNeededAfterIntro ??
        false;

      setIntroDone(!!completedAt);
      setPaywallAfterIntro(!!paywall);
    } catch {
      setErr("در دریافت یا ثبت مقدمه مشکلی پیش آمد، لطفاً دوباره تلاش کن");
    } finally {
      setLoading(false);
    }
  }, [authLoading, token]);

  const markIntroComplete = useCallback(async () => {
    if (!token) return;
    if (introDone) return;
    if (completingRef.current) return;

    completingRef.current = true;

    try {
      const res = await fetch(`${apiBase}/api/pelekan/bastan/intro/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      let json: { ok?: boolean; error?: string } | null = null;

      try {
        json = (await res.json()) as { ok?: boolean; error?: string };
      } catch {
        json = null;
      }

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `HTTP_${res.status}`);
      }

      setIntroDone(true);

      try {
        await AsyncStorage.removeItem(STORAGE_POS_KEY);
      } catch {
        // intentionally ignored
      }
    } finally {
      completingRef.current = false;
    }
  }, [token, introDone, STORAGE_POS_KEY]);

  const unload = useCallback(async () => {
    try {
      const p = playerRef.current;

      if (p) {
        try {
          if (p.isLoaded && !introDone) {
            const currentMs = Math.max(0, Math.floor((p.currentTime || 0) * 1000));
            if (currentMs > 0) {
              await AsyncStorage.setItem(STORAGE_POS_KEY, String(currentMs));
            }
          }
        } catch {
          // intentionally ignored
        }

        try {
          p.pause();
        } catch {
          // intentionally ignored
        }

        try {
          p.remove();
        } catch {
          // intentionally ignored
        }
      }
    } catch {
      // intentionally ignored
    }

    playerRef.current = null;
    setIsLoaded(false);
    setIsPlaying(false);
    setIsBuffering(false);
  }, [introDone, STORAGE_POS_KEY]);

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
        const nearEnd = duration > 0 && duration - position <= 800;

        if ((st.didJustFinish || nearEnd) && !introDone) {
          setIsPlaying(false);

          try {
            await markIntroComplete();
          } catch {
            setErr("در پخش یا ثبت مقدمه مشکلی پیش آمد، لطفاً دوباره تلاش کن");
          }
        }

        if (!introDone && duration > 0 && position > 0) {
          try {
            if (position % 3000 < 250) {
              await AsyncStorage.setItem(STORAGE_POS_KEY, String(position));
            }
          } catch {
            // intentionally ignored
          }
        }
      });
    },
    [introDone, STORAGE_POS_KEY, markIntroComplete]
  );

  const loadIfNeeded = useCallback(async () => {
    if (playerRef.current) return;

    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: "duckOthers",
      shouldRouteThroughEarpiece: false,
    });

    if (!introDone && token) {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_POS_KEY);
        const n = raw ? Number(raw) : 0;
        if (Number.isFinite(n) && n > 0) {
          restorePosRef.current = n;
        }
      } catch {
        // intentionally ignored
      }
    } else {
      restorePosRef.current = null;
    }

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
      if (restore && restore > 0 && !introDone) {
        const duration = Math.max(0, Math.floor((player.duration || 0) * 1000));
        const safeRestore =
          duration > 0
            ? Math.min(restore, Math.max(0, duration - 1200))
            : restore;

        await player.seekTo(safeRestore / 1000).catch(() => {});
      }
    } catch {
      // intentionally ignored
    }
  }, [AUDIO_URL, introDone, token, STORAGE_POS_KEY, attachStatusListener]);

  const togglePlay = useCallback(async () => {
    if (isBuffering) return;

    try {
      if (!playerRef.current) {
        setIsBuffering(true);
      }

      await lock(async () => {
        await loadIfNeeded();

        const p = playerRef.current;
        if (!p || !p.isLoaded) {
          setIsBuffering(false);
          return;
        }

        setIsBuffering(false);

        if (p.playing) {
          p.pause();
        } else {
          p.play();
        }
      });
    } catch {
      setIsBuffering(false);
      setErr("در پخش یا ثبت مقدمه مشکلی پیش آمد، لطفاً دوباره تلاش کن");
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

          if (!introDone && d > 0 && d - clamped <= 800) {
            try {
              await markIntroComplete();
            } catch {
              setErr("در پخش یا ثبت مقدمه مشکلی پیش آمد، لطفاً دوباره تلاش کن");
            }
          }
        });
      } catch {
        setErr("در پخش یا ثبت مقدمه مشکلی پیش آمد، لطفاً دوباره تلاش کن");
      }
    },
    [durMs, loadIfNeeded, introDone, markIntroComplete]
  );

  useEffect(() => {
    mountedRef.current = true;
    fetchIntroState();

    return () => {
      mountedRef.current = false;
      void unload();
    };
  }, [fetchIntroState, unload]);

  const progressPct = Math.min(1, posMs / Math.max(1, durMs));

  if (loading || authLoading) {
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
          <TouchableOpacity style={styles.retryBtn} onPress={fetchIntroState}>
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
              name={isPlaying ? "stop" : "play"}
              size={72}
              color="#0b0f14"
              style={{ marginLeft: isPlaying ? 0 : 6 }}
            />
          )}
        </TouchableOpacity>

        <Text style={styles.title}>شروع درمان</Text>

        <Text style={styles.desc}>
          {introDone
            ? "این ویس ثبت شده. هر وقت خواستی دوباره بهش گوش کن."
            : "پیشنهاد میشه این بخش رو برای شناخت مسیر، کامل گوش کنی."}
        </Text>

        <View
          style={styles.progressTrack}
          onLayout={(e) => setTrackW(e.nativeEvent.layout.width ?? 0)}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            style={{ flex: 1 }}
            onPress={(e) => {
              if (!trackW) return;
              const x = e.nativeEvent.locationX;
              const pct = Math.max(0, Math.min(1, x / trackW));
              void seekTo(Math.floor(pct * durMs));
            }}
          >
            <View style={[styles.progressFill, { width: `${Math.round(progressPct * 100)}%` }]} />
          </TouchableOpacity>
        </View>

        <Text style={styles.timeText}>
          {fmt(posMs)} / {fmt(durMs)}
        </Text>

        <TouchableOpacity
          activeOpacity={0.9}
          disabled={!canContinue}
          style={[styles.continueBtn, !canContinue && styles.continueBtnDisabled]}
          onPress={async () => {
            try {
              if (!introDone) {
                await markIntroComplete();
              }
            } catch {
              setErr("در پخش یا ثبت مقدمه مشکلی پیش آمد، لطفاً دوباره تلاش کن");
              return;
            }

            if (!isPro) {
              router.push("/(tabs)/Subscription");
              return;
            }

            router.replace("/(tabs)/Pelekan");
          }}
        >
          <Text style={[styles.continueText, !canContinue && styles.continueTextDisabled]}>
            ادامه
          </Text>
        </TouchableOpacity>

        {!isPro ? (
          <Text style={styles.warningText}>
            برای ادامه‌ی مسیر، باید اشتراک پرو داشته باشی.
          </Text>
        ) : null}
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

  title: {
    color: "#F9FAFB",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 6,
  },
  desc: {
    color: "rgba(231,238,247,.75)",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 6,
  },

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
  continueBtnDisabled: {
    backgroundColor: "rgba(255,255,255,.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.12)",
  },
  continueText: { color: "#0b0f14", fontWeight: "900", fontSize: 15 },
  continueTextDisabled: { color: "rgba(231,238,247,.55)" },

  warningText: {
    marginTop: 10,
    color: "rgba(252,165,165,.90)",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
});
