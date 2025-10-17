// /hooks/useAudioTP.ts
import { useCallback, useEffect, useRef, useState } from "react";
import TrackPlayer, {
  Event,
  State as TPState,
} from "react-native-track-player";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Asset } from "expo-asset";

type UseAudioArgs = {
  id: string;
  uri: string | number;
  enabled?: boolean;
};

type UseAudioReturn = {
  position: number;          // ms
  duration: number;          // ms
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
  // کنترل‌های مستقیم
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seekTo: (ms: number) => Promise<void>;
  seekBy: (deltaMs: number) => Promise<void>;
};

const keyFor = (id: string) => `Mashaal.progress.${id}`;
const msToSec = (ms: number) => ms / 1000;
const secToMs = (sec: number) => Math.round(sec * 1000);

export function useAudioTP({ id, uri, enabled = true }: UseAudioArgs): UseAudioReturn {
  const [position, setPosition] = useState(0); // ms
  const [duration, setDuration] = useState(0); // ms
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(enabled);
  const [resumeFrom, setResumeFrom] = useState<number | null>(null);
  const [rate, setRate] = useState(1);

  const endedRef = useRef(false);
  const mountedRef = useRef(false);
  const pollingRef = useRef<NodeJS.Timer | null>(null);

  const readInitialProgress = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(keyFor(id));
      if (raw) {
        const { positionMillis, durationMillis } = JSON.parse(raw) || {};
        if (
          typeof positionMillis === "number" &&
          typeof durationMillis === "number" &&
          positionMillis > 0 &&
          durationMillis > 0 &&
          positionMillis < durationMillis - 1500
        ) {
          setResumeFrom(positionMillis);
          return positionMillis;
        }
      }
    } catch {}
    return 0;
  }, [id]);

  const persist = useCallback(
    async (posMs: number, durMs: number) => {
      if (!durMs) return;
      try {
        await AsyncStorage.setItem(
          keyFor(id),
          JSON.stringify({
            positionMillis: posMs,
            durationMillis: durMs,
            updatedAt: Date.now(),
          })
        );
      } catch {}
    },
    [id]
  );

  const resolveSourceUrl = useCallback(async (): Promise<string> => {
    if (typeof uri === "number") {
      const asset = await Asset.fromModule(uri).downloadAsync();
      return asset.localUri ?? asset.uri;
    }
    return uri;
  }, [uri]);

  // راه‌اندازی/لود ترک روی TrackPlayer
  useEffect(() => {
    mountedRef.current = true;

    const setup = async () => {
      try {
        if (!enabled) {
          setLoading(false);
          return;
        }
        setLoading(true);

        // اگه قبلاً چیزی پلی بوده، ریست
        await TrackPlayer.reset();

        const initialMs = await readInitialProgress();
        const url = await resolveSourceUrl();

        // اضافه کردن ترک—بدون autoplay
        await TrackPlayer.add({
          id,
          url,
          title: " ",
          artist: " ",
          artwork: undefined,
        });

        // Seek به آخرین جای ذخیره‌شده (اگه بود)
        if (initialMs > 0) {
          await TrackPlayer.seekTo(msToSec(initialMs));
        }

        // نرخ پخش اولیه
        try {
          // @ts-ignore: setRate در v3 وجود دارد
          await TrackPlayer.setRate(rate);
        } catch {}

        setLoading(false);
        endedRef.current = false;

        // استیت اولیه
        const { position, duration } = await TrackPlayer.getProgress();
        setPosition(secToMs(position));
        setDuration(secToMs(duration));

        // شروع پولینگ پروگرس (هر 500ms)
        if (pollingRef.current) clearInterval(pollingRef.current as any);
        pollingRef.current = setInterval(async () => {
          if (!mountedRef.current) return;
          try {
            const { position, duration } = await TrackPlayer.getProgress();
            const posMs = secToMs(position);
            const durMs = secToMs(duration);
            setPosition(posMs);
            setDuration(durMs);
            persist(posMs, durMs);

            // تشخیص پایان
            if (durMs > 0 && posMs >= durMs - 250) {
              endedRef.current = true;
              setIsPlaying(false);
            }
          } catch {}
        }, 500);

        // گوش دادن به تغییر وضعیت پلیر
        const sub1 = TrackPlayer.addEventListener(Event.PlaybackState, async ({ state }) => {
          if (!mountedRef.current) return;
          setIsPlaying(state === TPState.Playing);
          if (state === TPState.Ended) {
            endedRef.current = true;
          }
        });

        const sub2 = TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async () => {
          endedRef.current = true;
          const { duration } = await TrackPlayer.getProgress().catch(() => ({ duration: 0 }));
          if (duration) {
            await TrackPlayer.seekTo(duration);
          }
          setIsPlaying(false);
        });

        return () => {
          sub1.remove();
          sub2.remove();
        };
      } catch (e) {
        setLoading(false);
      }
    };

    setup();

    return () => {
      mountedRef.current = false;
      if (pollingRef.current) {
        clearInterval(pollingRef.current as any);
        pollingRef.current = null;
      }
    };
  }, [id, enabled, readInitialProgress, resolveSourceUrl, persist, rate]);

  // کنترل سرعت
  const applyRate = useCallback(async (r: number) => {
    setRate(r);
    try {
      // @ts-ignore
      await TrackPlayer.setRate(r);
    } catch {}
  }, []);

  const cycleRate = useCallback(async () => {
    const next = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1;
    await applyRate(next);
  }, [rate, applyRate]);

  // کنترل‌ها
  const play = useCallback(async () => {
    try {
      const { position, duration } = await TrackPlayer.getProgress();
      if (duration > 0 && position >= duration - 0.25) {
        await TrackPlayer.seekTo(0);
        endedRef.current = false;
      }
      await TrackPlayer.play();
    } catch {}
  }, []);

  const pause = useCallback(async () => {
    try {
      await TrackPlayer.pause();
    } catch {}
  }, []);

  const togglePlay = useCallback(async () => {
    try {
      const state = await TrackPlayer.getState();
      if (state === TPState.Playing) {
        await pause();
      } else {
        await play();
      }
    } catch {}
  }, [pause, play]);

  const restart = useCallback(async () => {
    try {
      await TrackPlayer.seekTo(0);
      endedRef.current = false;
      await TrackPlayer.play();
    } catch {}
  }, []);

  const seekTo = useCallback(async (ms: number) => {
    try {
      await TrackPlayer.seekTo(msToSec(Math.max(0, ms)));
      endedRef.current = false;
    } catch {}
  }, []);

  const seekBy = useCallback(async (deltaMs: number) => {
    try {
      const { position, duration } = await TrackPlayer.getProgress();
      const target = Math.max(0, Math.min(position + msToSec(deltaMs), duration));
      await TrackPlayer.seekTo(target);
      endedRef.current = false;
    } catch {}
  }, []);

  const clearProgress = useCallback(async () => {
    try { await AsyncStorage.removeItem(keyFor(id)); } catch {}
    setPosition(0);
    setResumeFrom(null);
  }, [id]);

  // در TrackPlayer «unload/destroy» معمولاً لازم نیست هر بار؛ ولی برای سازگاری با API قبلی:
  const unload = useCallback(async () => {
    try {
      await TrackPlayer.reset(); // صف خالی، نوتیف می‌مونه
      setIsPlaying(false);
    } catch {}
  }, []);

  const stopAndUnload = useCallback(async () => {
    try {
      await TrackPlayer.stop();   // توقف پخش و حذف نوتیف
      await TrackPlayer.reset();  // خالی
      setIsPlaying(false);
      endedRef.current = false;
    } catch {}
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