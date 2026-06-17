// app/pelekan/gosastan/current.tsx
import AppBannerModal from "@/components/ui/AppBannerModal";
import { useAuth } from "@/hooks/useAuth";
import { useMoodHistory } from "@/hooks/useMoodHistory";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  //Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const RESET_DAY_URL = "https://qoqnoos.app/api/pelekan/stage/gosastan/day/reset";

const DONE_MOTIVATION_MESSAGES = [
  "ایول، همین فرمون ادامه بده!",
  "عالی داری جلو می‌ری.",
  "ادامه بده، مسیر همینه.",
  "باعث افتخاری.",
  "تو بی‌نظیری.",
  "محشری، جا نزن.",
  "دمت گرم، یک پله جلوتر برو.",
  "قوی پیش رفتی.",
  "این یعنی تعهد.",
  "آفرین به این پشتکار.",
  "داری خودت رو پس می‌گیری.",
  "همین قدم‌های کوچیک می‌سازنت.",
  "امروزت رو بردی.",
  "یه حرکت درست دیگه.",
  "ققنوس داره بیدار می‌شه.",
];

type NoContactStreak = {
  currentDays?: number;
  bestDays?: number;
  warningState?: string | null;
  violationCount?: number;
  resetCount?: number;
};

type GosastanTask = {
  id: string | number;
  code: string;
  titleFa?: string | null;
  title?: string | null;
  description?: string | null;
  suggestedTimeFa?: string | null;
  isRequired?: boolean;
  isDone?: boolean;
  xpReward?: number;
  noContactStreak?: NoContactStreak | null;
};


type GosastanStateResponse = {
  ok: boolean;
  stage?: {
    code?: string;
    titleFa?: string | null;
    title?: string | null;
    description?: string | null;
  };
  currentDay?: {
  id?: string | number;
  dayNumberInStage?: number;
  globalDayNumber?: number;
  titleFa?: string | null;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  completionPercent?: number;
  canReset?: boolean;
  canGoNextDay?: boolean;
  isTimeLocked?: boolean;
  startedAt?: string | null;
  completedAt?: string | null;
};
  summary?: {
    requiredDone?: number;
    requiredTotal?: number;
    allRequiredDone?: boolean;
    completionPercent?: number;
  };
  tasks?: GosastanTask[];
  error?: string;
  message?: string;
};

export default function GosastanDay1Screen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { dayNumber } = useLocalSearchParams<{ dayNumber?: string }>();
  const safeDayNumber = Number(dayNumber || 1);
  const API_URL = `https://qoqnoos.app/api/pelekan/stage/gosastan/day/${safeDayNumber}/state`;

  const { token, loading: authLoading, isAuthenticated } = useAuth();
  const { removeMoodEntryByDayCode} = useMoodHistory();
  //const { removeMoodEntryByDayCode, clearMoodHistory } = useMoodHistory(); //برای کلیر کردن این رو فعال کن بالایی رو کامنت

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GosastanStateResponse | null>(null);
  const [resettingDay, setResettingDay] = useState(false);
  const [resetConfirmVisible, setResetConfirmVisible] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(false);
  const [bannerKind, setBannerKind] = useState<"success" | "error">("success");
  const [bannerTitle, setBannerTitle] = useState("");
  const [bannerMessage, setBannerMessage] = useState("");

  const palette = useMemo(
    () => ({
      bg: "#070A10",
      card: "rgba(12,18,30,.86)",
      cardStrong: "rgba(17,24,39,.94)",
      cardSoft: "rgba(255,255,255,.045)",
      border: "rgba(255,255,255,.10)",
      border2: "rgba(255,255,255,.16)",
      text: "#F9FAFB",
      sub: "rgba(231,238,247,.76)",
      sub2: "rgba(231,238,247,.54)",
      gold: "#D4AF37",
      goldSoft: "rgba(212,175,55,.14)",
      orange: "#E98A15",
      orangeSoft: "rgba(233,138,21,.13)",
      green: "#86efac",
      greenSoft: "rgba(134,239,172,.13)",
      red: "#ef4444",
      redSoft: "rgba(239,68,68,.13)",
      track: "rgba(255,255,255,.08)",
      line: "rgba(212,175,55,.18)",
      separator: "rgba(255,255,255,.06)",
      stepGlass: "rgba(212,175,55,.20)",
      stepInner: "rgba(212,175,55,.28)",
    }),
    []
  );

  const fetchState = useCallback(
    async (isPullToRefresh = false) => {
      if (authLoading) return;

      if (!token) {
        setError("برای مشاهده این بخش باید وارد حساب کاربری‌ات شوی.");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        if (isPullToRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError(null);

        const res = await fetch(API_URL, {
          headers: {
            "Cache-Control": "no-store",
            Authorization: `Bearer ${token}`,
          },
        });

        const json: GosastanStateResponse = await res.json().catch(() => ({
          ok: false,
          error: "INVALID_JSON",
        }));

        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || json?.message || `HTTP_${res.status}`);
        }

        setData(json);
      } catch (e: any) {
        setError(e?.message || "در دریافت اطلاعات گسستن خطایی رخ داد.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, authLoading, API_URL]
  );

    useFocusEffect(
    useCallback(() => {
      if (authLoading || !token) return;

      fetchState();
    }, [authLoading, token, fetchState])
  );
  
  
const showBanner = (
  kind: "success" | "error",
  title: string,
  message = ""
) => {
  setBannerKind(kind);
  setBannerTitle(title);
  setBannerMessage(message);
  setBannerVisible(true);
};

  const buildDayDraftKeys = () => {
  const dayCode = String(data?.currentDay?.id || "").trim();
  if (!dayCode) return [];

  return tasks
    .map((task) => task?.code)
    .filter(
      (taskCode): taskCode is string =>
        typeof taskCode === "string" && taskCode.trim().length > 0
    )
    .map((taskCode) => `pelekan:draft:${dayCode}:${taskCode.trim()}`);
};


const handleResetDay = async () => {
  if (!data?.currentDay?.canReset || resettingDay) return;

  try {
    setResettingDay(true);
    setResetConfirmVisible(false);

    const res = await fetch(RESET_DAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const result = await res.json().catch(() => null);

    if (!res.ok) {
  throw new Error(result?.message || "ریست روز انجام نشد.");
}

    const dayCode = String(data?.currentDay?.id || "").trim();

    const draftKeys = buildDayDraftKeys();

    if (draftKeys.length > 0) {
      await AsyncStorage.multiRemove(draftKeys);
    }

    if (dayCode) {
      await removeMoodEntryByDayCode(dayCode);
    }

    await fetchState();
    showBanner("success", "انجام شد", "روز فعال با موفقیت ریست شد.");
  } catch (error: any) {
    showBanner("error", "خطا", error?.message || "مشکلی در ریست روز پیش آمد.");
  } finally {
    setResettingDay(false);
  }
};


  const stageTitle = "گســــستن";
  const currentDayTitle =
    data?.currentDay?.titleFa || data?.currentDay?.title || "روز جاری";

  const dayDescription =
    data?.currentDay?.description ||
    data?.stage?.description ||
    "امروز فقط مشاهده می‌کنی؛ بدون عجله برای واکنش، بدون فشار برای خوب شدن.";

  const requiredDone = Number(data?.summary?.requiredDone ?? 0);
  const requiredTotal = Number(data?.summary?.requiredTotal ?? 0);
  const completionPercent = Number(data?.summary?.completionPercent ?? 0);
  const safeCompletionPercent = Math.max(0, Math.min(100, completionPercent));

  const progressColor = useMemo(() => {
  if (safeCompletionPercent >= 100) return "#16a34a";
  if (safeCompletionPercent >= 75) return "#22c55e";
  if (safeCompletionPercent >= 50) return "#86efac";
  return palette.gold;
}, [safeCompletionPercent, palette.gold]);

const dayStartDateText = useMemo(() => {
  const startedAt = data?.currentDay?.startedAt;
  if (!startedAt) return "ثبت نشده";

  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(startedAt));
}, [data?.currentDay?.startedAt]);

const dayEndDateText = useMemo(() => {
  const completedAt = data?.currentDay?.completedAt;
  if (!completedAt) return null;

  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(completedAt));
}, [data?.currentDay?.completedAt]);


const getDoneMotivationMessage = useCallback((taskId: string | number) => {
  const index = Math.abs(String(taskId).split("").reduce((sum, char) => {
    return sum + char.charCodeAt(0);
  }, 0)) % DONE_MOTIVATION_MESSAGES.length;

  return DONE_MOTIVATION_MESSAGES[index];
}, []);


  const tasks = useMemo(() => {
  return Array.isArray(data?.tasks) ? data.tasks : [];
  }, [data?.tasks]);

  const earnedXp = useMemo(() => {
  return tasks.reduce((sum, task) => {
    if (!task.isDone) return sum;
    return sum + (Number(task.xpReward) || 0);
  }, 0);
}, [tasks]);

const doneTasksCount = useMemo(() => {
  return tasks.filter((task) => !!task.isDone).length;
}, [tasks]);


  const statusLabel = useMemo(() => {
    const s = data?.currentDay?.status;
    if (s === "completed") return "تکمیل‌شده";
    if (s === "in_progress") return "در حال انجام";
    if (s === "locked") return "قفل";
    return "فعال";
  }, [data?.currentDay?.status]);

  const statusColor = useMemo(() => {
    const s = data?.currentDay?.status;
    if (s === "completed") return palette.green;
    if (s === "locked") return palette.red;
    return palette.gold;
  }, [data?.currentDay?.status, palette]);

  const shouldShowResetDayButton =
  data?.currentDay?.status === "active" && data?.currentDay?.canReset === true;


  if (loading) {
    return (
      <SafeAreaView
        style={[styles.root, { backgroundColor: palette.bg }]}
        edges={["top", "bottom", "left", "right"]}
      >
        <View pointerEvents="none" style={styles.glowTop} />
        <View pointerEvents="none" style={styles.glowBottom} />
        <View style={styles.centerBox}>
          <ActivityIndicator color={palette.gold} />
          <Text style={[styles.loadingText, { color: palette.sub }]}>
            در حال بارگذاری گسستن…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated || !token) {
    return (
      <SafeAreaView
        style={[styles.root, { backgroundColor: palette.bg }]}
        edges={["top", "bottom", "left", "right"]}
      >
        <View pointerEvents="none" style={styles.glowTop} />
        <View pointerEvents="none" style={styles.glowBottom} />

        <View style={styles.centerBox}>
          <Text style={[styles.errorTitle, { color: palette.text }]}>
            نیاز به ورود
          </Text>
          <Text style={[styles.errorText, { color: palette.sub }]}>
            برای مشاهده روز جاری گسستن، اول وارد حساب کاربریت شو.
          </Text>

          <TouchableOpacity
            activeOpacity={0.9}
            style={[
              styles.btn,
              styles.btnGhost,
              { borderColor: palette.border2 },
            ]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={18} color={palette.text} />
            <Text style={[styles.btnText, { color: palette.text }]}>
              بازگشت
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView
        style={[styles.root, { backgroundColor: palette.bg }]}
        edges={["top", "bottom", "left", "right"]}
      >
        <View pointerEvents="none" style={styles.glowTop} />
        <View pointerEvents="none" style={styles.glowBottom} />

        <View style={styles.centerBox}>
          <Ionicons
            name="alert-circle-outline"
            size={30}
            color={palette.red}
          />
          <Text style={[styles.errorTitle, { color: palette.text }]}>
            خطا در دریافت اطلاعات
          </Text>
          <Text style={[styles.errorText, { color: palette.sub }]}>
            {error}
          </Text>

          <TouchableOpacity
            activeOpacity={0.9}
            style={[
              styles.btn,
              styles.btnSecondary,
              { borderColor: palette.border2 },
            ]}
            onPress={() => fetchState()}
          >
            <Ionicons name="refresh-outline" size={18} color={palette.text} />
            <Text style={[styles.btnText, { color: palette.text }]}>
              تلاش دوباره
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: palette.bg }]}
      edges={["top", "bottom", "left", "right"]}
    >
      <View pointerEvents="none" style={styles.glowTop} />
      <View pointerEvents="none" style={styles.glowBottom} />
      <View pointerEvents="none" style={styles.softGrid} />

      <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[
              styles.backBtn,
              {
                backgroundColor: palette.cardSoft,
                borderColor: palette.border,
              },
            ]}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-forward" size={19} color={palette.text} />
          </TouchableOpacity>

          <View style={styles.headerTextBox}>
            <Text style={[styles.stageTitle, { color: palette.text }]}>
              {stageTitle}
            </Text>
          </View>
        </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(34, insets.bottom + 28) },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchState(true)}
            tintColor={palette.gold}
          />
        }
      >
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: palette.cardStrong,
              borderColor: palette.border2,
            },
          ]}
        >
          <View style={styles.heroDecorOne} />
          <View style={styles.heroDecorTwo} />

          <View style={styles.heroTop}>
            <View
              style={[
                styles.statusBadge,
                {
                  borderColor: statusColor,
                  backgroundColor: "rgba(255,255,255,.035)",
                },
              ]}
            >
              <View
                style={[styles.statusDot, { backgroundColor: statusColor }]}
              />
              <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                {statusLabel}
              </Text>
            </View>

            <View style={styles.heroStatusMeta}>
  <Text style={[styles.heroDateText, { color: palette.sub2 }]}>
    شروع: {dayStartDateText}
  </Text>

  {dayEndDateText ? (
    <Text style={[styles.heroDateText, { color: palette.green }]}>
      پایان: {dayEndDateText}
    </Text>
  ) : null}
</View>


            <View
              style={[
                styles.iconCircle,
                {
                  backgroundColor: palette.goldSoft,
                  borderColor: "rgba(212,175,55,.26)",
                },
              ]}
            >
              <Ionicons
                name="trail-sign-outline"
                size={22}
                color={palette.gold}
              />
            </View>
          </View>

          <Text style={[styles.heroEyebrow, { color: palette.gold }]}>
            مرحله درمانی ققنوس
          </Text>

          <Text style={[styles.heroTitle, { color: palette.text }]}>
            {currentDayTitle}
          </Text>

          <Text style={[styles.heroDesc, { color: palette.sub }]}>
            {dayDescription}
          </Text>

          <View style={styles.progressWrap}>
            <View style={styles.progressTopRow}>
              <Text style={[styles.progressPercent, { color: palette.text }]}>
                {safeCompletionPercent}%
              </Text>
              <Text style={[styles.progressLabel, { color: palette.sub2 }]}>
                پیشرفت امروز
              </Text>
            </View>

            <View
              style={[
                styles.progressTrack,
                { backgroundColor: palette.track },
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${safeCompletionPercent}%`,
                    backgroundColor: progressColor,
                  },
                ]}
              />
            </View>

            <Text style={[styles.progressText, { color: palette.sub2 }]}>
              {requiredDone} از {requiredTotal} تمرین ضروری انجام شده
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.summaryCard,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: palette.text }]}>
              {earnedXp}
            </Text>
            <Text style={[styles.summaryLabel, { color: palette.sub2 }]}>
              امتیاز امروز
            </Text>
          </View>

          <View
            style={[
              styles.summaryDivider,
              { backgroundColor: palette.border },
            ]}
          />

          <View style={styles.summaryItem}>
  <Text style={[styles.summaryValue, { color: palette.text }]}>
    {doneTasksCount}
  </Text>
  <Text style={[styles.summaryLabel, { color: palette.sub2 }]}>
    انجام‌شده
  </Text>
</View>

          <View
            style={[
              styles.summaryDivider,
              { backgroundColor: palette.border },
            ]}
          />

          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: palette.text }]}>
              {tasks.length}
            </Text>
            <Text style={[styles.summaryLabel, { color: palette.sub2 }]}>
              تمرین امروز
            </Text>
          </View>
        </View>

        {shouldShowResetDayButton ? (
          <TouchableOpacity
            activeOpacity={0.9}
            disabled={resettingDay}
            style={[
              styles.resetDayButton,
              {
                backgroundColor: palette.redSoft,
                borderColor: "rgba(239,68,68,.34)",
                opacity: resettingDay ? 0.65 : 1,
              },
            ]}
            onPress={() => setResetConfirmVisible(true)}
          >
            {resettingDay ? (
              <ActivityIndicator size="small" color={palette.red} />
            ) : (
              <Ionicons name="refresh-outline" size={18} color={palette.red} />
            )}

            <Text style={[styles.resetDayButtonText, { color: palette.red }]}>
              ریست کردن روز
            </Text>
          </TouchableOpacity>
        ) : null}


        <View style={styles.sectionHead}>
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              پلکان امروز
            </Text>

            <View
              style={[
                styles.sectionIcon,
                {
                  backgroundColor: palette.goldSoft,
                  borderColor: "rgba(212,175,55,.22)",
                },
              ]}
            >
              <Ionicons
                name="footsteps-outline"
                size={16}
                color={palette.gold}
              />
            </View>
          </View>

          <Text style={[styles.sectionSub, { color: palette.sub2 }]}>
            هر تمرین یک پله کوچیکه؛ لازم نیست بدویی، فقط جا نزن.
          </Text>
        </View>

        {tasks.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <Ionicons name="file-tray-outline" size={24} color={palette.sub2} />
            <Text style={[styles.emptyText, { color: palette.sub }]}>
              فعلاً تسکی برای این روز دریافت نشد.
            </Text>
          </View>
        ) : (
          <View style={styles.stairList}>
            <View
              pointerEvents="none"
              style={[styles.pathLine, { backgroundColor: palette.line }]}
            />

            {tasks.map((task, index) => {
              const title =
                task.titleFa || task.title || task.code || "تسک بدون عنوان";

              const isDone = !!task.isDone;
              const suggestedTime = task.suggestedTimeFa || "در طول روز";

              const offsetStyle =
                index % 2 === 0 ? styles.taskOffsetRight : styles.taskOffsetLeft;

              return (
                <View key={String(task.id)} style={styles.taskBlock}>
                  <Link
  href={{
    pathname: "/pelekan/gosastan/[code]",
    params: {
      code: String(task.code),
      dayCode: String(data?.currentDay?.id || ""),
      dayNumber: String(safeDayNumber),
      taskId: String(task.id),
      titleFa: String(task.titleFa || task.title || ""),
      description: String(task.description || ""),
      isDone: String(!!task.isDone),
      isRequired: String(!!task.isRequired),
      suggestedTimeFa: String(task.suggestedTimeFa || ""),
      noContactCurrentDays:
  task.noContactStreak?.currentDays != null
    ? String(task.noContactStreak.currentDays)
    : "",
noContactBestDays:
  task.noContactStreak?.bestDays != null
    ? String(task.noContactStreak.bestDays)
    : "",
noContactWarningState: task.noContactStreak?.warningState || "",
noContactViolationCount:
  task.noContactStreak?.violationCount != null
    ? String(task.noContactStreak.violationCount)
    : "",
noContactResetCount:
  task.noContactStreak?.resetCount != null
    ? String(task.noContactStreak.resetCount)
    : "",

    },
  }}
  asChild
>
                    <TouchableOpacity
                      activeOpacity={0.9}
                      style={[
                        styles.taskCard,
                        offsetStyle,
                        {
                          backgroundColor: isDone
                            ? "rgba(10,35,25,.82)"
                            : palette.card,
                          borderColor: isDone
                            ? "rgba(134,239,172,.28)"
                            : palette.border,
                        },
                      ]}
                    >
                      <View style={styles.taskTopRow}>
                        <View
                          style={[
                            styles.stepBadge,
                            {
                              backgroundColor: palette.stepGlass,
                              borderColor: "rgba(212,175,55,.34)",
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.stepBadgeInner,
                              { backgroundColor: palette.stepInner },
                            ]}
                          >
                            {isDone ? (
                              <Ionicons
                                name="checkmark"
                                size={15}
                                color={palette.green}
                              />
                            ) : (
                              <Text
                                style={[
                                  styles.stepNumber,
                                  { color: "#F8E7A1" },
                                ]}
                              >
                                {String(index + 1).padStart(2, "0")}
                              </Text>
                            )}
                          </View>
                        </View>

                        <View style={styles.taskTextBox}>
                          <Text
                            style={[styles.taskTitle, { color: palette.text }]}
                          >
                            {title}
                          </Text>

                          <Text
  style={[styles.taskHint, { color: palette.sub2 }]}
  numberOfLines={1}
>
  زمان پیشنهادی: {suggestedTime}
  {typeof task.xpReward === "number"
    ? `  •  XP ${task.xpReward}`
    : ""}
</Text>
                        </View>

                        <View
                          style={[
                            styles.chevronBox,
                            {
                              backgroundColor: "rgba(255,255,255,.045)",
                              borderColor: palette.border,
                            },
                          ]}
                        >
                          <Ionicons
                            name="chevron-back"
                            size={18}
                            color={palette.sub}
                          />
                        </View>
                      </View>

                      {!!task.description && (
                        <Text
                          style={[styles.taskDesc, { color: palette.sub }]}
                          numberOfLines={2}
                        >
                          {task.description}
                        </Text>
                      )}

                      <View style={styles.taskBottomRow}>
                        <View
                          style={[
                            styles.doneBadge,
                            {
                              backgroundColor: isDone
                                ? palette.greenSoft
                                : palette.orangeSoft,
                              borderColor: isDone
                                ? "rgba(134,239,172,.34)"
                                : "rgba(233,138,21,.34)",
                            },
                          ]}
                        >
                          <Ionicons
                            name={
                              isDone ? "checkmark-circle" : "ellipse-outline"
                            }
                            size={13}
                            color={isDone ? palette.green : palette.orange}
                          />
                          <Text
                            style={[
                              styles.doneBadgeText,
                              {
                                color: isDone ? palette.green : palette.orange,
                              },
                            ]}
                          >
                            {isDone ? "انجام‌شده" : "انجام‌نشده"}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.metaPill,
                            {
  backgroundColor: isDone
    ? palette.greenSoft
    : task.isRequired
    ? palette.redSoft
    : "rgba(255,255,255,.04)",
  borderColor: isDone
    ? "rgba(134,239,172,.34)"
    : task.isRequired
    ? "rgba(239,68,68,.34)"
    : palette.border,
}
                          ]}
                        >
                          <Text
  style={[
    styles.metaPillText,
    {
      color: isDone
        ? palette.green
        : task.isRequired
        ? palette.red
        : palette.sub,
    },
  ]}
  numberOfLines={1}
>
  {isDone
    ? getDoneMotivationMessage(task.id)
    : task.isRequired
    ? "ضروری"
    : "اختیاری"}
</Text>

                        </View>
                      </View>
                    </TouchableOpacity>
                  </Link>

                  {index < tasks.length - 1 ? (
                    <View
                      style={[
                        styles.taskSeparator,
                        { backgroundColor: palette.separator },
                      ]}
                    />
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
            </ScrollView>

      <Modal
        visible={resetConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setResetConfirmVisible(false)}
      >
        <View style={styles.confirmBackdrop}>
          <View
            style={[
              styles.confirmCard,
              {
                backgroundColor: palette.cardStrong,
                borderColor: palette.border2,
              },
            ]}
          >
            <View style={styles.confirmIconWrap}>
              <Ionicons name="warning-outline" size={28} color={palette.red} />
            </View>

            <Text style={[styles.confirmTitle, { color: palette.text }]}>
              هشدار
            </Text>

            <Text style={[styles.confirmMessage, { color: palette.sub }]}>
             با ریست کردن، وضعیت انجام اقدامات، نوشته‌ها، پاسخ‌های ذخیره‌شده و نمره نمودار این روز پاک می‌شه و این کار غیر قابل برگشته.
            </Text>

            <View style={styles.confirmActions}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={[
                  styles.confirmCancelButton,
                  { borderColor: palette.border2 },
                ]}
                onPress={() => setResetConfirmVisible(false)}
              >
                <Text style={[styles.confirmCancelText, { color: palette.text }]}>
                  منصرف شدم
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                disabled={resettingDay}
                style={[
                  styles.confirmResetButton,
                  {
                    backgroundColor: palette.redSoft,
                    borderColor: "rgba(239,68,68,.34)",
                    opacity: resettingDay ? 0.65 : 1,
                  },
                ]}
                onPress={handleResetDay}
              >
                {resettingDay ? (
                  <ActivityIndicator size="small" color={palette.red} />
                ) : (
                  <Text style={[styles.confirmResetText, { color: palette.red }]}>
                    بله، ریست کن
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <AppBannerModal
        visible={bannerVisible}
        kind={bannerKind}
        title={bannerTitle}
        message={bannerMessage}
        onClose={() => setBannerVisible(false)}
      />
    </SafeAreaView> 
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  glowTop: {
    position: "absolute",
    top: -80,
    left: -90,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: "rgba(212,175,55,.14)",
  },

  glowBottom: {
    position: "absolute",
    bottom: -90,
    right: -100,
    width: 330,
    height: 330,
    borderRadius: 999,
    backgroundColor: "rgba(233,138,21,.105)",
  },

  softGrid: {
    position: "absolute",
    top: 120,
    right: -40,
    width: 160,
    height: 360,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,.018)",
    transform: [{ rotate: "-18deg" }],
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  loadingText: {
    marginTop: 10,
    fontSize: 12,
    textAlign: "center",
  },

  errorTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },

  errorText: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 21,
    textAlign: "center",
    writingDirection: "rtl",
  },

  headerRow: {
    marginTop: 4,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
    justifyContent: "space-between",
  },

  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginLeft: "auto",
  },

  headerTextBox: {
  position: "absolute",
  left: 0,
  right: 0,
  alignItems: "center",
  },

  stageTitle: {
    fontSize: 23,
    fontWeight: "900",
    textAlign: "center",
    writingDirection: "rtl",
    letterSpacing: -0.3,
  },

  dayTitle: {
    marginTop: 4,
    fontSize: 13,
    textAlign: "right",
    writingDirection: "rtl",
  },

  heroCard: {
    marginTop: 18,
    borderRadius: 28,
    borderWidth: 1,
    padding: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },

  heroDecorOne: {
    position: "absolute",
    top: -45,
    right: -35,
    width: 130,
    height: 130,
    borderRadius: 999,
    backgroundColor: "rgba(212,175,55,.11)",
  },

  heroDecorTwo: {
    position: "absolute",
    bottom: -55,
    left: -35,
    width: 150,
    height: 150,
    borderRadius: 999,
    backgroundColor: "rgba(233,138,21,.08)",
  },

  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  statusBadge: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 7,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },

  statusBadgeText: {
    fontSize: 11,
    fontWeight: "900",
  },

  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  heroEyebrow: {
    marginTop: 18,
    fontSize: 11,
    fontWeight: "900",
    textAlign: "right",
    writingDirection: "rtl",
  },

  heroTitle: {
    marginTop: 7,
    fontSize: 22,
    fontWeight: "900",
    textAlign: "right",
    writingDirection: "rtl",
    letterSpacing: -0.4,
  },

  heroDesc: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 22,
    textAlign: "right",
    writingDirection: "rtl",
  },

  progressWrap: {
    marginTop: 20,
  },

  progressTopRow: {
    marginBottom: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  progressPercent: {
    fontSize: 13,
    fontWeight: "900",
  },

  progressLabel: {
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
    writingDirection: "rtl",
  },

  progressTrack: {
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: 999,
  },

  progressText: {
    marginTop: 9,
    fontSize: 12,
    textAlign: "right",
    writingDirection: "rtl",
  },

  summaryCard: {
    marginTop: 14,
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  summaryItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  summaryValue: {
    fontSize: 18,
    fontWeight: "900",
  },

  summaryLabel: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: "700",
  },

  summaryDivider: {
    width: 1,
    height: 34,
    opacity: 0.8,
  },

    resetDayButton: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 13,
    paddingHorizontal: 14,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 8,
  },

  resetDayButtonText: {
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
    writingDirection: "rtl",
  },


  sectionHead: {
    marginTop: 24,
    marginBottom: 13,
  },

  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    columnGap: 9,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: "900",
    textAlign: "right",
    writingDirection: "rtl",
  },

  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  sectionSub: {
    marginTop: 7,
    fontSize: 12,
    lineHeight: 19,
    textAlign: "right",
    writingDirection: "rtl",
  },

  emptyCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
    rowGap: 10,
  },

  emptyText: {
    fontSize: 13,
    textAlign: "center",
    writingDirection: "rtl",
  },

  stairList: {
    position: "relative",
    paddingTop: 2,
  },

  pathLine: {
    position: "absolute",
    top: 10,
    bottom: 18,
    right: 21,
    width: 2,
    borderRadius: 999,
  },

  taskBlock: {
    marginBottom: 6,
  },

  taskCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },

  taskSeparator: {
    height: 1,
    marginTop: 10,
    marginBottom: 4,
    marginHorizontal: 18,
    borderRadius: 999,
  },

  taskOffsetRight: {
    marginLeft: 10,
    marginRight: 0,
  },

  taskOffsetLeft: {
    marginLeft: 0,
    marginRight: 14,
  },

  taskTopRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    columnGap: 11,
  },

  stepBadge: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },

  stepBadgeInner: {
    width: "100%",
    height: "100%",
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },

  stepNumber: {
    fontSize: 13,
    fontWeight: "900",
  },

  taskTextBox: {
    flex: 1,
  },

  taskTitle: {
    fontSize: 15,
    fontWeight: "900",
    textAlign: "right",
    writingDirection: "rtl",
    lineHeight: 22,
  },

  taskHint: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "right",
    writingDirection: "rtl",
  },

  chevronBox: {
    width: 34,
    height: 34,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  taskDesc: {
    marginTop: 11,
    fontSize: 12,
    lineHeight: 20,
    textAlign: "right",
    writingDirection: "rtl",
  },

  taskBottomRow: {
  marginTop: 13,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  columnGap: 10,
},

  doneBadge: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    columnGap: 6,
  },

  doneBadgeText: {
    fontSize: 10,
    fontWeight: "900",
  },

  metaPill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },

  metaPillText: {
    fontSize: 10,
    fontWeight: "900",
  },

  btn: {
    marginTop: 18,
    minWidth: 150,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    columnGap: 10,
    borderWidth: 1,
  },

  btnSecondary: {
    backgroundColor: "rgba(255,255,255,.06)",
  },

  btnGhost: {
    backgroundColor: "transparent",
  },

  btnText: {
    fontSize: 14,
    fontWeight: "900",
  },
  heroStatusMeta: {
  flex: 1,
  marginHorizontal: 10,
  alignItems: "flex-end",
},

heroDateText: {
  fontSize: 11,
  fontWeight: "700",
  textAlign: "right",
  writingDirection: "rtl",
  marginTop: 2,
},
  confirmBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },

  confirmCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
  },

  confirmIconWrap: {
    alignSelf: "center",
    width: 54,
    height: 54,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239,68,68,.12)",
    marginBottom: 12,
  },

  confirmTitle: {
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
    writingDirection: "rtl",
  },

  confirmMessage: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 22,
    textAlign: "center",
    writingDirection: "rtl",
  },

  confirmActions: {
    marginTop: 18,
    flexDirection: "row-reverse",
    columnGap: 10,
  },

  confirmCancelButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,.04)",
  },

  confirmResetButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  confirmCancelText: {
    fontSize: 13,
    fontWeight: "900",
  },

  confirmResetText: {
    fontSize: 13,
    fontWeight: "900",
  },
});
