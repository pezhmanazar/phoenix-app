// /hooks/useAudio.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Asset } from "expo-asset";
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioStatus,
  type AudioSource,
} from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";

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
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seekTo: (ms: number) => Promise<void>;
  seekBy: (deltaMs: number) => Promise<void>;
};

const keyFor = (id: string) => `Mashaal.progress.${id}`;

export function useAudio({ id, uri, enabled = true }: UseAudioArgs): UseAudioReturn {
  const playerRef = useRef<AudioPlayer | null>(null);
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
    return () => {
      cancelled = true;
    };
  }, [id]);

  const persist = useCallback(
    async (pos: number, dur: number) => {
      if (!dur) return;
      try {
        await AsyncStorage.setItem(
          keyFor(id),
          JSON.stringify({
            positionMillis: pos,
            durationMillis: dur,
            updatedAt: Date.now(),
          })
        );
      } catch {}
    },
    [id]
  );

  useEffect(() => {
    mountedRef.current = true;
    const myToken = ++loadTokenRef.current;

    const cleanupPlayer = () => {
      if (playerRef.current) {
        try {
          playerRef.current.pause();
        } catch {}
        try {
          playerRef.current.remove();
        } catch {}
        playerRef.current = null;
      }
    };

    const setup = async () => {
      if (!enabled) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        await setAudioModeAsync({
          shouldPlayInBackground: true,
          playsInSilentMode: true,
          interruptionMode: "duckOthers",
          shouldRouteThroughEarpiece: false,
        });
      } catch {}

      cleanupPlayer();
      endedRef.current = false;

      let source: AudioSource;
      if (typeof uri === "number") {
        try {
          const asset = await Asset.fromModule(uri).downloadAsync();
          const local = asset.localUri ?? asset.uri;
          source = { uri: local };
        } catch {
          setLoading(false);
          return;
        }
      } else {
        source = { uri };
      }

      if (loadTokenRef.current !== myToken) {
        setLoading(false);
        return;
      }

      try {
        const player = createAudioPlayer(source, {
          updateInterval: 500,
        });

        playerRef.current = player;
        player.loop = false;

        player.addListener("playbackStatusUpdate", (status: AudioStatus) => {
          if (loadTokenRef.current !== myToken) return;
          if (!mountedRef.current) return;

          const posMs = Math.floor((status.currentTime || 0) * 1000);
          const durMs = Math.floor((status.duration || 0) * 1000);

          setDuration(durMs);
          setPosition(posMs);
          setIsPlaying(!!status.playing);
          setLoading(!status.isLoaded);

          if (status.didJustFinish) {
            endedRef.current = true;
            setIsPlaying(false);
            setPosition(durMs);
          }

          if (posMs >= 0 && durMs > 0) {
            persist(posMs, durMs);
          }
        });

        try {
          player.setPlaybackRate(rate, "high");
        } catch {}

        if (initialPosRef.current && initialPosRef.current > 0) {
          try {
            await player.seekTo(initialPosRef.current / 1000);
          } catch {}
        }

        initialPosRef.current = null;

        if (loadTokenRef.current !== myToken) {
          try {
            player.pause();
          } catch {}
          try {
            player.remove();
          } catch {}
          return;
        }

        setLoading(false);
        setDuration(Math.floor((player.duration || 0) * 1000));
        setPosition(Math.floor((player.currentTime || 0) * 1000));
        setIsPlaying(!!player.playing);
      } catch {
        if (loadTokenRef.current !== myToken) return;
        setLoading(false);
        cleanupPlayer();
      }
    };

    setup();

    return () => {
      mountedRef.current = false;
      loadTokenRef.current++;
      cleanupPlayer();
    };
  }, [id, uri, enabled, persist]);

  useEffect(() => {
    if (playerRef.current) {
      try {
        playerRef.current.setPlaybackRate(rate, "high");
      } catch {}
    }
  }, [rate]);

  useEffect(() => {
    if (!enabled && playerRef.current) {
      try {
        playerRef.current.pause();
      } catch {}
      try {
        playerRef.current.remove();
      } catch {}
      playerRef.current = null;
      setIsPlaying(false);
      setLoading(false);
    }
  }, [enabled]);

  const applyRate = useCallback(async (r: number) => {
    setRate(r);
    if (playerRef.current) {
      try {
        playerRef.current.setPlaybackRate(r, "high");
      } catch {}
    }
  }, []);

  const cycleRate = useCallback(async () => {
    const next = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1;
    await applyRate(next);
  }, [rate, applyRate]);

  const togglePlay = useCallback(async () => {
    const player = playerRef.current;
    if (!player || !player.isLoaded) return;

    const posMs = Math.floor((player.currentTime || 0) * 1000);
    const durMs = Math.floor((player.duration || 0) * 1000);

    const atEnd =
      endedRef.current || (durMs > 0 && posMs >= durMs - 250);

    if (atEnd) {
      try {
        await player.seekTo(0);
      } catch {}
      endedRef.current = false;
      player.play();
      return;
    }

    if (player.playing) player.pause();
    else player.play();
  }, []);

  const restart = useCallback(async () => {
    const player = playerRef.current;
    if (!player || !player.isLoaded) return;

    try {
      await player.seekTo(0);
    } catch {}
    endedRef.current = false;
    player.play();
  }, []);

  const clearProgress = useCallback(async () => {
    await AsyncStorage.removeItem(keyFor(id));
    setPosition(0);
    setResumeFrom(null);
  }, [id]);

  const unload = useCallback(async () => {
    if (playerRef.current) {
      try {
        playerRef.current.pause();
      } catch {}
      try {
        playerRef.current.remove();
      } catch {}
      playerRef.current = null;
      setIsPlaying(false);
    }
  }, []);

  const stopAndUnload = useCallback(async () => {
    if (playerRef.current) {
      try {
        playerRef.current.pause();
      } catch {}
      try {
        await playerRef.current.seekTo(0);
      } catch {}
      try {
        playerRef.current.remove();
      } catch {}
      playerRef.current = null;
      setIsPlaying(false);
      endedRef.current = false;
    }
  }, []);

  const play = useCallback(async () => {
    const player = playerRef.current;
    if (!player || !player.isLoaded) return;

    const posMs = Math.floor((player.currentTime || 0) * 1000);
    const durMs = Math.floor((player.duration || 0) * 1000);

    if (durMs > 0 && posMs >= durMs - 250) {
      try {
        await player.seekTo(0);
      } catch {}
    }

    endedRef.current = false;
    player.play();
  }, []);

  const pause = useCallback(async () => {
    const player = playerRef.current;
    if (!player || !player.isLoaded) return;
    if (player.playing) player.pause();
  }, []);

  const seekTo = useCallback(async (ms: number) => {
    const player = playerRef.current;
    if (!player || !player.isLoaded) return;

    const dur = Math.floor((player.duration || 0) * 1000);
    const clamped = Math.max(0, Math.min(ms, dur));

    await player.seekTo(clamped / 1000);
    if (clamped < dur) endedRef.current = false;
  }, []);

  const seekBy = useCallback(async (deltaMs: number) => {
    const player = playerRef.current;
    if (!player || !player.isLoaded) return;

    const pos = Math.floor((player.currentTime || 0) * 1000);
    const dur = Math.floor((player.duration || 0) * 1000);
    const target = Math.max(0, Math.min(pos + deltaMs, dur));

    await player.seekTo(target / 1000);
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
