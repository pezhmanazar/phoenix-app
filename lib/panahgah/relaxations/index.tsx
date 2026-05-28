// lib/panahgah/relaxations/index.tsx
import { Ionicons } from "@expo/vector-icons";
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioStatus,
} from "expo-audio";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { AUDIO_KEYS, mediaUrl } from "@/constants/media";

/* ---------- Theme (همون پناهگاه) ---------- */
const palette = {
  bg: "#0b0f14",
  text: "#F9FAFB",
  muted: "rgba(231,238,247,.78)",
  sub2: "rgba(231,238,247,.70)",
  border: "rgba(255,255,255,.10)",
  glass: "rgba(255,255,255,.04)",
  glass2: "rgba(3,7,18,.92)",
  gold: "#D4AF37",
  orange: "#E98A15",
  red: "#FCA5A5",
  green: "#22C55E",

  // ✅ Green calming accents for relaxation player
  calmGreen: "#22C55E",
  calmGreen2: "#34D399",
};

export type RelaxationId =
  | "box"
  | "exhale"
  | "body_surf"
  | "pmr"
  | "ground_321"
  | "movement";

type RelaxationModel = {
  id: RelaxationId;
  title: string;
  kind: "breath" | "scan" | "pmr" | "ground" | "move";

  /** ✅ کلید ویس کوچ همین روش */
  coachAudioKey: string;
};

const DEFAULT_COACH_KEY = AUDIO_KEYS.panahgahRelaxCoachDefault;

/* ✅ هر روش ← ویس خودش از media.ts */
export const RELAXATIONS: RelaxationModel[] = [
  {
    id: "box",
    title: "تنفس جعبه‌ای",
    kind: "breath",
    coachAudioKey: AUDIO_KEYS.panahgahRelax.boxBreathing,
  },
  {
    id: "exhale",
    title: "بازدم طولانی",
    kind: "breath",
    coachAudioKey: AUDIO_KEYS.panahgahRelax.longExhale,
  },
  {
    id: "body_surf",
    title: "مشاهده موج در بدن",
    kind: "scan",
    coachAudioKey: AUDIO_KEYS.panahgahRelax.urgeSurf,
  },
  {
    id: "pmr",
    title: "رهاسازی عضلانی",
    kind: "pmr",
    coachAudioKey: AUDIO_KEYS.panahgahRelax.muscleRelease,
  },
  {
    id: "ground_321",
    title: "فعال کردن حواس پنجگانه",
    kind: "ground",
    coachAudioKey: AUDIO_KEYS.panahgahRelax.grounding5Senses,
  },
  {
    id: "movement",
    title: "تنفس پرتابی",
    kind: "move",
    coachAudioKey: AUDIO_KEYS.panahgahRelax.resetBreath,
  },
];

/* ---------- Seeded pick (رندوم پایدار) ---------- */
function hashSeed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function pickRelaxation(seed: string): RelaxationModel {
  const h = hashSeed(seed);
  return RELAXATIONS[h % RELAXATIONS.length];
}

/* ---------- Utils ---------- */
function fmtMs(ms: number) {
  const s = Math.max(0, Math.floor((Number.isFinite(ms) ? ms : 0) / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/* ---------- Voice Coach Player (big + seekbar like "گوش بده") ---------- */
function CoachAudioPlayer({
  audioKey,
  onFinished,
}: {
  audioKey: string;
  onFinished?: () => void;
}) {
  const url = useMemo(() => mediaUrl(audioKey), [audioKey]);

  const playerRef = useRef<AudioPlayer | null>(null);
  const currentUrlRef = useRef<string>("");

  const mountedRef = useRef(true);
  const opLockRef = useRef(false);
  const fadingRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [posMs, setPosMs] = useState(0);
  const [durMs, setDurMs] = useState(1);
  const [trackW, setTrackW] = useState(0);

  const lock = async <T,>(fn: () => Promise<T>) => {
    if (opLockRef.current) return null as any;
    opLockRef.current = true;
    try {
      return await fn();
    } finally {
      opLockRef.current = false;
    }
  };

  const resetUi = useCallback(() => {
    if (!mountedRef.current) return;
    setIsLoaded(false);
    setIsPlaying(false);
    setIsBuffering(false);
    setPosMs(0);
    setDurMs(1);
  }, []);

  const fadeOutAndStop = useCallback(async (ms = 320) => {
    const p = playerRef.current;
    if (!p) return;

    if (fadingRef.current) return;
    fadingRef.current = true;

    try {
      const wasPlaying = !!p.isLoaded && !!p.playing;

      if (wasPlaying) {
        const steps = 8;
        const stepMs = Math.max(20, Math.floor(ms / steps));
        const startVol = typeof p.volume === "number" ? p.volume : 1;

        for (let i = 0; i < steps; i++) {
          const v = startVol * (1 - (i + 1) / steps);
          try {
            p.volume = Math.max(0, v);
          } catch {}
          await new Promise((r) => setTimeout(r, stepMs));
        }
      }

      try {
        p.pause();
      } catch {}

      try {
        await p.seekTo(0);
      } catch {}

      try {
        p.volume = 1;
      } catch {}
    } finally {
      fadingRef.current = false;
    }
  }, []);

  const unload = useCallback(async () => {
    const p = playerRef.current;
    playerRef.current = null;
    currentUrlRef.current = "";

    try {
      if (p) {
        try {
          p.pause();
        } catch {}
        try {
          p.remove();
        } catch {}
      }
    } catch {}

    resetUi();
  }, [resetUi]);

  const attachStatusListener = useCallback(
    (player: AudioPlayer) => {
      player.addListener("playbackStatusUpdate", (st: AudioStatus) => {
        if (!mountedRef.current) return;

        const nextLoaded = !!st.isLoaded;
        const nextPlaying = !!st.playing;
        const nextPosMs = Math.max(0, Math.floor((st.currentTime || 0) * 1000));
        const nextDurMs = Math.max(1, Math.floor((st.duration || 0) * 1000));

        setIsLoaded(nextLoaded);
        setIsPlaying(nextPlaying);
        setPosMs(nextPosMs);
        setDurMs(nextDurMs);
        setIsBuffering(!!st.isBuffering);

        if (st.didJustFinish) {
          setIsPlaying(false);
          onFinished?.();
        }
      });
    },
    [onFinished]
  );

  const loadIfNeeded = useCallback(async () => {
    if (playerRef.current && currentUrlRef.current && currentUrlRef.current !== url) {
      await fadeOutAndStop(300).catch(() => {});
      await unload();
    }

    if (playerRef.current && currentUrlRef.current === url) return;

    setIsBuffering(true);

    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: "duckOthers",
      shouldRouteThroughEarpiece: false,
    }).catch(() => {});

    const player = createAudioPlayer({ uri: url }, { updateInterval: 250 });
    player.loop = false;
    player.volume = 1;

    attachStatusListener(player);

    playerRef.current = player;
    currentUrlRef.current = url;

    if (!mountedRef.current) return;

    setIsLoaded(!!player.isLoaded);
    setIsPlaying(!!player.playing);
    setPosMs(Math.max(0, Math.floor((player.currentTime || 0) * 1000)));
    setDurMs(Math.max(1, Math.floor((player.duration || 0) * 1000)));
    setIsBuffering(false);
  }, [url, fadeOutAndStop, unload, attachStatusListener]);

  useEffect(() => {
    if (!playerRef.current) {
      resetUi();
      return;
    }

    if (currentUrlRef.current && currentUrlRef.current !== url) {
      lock(async () => {
        setIsBuffering(true);
        await fadeOutAndStop(280).catch(() => {});
        await unload();
        if (!mountedRef.current) return;
        setIsBuffering(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const togglePlay = useCallback(() => {
    return lock(async () => {
      if (isBuffering) return;
      if (fadingRef.current) return;

      if (!playerRef.current) setIsBuffering(true);
      await loadIfNeeded();

      const p = playerRef.current;
      if (!p || !p.isLoaded) {
        if (mountedRef.current) setIsBuffering(false);
        return;
      }

      if (p.playing) {
        setIsBuffering(true);
        await fadeOutAndStop(180).catch(() => {});
        if (!mountedRef.current) return;
        setIsBuffering(false);
        setIsPlaying(false);
        return;
      }

      const pos = Math.floor((p.currentTime || 0) * 1000);
      const dur = Math.floor((p.duration || 0) * 1000);

      if (pos >= dur - 250) {
        await p.seekTo(0).catch(() => {});
      }

      setIsBuffering(true);
      try {
        p.volume = 1;
      } catch {}
      p.play();
      if (!mountedRef.current) return;
      setIsBuffering(false);
      setIsPlaying(true);
    });
  }, [isBuffering, loadIfNeeded, fadeOutAndStop]);

  const seekTo = useCallback(
    (ms: number) => {
      return lock(async () => {
        await loadIfNeeded();
        const p = playerRef.current;
        if (!p || !p.isLoaded) return;

        const d = Math.max(1, Math.floor((p.duration || durMs || 1) * 1000));
        const clamped = Math.max(0, Math.min(ms, d));
        await p.seekTo(clamped / 1000).catch(() => {});
      });
    },
    [durMs, loadIfNeeded]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;

      lock(async () => {
        try {
          setIsBuffering(true);
          await fadeOutAndStop(280).catch(() => {});
          await unload();
        } catch {}
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progressPct = Math.min(1, posMs / Math.max(1, durMs));

  return (
    <View style={styles.bigPlayerWrap}>
      <View pointerEvents="none" style={styles.calmGlowA} />
      <View pointerEvents="none" style={styles.calmGlowB} />

      <TouchableOpacity activeOpacity={0.9} onPress={togglePlay} style={styles.bigPlayBtn}>
        {isBuffering ? (
          <ActivityIndicator color={palette.bg} />
        ) : (
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={72}
            color={palette.bg}
            style={{ marginLeft: isPlaying ? 0 : 6 }}
          />
        )}
      </TouchableOpacity>

      <View
        style={styles.bigTrack}
        onLayout={(e) => setTrackW(e?.nativeEvent?.layout?.width ?? 0)}
      >
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
          <View style={[styles.bigFill, { width: `${Math.round(progressPct * 100)}%` }]} />
        </TouchableOpacity>
      </View>

      <Text style={styles.bigTime}>
        {fmtMs(posMs)} / {fmtMs(durMs)}
      </Text>

      {!isLoaded && !isBuffering ? (
        <Text style={styles.bigHint}>برای شروع، روی دکمهٔ پلی بزن.</Text>
      ) : null}
    </View>
  );
}

/* ---------- Main UI component ---------- */
export function RelaxationPlayer({
  model,
  onDone,
}: {
  model: RelaxationModel;
  onDone?: () => void;
}) {
  const audioKey = (model as any)?.coachAudioKey || DEFAULT_COACH_KEY;

  return (
    <View style={styles.card}>
      <Text style={styles.h1}>{model.title}</Text>
      <View style={{ height: 10 }} />

      <CoachAudioPlayer audioKey={audioKey} onFinished={() => onDone?.()} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.glass,
    borderRadius: 18,
    padding: 14,
    marginTop: 10,
  },
  h1: { color: palette.text, fontWeight: "900", fontSize: 16, textAlign: "center" },

  bigPlayerWrap: {
    width: "100%",
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(0,0,0,.18)",
    borderRadius: 20,
    padding: 16,
    alignItems: "center",
    gap: 10,
    overflow: "hidden",
  },

  calmGlowA: {
    position: "absolute",
    top: -40,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,.10)",
    transform: [{ rotate: "14deg" }],
  },
  calmGlowB: {
    position: "absolute",
    bottom: -60,
    right: -60,
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: "rgba(52,211,153,.08)",
    transform: [{ rotate: "-10deg" }],
  },

  bigPlayBtn: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(34,197,94,.92)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,.35)",
  },

  bigTrack: {
    width: "100%",
    height: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(255,255,255,.06)",
    overflow: "hidden",
    marginTop: 6,
  },

  bigFill: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(52,211,153,.95)",
  },

  bigTime: {
    color: "rgba(231,238,247,.70)",
    fontSize: 12,
    fontWeight: "800",
  },

  bigHint: {
    color: "rgba(231,238,247,.65)",
    fontSize: 11,
    textAlign: "center",
    marginTop: 2,
  },
});
