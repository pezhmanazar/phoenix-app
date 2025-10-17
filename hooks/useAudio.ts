// /hooks/useAudio.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { Audio, AVPlaybackStatusSuccess } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Asset } from "expo-asset";

type UseAudioArgs = { id: string; uri: string | number; enabled?: boolean };
type UseAudioReturn = {
  position: number;
  duration: number;
  isPlaying: boolean;
  loading: boolean;
  resumeFrom?: number | null;
  rate: number;
  cycleRate: () => Promise<void>;
  togglePlay: () => Promise<void>;
  restart: () => Promise<void>;
  clearProgress: () => Promise<void>;
  unload: () => Promise<void>;
  stopAndUnload: () => Promise<void>;
  // کنترل مستقیم
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seekTo: (ms: number) => Promise<void>;
  seekBy: (deltaMs: number) => Promise<void>;
};

const keyFor = (id: string) => `Mashaal.progress.${id}`;

export function useAudio({ id, uri, enabled = true }: UseAudioArgs): UseAudioReturn {
  const soundRef = useRef<Audio.Sound | null>(null);
  const loadTokenRef = useRef(0);
  const initialPosRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const endedRef = useRef(false);

  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(enabled);
  const [resumeFrom, setResumeFrom] = useState<number | null>(null);
  const [rate, setRate] = useState(1);

  // read last progress (once per id)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(keyFor(id));
        if (!cancelled && raw) {
          const { positionMillis, durationMillis } = JSON.parse(raw) || {};
          if (
            typeof positionMillis === "number" &&
            typeof durationMillis === "number" &&
            positionMillis > 0 &&
            durationMillis > 0 &&
            positionMillis < durationMillis - 1500
          ) {
            initialPosRef.current = positionMillis;
            setResumeFrom(positionMillis);
          }
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [id]);

  const persist = useCallback(async (pos: number, dur: number) => {
    if (!dur) return;
    try {
      await AsyncStorage.setItem(
        keyFor(id),
        JSON.stringify({ positionMillis: pos, durationMillis: dur, updatedAt: Date.now() })
      );
    } catch {}
  }, [id]);

  // setup / load
  useEffect(() => {
    mountedRef.current = true;
    const myToken = ++loadTokenRef.current;

    const setup = async () => {
      if (!enabled) { setLoading(false); return; }
      setLoading(true);

      try {
        await Audio.setAudioModeAsync({
          staysActiveInBackground: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (e) {
        console.log("[useAudio] setAudioModeAsync error:", e);
      }

      if (soundRef.current) {
        try { await soundRef.current.unloadAsync(); } catch {}
        soundRef.current = null;
      }

      const sound = new Audio.Sound();
      soundRef.current = sound;
      endedRef.current = false;

      sound.setOnPlaybackStatusUpdate((st) => {
        if (loadTokenRef.current !== myToken) return;
        const s = st as AVPlaybackStatusSuccess;
        if (!s || !s.isLoaded || !mountedRef.current) return;

        setDuration(s.durationMillis || 0);
        setPosition(s.positionMillis || 0);
        setIsPlaying(!!s.isPlaying);
        setLoading(false);

        if (s.didJustFinish) {
          endedRef.current = true;
          setIsPlaying(false);
          setPosition(s.durationMillis || 0);
        }
        if (s.positionMillis != null && s.durationMillis != null) {
          persist(s.positionMillis, s.durationMillis);
        }
      });

      // source (local/remote)
      let source: { uri: string } | number;
      if (typeof uri === "number") {
        try {
          const asset = await Asset.fromModule(uri).downloadAsync();
          const local = asset.localUri ?? asset.uri;
          source = { uri: local };
          console.log("[useAudio] local asset:", local);
        } catch (e) {
          console.log("[useAudio] asset download error:", e);
          setLoading(false);
          return;
        }
      } else {
        source = { uri };
      }

      try {
        console.log("[useAudio] loadAsync start");
        await sound.loadAsync(source as any, {
          shouldPlay: false, // ⬅️ خودکار پخش نکن
          positionMillis: initialPosRef.current || 0,
          progressUpdateIntervalMillis: 500,
        });
        if (loadTokenRef.current !== myToken) {
          try { await sound.unloadAsync(); } catch {}
          return;
        }
        console.log("[useAudio] loadAsync done");
        initialPosRef.current = null;
        setLoading(false);
        try { await sound.setRateAsync(rate, true); } catch {}
      } catch (e) {
        if (loadTokenRef.current !== myToken) return;
        console.log("[useAudio] loadAsync error:", e);
        setLoading(false);
        try { await sound.unloadAsync(); } catch {}
        soundRef.current = null;
      }
    };

    setup();

    return () => {
      mountedRef.current = false;
      loadTokenRef.current++;
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, [id, uri, enabled, persist]); // عمداً rate اینجا نیست

  // apply rate without reloading
  useEffect(() => {
    if (soundRef.current) {
      soundRef.current.setRateAsync(rate, true).catch(() => {});
    }
  }, [rate]);

  // disable handling
  useEffect(() => {
    if (!enabled && soundRef.current) {
      soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
      setIsPlaying(false);
      setLoading(false);
    }
  }, [enabled]);

  const applyRate = useCallback(async (r: number) => {
    setRate(r);
    if (soundRef.current) {
      try { await soundRef.current.setRateAsync(r, true); } catch {}
    }
  }, []);
  const cycleRate = useCallback(async () => {
    const next = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1;
    await applyRate(next);
  }, [rate, applyRate]);

  const togglePlay = useCallback(async () => {
    if (!soundRef.current) return;
    const st = await soundRef.current.getStatusAsync().catch(() => null);
    const s = st as AVPlaybackStatusSuccess | null;
    if (!s || !s.isLoaded) return;

    const atEnd =
      endedRef.current ||
      ((s.durationMillis ?? 0) > 0 && (s.positionMillis ?? 0) >= (s.durationMillis! - 250));

    if (atEnd) {
      try { await soundRef.current.setPositionAsync(0); } catch {}
      endedRef.current = false;
      await soundRef.current.playAsync();
      return;
    }
    if (s.isPlaying) await soundRef.current.pauseAsync();
    else await soundRef.current.playAsync();
  }, []);

  const restart = useCallback(async () => {
    if (!soundRef.current) return;
    const st = await soundRef.current.getStatusAsync().catch(() => null);
    const s = st as AVPlaybackStatusSuccess | null;
    if (!s || !s.isLoaded) return;
    await soundRef.current.setPositionAsync(0);
    endedRef.current = false;
    await soundRef.current.playAsync();
  }, []);

  const clearProgress = useCallback(async () => {
    await AsyncStorage.removeItem(keyFor(id));
    setPosition(0);
    setResumeFrom(null);
  }, [id]);

  const unload = useCallback(async () => {
    if (soundRef.current) {
      try { await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
      setIsPlaying(false);
    }
  }, []);

  const stopAndUnload = useCallback(async () => {
    if (soundRef.current) {
      try {
        const st = await soundRef.current.getStatusAsync().catch(() => null);
        const s = st as AVPlaybackStatusSuccess | null;
        if (s && s.isLoaded && s.isPlaying) {
          await soundRef.current.stopAsync();
        }
      } catch {}
      try { await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
      setIsPlaying(false);
      endedRef.current = false;
    }
  }, []);

  // Direct controls
  const play = useCallback(async () => {
    if (!soundRef.current) return;
    const st = await soundRef.current.getStatusAsync().catch(() => null);
    const s = st as AVPlaybackStatusSuccess | null;
    if (!s || !s.isLoaded) return;
    if ((s.durationMillis ?? 0) > 0 && (s.positionMillis ?? 0) >= (s.durationMillis! - 250)) {
      try { await soundRef.current.setPositionAsync(0); } catch {}
    }
    endedRef.current = false;
    await soundRef.current.playAsync();
  }, []);

  const pause = useCallback(async () => {
    if (!soundRef.current) return;
    const st = await soundRef.current.getStatusAsync().catch(() => null);
    const s = st as AVPlaybackStatusSuccess | null;
    if (!s || !s.isLoaded) return;
    if (s.isPlaying) await soundRef.current.pauseAsync();
  }, []);

  const seekTo = useCallback(async (ms: number) => {
    if (!soundRef.current) return;
    const st = await soundRef.current.getStatusAsync().catch(() => null);
    const s = st as AVPlaybackStatusSuccess | null;
    if (!s || !s.isLoaded) return;
    const dur = s.durationMillis ?? 0;
    const clamped = Math.max(0, Math.min(ms, dur));
    await soundRef.current.setPositionAsync(clamped);
    if (clamped < dur) endedRef.current = false;
  }, []);

  const seekBy = useCallback(async (deltaMs: number) => {
    if (!soundRef.current) return;
    const st = await soundRef.current.getStatusAsync().catch(() => null);
    const s = st as AVPlaybackStatusSuccess | null;
    if (!s || !s.isLoaded) return;
    const pos = s.positionMillis ?? 0;
    const dur = s.durationMillis ?? 0;
    const target = Math.max(0, Math.min(pos + deltaMs, dur));
    await soundRef.current.setPositionAsync(target);
    if (target < dur) endedRef.current = false;
  }, []);

  return {
    position,
    duration,
    isPlaying,
    loading,
    resumeFrom,
    rate,
    cycleRate,
    togglePlay,
    restart,
    clearProgress,
    unload,
    stopAndUnload,
    play,
    pause,
    seekTo,
    seekBy,
  };
}