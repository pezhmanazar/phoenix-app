// app/(tabs)/Mashaal.tsx
import React, { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { useTheme } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Video, ResizeMode, AVPlaybackStatusSuccess } from "expo-av";
import Slider from "@react-native-community/slider";
import { LinearGradient } from "expo-linear-gradient";
import Screen from "@/components/Screen";
import { useAudio } from "../../hooks/useAudio";
import { Asset } from "expo-asset"; // ⬅️ برای گرفتن مسیر لوکال
// ⬅️ نوتیف/لاکسکرین helper ها
import { initNotifications, setNotifTrack, syncPlay, syncSeek, stopNotif } from "../../lib/notifSession";

const keyFor = (id: string) => `Mashaal.progress.${id}`;

type Lesson = {
  id: string;
  title: string;
  kind: "video" | "audio";
  uri: string | number;
  artwork?: number | string | null;
};

const LESSONS: Lesson[] = [
  { id: "l1", title: "کارکردهای مغز در شکست عشقی", kind: "video", uri: require("../../assets/video/video2.mp4") },
  {
    id: "l2",
    title: "انواع وابستگی در شکست عشقی",
    kind: "audio",
    uri: require("../../assets/audio/voice.mp3"),
    artwork: require("../../assets/images/cover.jpg"),
  },
  { id: "l3", title: "خطاهای شناختی در شکست عشقی", kind: "video", uri: require("../../assets/video/video.mp4") },
  {
    id: "l4",
    title: "خیانت",
    kind: "audio",
    uri: require("../../assets/audio/voice.mp3"),
    artwork: require("../../assets/images/cover.jpg"),
  },
  { id: "l5", title: "جواب به چراهای شکست عشقی", kind: "video", uri: require("../../assets/video/video2.mp4") },
  {
    id: "l6",
    title: "نقش طرحواره‌ها در شکست عشقی",
    kind: "audio",
    uri: require("../../assets/audio/voice.mp3"),
    artwork: "https://example.com/covers/cover.jpg",
  },
];

const toHMM = (ms: number) => {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${m}:${pad(s)}`;
};

function LessonCard({
  item, onOpen, progressMs, durationMs, onResetProgress,
}: {
  item: Lesson; onOpen: (l: Lesson) => void; progressMs?: number; durationMs?: number; onResetProgress: (id: string) => void;
}) {
  const { colors } = useTheme();
  const pct = progressMs && durationMs && durationMs > 0
    ? Math.min(100, Math.round((progressMs / durationMs) * 100))
    : 0;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onOpen(item)}
      style={{
        borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
        borderRadius: 16, padding: 12, gap: 10, marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{
          width: 42, height: 42, borderRadius: 10, alignItems: "center",
          justifyContent: "center", backgroundColor: colors.background,
          borderWidth: 1, borderColor: colors.border,
        }}>
          <Ionicons name={item.kind === "video" ? "videocam" : "musical-notes"} size={22} color={colors.text} />
        </View>
        <Text style={{ color: colors.text, fontWeight: "900", flex: 1, textAlign: "right" }}>{item.title}</Text>
      </View>

      {pct > 0 ? (
        <View style={{ gap: 6 }}>
          <View style={{
            height: 8, backgroundColor: colors.background, borderRadius: 999,
            overflow: "hidden", borderWidth: 1, borderColor: colors.border,
          }}>
            <View style={{ width: `${pct}%`, height: "100%", backgroundColor: colors.primary, borderRadius: 999 }} />
          </View>
          <View style={{ flexDirection: "row-reverse", justifyContent: "space-between" }}>
            <Text style={{ color: "#8E8E93", fontSize: 11 }}>پیشرفت: {pct}%</Text>
            <Text style={{ color: "#8E8E93", fontSize: 11 }}>
              {toHMM(progressMs || 0)} / {toHMM(durationMs || 0)}
            </Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
            <TouchableOpacity
              onPress={() => onResetProgress(item.id)}
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}
            >
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: "800" }}>پاک‌کردن پیشرفت</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <Text style={{ color: "#8E8E93", fontSize: 12, textAlign: "right" }}>برای شروع تپ کن</Text>
      )}
    </TouchableOpacity>
  );
}

function Player({
  lesson, onClose, onProgress,
}: {
  lesson: Lesson; onClose: () => void; onProgress: (id: string, p: number, d: number) => void;
}) {
  const { colors } = useTheme();

  // ویدیو
  const [vDuration, setVDuration] = useState<number>(0);
  const [vPosition, setVPosition] = useState<number>(0);
  const [shouldResumeFrom, setShouldResumeFrom] = useState<number | null>(null);
  const videoRef = useRef<Video>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(keyFor(lesson.id));
        if (!cancel && raw) {
          const { positionMillis, durationMillis } = JSON.parse(raw) || {};
          if (
            typeof positionMillis === "number" &&
            typeof durationMillis === "number" &&
            positionMillis > 0 && durationMillis > 0 &&
            positionMillis < durationMillis - 1500
          ) setShouldResumeFrom(positionMillis);
        }
      } catch {}
    })();
    return () => { cancel = true; };
  }, [lesson.id]);

  const onVideoStatusUpdate = (s: AVPlaybackStatusSuccess) => {
    if (!s.isLoaded) return;
    const d = s.durationMillis || 0;
    const p = s.positionMillis || 0;
    setVDuration(d);
    setVPosition(p);
    if (s.positionMillis != null && s.durationMillis != null) {
      AsyncStorage.setItem(keyFor(lesson.id),
        JSON.stringify({ positionMillis: p, durationMillis: d, updatedAt: Date.now() })
      ).catch(() => {});
      onProgress(lesson.id, p, d);
    }
  };

  const onVideoReady = async () => {
    if (shouldResumeFrom && videoRef.current) {
      try { await videoRef.current.setPositionAsync(shouldResumeFrom); setShouldResumeFrom(null); } catch {}
    }
  };

  // صوت
  const audio = useAudio({ id: lesson.id, uri: lesson.uri, enabled: lesson.kind === "audio" });

  // ⚙️ نوتیف/لاک‌اسکرین: init + ست‌کردن ترک (بی‌صدا) + سنک پخش/سیک
  useEffect(() => {
    if (lesson.kind !== "audio") return;

    let isMounted = true;

    (async () => {
      await initNotifications();

      // url لوکالِ فایل ویس
      let audioUrl: string;
      if (typeof lesson.uri === "number") {
        const asset = Asset.fromModule(lesson.uri);
        await asset.downloadAsync();
        audioUrl = asset.localUri ?? asset.uri;
      } else {
        audioUrl = lesson.uri;
      }

      // artwork لوکال/ریموت
      let artworkUrl: string | undefined = undefined;
      if (typeof lesson.artwork === "number") {
        const a = Asset.fromModule(lesson.artwork);
        await a.downloadAsync();
        artworkUrl = a.localUri ?? a.uri;
      } else if (typeof lesson.artwork === "string") {
        artworkUrl = lesson.artwork;
      }

      // مدت‌زمان اگر داشتی بده (نداشتی TrackPlayer هندل می‌کند)
      const durSec = audio.duration ? Math.max(1, Math.floor(audio.duration / 1000)) : undefined;

      if (!isMounted) return;
      await setNotifTrack({
        id: lesson.id,
        url: audioUrl,
        title: lesson.title,
        artwork: artworkUrl,
        duration: durSec,
      });

      // سنکِ وضعیت پخش اولیه
      await syncPlay(audio.isPlaying);
    })();

    return () => {
      isMounted = false;
      // اختیاری: نوتیف رو ببند
      stopNotif().catch(() => {});
    };
    // فقط روی mount/unmount و id/uri/artwork واکنش بده
  }, [lesson.kind, lesson.id, lesson.uri, lesson.artwork]);

  // هر بار پخش/توقف تغییر کرد → نوتیف سنک
  useEffect(() => {
    if (lesson.kind !== "audio") return;
    syncPlay(audio.isPlaying).catch(() => {});
  }, [lesson.kind, audio.isPlaying]);

  // وقتی Seek می‌کنی → نوتیف سنک (واحد ورودی ثانیه است)
  useEffect(() => {
    // این افکت چیزی رو تغییر نمی‌ده؛ فقط نمونه‌ی استفاده از syncSeek در کنترل‌های خودته
  }, []);

  // Throttle عادی هر 2 ثانیه، اما اگر به انتها رسیدیم فوراً ۱۰۰٪ ثبت کن
  const lastProgressRef = useRef(0);
  const atAudioEnd = lesson.kind === "audio" &&
    (audio.duration ?? 0) > 0 &&
    (audio.position ?? 0) >= (audio.duration - 250);

  useEffect(() => {
    if (lesson.kind !== "audio") return;

    if (atAudioEnd) {
      onProgress(lesson.id, audio.duration, audio.duration);
      lastProgressRef.current = Date.now();
      return;
    }

    const now = Date.now();
    if (audio.duration && now - lastProgressRef.current > 2000) {
      lastProgressRef.current = now;
      onProgress(lesson.id, audio.position, audio.duration);
    }
  }, [audio.position, audio.duration, lesson.kind, lesson.id, atAudioEnd]);

  const progPosition = lesson.kind === "video" ? vPosition : audio.position ?? 0;
  const progDuration = lesson.kind === "video" ? vDuration : audio.duration ?? 0;

  // اسلایدر تعاملی صوت
  const [dragging, setDragging] = useState(false);
  const [dragPos, setDragPos] = useState(0);
  const wasPlayingRef = useRef(false);
  const sliderValue = dragging ? dragPos : progPosition;
  const sliderMax = Math.max(1, progDuration);

  const onSlideStart = () => {
    if (lesson.kind !== "audio") return;
    setDragging(true);
    wasPlayingRef.current = audio.isPlaying;
    if (audio.isPlaying) audio.pause();
  };
  const onSlideComplete = async (value: number) => {
    if (lesson.kind !== "audio") return;
    setDragging(false);
    const ms = Math.min(Math.max(0, Math.floor(value)), sliderMax);
    await audio.seekTo(ms);
    // ⬅️ سنک نوتیف (ثانیه)
    syncSeek(ms / 1000).catch(() => {});
    if (wasPlayingRef.current) await audio.play();
  };

  // سورس کاور
  const coverSource =
    typeof lesson.artwork === "number"
      ? lesson.artwork
      : lesson.artwork
      ? { uri: lesson.artwork }
      : null;

  const header = (
    <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}>
      <TouchableOpacity
        onPress={() => { if (lesson.kind === "audio") { audio.stopAndUnload(); stopNotif().catch(() => {}); } onClose(); }}
        style={{ padding: 6 }}
      >
        <Ionicons name="chevron-back" size={22} color={colors.text} style={{ transform: [{ scaleX: -1 }] }} />
      </TouchableOpacity>
      <Text style={{ color: colors.text, fontWeight: "900", flex: 1, textAlign: "right" }}>{lesson.title}</Text>
      <View style={{ width: 28 }} />
    </View>
  );

  return (
    <View style={{ flex: 1, gap: 12 }}>
      {header}

      {lesson.kind === "video" ? (
        <View style={{ borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: colors.border, backgroundColor: "#000", height: 260 }}>
          <Video
            ref={videoRef}
            source={typeof lesson.uri === "string" ? { uri: lesson.uri } : lesson.uri}
            style={{ width: "100%", height: "100%" }}
            resizeMode={ResizeMode.CONTAIN}
            useNativeControls
            shouldPlay
            onLoad={onVideoReady}
            onPlaybackStatusUpdate={(st) => {
              const s = st as AVPlaybackStatusSuccess;
              if (s.isLoaded) onVideoStatusUpdate(s);
            }}
          />
        </View>
      ) : (
        <View
          style={{
            flex: 1,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            padding: 16,
            gap: 16,
            justifyContent: "space-between",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* بک‌گراند از کاور + گرادیانت + هاله تیره */}
          {!!coverSource && (
            <>
              <Image source={coverSource} blurRadius={40} resizeMode="cover" style={StyleSheet.absoluteFillObject} />
              <LinearGradient
                colors={["rgba(0,0,0,0.55)", "rgba(0,0,0,0.28)", "rgba(0,0,0,0.08)"]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.25)" }]} />
            </>
          )}

          {/* Cover */}
          <View style={{ alignItems: "center", marginTop: 8 }}>
            <View
              style={{
                width: 260,
                height: 260,
                borderRadius: 28,
                backgroundColor: "#111",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: colors.border,
                overflow: "hidden",
              }}
            >
              {coverSource ? (
                <Image source={coverSource} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
              ) : (
                <Ionicons name="musical-notes" size={70} color={colors.text} />
              )}
            </View>
          </View>

          {/* Row 1: -10 / Play / +10 */}
          <View style={{ alignItems: "center", marginTop: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", columnGap: 22 }}>
              <TouchableOpacity
                disabled={audio.loading}
                onPress={async () => {
                  await audio.seekBy(-10000);
                  syncSeek((Math.max(0, (audio.position - 10000))) / 1000).catch(() => {});
                }}
                style={{ opacity: audio.loading ? 0.5 : 1, padding: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.border }}
              >
                <Ionicons name="play-back" size={28} color={colors.text} />
              </TouchableOpacity>

              <TouchableOpacity
                disabled={audio.loading}
                onPress={audio.togglePlay}
                style={{ opacity: audio.loading ? 0.5 : 1, paddingVertical: 16, paddingHorizontal: 24, borderRadius: 999, backgroundColor: colors.primary }}
              >
                <Ionicons name={audio.isPlaying ? "pause" : "play"} size={32} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity
                disabled={audio.loading}
                onPress={async () => {
                  await audio.seekBy(10000);
                  syncSeek((audio.position + 10000) / 1000).catch(() => {});
                }}
                style={{ opacity: audio.loading ? 0.5 : 1, padding: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.border }}
              >
                <Ionicons name="play-forward" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Row 2: restart (left) — rate (right) */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 8, marginTop: 6 }}>
            <TouchableOpacity
              disabled={audio.loading}
              onPress={async () => {
                await audio.restart();
                syncSeek(0).catch(() => {});
              }}
              style={{ opacity: audio.loading ? 0.5 : 1, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.border }}
            >
              <Ionicons name="play-skip-back" size={22} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              disabled={audio.loading}
              onPress={audio.cycleRate}
              style={{ opacity: audio.loading ? 0.5 : 1, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.border }}
            >
              <Text style={{ color: colors.text, fontWeight: "900" }}>{`${audio.rate}×`}</Text>
            </TouchableOpacity>
          </View>

          {/* Slider + timers */}
          <View style={{ width: "100%", paddingHorizontal: 4, marginTop: 4 }}>
            <Slider
              value={sliderValue}
              minimumValue={0}
              maximumValue={sliderMax}
              step={250}
              onSlidingStart={onSlideStart}
              onValueChange={(v: number) => setDragPos(v)}
              onSlidingComplete={onSlideComplete}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.primary}
            />
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
              <Text style={{ color: "#E5E7EB", fontSize: 12 }}>{toHMM(sliderValue)}</Text>
              <Text style={{ color: "#E5E7EB", fontSize: 12 }}>{toHMM(sliderMax)}</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

export default function Mashaal() {
  const { colors } = useTheme();
  const [selected, setSelected] = useState<Lesson | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, { p: number; d: number }>>({});

  useEffect(() => {
    let cancel = false;
    (async () => {
      const next: Record<string, { p: number; d: number }> = {};
      for (const l of LESSONS) {
        try {
          const raw = await AsyncStorage.getItem(keyFor(l.id));
          if (raw) {
            const { positionMillis, durationMillis } = JSON.parse(raw) || {};
            if (typeof positionMillis === "number" && typeof durationMillis === "number") {
              next[l.id] = { p: positionMillis, d: durationMillis };
            }
          }
        } catch {}
      }
      if (!cancel) setProgressMap(next);
    })();
    return () => { cancel = true; };
  }, []);

  const open = (l: Lesson) => setSelected(l);
  const close = () => setSelected(null);

  const resetProgress = async (id: string) => {
    await AsyncStorage.removeItem(keyFor(id));
    setProgressMap((m) => {
      const { [id]: _, ...rest } = m;
      return rest;
    });
  };

  const handleProgress = (id: string, p: number, d: number) => {
    setProgressMap((m) => ({ ...m, [id]: { p, d } }));
  };

  return (
    <Screen contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }}>
      {!selected ? (
        <View style={{ gap: 10, flexGrow: 1 }}>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: "900", textAlign: "right" }}>مشعل 🔥</Text>
          <Text style={{ color: "#8E8E93", fontSize: 12, textAlign: "right" }}>
            محتوای آموزشی (ویدیو/ویس). هر جا موندی، دفعهٔ بعد از همان‌جا ادامه می‌دهیم.
          </Text>

          <View style={{ paddingTop: 4, paddingBottom: 16 }}>
            {LESSONS.map((item) => (
              <LessonCard
                key={item.id}
                item={item}
                onOpen={open}
                progressMs={progressMap[item.id]?.p}
                durationMs={progressMap[item.id]?.d}
                onResetProgress={resetProgress}
              />
            ))}
          </View>
        </View>
      ) : (
        <Player lesson={selected} onClose={close} onProgress={handleProgress} />
      )}
    </Screen>
  );
}