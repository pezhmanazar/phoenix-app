// app/(tabs)/Mashaal.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Slider from "@react-native-community/slider";
import { useFocusEffect } from "@react-navigation/native";
import { AVPlaybackStatusSuccess, ResizeMode, Video } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import PlanStatusBadge from "../../components/PlanStatusBadge";
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
  const pct =
    progressMs && durationMs && durationMs > 0
      ? Math.min(100, Math.round((progressMs / durationMs) * 100))
      : 0;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onOpen(item)}
      style={styles.lessonCard}
    >
      <View style={styles.lessonTopRow}>
        <View style={styles.lessonIconBox}>
          <Ionicons
            name={item.kind === "video" ? "videocam" : "musical-notes"}
            size={22}
            color="#E5E7EB"
          />
        </View>
        <Text style={styles.lessonTitle}>{item.title}</Text>
      </View>

      {pct > 0 ? (
        <View style={{ gap: 6 }}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>

          <View style={styles.progressMetaRow}>
            <Text style={styles.progressMetaText}>پیشرفت: {pct}%</Text>
            <Text style={styles.progressMetaText}>
              {toHMM(progressMs || 0)} / {toHMM(durationMs || 0)}
            </Text>
          </View>

          <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
            <TouchableOpacity
              onPress={() => onResetProgress(item.id)}
              style={styles.resetBtn}
              activeOpacity={0.9}
            >
              <Text style={styles.resetBtnText}>پاک‌کردن پیشرفت</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <Text style={styles.tapToStart}>برای شروع تپ کن</Text>
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

  // Throttle هر ۲ ثانیه
  const lastProgressRef = useRef(0);
  const atAudioEnd =
    lesson.kind === "audio" &&
    (audio.duration ?? 0) > 0 &&
    (audio.position ?? 0) >= audio.duration - 250;

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
  }, [
    audio.position,
    audio.duration,
    lesson.kind,
    lesson.id,
    atAudioEnd,
    onProgress,
    audio.duration,
  ]);

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
    <View style={styles.playerHeaderRow}>
      <TouchableOpacity
        onPress={() => {
          if (lesson.kind === "audio") audio.stopAndUnload();
          onClose();
        }}
        style={styles.playerBackBtn}
        activeOpacity={0.9}
      >
        <Ionicons
          name="chevron-back"
          size={22}
          color="#E5E7EB"
          style={{ transform: [{ scaleX: -1 }] }}
        />
      </TouchableOpacity>

      <Text style={styles.playerTitle} numberOfLines={1}>
        {lesson.title}
      </Text>

      <View style={{ width: 34 }} />
    </View>
  );

  return (
    <View style={{ flex: 1, gap: 12 }}>
      {header}

      {lesson.kind === "video" ? (
        <View style={styles.videoBox}>
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
        <View style={styles.audioCard}>
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
                  "rgba(0,0,0,0.62)",
                  "rgba(0,0,0,0.32)",
                  "rgba(0,0,0,0.10)",
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
            <View style={styles.coverBox}>
              {coverSource ? (
                <Image
                  source={coverSource}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
              ) : (
                <Ionicons name="musical-notes" size={70} color="#E5E7EB" />
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
                style={[styles.circleOutlineBtn, { opacity: audio.loading ? 0.5 : 1 }]}
              >
                <Ionicons name="play-back" size={28} color="#E5E7EB" />
              </TouchableOpacity>

              <TouchableOpacity
                disabled={audio.loading}
                onPress={audio.togglePlay}
                style={[styles.playBtn, { opacity: audio.loading ? 0.5 : 1 }]}
              >
                <Ionicons
                  name={audio.isPlaying ? "pause" : "play"}
                  size={32}
                  color="#111827"
                />
              </TouchableOpacity>

              <TouchableOpacity
                disabled={audio.loading}
                onPress={async () => {
                  await audio.seekBy(10000);
                }}
                style={[styles.circleOutlineBtn, { opacity: audio.loading ? 0.5 : 1 }]}
              >
                <Ionicons name="play-forward" size={28} color="#E5E7EB" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Row 2: restart — rate */}
          <View style={styles.audioRow2}>
            <TouchableOpacity
              disabled={audio.loading}
              onPress={async () => {
                await audio.restart();
              }}
              style={[styles.pillOutlineBtn, { opacity: audio.loading ? 0.5 : 1 }]}
            >
              <Ionicons name="play-skip-back" size={22} color="#E5E7EB" />
            </TouchableOpacity>

            <TouchableOpacity
              disabled={audio.loading}
              onPress={audio.cycleRate}
              style={[styles.pillOutlineBtn, { opacity: audio.loading ? 0.5 : 1 }]}
            >
              <Text style={{ color: "#E5E7EB", fontWeight: "900" }}>
                {`${audio.rate}×`}
              </Text>
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
              minimumTrackTintColor="#D4AF37"
              maximumTrackTintColor="rgba(255,255,255,.18)"
              thumbTintColor="#D4AF37"
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
  const insets = useSafeAreaInsets();
  const { me } = useUser();

  const [selected, setSelected] = useState<Lesson | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, { p: number; d: number }>>({});
  const [planView, setPlanView] = useState<PlanView>("free");
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);

  const isProPlan = planView === "pro";

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
            if (typeof positionMillis === "number" && typeof durationMillis === "number") {
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
        const localDaysLeft: number | null = status.daysLeft ?? null;

        if (status.rawExpiresAt) {
          if (status.isExpired) view = "expired";
          else if (status.isPro || flagIsPro) view = "pro";
          else view = "free";
        } else {
          view = status.isPro || flagIsPro ? "pro" : "free";
        }

        setPlanView(view);
        setDaysLeft(localDaysLeft);
      } catch {
        setPlanView("free");
        setDaysLeft(null);
      } finally {
        setLoadingPlan(false);
      }
    })();
  }, [me]);

  /** هر بار تب فوکوس بگیرد، وضعیت پلن دوباره محاسبه شود */
  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const flag = await AsyncStorage.getItem(PRO_FLAG_KEY);
          const status = getPlanStatus(me);
          const flagIsPro = flag === "1";

          let view: PlanView = "free";
          const localDaysLeft: number | null = status.daysLeft ?? null;

          if (status.rawExpiresAt) {
            if (status.isExpired) view = "expired";
            else if (status.isPro || flagIsPro) view = "pro";
            else view = "free";
          } else {
            view = status.isPro || flagIsPro ? "pro" : "free";
          }

          if (!cancelled) {
            setPlanView(view);
            setDaysLeft(localDaysLeft);
          }
        } catch {}
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
      <SafeAreaView edges={["top"]} style={styles.root}>
        <View pointerEvents="none" style={styles.bgGlowTop} />
        <View pointerEvents="none" style={styles.bgGlowBottom} />

        <View style={styles.center}>
          <ActivityIndicator color="#D4AF37" />
          <Text style={styles.centerText}>در حال آماده‌سازی مشعل…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.root}>
      <View pointerEvents="none" style={styles.bgGlowTop} />
      <View pointerEvents="none" style={styles.bgGlowBottom} />

      {/* Header: بج سمت چپ + عنوان راست‌چین (بدون ایموجی) */}
      <View style={[styles.headerBar, { paddingTop: 10 }]}>
        <View style={styles.headerLeft}>
          {/* ✅ متن نزدیک انقضا را از خود کامپوننت بگیر و کنار بج نمایش بده */}
          <PlanStatusBadge me={me} showExpiringText />
        </View>

        <View style={styles.headerCenter} pointerEvents="none">
          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              مــــــشعل
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          {/* سمت راست خالیه تا عنوان دقیقاً در جای درست بایسته */}
          <View style={{ width: 120 }} />
        </View>
      </View>

      {/* ✅ بدنه اسکرولی + padding پایین برای اینکه زیر تب‌بار نره */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: 10,
          paddingBottom: Math.max(18, insets.bottom + 120),
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* اگر پلن پرو نیست → صفحه قفل‌شده */}
        {!isProPlan ? (
          <View style={styles.lockCard}>
            {planView === "expired" ? (
              <>
                <Text style={styles.lockTitle}>اشتراکت منقضی شده و مشعل فعلاً برات قفله.</Text>

                <Text style={styles.lockBody}>
                  مشعل جاییه که ویدیوها و ویس‌های آموزشی عمیقِ شکست عشقی جمع شده؛ برای فهمیدن مغزت، الگوها، و ساختن
                  مهارت‌های جدید.
                  {"\n\n"}
                  برای این‌که دوباره به همهٔ درس‌ها و مسیرهای آموزشی دسترسی داشته باشی، پلن ققنوس رو تمدید کن و ادامه بده.
                </Text>
              </>
            ) : (
              <>
                <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
                  <Ionicons name="school" size={22} color="#D4AF37" />
                  <Text style={styles.lockTitle}>
                    اینجا «مشعل»ـه؛ جایی که ویدیوها و ویس‌های آموزشی عمیق و کاربردی‌ات قرار می‌گیره.
                  </Text>
                </View>

                <Text style={[styles.lockBody, { marginTop: 10 }]}>
                  این تب برای این ساخته شده که فقط حالِت کمی بهتر نشه؛ واقعاً مهارت بسازی برای مدیریت احساس، وسواس فکری،
                  ترس از تنهایی و بازسازی عزت‌نفس بعد از جدایی.
                </Text>

                <View style={{ marginTop: 14, gap: 6 }}>
                  <View style={styles.bulletRow}>
                    <Ionicons name="play-outline" size={16} color="#D4AF37" />
                    <Text style={styles.bulletText}>ویدیوهای کوتاه و کاربردی با مثال‌های واقعی از مراجعان</Text>
                  </View>
                  <View style={styles.bulletRow}>
                    <Ionicons name="mic-outline" size={16} color="#D4AF37" />
                    <Text style={styles.bulletText}>ویس‌هایی که هر وقت حوصله تصویر نداری، می‌تونی گوش کنی</Text>
                  </View>
                  <View style={styles.bulletRow}>
                    <Ionicons name="trail-sign-outline" size={16} color="#D4AF37" />
                    <Text style={styles.bulletText}>مسیرهای آموزشی مرحله‌به‌مرحله برای عبور سالم از شکست عشقی</Text>
                  </View>
                </View>

                <View style={styles.lockHintBox}>
                  <Text style={styles.lockHintText}>
                    برای باز شدن کامل «مشعل» و دسترسی به همه‌ی ویدیوها و ویس‌های آموزشی، باید پلن PRO را از تب پرداخت فعال کنی.
                  </Text>
                </View>
              </>
            )}
          </View>
        ) : !selected ? (
          // حالت PRO و هنوز در لیست هستیم
          <View style={{ paddingHorizontal: 16, gap: 10 }}>
            <Text style={styles.listHint}>
              محتوای آموزشی (ویدیو / ویس). هر جا موندی، دفعهٔ بعد از همان‌جا ادامه می‌دهیم.
            </Text>

            <View style={{ paddingTop: 4 }}>
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
          // حالت PRO و داخل پلیر (اسکرول‌پذیر + فضای پایین برای تب‌بار)
          <View style={{ paddingHorizontal: 16 }}>
            <Player lesson={selected} onClose={close} onProgress={handleProgress} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b0f14" },

  bgGlowTop: {
    position: "absolute",
    top: -260,
    left: -240,
    width: 480,
    height: 480,
    borderRadius: 999,
    backgroundColor: "rgba(212,175,55,.14)",
  },
  bgGlowBottom: {
    position: "absolute",
    bottom: -280,
    right: -260,
    width: 560,
    height: 560,
    borderRadius: 999,
    backgroundColor: "rgba(233,138,21,.10)",
  },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  centerText: { marginTop: 8, color: "rgba(231,238,247,.72)", fontSize: 12, fontWeight: "800" },

  headerBar: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,.08)",
    backgroundColor: "#030712",
    paddingHorizontal: 12,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  headerLeft: {
    minWidth: 120,
    alignItems: "flex-start",
    justifyContent: "flex-end",
  },

  // ✅ عنوان: به جای وسط‌چین، راست‌چین و هم‌خوان با تم
  headerCenter: {
  position: "absolute",
  left: 12,     // هم‌عرض paddingHorizontal هدر
  right: 12,    // هم‌عرض paddingHorizontal هدر
  top: 10,
  bottom: 10,
  justifyContent: "center",
  alignItems: "flex-end",
  paddingRight: 0,
},
  headerTitleBox: {
    maxWidth: "92%",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "transparent",
    alignSelf: "flex-end",
  },
  headerTitle: {
    color: "#F9FAFB",
    fontSize: 15,
    fontWeight: "900",
    textAlign: "right",
  },

  headerActions: {
    marginLeft: "auto",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    minWidth: 120,
    justifyContent: "flex-end",
  },

  lockCard: {
    borderWidth: 1,
    borderRadius: 16,
    borderColor: "rgba(255,255,255,.08)",
    backgroundColor: "rgba(255,255,255,.04)",
    padding: 16,
    marginHorizontal: 16,
    marginTop: 6,
  },
  lockTitle: {
    color: "#F9FAFB",
    fontSize: 15,
    fontWeight: "900",
    textAlign: "right",
    lineHeight: 24,
    flex: 1,
  },
  lockBody: {
    color: "rgba(231,238,247,.80)",
    marginTop: 10,
    fontSize: 13,
    textAlign: "right",
    lineHeight: 20,
    fontWeight: "700",
  },
  lockHintBox: {
    marginTop: 16,
    padding: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
  },
  lockHintText: {
    color: "rgba(231,238,247,.82)",
    fontSize: 12,
    textAlign: "right",
    lineHeight: 18,
    fontWeight: "700",
  },

  bulletRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  bulletText: {
    fontSize: 13,
    textAlign: "right",
    flex: 1,
    color: "#E5E7EB",
    fontWeight: "700",
    lineHeight: 19,
  },

  listHint: {
    color: "rgba(231,238,247,.55)",
    fontSize: 12,
    textAlign: "right",
    marginHorizontal: 4,
    fontWeight: "800",
  },

  lessonCard: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
    backgroundColor: "rgba(255,255,255,.04)",
    borderRadius: 16,
    padding: 12,
    gap: 10,
    marginBottom: 10,
  },
  lessonTopRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  lessonIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
  },
  lessonTitle: {
    color: "#F9FAFB",
    fontWeight: "900",
    flex: 1,
    textAlign: "right",
    lineHeight: 22,
  },
  tapToStart: {
    color: "rgba(231,238,247,.55)",
    fontSize: 12,
    textAlign: "right",
    fontWeight: "800",
  },

  progressTrack: {
    height: 8,
    backgroundColor: "rgba(255,255,255,.03)",
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#D4AF37",
    borderRadius: 999,
  },
  progressMetaRow: { flexDirection: "row-reverse", justifyContent: "space-between" },
  progressMetaText: { color: "rgba(231,238,247,.55)", fontSize: 11, fontWeight: "800" },

  resetBtn: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,.03)",
  },
  resetBtnText: { color: "#E5E7EB", fontSize: 12, fontWeight: "800" },

  playerHeaderRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  playerBackBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
  },
  playerTitle: {
    color: "#F9FAFB",
    fontWeight: "900",
    flex: 1,
    textAlign: "right",
    marginHorizontal: 10,
  },

  videoBox: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
    backgroundColor: "#000",
    height: 260,
  },

  audioCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
    backgroundColor: "rgba(255,255,255,.04)",
    padding: 16,
    gap: 16,
    justifyContent: "space-between",
    overflow: "hidden",
    position: "relative",
    minHeight: 520,
  },
  coverBox: {
    width: 260,
    height: 260,
    borderRadius: 28,
    backgroundColor: "rgba(0,0,0,.35)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    overflow: "hidden",
  },

  circleOutlineBtn: {
    padding: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.12)",
    backgroundColor: "rgba(255,255,255,.04)",
  },
  playBtn: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 999,
    backgroundColor: "rgba(212,175,55,.92)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,.45)",
  },

  audioRow2: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    marginTop: 6,
  },
  pillOutlineBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.12)",
    backgroundColor: "rgba(255,255,255,.04)",
  },
});