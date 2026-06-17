//phoenix-app\components\ScreenLayout.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioStatus,
} from "expo-audio";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";


function formatMs(ms: number) {
  const safe = Number.isFinite(ms) ? ms : 0;
  const s = Math.max(0, Math.floor(safe / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export type SharedAudioPalette = {
  border2: string;
  text: string;
  sub2: string;
  gold: string;
  glass2: string;
};

function SeekBar({
  progress,
  palette,
}: {
  progress: number;
  palette: Pick<SharedAudioPalette, "border2" | "gold">;
}) {
  return (
    <View>
      <View style={[styles.audioBarWrap, { borderColor: palette.border2 }]}>
        <View
          style={[
            styles.audioBarFill,
            {
              width: `${Math.round(progress * 100)}%`,
              backgroundColor: palette.gold,
            },
          ]}
        />
      </View>
    </View>
  );
}



type SharedInlineAudioPlayerProps = {
  url: string;
  storageKey: string;
  palette: SharedAudioPalette;
  expanded?: boolean;
  isActive?: boolean;
  onPlayRequest?: () => void;
  onPauseRequest?: () => void;
  onPlaybackFinish?: () => void;
  onProgress?: (percent: number) => void;
};

export default function SharedInlineAudioPlayer({
  url,
  storageKey,
  palette,
  expanded = false,
  isActive = false,
  onPlayRequest,
  onPauseRequest,
  onPlaybackFinish,
  onProgress,
}: SharedInlineAudioPlayerProps) {
  const playerRef = useRef<AudioPlayer | null>(null);
  const statusSubscriptionRef = useRef<{ remove: () => void } | null>(null);

    const sharedProgressKey = useMemo(() => {
    return `shared-audio-progress:${url}`;
  }, [url]);

  const isActiveRef = useRef(isActive);

  const opLockRef = useRef(false);
  const mountedRef = useRef(true);

  const resumeFromRef = useRef<number>(0);
  const lastSaveRef = useRef<number>(0);
  const finishedRef = useRef(false);

  const completedRef = useRef(false);
  const savedPositionRef = useRef(0);
  const savedDurationRef = useRef(0);
  const replayGuardRef = useRef(false);
  const restoredProgressUrlRef = useRef<string | null>(null);
  const isRestoringProgressRef = useRef(false);
  const REPLAY_THRESHOLD_MS = 30_000;

  const [playing, setPlaying] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  const [posMs, setPosMs] = useState(0);
  const [durMs, setDurMs] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [busyAction, setBusyAction] = useState<"seek" | "forward" | "backward" | "restart" | null>(null);

  const drawerAnim = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  const [drawerContentHeight, setDrawerContentHeight] = useState(0);

  const progress = useMemo(() => {
    const d = durMs > 0 ? durMs : 0;
    const p = d > 0 ? posMs / d : 0;
    return Math.max(0, Math.min(1, p));
  }, [posMs, durMs]);

    const startBusy = useCallback(
    (action: "seek" | "forward" | "backward" | "restart") => {
      if (mountedRef.current) {
        setBusyAction(action);
        setSeeking(action === "seek");
        setLoadingAudio(true);
      }
    },
    []
  );

  const stopBusy = useCallback(() => {
    if (mountedRef.current) {
      setBusyAction(null);
      setSeeking(false);
      setLoadingAudio(false);
    }
  }, []);

  const isBusy = loadingAudio || seeking || busyAction !== null;


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

    const safeDuration =
      Math.max(0, Number(durationMillis || 0)) || savedDurationRef.current;
    const safePosition = Math.max(0, Number(positionMillis || 0));

    if (safeDuration <= 0) return;

    const isFinished = safePosition >= safeDuration - 1500;

    let nextCompleted = completedRef.current;
    let nextPosition = safePosition;

    if (isFinished) {
      nextCompleted = true;
      nextPosition = safeDuration;
    } else if (completedRef.current) {
      if (safePosition < REPLAY_THRESHOLD_MS) {
        nextCompleted = true;
        nextPosition = safeDuration;
      } else {
        nextCompleted = false;
        nextPosition = safePosition;
      }
    } else {
      nextCompleted = false;
      nextPosition = safePosition;
    }

    completedRef.current = nextCompleted;
    savedPositionRef.current = nextPosition;
    savedDurationRef.current = safeDuration;
    resumeFromRef.current = nextPosition;

    const payload = JSON.stringify({
      positionMillis: nextPosition,
      durationMillis: safeDuration,
      completed: nextCompleted,
      updatedAt: now,
    });

    await Promise.all([
      AsyncStorage.setItem(storageKey, payload),
      AsyncStorage.setItem(sharedProgressKey, payload),
    ]).catch(() => {});
  },
  [storageKey, sharedProgressKey]
);



  const hydrateFromStorage = useCallback(async () => {
  try {
    const [sharedRaw, localRaw] = await Promise.all([
      AsyncStorage.getItem(sharedProgressKey),
      AsyncStorage.getItem(storageKey),
    ]);

    const raw = sharedRaw || localRaw;

    if (!raw) {
      completedRef.current = false;
      savedPositionRef.current = 0;
      resumeFromRef.current = 0;
      replayGuardRef.current = false;
      savedDurationRef.current = 0;

      if (mountedRef.current) {
        setPosMs(0);
        setDurMs(0);
      }

      return;
    }

    const parsed = JSON.parse(raw || "{}") || {};

    const storedPos = Math.max(0, Number(parsed.positionMillis || 0));
    const storedDur = Math.max(0, Number(parsed.durationMillis || 0));
    const storedCompleted = !!parsed.completed;

    completedRef.current = storedCompleted;
    savedPositionRef.current = storedPos;
    savedDurationRef.current = storedDur;
    replayGuardRef.current = false;

    const resumePosition =
      storedCompleted && storedDur > 0
        ? Math.min(storedPos || storedDur, storedDur)
        : storedPos;

    resumeFromRef.current = resumePosition;

    if (mountedRef.current) {
      setPosMs(resumePosition);
      setDurMs(storedDur);
    }
   } catch {
   completedRef.current = false;
   savedPositionRef.current = 0;
   savedDurationRef.current = 0;
   replayGuardRef.current = false;
   resumeFromRef.current = 0;

  if (mountedRef.current) {
    setPosMs(0);
    setDurMs(0);
  }
}

}, [storageKey, sharedProgressKey]);


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
          if (p.isLoaded && !isRestoringProgressRef.current) {
            const currentMs = Math.max(0, Math.floor((p.currentTime || 0) * 1000));
            const durationMs = Math.max(0, Math.floor((p.duration || 0) * 1000));
            await maybeSaveProgress(currentMs, durationMs, true);
          }
        } catch {}

        try {
          p.pause();
        } catch {}

        try {
          p.remove();
        } catch {}
      }
    } finally {
      finishedRef.current = false;
      restoredProgressUrlRef.current = null;
      isRestoringProgressRef.current = false;

      if (!mountedRef.current) return;
      setPlaying(false);
      setLoadingAudio(false);
    }
  }, [maybeSaveProgress]);

  const attachStatusListener = useCallback(
    (player: AudioPlayer) => {
      statusSubscriptionRef.current?.remove?.();
      statusSubscriptionRef.current = player.addListener("playbackStatusUpdate", (st: AudioStatus) => {
        if (!st?.isLoaded) return;
        if (!mountedRef.current) return;

        const p = Math.max(0, Math.floor((st.currentTime || 0) * 1000));
        const d = Math.max(0, Math.floor((st.duration || 0) * 1000));

        setPlaying(!!st.playing);
        setPosMs(p);
        setDurMs(d);

      if (d > 0) {
          onProgress?.(p / d);
        }

      if (isRestoringProgressRef.current) return;

        finishedRef.current = !!st.didJustFinish;

        void maybeSaveProgress(
          st.didJustFinish ? d : p,
          d,
          !!st.didJustFinish
        );

        if (st.didJustFinish) {
          setPlaying(false);
          setLoadingAudio(false);
          setPosMs(d);
          resumeFromRef.current = d;
          isActiveRef.current = false;
          onPlaybackFinish?.();
        }

      });
    },
    [maybeSaveProgress, onPlaybackFinish, onProgress]
  );


  const ensureLoaded = useCallback(
    async (keepLoading = false) => {
      if (playerRef.current) return playerRef.current;

      setLoadingAudio(true);

      await hydrateFromStorage();

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
      restoredProgressUrlRef.current = null;
      isRestoringProgressRef.current = true;

      if (mountedRef.current) {
        setPlaying(!!player.playing);
      }

      return player;
    },
    [url, hydrateFromStorage, attachStatusListener]
  );

  const waitUntilLoaded = useCallback(async () => {
    const p = playerRef.current;
    if (!p) return null;

    for (let i = 0; i < 60; i += 1) {
      if (p.isLoaded) {
        const durationMs = Math.max(0, Math.floor((p.duration || 0) * 1000));

        if (durationMs > 0) {
          savedDurationRef.current = durationMs;

          if (mountedRef.current) {
            setDurMs(durationMs);
          }
        }

        if (restoredProgressUrlRef.current !== url) {
          restoredProgressUrlRef.current = url;

          try {
            const rawTarget = Math.max(0, Math.floor(resumeFromRef.current || 0));
            const maxTarget = durationMs > 0 ? durationMs : rawTarget;
            const target = Math.max(0, Math.min(rawTarget, maxTarget));

            if (target > 0) {
              await p.seekTo(target / 1000).catch(() => {});
            }

            if (mountedRef.current) {
              setPosMs(target);
            }
          } finally {
            isRestoringProgressRef.current = false;
          }
        } else {
          isRestoringProgressRef.current = false;
        }

        return p;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    isRestoringProgressRef.current = false;

    return p.isLoaded ? p : null;
  }, [url]);


    const togglePlayPause = useCallback(() => {
    return lock(async () => {
      const existing = playerRef.current;

      if (existing?.playing) {
        try {
          if (existing.isLoaded && !isRestoringProgressRef.current) {
            const currentMs = Math.max(0, Math.floor((existing.currentTime || 0) * 1000));
            const durationMs = Math.max(0, Math.floor((existing.duration || 0) * 1000));
            if (durationMs > 0) {
              await maybeSaveProgress(currentMs, durationMs, true);
            }
          }
        } catch {}

        try {
          existing.pause();
        } catch {}

        isActiveRef.current = false;
        if (mountedRef.current) {
          setPlaying(false);
          setLoadingAudio(false);
          setLoadStatus("idle"); // برگشت به حالت عادی
        }
        onPauseRequest?.();
        return;
      }

      isActiveRef.current = true;
      onPlayRequest?.();

      if (mountedRef.current) {
        setLoadingAudio(true);
        setLoadStatus("loading"); // در حال آماده‌سازی
      }

      if (finishedRef.current && playerRef.current) {
        await unload();
        resumeFromRef.current = 0;
        finishedRef.current = false;
      }

      if (!playerRef.current) {
        await ensureLoaded(true);
      }

      const p = await waitUntilLoaded();
      
      if (!isActiveRef.current) {
         stopBusy();
         setLoadStatus("idle");
         return;
      }

      if (!p) {
        if (mountedRef.current) {
          setPlaying(false);
          setLoadingAudio(false);
          setLoadStatus("error"); // خطای دریافت
        }
        return;
      }

      const currentMs = Math.max(0, Math.floor((p.currentTime || 0) * 1000));
      const durationMs = Math.max(0, Math.floor((p.duration || 0) * 1000));

      if (durationMs > 0 && currentMs >= durationMs - 250) {
        replayGuardRef.current = completedRef.current;
        await p.seekTo(0).catch(() => {});
        if (mountedRef.current) {
          setPosMs(0);
          setDurMs(durationMs);
        }
      }

      finishedRef.current = false;

      try {
        p.play();
      } catch {
        if (mountedRef.current) {
          setPlaying(false);
          setLoadingAudio(false);
          setLoadStatus("error");
        }
        return;
      }

      // چک کردن اینکه آیا واقعاً پخش شروع شد یا نه
      let started = !!p.playing;
      for (let i = 0; i < 15 && !started; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        started = !!p.playing;
      }

      if (mountedRef.current) {
        setPlaying(started);
        setLoadingAudio(false);
        // نکته مهم: اینجا اگر پخش نشد، وضعیت را "ready" می‌کنیم
        setLoadStatus(started ? "idle" : "ready");
      }
    });
  }, [ensureLoaded, waitUntilLoaded, unload, maybeSaveProgress, onPlayRequest, onPauseRequest, stopBusy]);


    const seekBy = useCallback(
    (deltaMs: number) => {
      return lock(async () => {
        if (finishedRef.current && playerRef.current) {
          await unload();
          resumeFromRef.current = 0;
          finishedRef.current = false;
        }

        startBusy(deltaMs > 0 ? "forward" : "backward");

        try {
          if (!playerRef.current) {
            await ensureLoaded(true);
          }

          const p = await waitUntilLoaded();
          if (!p) {
            stopBusy();
            return;
          }

          const current = Math.max(0, Math.floor((p.currentTime || 0) * 1000));
          const duration = Math.max(
            0,
            Math.floor(((p.duration || 0) > 0 ? p.duration : durMs / 1000) * 1000)
          );

          const max = duration > 0 ? duration : Number.MAX_SAFE_INTEGER;
          const target = Math.max(0, Math.min(max, current + deltaMs));

          await p.seekTo(target / 1000).catch(() => {});

          if (duration > 0) {
            await maybeSaveProgress(target, duration, true);
          }

          if (mountedRef.current) {
            setPosMs(target);
          }

          stopBusy();
        } catch {
          stopBusy();
        }
      });
    },
    [ensureLoaded, waitUntilLoaded, durMs, maybeSaveProgress, unload, startBusy, stopBusy]
  );


    const restartAudio = useCallback(() => {
    return lock(async () => {
      if (finishedRef.current && playerRef.current) {
        await unload();
        resumeFromRef.current = 0;
        finishedRef.current = false;
      }

      startBusy("restart");

      try {
        if (!playerRef.current) {
          await ensureLoaded(true);
        }

        const p = await waitUntilLoaded();
        if (!p) {
          stopBusy();
          return;
        }

        const duration = Math.max(0, Math.floor((p.duration || durMs / 1000) * 1000));

        await p.seekTo(0).catch(() => {});
        await maybeSaveProgress(0, duration, true);

        if (mountedRef.current) {
          setPosMs(0);
          setPlaying(!!p.playing);
        }

        stopBusy();
      } catch {
        stopBusy();
      }
    });
  }, [ensureLoaded, waitUntilLoaded, durMs, maybeSaveProgress, unload, startBusy, stopBusy]);

    useEffect(() => {
    restoredProgressUrlRef.current = null;
    isRestoringProgressRef.current = false;
  }, [url]);

  useEffect(() => {
    isActiveRef.current = isActive;

    if (!isActive && playerRef.current) {
      void unload();
    }
  }, [isActive, unload]);

  useEffect(() => {
    Animated.timing(drawerAnim, {
      toValue: expanded ? 1 : 0,
      duration: expanded ? 180 : 140,
      easing: expanded ? Easing.out(Easing.cubic) : Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [expanded, drawerAnim]);

  useEffect(() => {
    mountedRef.current = true;
    hydrateFromStorage();

    return () => {
      mountedRef.current = false;
      void unload();
    };
  }, [hydrateFromStorage, unload]);

useFocusEffect(
  useCallback(() => {
    if (!playerRef.current && !playing && !loadingAudio) {
      void hydrateFromStorage();
    }
  }, [hydrateFromStorage, playing, loadingAudio])
);

  const animatedDrawerStyle = {
    height: drawerAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, drawerContentHeight || 1],
    }),
    opacity: drawerAnim,
    marginTop: drawerAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 12],
    }),
  };

  return (
    <View
      style={[
        styles.audioRow,
        {
          borderColor: palette.border2,
          backgroundColor: palette.glass2,
        },
      ]}
    >
      <Pressable
        style={({ pressed }) => [
          styles.audioInnerRow,
          { opacity: pressed ? 0.92 : 1 },
        ]}
      >
        <Text style={[styles.audioTimeInline, { color: palette.sub2 }]}>
          {formatMs(posMs)} / {formatMs(durMs)}
        </Text>

        <View style={styles.audioBarCol}>
          <SeekBar
  progress={progress}
  palette={{ border2: palette.border2, gold: palette.gold }}
/>

        </View>

        <Pressable
          style={({ pressed }) => [
            styles.audioPlayBtn,
            {
              opacity: pressed ? 0.85 : 1,
              borderColor: "rgba(255,255,255,.10)",
            },
          ]}
          onPress={() => {
            void togglePlayPause();
          }}
          hitSlop={10}
          disabled={isBusy && !playing}
        >
          {isBusy && !playing ? (
            <ActivityIndicator size="small" color={palette.text} />
          ) : (
            <Ionicons name={playing ? "pause" : "play"} size={18} color={palette.text} />
          )}
        </Pressable>
      </Pressable>

      <Animated.View style={[styles.audioDrawerAnimated, animatedDrawerStyle]}>
        <View
          style={[styles.audioDrawer, { borderTopColor: palette.border2 }]}
          onLayout={(e) => {
            const h = Math.ceil(e.nativeEvent.layout.height);
            if (h > 0 && h !== drawerContentHeight) {
              setDrawerContentHeight(h);
            }
          }}
          pointerEvents={expanded ? "auto" : "none"}
        >
          <Pressable
            onPress={() => void seekBy(10_000)}
            style={({ pressed }) => [
              styles.audioToolBtn,
              { opacity: pressed ? 0.82 : 1 },
            ]}
            disabled={isBusy}
          >
            {busyAction === "forward" ? (
              <ActivityIndicator size="small" color={palette.text} />
            ) : (
              <>
                <Ionicons name="play-forward" size={16} color={palette.text} />
                <Text style={[styles.audioToolText, { color: palette.text }]}>۱۰+</Text>
              </>
            )}
          </Pressable>

         <Pressable
            onPress={() => void restartAudio()}
            style={({ pressed }) => [
              styles.audioToolBtn,
              { opacity: pressed ? 0.82 : 1 },
            ]}
            disabled={isBusy}
          >
            {busyAction === "restart" ? (
              <ActivityIndicator size="small" color={palette.text} />
            ) : (
              <>
                <Ionicons name="refresh-circle-outline" size={18} color={palette.text} />
                <Text style={[styles.audioToolText, { color: palette.text }]}>از اول</Text>
              </>
            )}
          </Pressable>


          <Pressable
            onPress={() => void seekBy(-10_000)}
            style={({ pressed }) => [
              styles.audioToolBtn,
              { opacity: pressed ? 0.82 : 1 },
            ]}
            disabled={isBusy}
          >
            {busyAction === "backward" ? (
              <ActivityIndicator size="small" color={palette.text} />
            ) : (
              <>
                <Ionicons name="play-back" size={16} color={palette.text} />
                <Text style={[styles.audioToolText, { color: palette.text }]}>۱۰-</Text>
              </>
            )}
          </Pressable>
        </View>
      </Animated.View>
      {/* کد پیام راهنما این‌جا اضافه شود */}
      {loadStatus !== "idle" && (
        <View style={{ marginTop: 8, alignItems: 'center' }}>
          <Text style={{ color: palette.gold, fontSize: 12, fontWeight: 'bold' }}>
            {loadStatus === "loading" && "در حال آماده‌سازی فایل... صبور باش"}
            {loadStatus === "ready" && "فایل آماده شنیدنه؛ دوباره دکمه شروع رو بزن"}
            {loadStatus === "error" && "خطا در دریافت فایل؛ اینترنت رو چک کن و دوباره بزن"}
          </Text>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  audioRow: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    overflow: "hidden",
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

  audioDrawerAnimated: {
    overflow: "hidden",
  },

  audioDrawer: {
    paddingTop: 12,
    borderTopWidth: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },

  audioToolBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.09)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row-reverse",
    gap: 6,
    paddingHorizontal: 8,
  },

  audioToolText: {
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
  },
});
