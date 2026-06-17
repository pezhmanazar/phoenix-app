// phoenix-app/app/(tabs)/ReviewResult.tsx
import { useAuth } from "@/hooks/useAuth";
import { getFriendlyErrorMessage } from "@/lib/errors/getFriendlyErrorMessage";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioStatus,
} from "expo-audio";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { AUDIO_KEYS, mediaUrl } from "../../constants/media";


/**
 * ✅ فقط API اصلی
 */
const API_REVIEW = "https://api.qoqnoos.app/api/pelekan/review";
const API_STATE = "https://api.qoqnoos.app/api/pelekan/state";

// ✅ Baseline max score
const BASELINE_MAX_SCORE = 31;

type ResultResponse = {
  ok: boolean;
  error?: string;
  data?: {
    status: "in_progress" | "completed_locked" | "unlocked";
    canEnterPelekan?: boolean;
    result: any | null;
  };
};

type StateResponse = {
  ok: boolean;
  error?: string;
  data?: {
    baseline?: { session?: any | null } | null;
    review?: { session?: any | null } | null;
    user?: any | null;
  };
};

type DiagramItem = {
  key: string;
  title: string;
  percent: number;
  label?: string;
};

async function fetchJsonAuthed(url: string, token: string) {
  const res = await fetch(url, {
    headers: {
      "Cache-Control": "no-store",
      Authorization: `Bearer ${token}`,
    },
  });

  const text = await res.text();
  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok || !json?.ok) {
    const msg =
      json?.error ||
      json?.message ||
      json?.detail ||
      json?.data?.error ||
      json?.data?.message ||
      (res.status === 401 ? "UNAUTHORIZED" : `HTTP_${res.status}`);
    throw new Error(msg);
  }

  return json;
}

async function postJsonAuthed(url: string, body: any, token: string) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok || !json?.ok) {
    const msg =
      json?.error ||
      json?.message ||
      json?.detail ||
      json?.data?.error ||
      json?.data?.message ||
      (res.status === 401 ? "UNAUTHORIZED" : `HTTP_${res.status}`);
    throw new Error(msg);
  }

  return json;
}

/** ✅ Ring (بدون کتابخانه اضافی) */
function ScoreRing({
  value,
  max = 100,
  size = 108,
  stroke = 10,
  trackColor,
  progressColor,
  textColor,
  subColor,
  label,
}: {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  trackColor: string;
  progressColor: string;
  textColor: string;
  subColor: string;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(Number(value || 0), Number(max || 100)));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  const safeMax = Number(max || 100);
  const dash = safeMax > 0 ? (clamped / safeMax) * c : 0;

  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={progressColor}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c - dash}`}
            rotation={-90}
            originX={size / 2}
            originY={size / 2}
          />
        </Svg>

        <View style={[StyleSheet.absoluteFillObject, { alignItems: "center", justifyContent: "center" }]}>
          <Text style={{ color: textColor, fontWeight: "900", fontSize: 20 }}>{clamped}</Text>
          <Text style={{ color: subColor, fontSize: 11, marginTop: 2, fontWeight: "900" }}>از {safeMax}</Text>
        </View>
      </View>

      {!!label && (
        <Text style={{ marginTop: 10, color: subColor, fontSize: 12, fontWeight: "900", writingDirection: "rtl" as any }}>
          {label}
        </Text>
      )}
    </View>
  );
}

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
  const playerRef = useRef<AudioPlayer | null>(null);
  const statusSubscriptionRef = useRef<{ remove: () => void } | null>(null);

  const opLockRef = useRef(false);
  const mountedRef = useRef(true);

  const [, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
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
  const p = playerRef.current;
  playerRef.current = null;

  try {
    statusSubscriptionRef.current?.remove?.();
    statusSubscriptionRef.current = null;
  } catch {}

  try {
    if (p) {
      try {
        p.pause();
      } catch {}

      try {
        p.remove();
      } catch {}
    }
  } finally {
    if (!mountedRef.current) return;
    setReady(false);
    setPlaying(false);
    setLoadingAudio(false);
    setLoadStatus("idle");
    setPosMs(0);
    setDurMs(0);
  }
}, []);


  const attachStatusListener = useCallback((player: AudioPlayer) => {
  try {
    statusSubscriptionRef.current?.remove?.();
    statusSubscriptionRef.current = null;
  } catch {}

  statusSubscriptionRef.current = player.addListener("playbackStatusUpdate", (st: AudioStatus) => {
    if (!st?.isLoaded) return;
    if (!mountedRef.current) return;

    setPlaying(!!st.playing);
    setPosMs(Math.max(0, Math.floor((st.currentTime || 0) * 1000)));
    setDurMs(Math.max(0, Math.floor((st.duration || 0) * 1000)));

    if (st.isLoaded) {
      setLoadStatus((prev) => (prev === "loading" ? "ready" : prev));
    }

    if (st.didJustFinish) {
      setPlaying(false);
      setLoadStatus("idle");
    }
  });
}, []);


  const ensureLoaded = useCallback(async () => {
    if (playerRef.current) return;

    setLoadingAudio(true);
    setLoadStatus("loading");

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

    if (!mountedRef.current) return;
    setReady(true);
    setDurMs(Math.max(0, Math.floor((player.duration || 0) * 1000)));
    setPlaying(!!player.playing);
    setLoadingAudio(false);
    if (player.isLoaded) setLoadStatus("ready");
  }, [url, attachStatusListener]);

  const togglePlayPause = useCallback(() => {
    return lock(async () => {
      if (!playerRef.current) {
        setLoadingAudio(true);
        setLoadStatus("loading");
        await ensureLoaded();
      }

      const p = playerRef.current;
      if (!p) {
        if (mountedRef.current) setLoadingAudio(false);
        setLoadStatus("error");
        return;
      }

      setLoadingAudio(true);

      for (let i = 0; i < 25 && !p.isLoaded; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      if (!p.isLoaded) {
        if (mountedRef.current) setLoadingAudio(false);
        setLoadStatus("error");
        return;
      }

      if (p.playing) {
        p.pause();
        if (!mountedRef.current) return;
        setPlaying(false);
        setLoadingAudio(false);
        setLoadStatus("idle");
        return;
      }

      const currentMs = Math.max(0, Math.floor((p.currentTime || 0) * 1000));
      const durationMs = Math.max(0, Math.floor((p.duration || 0) * 1000));

      if (durationMs > 0 && currentMs >= durationMs - 250) {
        await p.seekTo(0).catch(() => {});
      }

      p.play();

      let started = !!p.playing;

      for (let i = 0; i < 15 && !started; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        started = !!p.playing;
      }

      if (!mountedRef.current) return;
      setPlaying(started);
      setLoadingAudio(false);
      setLoadStatus(started ? "idle" : "ready");
    });
  }, [ensureLoaded]);

  const seekTo = useCallback(
    (ratio: number) => {
      return lock(async () => {
        const p = playerRef.current;
        if (!p || !p.isLoaded) return;

        const d = Math.max(0, Math.floor((p.duration || durMs / 1000) * 1000));
        if (d <= 0) return;

        const target = Math.max(0, Math.min(d, Math.floor(d * ratio)));
        await p.seekTo(target / 1000).catch(() => {});

        if (mountedRef.current) setPosMs(target);
      });
    },
    [durMs]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      void unload();
    };
  }, [unload]);

  return (
    <View style={[styles.audioRow, { borderColor: palette.border2, backgroundColor: palette.glass2 }]}>
      <View style={styles.audioInnerRow}>
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

        <View style={styles.audioBarCol}>
          <SeekBar progress={progress} palette={palette} onSeek={seekTo} />
        </View>

        <Text style={[styles.audioTimeInline, { color: palette.sub2 }]}>
          {formatMs(posMs)} / {formatMs(durMs)}
        </Text>
      </View>
      {loadStatus !== "idle" && (
      <Text
        style={[
          styles.audioLoadStatus,
          {
            color: loadStatus === "error" ? "#FCA5A5" : palette.gold,
          },
        ]}
      >
        {loadStatus === "loading" && "در حال آماده‌سازی فایل... صبور باش"}
        {loadStatus === "ready" && "فایل آماده شنیدنه؛ دوباره دکمه شروع رو بزن"}
        {loadStatus === "error" && "خطا در دریافت فایل؛ اینترنت رو چک کن و دوباره بزن"}
      </Text>
    )}
  </View>
);
}


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
          <View style={[styles.audioBarFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: palette.gold }]} />
        </View>
      </Pressable>
    </View>
  );
}

/* --------------------------- Audio selection logic -------------------------- */

type ReviewAudioKey = "danger" | "draining" | "unstable" | "good" | "unclear";

const AUDIO_MAP: Record<ReviewAudioKey, string> = {
  danger: mediaUrl(AUDIO_KEYS.review.danger),
  draining: mediaUrl(AUDIO_KEYS.review.draining),
  unstable: mediaUrl(AUDIO_KEYS.review.unstable),
  good: mediaUrl(AUDIO_KEYS.review.good),
  unclear: mediaUrl(AUDIO_KEYS.review.unclear),
};

function computeReviewAudioKeyFromMeta(metaTest1: any): ReviewAudioKey {
  const redPercent = Number(metaTest1?.redPercent);
  const satisfPercent = metaTest1?.satisfPercent == null ? null : Number(metaTest1?.satisfPercent);
  const attachPercent = metaTest1?.attachPercent == null ? null : Number(metaTest1?.attachPercent);
  const conflictPercent = metaTest1?.conflictPercent == null ? null : Number(metaTest1?.conflictPercent);

  const relationshipDanger = (Number.isFinite(redPercent) && redPercent >= 60) || (conflictPercent != null && conflictPercent >= 70);

  const personalDanger =
    satisfPercent != null &&
    attachPercent != null &&
    satisfPercent <= 30 &&
    attachPercent >= 70;

  const relationshipPoor =
    (satisfPercent != null && satisfPercent <= 40) ||
    (conflictPercent != null && conflictPercent >= 60) ||
    (attachPercent != null && attachPercent >= 65);

  const relationshipGood =
    satisfPercent != null &&
    satisfPercent >= 65 &&
    conflictPercent != null &&
    conflictPercent <= 45 &&
    attachPercent != null &&
    attachPercent <= 55;

  if (relationshipDanger) return "danger";
  if (personalDanger) return "draining";
  if (relationshipPoor) return "unstable";
  if (relationshipGood) return "good";
  return "unclear";
}

export default function ReviewResult() {
const router = useRouter();
const { token, loading: authLoading } = useAuth() as any;


  const mountedRef = useRef(true);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [baselineSession, setBaselineSession] = useState<any | null>(null);
  const [reviewSession, setReviewSession] = useState<any | null>(null);

  const [result, setResult] = useState<any | null>(null);
  const [reviewResultStatus, setReviewResultStatus] = useState<
  "in_progress" | "completed_locked" | "unlocked" | null
>(null);

  const palette = useMemo(
    () => ({
      bg: "#0b0f14",
      glass: "rgba(3,7,18,.92)",
      glass2: "rgba(255,255,255,.02)",
      border: "rgba(255,255,255,.10)",
      border2: "rgba(255,255,255,.14)",
      text: "#F9FAFB",
      sub: "rgba(231,238,247,.75)",
      sub2: "rgba(231,238,247,.55)",
      gold: "#D4AF37",
      orange: "#E98A15",
      red: "#ef4444",
      lime: "#86efac",
      track: "rgba(231,238,247,.14)",
    }),
    []
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const goPelekan = useCallback(() => {
  router.replace({
    pathname: "/(tabs)/Pelekan",
    params: { enterTreatment: "1" },
  } as any);
}, [router]);


  const goPelekanReviewTests = useCallback(() => {
  router.replace(`/(tabs)/Pelekan?focus=review_tests`);
}, [router]);

  const goPelekanBaselineTests = useCallback(() => {
  router.replace(`/(tabs)/Pelekan?focus=baseline_tests`);
}, [router]);

  const fetchAll = useCallback(async () => {
if (authLoading) {
    return;
}

if (!token) {
  setBaselineSession(null);
  setReviewSession(null);
  setResult(null);
  setReviewResultStatus(null);
  setErr("TOKEN_MISSING");
  setLoading(false);
  return;
}


    if (mountedRef.current) {
      setLoading(true);
      setErr(null);
    }

    try {
      const stJson: StateResponse = await fetchJsonAuthed(API_STATE, token);
      const b = stJson?.data?.baseline?.session ?? null;
      const r = stJson?.data?.review?.session ?? null;

      if (mountedRef.current) {
        setBaselineSession(b);
        setReviewSession(r);
      }

      const rStatus = String(r?.status || "");
      const shouldFetchReviewResult = rStatus === "completed_locked" || rStatus === "unlocked";

  if (!shouldFetchReviewResult) {
  if (mountedRef.current) {
    setReviewResultStatus((rStatus as any) || null);
    setResult(null);
    setErr(null);
  }
  return;
}

try {
  const rrJson: ResultResponse = await fetchJsonAuthed(`${API_REVIEW}/result`, token);

  if (mountedRef.current) {
    setReviewResultStatus(rrJson?.data?.status ?? null);
    setResult(rrJson?.data?.result ?? null);
    setErr(null);
  }
} catch (e: any) {
  if (mountedRef.current) {
    setReviewResultStatus((rStatus as any) || null);
    setResult(null);
    setErr(String(e?.message || "FAILED"));
  }
}

    } catch (e: any) {
      if (mountedRef.current) setErr(String(e?.message || "NETWORK_ERROR"));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [token, authLoading]);

  useEffect(() => {
  if (authLoading) return;
  fetchAll();
}, [authLoading, fetchAll]);

  useFocusEffect(
  useCallback(() => {
    if (authLoading) return;
    if (!token) return;

    fetchAll();
  }, [fetchAll, authLoading, token])
);


  const retryRef = useRef(0);
  const retryTimerRef = useRef<any>(null);

  const hasUsableResultForRetry = useMemo(() => {
  const diagramsObjForRetry = result?.diagrams || null;
  const test1ForRetry = Array.isArray(diagramsObjForRetry?.test1)
    ? diagramsObjForRetry.test1
    : [];
  const test2ForRetry = Array.isArray(diagramsObjForRetry?.test2)
    ? diagramsObjForRetry.test2
    : [];
  const summaryForRetry = result?.summary || null;

  return (
    !!result &&
    (
      !!summaryForRetry ||
      !!result?.message ||
      test1ForRetry.length > 0 ||
      test2ForRetry.length > 0
    )
  );
}, [result]);


  useEffect(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    if (loading || err) return;
    if (authLoading || !token) return;

    const rStatus = String(reviewSession?.status || "");
    const chosen = String(reviewSession?.chosenPath || "");

    const isDone = rStatus === "completed_locked" || rStatus === "unlocked";
    if (isDone && hasUsableResultForRetry) {
  retryRef.current = 0;
  return;
}

    if (chosen !== "review") return;
    if (retryRef.current >= 6) return;

    retryTimerRef.current = setTimeout(() => {
      retryRef.current += 1;
      fetchAll();
    }, 700);

    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [
  loading,
  err,
  authLoading,
  token,
  reviewSession?.status,
  reviewSession?.chosenPath,
  hasUsableResultForRetry,
  fetchAll,
]
);

  const goReviewTestsForceReviewPath = useCallback(async () => {
if (authLoading) return;

if (!token) {
  setErr("TOKEN_MISSING");
  return;
}

    if (mountedRef.current) {
      setLoading(true);
      setErr(null);
    }

    try {
      const chosen = String(reviewSession?.chosenPath || "");
      if (chosen === "skip_review") {
        await postJsonAuthed(`${API_REVIEW}/choose`, { choice: "review" }, token);
        try {
          await fetchAll();
        } catch {}
      }

      router.replace({
  pathname: "/(tabs)/Pelekan",
  params: { focus: "review_tests" },
} as any);
    } catch (e: any) {
      if (mountedRef.current) setErr(String(e?.message || "NETWORK_ERROR"));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [authLoading, token, reviewSession?.chosenPath, router, fetchAll]);

  const baselineStatus = String(baselineSession?.status || "");
  const baselineDone = baselineStatus === "completed";
  const baselineInProgress = !!baselineSession && !baselineDone;

  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

  const baselineScore = useMemo(() => {
    const n = baselineSession?.totalScore ?? null;
    const v = Number(n);
    if (!Number.isFinite(v)) return null;
    return clamp(v, 0, BASELINE_MAX_SCORE);
  }, [baselineSession]);

  const baselinePercent = useMemo(() => {
    if (baselineScore == null) return null;
    return clamp(Math.round((baselineScore / BASELINE_MAX_SCORE) * 100), 0, 100);
  }, [baselineScore]);

  const baselineColor = useMemo(() => {
    if (baselineScore == null) return palette.gold;
    if (baselineScore >= 20) return palette.red;
    if (baselineScore >= 10) return palette.orange;
    return palette.lime;
  }, [baselineScore, palette.red, palette.orange, palette.lime, palette.gold]);

  const baselineExplain = useMemo(() => {
    const safeText =
      baselineSession?.scalesJson?.interpretationTextSafe ??
      baselineSession?.scalesJson?.interpretationSafe ??
      baselineSession?.interpretationTextSafe ??
      baselineSession?.scalesJson?.interpretationText ??
      null;

    if (safeText) return String(safeText);

    return "این نمره شدت «فشار و آسیب روانیِ ناشی از شکست عاطفی یا جدایی» را نشان می‌دهد. نمره بالاتر یعنی ذهن و بدن تو هنوز تحت فشار بیشتری هستند و بهتر است از یک مسیر حمایتی و درمانی ساختارمند استفاده کنی.";
  }, [baselineSession]);

  const hasReviewSession = !!reviewSession?.id;
  const chosenPath = reviewSession?.chosenPath ?? null;
  const reviewSessStatus = String(reviewSession?.status || "");
  const effectiveReviewStatus = String(reviewResultStatus || reviewSessStatus || "");
  const reviewInProgress = effectiveReviewStatus === "in_progress";

  const isSkipPath = chosenPath === "skip_review";
  const isReviewPath = chosenPath === "review";
  const reviewDone =
  isReviewPath &&
  (effectiveReviewStatus === "completed_locked" ||
   effectiveReviewStatus === "unlocked");
  const locked = effectiveReviewStatus === "completed_locked";
  const didSkipTest2 = !!result?.meta?.didSkipTest2;

  const diagramsObj = result?.diagrams || null;
  const test1Diagrams: DiagramItem[] = Array.isArray(diagramsObj?.test1) ? diagramsObj.test1 : [];
  const test2Diagrams: DiagramItem[] = Array.isArray(diagramsObj?.test2) ? diagramsObj.test2 : [];
  const summary = result?.summary || null;

  const hasUsableResult =
  !!result &&
  (
    !!summary ||
    !!result?.message ||
    test1Diagrams.length > 0 ||
    test2Diagrams.length > 0
  );


  const returnOne =
    summary?.returnOne ??
    summary?.retOne ??
    summary?.return?.oneLook ??
    summary?.returnSummary ??
    null;

  const returnStep =
    summary?.returnStep ??
    summary?.retStep ??
    summary?.return?.nextStep ??
    null;

  const statusColor = useMemo(() => {
    if (isSkipPath) return palette.gold;
    if (reviewDone) return locked ? palette.red : palette.lime;
    return palette.gold;
  }, [isSkipPath, reviewDone, locked, palette.red, palette.lime, palette.gold]);

  const isHigherWorse = (key: string) => {
    const k = String(key || "");
    return k === "t1_redflags" || k === "t1_conflict" || k === "t1_attachment" || k === "t2_ambiguity" || k === "t2_cost";
  };

  const barColor = (key: string, percentRaw: any) => {
    const p = clamp(Number(percentRaw ?? 0), 0, 100);
    const worse = isHigherWorse(key);

    if (worse) {
      if (p >= 80) return palette.red;
      if (p >= 60) return palette.orange;
      if (p >= 40) return palette.gold;
      return palette.lime;
    } else {
      if (p >= 80) return palette.lime;
      if (p >= 60) return palette.gold;
      if (p >= 40) return palette.orange;
      return palette.red;
    }
  };

  const toneLabel = (key: string, percentRaw: any) => {
    const p = clamp(Number(percentRaw ?? 0), 0, 100);
    const worse = isHigherWorse(key);
    if (worse) {
      if (p >= 80) return "خیلی بالا (هشدار)";
      if (p >= 60) return "بالا";
      if (p >= 40) return "متوسط";
      return "پایین";
    } else {
      if (p >= 80) return "خیلی خوب";
      if (p >= 60) return "خوب";
      if (p >= 40) return "متوسط";
      return "ضعیف";
    }
  };

  const scaleExplain = (key: string) => {
    switch (key) {
      case "t1_redflags":
        return (
          "این شاخص میگه «چقدر خط قرمز جدی» در رابطه وجود داشته؛ چیزهایی که معمولاً با تکرارشون، رابطه ناایمن و آسیب‌زا می‌شد.\n" +
          "مثلا خشونت، اعتیاد، خیانت، تحقیرکردن، عدم جدی بودن در تغییر.\n\n" +
          "🟢 نمره پایین یعنی خط قرمزها داخل رابطه کم یا نادر بودن.\n" +
          "🟡 نمره متوسط یعنی چند مورد جدی وجود داشته و رابطه سمی بوده.\n" +
          "🔴 نمره بالا یعنی الگوی تکرارشونده‌ی خطرناک وجود داشته و احتمال برگشت آسیب‌ها زیاده و رابطه برای فرد بسیار خطرناکه."
        );

      case "t1_satisfaction":
        return (
          "این شاخص نشون می‌ده «تجربه‌ی تو از رابطه چقدر خوب بوده»؛ یعنی حس دیده‌شدن، آرامش، صمیمیت، احترام، و امنیت عاطفی.\n" +
          "مثلا وقتی ناراحت بودی به حرفات گوش می‌داد؟ یا موقع ناراحتی کنارت می‌موند؟ یا در کنارش احساس ارزشمندی می‌کردی؟ یا باید مدام ثابت می‌کردی کافی هستی؟\n\n" +
          "🔴 نمره پایین یعنی رابطه بیشتر فرسایشی بوده تا آروم‌کننده.\n" +
          "🟡 نمره متوسط یعنی رابطه، هم لحظات خوب داشته هم فشار و ناراحتی.\n" +
          "🟢 نمره بالا یعنی از نظر تجربه‌ی ذهنی، رابطه برای تو بیشتر «خوب و دلگرم‌کننده» بوده."
        );

      case "t1_attachment":
        return (
          "این شاخص میزان «وابستگی» رو می‌سنجه؛ یعنی رابطه چقدر روی زخم‌های وابستگی فشار آورده مثل اضطرابِ رهاشدگی یا ترس از صمیمیت.\n" +
          "مثلا با یک دیر جواب دادن، آیا ذهنت قفل می‌کرد و دنبال نشونه می‌گشتی؟.\n" +
          "یا وقتی رابطه بیش از حد صمیمی میشد آیا از رابطه سرد می‌شدی یا فرار می‌کردی؟.\n\n" +
          "🟢 نمره پایین یعنی رابطه نسبتاً آروم و بدون قفل‌شدن‌های شدید بوده.\n" +
          "🟡 نمره متوسط یعنی بعض وقت‌ها الگوی وابستگی فعال می‌شده ولی قابل کنترل بوده.\n" +
          "🔴 نمره بالا یعنی رابطه شدیداً سیستم عصبی تو رو فعال می‌کرده و تصمیم‌گیری شفاف رو برات سخت می‌کرده."
        );

      case "t1_conflict":
        return (
          "این شاخص کیفیت «اختلاف و تعارض» رو می‌سنجه یعنی آیا اختلاف‌ها قابل حل بوده یا تبدیل به یک چرخه‌ی فرساینده می‌شده.\n" +
          "مثلا در تعارضِ ناسالم تحقیر، قهرهای طولانی، حالت دفاعی‌بودن، سرزنش، تهدید، برچسب‌زدن و دعواهایی که هیچ‌وقت حل نمی‌شد دیده می‌شد.\n\n" +
          "🟢 نمره پایین یعنی اختلاف‌ها معمولاً با گفت‌وگو حل می‌شده.\n" +
          "🟡 نمره متوسط یعنی دعواها گاهی سنگین بوده ولی هنوز قابل مدیریت بوده.\n" +
          "🔴 نمره بالا یعنی الگوی دعوا «مسموم و تکرارشونده» بوده و احتمال آسیب دوباره بشدت بالاست."
        );

      case "t2_evidence":
        return (
          "این شاخص میگه «چقدر شواهد واقعی برای برگشت وجود داره»؛ یعنی نشونه‌هایی که از جنس عمل هستند نه حرف.\n" +
          "مثلا پذیرش مسئولیت اشتباهات، عذرخواهی بالغانه، اقدام عملی برای تغییر، ثبات رفتاری در زمان، احترام به مرزها و قطع رابطه‌های موازی.\n\n" +
          "🔴 نمره پایین یعنی بیشتر وعده احساسی داده و شواهد عملی کمه یا اینکه اصلا تمایلی به برگشت نداره.\n" +
          "🟡 نمره متوسط یعنی بعضی رفتارهای خوب رو داره ولی هنوز کافی و پایدار نیست.\n" +
          "🟢 نمره بالا یعنی نشونه‌های عملی به شکل جدی دیده می‌شه و احتمال برگشتن واقعی وجود داره."
        );

      case "t2_ambiguity":
        return (
          "این شاخص «ابهام و تعلیق» رو می‌سنجه یعنی چقدر طرف مقابل با گرم‌وسرد کردن رابطه، تو رو در حالت انتظار نگه داشته.\n" +
          "مثلا یک روز خیلی نزدیک میشه، چند روز ناپدید میشه یا پیام‌های مبهم مثل «فعلاً صبر کن».\n\n" +
          "🟢 نمره پایین یعنی رفتارها نسبتاً روشن و قابل پیش‌بینی هستند.\n" +
          "🟡 نمره متوسط یعنی کمی ابهام وجود داره.\n" +
          "🔴 نمره بالا یعنی تعلیق روانی زیاد بالاست و بیشترین فرسایش روانی رو ایجاد می‌کنه."
        );

      case "t2_cost":
        return (
          "این شاخص «هزینه‌ی روانی انتظار» رو نشون می‌ده؛ یعنی منتظر موندن چقدر به ذهن، خواب، تمرکز و زندگی تو ضربه می‌زنه.\n" +
          "مثلا چک کردن مداوم گوشی، نشخوار فکری، بی‌خوابی، افت کارکرد.\n\n" +
          "🟢 نمره پایین یعنی زندگیت خیلی از ریتم نمی‌افته.\n" +
          "🟡 نمره متوسط یعنی انتظار انرژی‌بره.\n" +
          "🔴 نمره بالا یعنی انتظار زندگیت رو معلق کرده و باید سریع وارد مسیر درمان و رهایی بشی."
        );

      case "t2_maturity":
        return (
          "این شاخص «بلوغ عاطفی طرف مقابل» رو می‌سنجه یعنی توانایی گفت‌وگوی بالغانه، ثبات هیجانی، احترام به مرزها و مسئولیت‌پذیری.\n\n" +
          "🔴 نمره پایین یعنی ساختن رابطه سالم با این آدم سخته.\n" +
          "🟡 نمره متوسط یعنی بعضی ظرفیت‌ها هست ولی ناپایداره.\n" +
          "🟢 نمره بالا یعنی شانس ساختن رابطه سالم بالاتره (به شرط پایداری رفتار)."
        );

      default:
        return "";
    }
  };

  const headerTitle = "سنجش وضعیت";

  const headerSub = useMemo(() => {
    if (authLoading) return "در حال آماده‌سازی نشست…";
    if (loading) return "در حال دریافت نتیجه…";
    if (err) return "خطا در دریافت نتیجه";
    return null;
  }, [authLoading, loading, err]);

  const DiagramCard = ({ item }: { item: DiagramItem }) => {
    const p = clamp(Number(item?.percent ?? 0), 0, 100);
    const c = barColor(item.key, p);
    const explain = scaleExplain(item.key);

    return (
      <View style={[styles.diagram, { borderColor: palette.border, backgroundColor: palette.glass2 }]}>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={[styles.rtl, { color: palette.text, fontWeight: "900", flex: 1 }]}>{String(item?.title || "—")}</Text>

          <View style={[styles.pill, { borderColor: palette.border2 }]}>
            <Text style={[styles.rtl, { color: palette.sub, fontSize: 11, fontWeight: "900" }]}>{p}%</Text>
          </View>
        </View>

        <View style={[styles.barWrap, { borderColor: palette.border2 }]}>
          <View style={[styles.barFill, { width: `${p}%`, backgroundColor: c }]} />
        </View>

        <Text style={[styles.rtl, { color: palette.sub2, marginTop: 8, fontSize: 12 }]}>
          {item?.label ? `${item.label} — ` : ""}
          {toneLabel(item.key, p)}
        </Text>

        {!!explain && (
          <Text style={[styles.rtl, { color: palette.sub, marginTop: 8, fontSize: 12, lineHeight: 18 }]}>{explain}</Text>
        )}
      </View>
    );
  };

  const reviewAudio = useMemo(() => {
    const metaT1 = summary?.meta?.test1 ?? result?.summary?.meta?.test1 ?? null;
    const key = computeReviewAudioKeyFromMeta(metaT1);
    return { key, url: AUDIO_MAP[key] || AUDIO_MAP.unclear };
  }, [summary, result]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.bg }]} edges={["top"]}>
      <View style={[styles.header, { backgroundColor: palette.bg, borderBottomColor: palette.border }]}>
        <View style={[styles.headerAccent, { backgroundColor: statusColor }]} />
        <Text style={[styles.headerTitle, { color: statusColor }]}>{headerTitle}</Text>
        {!!headerSub && (
          <Text
            style={[
              styles.headerSub,
              {
                color: palette.sub,
                writingDirection: "rtl" as any,
                textAlign: "center" as any,
                alignSelf: "center",
              },
            ]}
          >
            {headerSub}
          </Text>
        )}
      </View>

      <ScrollView
  contentContainerStyle={[styles.content, { paddingBottom: 120 }]}
  showsVerticalScrollIndicator={false}
>
          <View style={[styles.card, { backgroundColor: palette.glass, borderColor: palette.border }]}>
          {(loading || authLoading) && (
            <View style={{ paddingVertical: 18, alignItems: "center" }}>
              <ActivityIndicator color={palette.gold} />
              <Text style={{ color: palette.sub2, marginTop: 10, fontSize: 12 }}>
                {authLoading ? "در حال آماده‌سازی نشست…" : "در حال دریافت…"}
              </Text>
            </View>
          )}

{!!err && !loading && !authLoading && (
  <Text style={[styles.rtl, { color: palette.red }]}>
    {getFriendlyErrorMessage(err)}
  </Text>
)}

          {!loading && !authLoading && !err && (
            <>
              <View style={[styles.block, { borderColor: palette.border }]}>
                <Text style={[styles.h2, { color: palette.text }]}>سنجش آسیب شکست عاطفی یا جدایی</Text>

                {!baselineSession ? (
                  <>
                    <Text style={[styles.rtl, { color: palette.sub2, marginTop: 8, lineHeight: 20 }]}>هنوز این سنجش انجام نشده.</Text>
                    <View style={{ height: 12 }} />
                    <Pressable
                      style={[styles.btnPrimary, { borderColor: "rgba(212,175,55,.35)", backgroundColor: "rgba(212,175,55,.10)" }]}
                      onPress={goPelekanBaselineTests}
                    >
                      <Text style={[styles.btnText, { color: palette.text }]}>شروع سنجش</Text>
                    </Pressable>
                  </>
                ) : baselineDone ? (
                  <>
                    <View style={{ marginTop: 12, alignItems: "center" }}>
                      <ScoreRing
                        value={baselineScore ?? 0}
                        max={BASELINE_MAX_SCORE}
                        trackColor={palette.track}
                        progressColor={baselineColor}
                        textColor={palette.text}
                        subColor={palette.sub2}
                        label={baselinePercent != null ? `${baselinePercent}% آسیب` : "نمره کلی"}
                      />
                    </View>

                    <Text style={[styles.rtl, { color: palette.sub, marginTop: 14, fontSize: 12, lineHeight: 18 }]}>
                      {baselineExplain}
                    </Text>
                  </>
                ) : baselineInProgress ? (
                  <>
                    <Text style={[styles.rtl, { color: palette.sub2, marginTop: 8, lineHeight: 20 }]}>سنجش شروع شده ولی کامل نشده.</Text>
                    <View style={{ height: 12 }} />
                    <Pressable
                      style={[styles.btnPrimary, { borderColor: "rgba(212,175,55,.35)", backgroundColor: "rgba(212,175,55,.10)" }]}
                      onPress={goPelekanBaselineTests}
                    >
                      <Text style={[styles.btnText, { color: palette.text }]}>ادامه سنجش</Text>
                    </Pressable>
                  </>
                ) : null}
              </View>

              <View style={{ height: 12 }} />

              <View style={[styles.block, { borderColor: palette.border }]}>
                <Text style={[styles.h2, { color: palette.text }]}>بازسنجی + «آیا برمی‌گرده؟»</Text>

                {!hasReviewSession || !chosenPath ? (
                  <>
                    <Text style={[styles.rtl, { color: palette.sub2, marginTop: 8, lineHeight: 20 }]}>هنوز آزمون‌های بازسنجی شروع نشده‌اند.</Text>
                    <View style={{ height: 12 }} />
                    <Pressable
                      style={[styles.btnPrimary, { borderColor: "rgba(233,138,21,.35)", backgroundColor: "rgba(233,138,21,.10)" }]}
                      onPress={goPelekanReviewTests}
                    >
                      <Text style={[styles.btnText, { color: palette.text }]}>انجام بازسنجی</Text>
                    </Pressable>
                  </>
                ) : isSkipPath ? (
                  <>
                    <Text style={[styles.rtl, { color: palette.sub2, marginTop: 8, lineHeight: 20 }]}>
                      چون مسیر «فراموش کردن» رو انتخاب کردی، اینجا نتیجهٔ بازسنجی رو به‌صورت پیش‌فرض نشون نمی‌دیم.
                      {"\n"}اگه دوست داری می‌تونی آزمون‌های بازسنجی رابطه و آیا برمی‌گرده؟ رو انجام بدی.
                    </Text>
                    <View style={{ height: 12 }} />
                    <Pressable
                      style={[styles.btnPrimary, { borderColor: "rgba(233,138,21,.35)", backgroundColor: "rgba(233,138,21,.10)" }]}
                      onPress={goReviewTestsForceReviewPath}
                    >
                      <Text style={[styles.btnText, { color: palette.text }]}>انجام آزمون‌ها</Text>
                    </Pressable>
                  </>
                ) : reviewInProgress ? (
                  <>
                    <Text style={[styles.rtl, { color: palette.sub2, marginTop: 8, lineHeight: 20 }]}>
                      آزمون‌ها کامل نشدن. برای ادامه، وارد پلکان شو.
                    </Text>
                    <View style={{ height: 12 }} />
                    <Pressable
                      style={[styles.btnPrimary, { borderColor: "rgba(233,138,21,.35)", backgroundColor: "rgba(233,138,21,.10)" }]}
                      onPress={goPelekanReviewTests}
                    >
                      <Text style={[styles.btnText, { color: palette.text }]}>ادامه آزمون‌ها</Text>
                    </Pressable>
                  </>
                ) : reviewDone && !hasUsableResult ? (
  <>
    <Text style={[styles.rtl, { color: palette.sub2, marginTop: 8, lineHeight: 20 }]}>
      نتیجه هنوز آماده نشده یا کامل دریافت نشده. یک‌بار تازه‌سازی را بزن.
    </Text>

    <View style={{ height: 12 }} />

    <Pressable
      style={[styles.btnPrimary, { borderColor: palette.border }]}
      onPress={fetchAll}
    >
      <Text style={[styles.btnText, { color: palette.text }]}>تازه‌سازی نتیجه</Text>
    </Pressable>
  </>
) : reviewDone ? (
                  <>
                    <View style={{ height: 10 }} />
                    <View style={[styles.oneLook, { borderColor: palette.border2 }]}>
                      <Text style={[styles.h2, { color: palette.text, textAlign: "center" as any }]}>وضعیت کلی تو (در یک نگاه)</Text>

                      <View style={{ height: 10 }} />
                      <InlineAudioPlayer url={reviewAudio.url} palette={palette} />

                      <Text style={[styles.rtl, { color: palette.sub2, marginTop: 10, lineHeight: 20 }]}>
                        {summary?.oneLook || result?.message || "—"}
                      </Text>

                      {!!summary?.nextStep && (
                        <View style={[styles.nextStep, { borderColor: "rgba(212,175,55,.25)" }]}>
                          <Text style={[styles.h3, { color: palette.gold }]}>گام پیشنهادی بعدی</Text>
                          <Text style={[styles.rtl, { color: palette.sub, marginTop: 6, lineHeight: 20 }]}>{summary.nextStep}</Text>

                          {!!returnOne && (
                            <View style={[styles.returnBox, { borderColor: "rgba(233,138,21,.25)" }]}>
                              <Text style={[styles.h3, { color: palette.orange }]}>احتمال برگشت (جمع‌بندی)</Text>
                              <Text style={[styles.rtl, { color: palette.sub, marginTop: 6, lineHeight: 20 }]}>{String(returnOne)}</Text>
                              {!!returnStep && (
                                <Text style={[styles.rtl, { color: palette.sub2, marginTop: 8, lineHeight: 20 }]}>
                                  {String(returnStep)}
                                </Text>
                              )}
                            </View>
                          )}
                        </View>
                      )}
                    </View>

                    <View style={{ height: 12 }} />
                    <Pressable style={[styles.btn, { borderColor: palette.border }]} onPress={reviewInProgress ? goPelekanReviewTests : goPelekan}>
                      <Text style={[styles.btnText, { color: palette.text }]}>رفتن به پلکان درمــــان</Text>
                    </Pressable>

                    <View style={{ height: 12 }} />

                    <View
                      style={{
                        height: 1,
                        alignSelf: "stretch",
                        backgroundColor: palette.border2,
                        opacity: 0.7,
                        marginTop: 14,
                        marginBottom: 10,
                      }}
                    />

                    {(test1Diagrams.length > 0 || test2Diagrams.length > 0) && (
                      <View style={{ marginTop: 14 }}>
                        <Text style={[styles.h2, { color: palette.text }]}>جزئیات تحلیلی</Text>

                        {test1Diagrams.length > 0 && (
                          <View style={{ marginTop: 10 }}>
                            <Text style={[styles.sectionTitle, { color: palette.sub }]}>آزمون ۱: بازسنجی رابطه</Text>
                            {test1Diagrams.map((d, idx) => (
                              <DiagramCard key={`${d.key}-${idx}`} item={d} />
                            ))}
                          </View>
                        )}

                        {!didSkipTest2 && test2Diagrams.length > 0 && (
                          <View style={{ marginTop: 14 }}>
                            <Text style={[styles.sectionTitle, { color: palette.sub }]}>آزمون ۲: آیا برمی‌گرده؟</Text>
                            {test2Diagrams.map((d, idx) => (
                              <DiagramCard key={`${d.key}-${idx}`} item={d} />
                            ))}
                          </View>
                        )}
                      </View>
                    )}

                    <View style={{ height: 14 }} />
                  </>
                ) : (
                  <>
                    <Text style={[styles.rtl, { color: palette.sub2, marginTop: 8, lineHeight: 20 }]}>
                      وضعیت آزمون‌ها نامشخصه. برای همگام‌سازی وارد پلکان شو.
                    </Text>

                    <View style={{ height: 12 }} />

                    <Pressable style={[styles.btnPrimary, { borderColor: palette.border }]} onPress={goPelekan}>
                      <Text style={[styles.btnText, { color: palette.text }]}>رفتن به پلکان درمــــان</Text>
                    </Pressable>
                  </>
                )}
              </View>

              <View style={{ height: 14 }} />

              <Pressable style={[styles.btn, { borderColor: palette.border }]} onPress={reviewInProgress ? goPelekanReviewTests : goPelekan}>
                <Text style={[styles.btnText, { color: palette.text }]}>رفتن به پلکان درمــــان</Text>
              </Pressable>

              <View style={{ height: 10 }} />

              <Pressable
                style={[styles.btnGhost, { borderColor: palette.border, backgroundColor: "rgba(255,255,255,.04)" }]}
                onPress={fetchAll}
                disabled={loading || authLoading}
              >
                <Text style={[styles.btnText, { color: palette.sub }]}>
                  {loading || authLoading ? "..." : "تازه‌سازی نتایج"}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  rtl: { writingDirection: "rtl" as any, textAlign: "right" as any },

  header: {
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.95,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center" as any,
    writingDirection: "rtl" as any,
  },
  headerSub: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center" as any,
    writingDirection: "rtl" as any,
  },

  content: { flexGrow: 1, padding: 16, paddingTop: 12 },

  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    overflow: "hidden",
  },

  block: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },

  h2: { fontSize: 14, fontWeight: "900", textAlign: "center" as any, writingDirection: "rtl" as any },
  h3: { fontSize: 12, fontWeight: "900", textAlign: "right" as any, writingDirection: "rtl" as any },

  oneLook: { borderWidth: 1, borderRadius: 16, padding: 12, backgroundColor: "rgba(255,255,255,.02)" },

  nextStep: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    backgroundColor: "rgba(212,175,55,.06)",
  },

  returnBox: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    backgroundColor: "rgba(233,138,21,.06)",
  },

  sectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center" as any,
    writingDirection: "rtl" as any,
    marginBottom: 6,
    opacity: 0.95,
  },

  diagram: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },

  pill: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginLeft: 10,
  },

  barWrap: {
    marginTop: 10,
    height: 10,
    borderWidth: 1,
    borderRadius: 999,
    overflow: "hidden",
  },
  barFill: { height: "100%" },

  btn: { borderWidth: 1, borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  btnPrimary: { borderWidth: 1, borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  btnGhost: { borderWidth: 1, borderRadius: 14, paddingVertical: 12, alignItems: "center" },

  btnText: { fontSize: 14, fontWeight: "900", writingDirection: "rtl" as any },

  audioRow: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    overflow: "hidden",
  },

  audioInnerRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },

  audioPlayBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  audioBarCol: {
    flex: 1,
    marginLeft: 12,
    marginRight: 10,
    justifyContent: "center",
  },

  audioBarWrap: {
    height: 8,
    borderWidth: 1,
    borderRadius: 999,
    overflow: "hidden",
  },

  audioBarFill: {
    height: "100%",
  },
    audioLoadStatus: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center",
    writingDirection: "rtl",
  },
    audioTimeInline: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    writingDirection: "ltr",
  },
});
