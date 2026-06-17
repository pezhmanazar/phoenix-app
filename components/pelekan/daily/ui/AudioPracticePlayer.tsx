import { mediaUrl } from "@/constants/media";
import { Ionicons } from "@expo/vector-icons";
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioStatus,
} from "expo-audio";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type AudioPracticePlayerProps = {
  audioKey: string;
  onCompleted?: () => void;
};


function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function AudioPracticePlayer({
  audioKey,
  onCompleted,
}: AudioPracticePlayerProps) {
  const AUDIO_URL = useMemo(() => mediaUrl(audioKey), [audioKey]);

  const playerRef = useRef<AudioPlayer | null>(null);
  const statusSubscriptionRef = useRef<{ remove: () => void } | null>(null);
  const mountedRef = useRef(true);
  const opLockRef = useRef(false);
  const completedRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [posMs, setPosMs] = useState(0);
  const [durMs, setDurMs] = useState(1);
  const [isBuffering, setIsBuffering] = useState(false);
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [trackW, setTrackW] = useState(0);

  const lock = async <T,>(fn: () => Promise<T>) => {
    if (opLockRef.current) return null as T;
    opLockRef.current = true;
    try {
      return await fn();
    } finally {
      opLockRef.current = false;
    }
  };

  const completeOnce = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onCompleted?.();
  }, [onCompleted]);

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
        p.remove();
      } catch {}
    }
  } catch {}

  setIsPlaying(false);
  setIsBuffering(false);
  setLoadStatus("idle");
  setPosMs(0);
  setDurMs(1);
}, []);

  const attachStatusListener = useCallback(
    (player: AudioPlayer) => {
      try {
        statusSubscriptionRef.current?.remove?.();
        statusSubscriptionRef.current = null;
      } catch {}

      statusSubscriptionRef.current = player.addListener("playbackStatusUpdate", (st: AudioStatus) => {
        if (!mountedRef.current) return;

        if (!st.isLoaded) {
          setIsPlaying(false);
          return;
        }

        setIsPlaying(!!st.playing);
        setPosMs(Math.max(0, Math.floor((st.currentTime || 0) * 1000)));
        setDurMs(Math.max(1, Math.floor((st.duration || 0) * 1000)));
        setIsBuffering(!!st.isBuffering);

        const position = Math.max(0, Math.floor((st.currentTime || 0) * 1000));
        const duration = Math.max(0, Math.floor((st.duration || 0) * 1000));
        const nearEnd = duration > 0 && duration - position <= 800;

        if (st.playing) {
          setLoadStatus("idle");
        } else if (playerRef.current && st.isLoaded && loadStatus === "loading") {
          setLoadStatus("ready");
        }

        if (st.didJustFinish || nearEnd) {
          setIsPlaying(false);
          completeOnce();
        }
      });
    },
    [completeOnce, loadStatus]
  );


  const loadIfNeeded = useCallback(async () => {
    if (playerRef.current) return;

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
          setIsBuffering(false);
          setLoadStatus("error");
          return;
        }

        for (let i = 0; i < 25 && !p.isLoaded; i += 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        if (!p.isLoaded) {
          setIsBuffering(false);
          setLoadStatus("error");
          return;
        }

        const ended = durMs > 1 && posMs >= durMs - 800;
        if (ended) {
          await p.seekTo(0).catch(() => {});
        }

        if (p.playing) {
          p.pause();
          setIsBuffering(false);
          setLoadStatus("idle");
        } else {
          setLoadStatus("ready");
          p.play();

          let started = !!p.playing;

          for (let i = 0; i < 15 && !started; i += 1) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            started = !!p.playing;
          }

          if (mountedRef.current) {
            setIsPlaying(started);
            setIsBuffering(false);
            setLoadStatus(started ? "idle" : "ready");
          }
        }
      });
    } catch {
      setIsBuffering(false);
      setLoadStatus("error");
    }
  }, [durMs, posMs, loadIfNeeded, isBuffering]);

  const seekTo = useCallback(
    async (ms: number) => {
      try {
        if (!playerRef.current) {
          setLoadStatus("loading");
        }

        await lock(async () => {
          await loadIfNeeded();

          const p = playerRef.current;
          if (!p) {
            setLoadStatus("error");
            return;
          }

          for (let i = 0; i < 25 && !p.isLoaded; i += 1) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          if (!p.isLoaded) {
            setLoadStatus("error");
            return;
          }

          const d = Math.max(1, Math.floor((p.duration || durMs) * 1000));
          const clamped = Math.max(0, Math.min(ms, d));
          await p.seekTo(clamped / 1000).catch(() => {});

          if (!p.playing) {
            setLoadStatus("ready");
          }
        });
      } catch {
        setLoadStatus("error");
      }
    },
    [durMs, loadIfNeeded]
  );

  useEffect(() => {
    mountedRef.current = true;
    completedRef.current = false;

    return () => {
      mountedRef.current = false;
      void unload();
    };
  }, [unload]);

  useEffect(() => {
    completedRef.current = false;
    void unload();
  }, [audioKey, unload]);

  const progressPct = Math.min(1, posMs / Math.max(1, durMs));

  return (
    <View style={styles.root}>
      <TouchableOpacity activeOpacity={0.9} onPress={togglePlay} style={styles.bigPlayWrap}>
        {isBuffering ? (
          <ActivityIndicator color="#0b0f14" size="large" />
        ) : (
          <Ionicons
            name={isPlaying ? "stop" : "play"}
            size={72}
            color="#0b0f14"
            style={{ marginLeft: isPlaying ? 0 : 6 }}
          />
        )}
      </TouchableOpacity>

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

      {loadStatus !== "idle" && (
        <Text
          style={[
            styles.statusText,
            loadStatus === "error" ? styles.statusError : styles.statusInfo,
          ]}
        >
          {loadStatus === "loading"
            ? "در حال آماده‌سازی فایل..."
            : loadStatus === "ready"
            ? "فایل آماده پخشه؛ دوباره دکمه پخش رو بزن"
            : "پخش فایل با مشکل مواجه شد، اینترنت رو چک کن و دوباره تلاش کن"}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 16,
    backgroundColor: "transparent",
  },

  bigPlayWrap: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#D4AF37",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },

  progressTrack: {
    width: "100%",
    maxWidth: 320,
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,.10)",
    overflow: "hidden",
    marginTop: 4,
  },

  progressFill: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#E98A15",
  },

  timeText: {
    color: "rgba(231,238,247,.65)",
    fontSize: 12,
    marginTop: -4,
  },

  statusText: {
    marginTop: -8,
    fontSize: 12,
    textAlign: "center",
  },

  statusInfo: {
    color: "#D4AF37",
  },

  statusError: {
    color: "#ff6b6b",
  },
});
