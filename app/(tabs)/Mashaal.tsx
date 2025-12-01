// app/(tabs)/Mashaal.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useTheme, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Video, ResizeMode, AVPlaybackStatusSuccess } from "expo-av";
import Slider from "@react-native-community/slider";
import { LinearGradient } from "expo-linear-gradient";
import Screen from "@/components/Screen";
import { useAudio } from "../../hooks/useAudio";
import { useUser } from "../../hooks/useUser";
import { getPlanStatus, PRO_FLAG_KEY } from "../../lib/plan";

const keyFor = (id: string) => `Mashaal.progress.${id}`;

type Lesson = {
  id: string;
  title: string;
  kind: "video" | "audio";
  uri: string | number;
  artwork?: number | string | null;
};

type PlanView = "free" | "pro" | "expired";

const LESSONS: Lesson[] = [
  {
    id: "l1",
    title: "کارکردهای مغز در شکست عشقی",
    kind: "video",
    uri: require("../../assets/video/video2.mp4"),
  },
  {
    id: "l2",
    title: "انواع وابستگی در شکست عشقی",
    kind: "audio",
    uri: require("../../assets/audio/voice.mp3"),
    artwork: require("../../assets/images/cover.jpg"),
  },
  {
    id: "l3",
    title: "خطاهای شناختی در شکست عشقی",
    kind: "video",
    uri: require("../../assets/video/video.mp4"),
  },
  {
    id: "l4",
    title: "خیانت",
    kind: "audio",
    uri: require("../../assets/audio/voice.mp3"),
    artwork: require("../../assets/images/cover.jpg"),
  },
  {
    id: "l5",
    title: "جواب به چراهای شکست عشقی",
    kind: "video",
    uri: require("../../assets/video/video2.mp4"),
  },
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

/* ------------------ کارت هر درس ------------------ */
function LessonCard({
  item,
  onOpen,
  progressMs,
  durationMs,
  onResetProgress,
}: {
  item: Lesson;
  onOpen: (l: Lesson) => void;
  progressMs?: number;
  durationMs?: number;
  onResetProgress: (id: string) => void;
}) {
  const { colors } = useTheme();
  const pct =
    progressMs && durationMs && durationMs > 0
      ? Math.min(100, Math.round((progressMs / durationMs) * 100))
      : 0;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onOpen(item)}
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 12,
        gap: 10,
        marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 10,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons
            name={item.kind === "video" ? "videocam" : "musical-notes"}
            size={22}
            color={colors.text}
          />
        </View>
        <Text
          style={{
            color: colors.text,
            fontWeight: "900",
            flex: 1,
            textAlign: "right",
          }}
        >
          {item.title}
        </Text>
      </View>

      {pct > 0 ? (
        <View style={{ gap: 6 }}>
          <View
            style={{
              height: 8,
              backgroundColor: colors.background,
              borderRadius: 999,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View
              style={{
                width: `${pct}%`,
                height: "100%",
                backgroundColor: colors.primary,
                borderRadius: 999,
              }}
            />
          </View>
          <View
            style={{
              flexDirection: "row-reverse",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ color: "#8E8E93", fontSize: 11 }}>
              پیشرفت: {pct}%
            </Text>
            <Text style={{ color: "#8E8E93", fontSize: 11 }}>
              {toHMM(progressMs || 0)} / {toHMM(durationMs || 0)}
            </Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
            <TouchableOpacity
              onPress={() => onResetProgress(item.id)}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 10,
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}
            >
              <Text
                style={{
                  color: colors.text,
                  fontSize: 12,
                  fontWeight: "800",
                }}
              >
                پاک‌کردن پیشرفت
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <Text
          style={{
            color: "#8E8E93",
            fontSize: 12,
            textAlign: "right",
          }}
        >
          برای شروع تپ کن
        </Text>
      )}
    </TouchableOpacity>
  );
}

/* ------------------ پلیر ------------------ */
function Player({
  lesson,
  onClose,
  onProgress,
}: {
  lesson: Lesson;
  onClose: () => void;
  onProgress: (id: string, p: number, d: number) => void;
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
            positionMillis > 0 &&
            durationMillis > 0 &&
            positionMillis < durationMillis - 1500
          ) {
            setShouldResumeFrom(positionMillis);
          }
        }
      } catch {}
    })();
    return () => {
      cancel = true;
    };
  }, [lesson.id]);

  const onVideoStatusUpdate = (s: AVPlaybackStatusSuccess) => {
    if (!s.isLoaded) return;
    const d = s.durationMillis || 0;
    const p = s.positionMillis || 0;
    setVDuration(d);
    setVPosition(p);
    if (s.positionMillis != null && s.durationMillis != null) {
      AsyncStorage.setItem(
        keyFor(lesson.id),
        JSON.stringify({
          positionMillis: p,
          durationMillis: d,
          updatedAt: Date.now(),
        })
      ).catch(() => {});
      onProgress(lesson.id, p, d);
    }
  };

  const onVideoReady = async () => {
    if (shouldResumeFrom && videoRef.current) {
      try {
        await videoRef.current.setPositionAsync(shouldResumeFrom);
        setShouldResumeFrom(null);
      } catch {}
    }
  };

  // صوت
  const audio = useAudio({
    id: lesson.id,
    uri: lesson.uri,
    enabled: lesson.kind === "audio",
  });

  // Throttle هر ۲ ثانیه (و اگر رسید به انتها، سریع ۱۰۰٪ ثبت کن)
  const lastProgressRef = useRef(0);
  const atAudioEnd =
    lesson.kind === "audio" &&
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

  const progPosition =
    lesson.kind === "video" ? vPosition : audio.position ?? 0;
  const progDuration =
    lesson.kind === "video" ? vDuration : audio.duration ?? 0;

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
    <View
      style={{
        flexDirection: "row-reverse",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <TouchableOpacity
        onPress={() => {
          if (lesson.kind === "audio") {
            audio.stopAndUnload();
          }
          onClose();
        }}
        style={{ padding: 6 }}
      >
        <Ionicons
          name="chevron-back"
          size={22}
          color={colors.text}
          style={{ transform: [{ scaleX: -1 }] }}
        />
      </TouchableOpacity>
      <Text
        style={{
          color: colors.text,
          fontWeight: "900",
          flex: 1,
          textAlign: "right",
        }}
      >
        {lesson.title}
      </Text>
      <View style={{ width: 28 }} />
    </View>
  );

  return (
    <View style={{ flex: 1, gap: 12 }}>
      {header}

      {lesson.kind === "video" ? (
        <View
          style={{
            borderRadius: 16,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: "#000",
            height: 260,
          }}
        >
          <Video
            ref={videoRef}
            source={
              typeof lesson.uri === "string" ? { uri: lesson.uri } : lesson.uri
            }
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
              <Image
                source={coverSource}
                blurRadius={40}
                resizeMode="cover"
                style={StyleSheet.absoluteFillObject}
              />
              <LinearGradient
                colors={[
                  "rgba(0,0,0,0.55)",
                  "rgba(0,0,0,0.28)",
                  "rgba(0,0,0,0.08)",
                ]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFillObject,
                  { backgroundColor: "rgba(0,0,0,0.25)" },
                ]}
              />
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
                <Image
                  source={coverSource}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
              ) : (
                <Ionicons name="musical-notes" size={70} color={colors.text} />
              )}
            </View>
          </View>

          {/* Row 1: -10 / Play / +10 */}
          <View style={{ alignItems: "center", marginTop: 6 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                columnGap: 22,
              }}
            >
              <TouchableOpacity
                disabled={audio.loading}
                onPress={async () => {
                  await audio.seekBy(-10000);
                }}
                style={{
                  opacity: audio.loading ? 0.5 : 1,
                  padding: 12,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Ionicons name="play-back" size={28} color={colors.text} />
              </TouchableOpacity>

              <TouchableOpacity
                disabled={audio.loading}
                onPress={audio.togglePlay}
                style={{
                  opacity: audio.loading ? 0.5 : 1,
                  paddingVertical: 16,
                  paddingHorizontal: 24,
                  borderRadius: 999,
                  backgroundColor: colors.primary,
                }}
              >
                <Ionicons
                  name={audio.isPlaying ? "pause" : "play"}
                  size={32}
                  color="#fff"
                />
              </TouchableOpacity>

              <TouchableOpacity
                disabled={audio.loading}
                onPress={async () => {
                  await audio.seekBy(10000);
                }}
                style={{
                  opacity: audio.loading ? 0.5 : 1,
                  padding: 12,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Ionicons name="play-forward" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Row 2: restart — rate */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              paddingHorizontal: 8,
              marginTop: 6,
            }}
          >
            <TouchableOpacity
              disabled={audio.loading}
              onPress={async () => {
                await audio.restart();
              }}
              style={{
                opacity: audio.loading ? 0.5 : 1,
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Ionicons name="play-skip-back" size={22} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              disabled={audio.loading}
              onPress={audio.cycleRate}
              style={{
                opacity: audio.loading ? 0.5 : 1,
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text
                style={{
                  color: colors.text,
                  fontWeight: "900",
                }}
              >{`${audio.rate}×`}</Text>
            </TouchableOpacity>
          </View>

          {/* Slider + timers */}
          <View
            style={{
              width: "100%",
              paddingHorizontal: 4,
              marginTop: 4,
            }}
          >
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
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: 4,
              }}
            >
              <Text style={{ color: "#E5E7EB", fontSize: 12 }}>
                {toHMM(sliderValue)}
              </Text>
              <Text style={{ color: "#E5E7EB", fontSize: 12 }}>
                {toHMM(sliderMax)}
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

/* ------------------ تب مشعل ------------------ */
export default function Mashaal() {
  const { colors } = useTheme();
  const { me } = useUser();

  const [selected, setSelected] = useState<Lesson | null>(null);
  const [progressMap, setProgressMap] = useState<
    Record<string, { p: number; d: number }>
  >({});
  const [planView, setPlanView] = useState<PlanView>("free");
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);

  const isProPlan = planView === "pro";
  const isNearExpire =
    planView === "pro" &&
    daysLeft != null &&
    daysLeft > 0 &&
    daysLeft <= 7;

  // لود اولیه پیشرفت‌ها
  useEffect(() => {
    let cancel = false;
    (async () => {
      const next: Record<string, { p: number; d: number }> = {};
      for (const l of LESSONS) {
        try {
          const raw = await AsyncStorage.getItem(keyFor(l.id));
          if (raw) {
            const { positionMillis, durationMillis } = JSON.parse(raw) || {};
            if (
              typeof positionMillis === "number" &&
              typeof durationMillis === "number"
            ) {
              next[l.id] = { p: positionMillis, d: durationMillis };
            }
          }
        } catch {}
      }
      if (!cancel) setProgressMap(next);
    })();
    return () => {
      cancel = true;
    };
  }, []);

  /** بارگذاری اولیه وضعیت پلن */
  useEffect(() => {
    (async () => {
      try {
        const flag = await AsyncStorage.getItem(PRO_FLAG_KEY);
        const status = getPlanStatus(me);
        const flagIsPro = flag === "1";

        let view: PlanView = "free";
        let localDaysLeft: number | null = status.daysLeft;

        if (status.rawExpiresAt) {
          if (status.isExpired) {
            view =
              status.rawPlan === "pro" || status.rawPlan === "vip"
                ? "expired"
                : "free";
          } else if (status.isPro || flagIsPro) {
            view = "pro";
          } else {
            view = "free";
          }
        } else {
          view = status.isPro || flagIsPro ? "pro" : "free";
        }

        setPlanView(view);
        setDaysLeft(localDaysLeft ?? null);

        console.log("MASHAL INIT", {
          rawPlan: status.rawPlan,
          rawExpiresAt: status.rawExpiresAt,
          isExpired: status.isExpired,
          daysLeft: status.daysLeft,
          flag,
          planView: view,
          localDaysLeft,
        });
      } catch (e) {
        console.log("MASHAL INIT ERR", e);
        setPlanView("free");
        setDaysLeft(null);
      } finally {
        setLoadingPlan(false);
      }
    })();
  }, [me]);

  /** هر بار تب مشعل فوکوس بگیرد، وضعیت پلن دوباره محاسبه شود */
  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const flag = await AsyncStorage.getItem(PRO_FLAG_KEY);
          const status = getPlanStatus(me);
          const flagIsPro = flag === "1";

          let view: PlanView = "free";
          let localDaysLeft: number | null = status.daysLeft;

          if (status.rawExpiresAt) {
            if (status.isExpired) {
              view =
                status.rawPlan === "pro" || status.rawPlan === "vip"
                  ? "expired"
                  : "free";
            } else if (status.isPro || flagIsPro) {
              view = "pro";
            } else {
              view = "free";
            }
          } else {
            view = status.isPro || flagIsPro ? "pro" : "free";
          }

          if (!cancelled) {
            setPlanView(view);
            setDaysLeft(localDaysLeft ?? null);
            console.log("MASHAL FOCUS", {
              flag,
              planView: view,
              localDaysLeft,
              daysLeftReal: status.daysLeft,
              isExpired: status.isExpired,
            });
          }
        } catch (e) {
          console.log("MASHAL FOCUS ERR", e);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [me])
  );

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

  if (loadingPlan) {
    return (
      <Screen
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingBottom: 16,
        }}
      >
        <ActivityIndicator color={colors.primary} />
        <Text
          style={{
            color: colors.text,
            marginTop: 8,
            fontSize: 12,
          }}
        >
          در حال آماده‌سازی مشعل…
        </Text>
      </Screen>
    );
  }

  const badgeBg =
    planView === "pro"
      ? isNearExpire
        ? "#EA580C"
        : "#F59E0B"
      : planView === "expired"
      ? "#DC2626"
      : "#9CA3AF";

  const badgeLabel =
    planView === "pro"
      ? "PRO"
      : planView === "expired"
      ? "EXPIRED"
      : "FREE";

  const badgeTextColor = planView === "expired" ? "#FFFFFF" : "#111827";

  return (
    <Screen contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }}>
      {/* هدر + بج پلن */}
      <View
        style={{
          flexDirection: "row-reverse",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
          paddingHorizontal: 4,
          marginTop: 4,
        }}
      >
        <Text
          style={{
            color: colors.text,
            fontSize: 20,
            fontWeight: "900",
            textAlign: "right",
          }}
        >
          مشعل 🔥
        </Text>
        <View style={{ flexDirection: "row-reverse", alignItems: "center" }}>
          {isNearExpire && (
            <Text
              style={{
                color: "#FACC15",
                fontSize: 11,
                fontWeight: "900",
                marginLeft: 8,
              }}
            >
              {daysLeft} روز تا پایان اشتراک
            </Text>
          )}
          <View style={[styles.headerBadge, { backgroundColor: badgeBg }]}>
            <Text
              style={[styles.headerBadgeText, { color: badgeTextColor }]}
            >
              {badgeLabel}
            </Text>
          </View>
        </View>
      </View>

      {/* اگر پلن پرو نیست → صفحه قفل‌شده */}
      {!isProPlan ? (
        <View
          style={{
            flex: 1,
            borderWidth: 1,
            borderRadius: 16,
            borderColor: colors.border,
            backgroundColor: colors.card,
            padding: 16,
            marginHorizontal: 4,
            marginTop: 4,
          }}
        >
          {planView === "expired" ? (
            <>
              <Text
                style={{
                  color: colors.text,
                  fontSize: 15,
                  fontWeight: "900",
                  textAlign: "right",
                  lineHeight: 24,
                }}
              >
                اشتراکت منقضی شده و مشعل فعلاً برات قفله.
              </Text>

              <Text
                style={{
                  color: colors.text,
                  opacity: 0.8,
                  marginTop: 10,
                  fontSize: 13,
                  textAlign: "right",
                  lineHeight: 20,
                }}
              >
                مشعل جاییه که ویدیوها و ویس‌های آموزشی عمیقِ شکست عشقی جمع شده؛
                برای فهمیدن مغزت، الگوها، و ساختن مهارت‌های جدید.
                {"\n\n"}
                برای این‌که دوباره به همهٔ درس‌ها و مسیرهای آموزشی دسترسی داشته
                باشی، پلن ققنوس رو تمدید کن و ادامه بده.
              </Text>
            </>
          ) : (
            <>
              <View
                style={{
                  flexDirection: "row-reverse",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Ionicons name="school" size={22} color={colors.primary} />
                <Text
                  style={{
                    color: colors.text,
                    fontWeight: "900",
                    fontSize: 15,
                    textAlign: "right",
                    flex: 1,
                  }}
                >
                  اینجا «مشعل»ـه؛ جایی که ویدیوها و ویس‌های آموزشی عمیق و
                  کاربردی‌ات قرار می‌گیره.
                </Text>
              </View>

              <Text
                style={{
                  color: colors.text,
                  opacity: 0.8,
                  marginTop: 10,
                  fontSize: 13,
                  textAlign: "right",
                  lineHeight: 20,
                }}
              >
                این تب برای این ساخته شده که فقط حالِت کمی بهتر نشه؛
                واقعاً مهارت بسازی برای مدیریت احساس، وسواس فکری، ترس از
                تنهایی و بازسازی عزت‌نفس بعد از جدایی.
              </Text>

              <View style={{ marginTop: 14, gap: 6 }}>
                <View style={styles.bulletRow}>
                  <Ionicons
                    name="play-outline"
                    size={16}
                    color={colors.primary}
                  />
                  <Text
                    style={[styles.bulletText, { color: colors.text }]}
                  >
                    ویدیوهای کوتاه و کاربردی با مثال‌های واقعی از مراجعان
                  </Text>
                </View>
                <View style={styles.bulletRow}>
                  <Ionicons
                    name="mic-outline"
                    size={16}
                    color={colors.primary}
                  />
                  <Text
                    style={[styles.bulletText, { color: colors.text }]}
                  >
                    ویس‌هایی که هر وقت حوصله تصویر نداری، می‌تونی گوش کنی
                  </Text>
                </View>
                <View style={styles.bulletRow}>
                  <Ionicons
                    name="trail-sign-outline"
                    size={16}
                    color={colors.primary}
                  />
                  <Text
                    style={[styles.bulletText, { color: colors.text }]}
                  >
                    مسیرهای آموزشی مرحله‌به‌مرحله برای عبور سالم از شکست عشقی
                  </Text>
                </View>
              </View>

              <View
                style={{
                  marginTop: 16,
                  padding: 10,
                  borderRadius: 10,
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 12,
                    textAlign: "right",
                    lineHeight: 18,
                  }}
                >
                  برای باز شدن کامل «مشعل» و دسترسی به همه‌ی ویدیوها و ویس‌های
                  آموزشی، باید پلن PRO را از تب پرداخت فعال کنی.
                </Text>
              </View>
            </>
          )}
        </View>
      ) : !selected ? (
        // حالت PRO و هنوز در لیست هستیم
        <View style={{ gap: 10, flexGrow: 1 }}>
          <Text
            style={{
              color: "#8E8E93",
              fontSize: 12,
              textAlign: "right",
              marginHorizontal: 4,
            }}
          >
            محتوای آموزشی (ویدیو / ویس). هر جا موندی، دفعهٔ بعد از همان‌جا
            ادامه می‌دهیم.
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
        // حالت PRO و داخل پلیر
        <Player lesson={selected} onClose={close} onProgress={handleProgress} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  headerBadgeText: {
    fontWeight: "900",
    fontSize: 11,
  },
  bulletRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
  },
  bulletText: {
    fontSize: 13,
    textAlign: "right",
    flex: 1,
  },
});