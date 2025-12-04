// app/(tabs)/Pelekan.tsx
import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Animated,
  Easing,
  Alert,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useTheme, useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import { useUser } from "../../hooks/useUser";
import { getPlanStatus, PRO_FLAG_KEY } from "../../lib/plan";

/* --------------------------- مدل و دادهٔ اولیه --------------------------- */
type StepDef = { id: string; title: string; days: number };

const STEPS: StepDef[] = [
  { id: "step0", title: "پله صفر", days: 0 },
  { id: "step1", title: "پله اول: سوختن", days: 9 },
  { id: "step2", title: "پله دوم: زیستن", days: 9 },
  { id: "step3", title: "پله سوم: رستن", days: 9 },
];

type Progress = {
  stepIndex: number;
  dayIndex: number;
  gems: number;
  streak: number;
  isPro: boolean;
};

type PlanView = "free" | "pro" | "expired" | "expiring";

const PROGRESS_KEY = "Pelekan.progress.v1";

/** پیش‌فرض */
const defaultProgress: Progress = {
  stepIndex: 1,
  dayIndex: 1,
  gems: 0,
  streak: 1,
  isPro: false,
};

/* ----------------------------- تنظیمات نمایشی ---------------------------- */
const { width: SCREEN_W } = Dimensions.get("window");
const CELL_H = 120;
const PATH_W = SCREEN_W - 32;
const MID_X = PATH_W / 2;
const NODE_X_LEFT = 70;
const NODE_X_RIGHT = PATH_W - 70;
const NODE_R = 28;

/* --------------------- کمک‌کامپوننت: پالس برای روز فعال --------------------- */
function Pulsing({
  children,
  playing = false,
}: {
  children: React.ReactNode;
  playing?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!playing) {
      scale.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.08,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1.0,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [playing, scale]);

  return <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>;
}

/* ------------------------------- صفحه اصلی ------------------------------- */
export default function PelekanScreen() {
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const { me } = useUser();

  const [progress, setProgress] = useState<Progress>(defaultProgress);
  const [loading, setLoading] = useState(true);

  const [planView, setPlanView] = useState<PlanView>("free");
  const [expiringDaysLeft, setExpiringDaysLeft] = useState<number | null>(null);

  // مودال قشنگ برای FREE / EXPIRED
  const [planInfoModal, setPlanInfoModal] = useState<null | "free" | "expired">(
    null
  );

  const isProPlan = planView === "pro" || planView === "expiring";

  const computePlanView = useCallback(
    async (includeProgress: boolean) => {
      try {
        const flag = await AsyncStorage.getItem(PRO_FLAG_KEY);
        const status = getPlanStatus(me);
        const flagIsPro = flag === "1";

        let view: PlanView = "free";
        let expDays: number | null = null;

        if (status.rawExpiresAt) {
          if (status.isExpired) {
            view = "expired";
            expDays = 0;
          } else if (status.isPro || flagIsPro) {
            const d =
              typeof status.daysLeft === "number" ? status.daysLeft : null;
            if (d != null && d > 0 && d <= 7) {
              view = "expiring";
              expDays = d;
            } else {
              view = "pro";
              expDays = d;
            }
          } else {
            view = "free";
          }
        } else {
          if (status.isPro || flagIsPro) {
            view = "pro";
          } else {
            view = "free";
          }
        }

        const finalIsPro = view === "pro" || view === "expiring";

        if (includeProgress) {
          const rawProgress = await AsyncStorage.getItem(PROGRESS_KEY);
          let base: Progress = defaultProgress;
          if (rawProgress) {
            try {
              base = { ...defaultProgress, ...JSON.parse(rawProgress) };
            } catch {
              base = defaultProgress;
            }
          }
          const merged: Progress = {
            ...base,
            isPro: finalIsPro,
          };
          setProgress(merged);
        } else {
          setProgress((prev) => ({ ...prev, isPro: finalIsPro }));
        }

        setPlanView(view);
        setExpiringDaysLeft(expDays);
      } catch {
        if (includeProgress) {
          setProgress(defaultProgress);
        }
        setPlanView("free");
        setExpiringDaysLeft(null);
      } finally {
        if (includeProgress) setLoading(false);
      }
    },
    [me]
  );

  // بارگذاری اولیه: پروگرس + وضعیت پلن
  useEffect(() => {
    computePlanView(true);
  }, [computePlanView]);

  // هر بار تب فوکوس شد: فقط وضعیت پلن را تازه کن
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        await computePlanView(false);
        if (cancelled) return;
      })();
      return () => {
        cancelled = true;
      };
    }, [computePlanView])
  );

  const persist = useCallback(async (p: Progress) => {
    setProgress(p);
    await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  }, []);

  // پالت تطبیقی روشن/تاریک
  const palette = {
    bg: colors.background,
    card: colors.card,
    text: colors.text,
    border: colors.border,
    pathIdle: dark ? "#334155" : "#CBD5E1",
    pathDone: dark ? "#0EA5E955" : "#A7F3D0",
    node: {
      availableBg: dark ? "#0B1220" : "#FFFFFF",
      availableBorder: dark ? "#334155" : "#CBD5E1",
      availableIcon: dark ? "#60A5FA" : "#2563EB",
      availableLabel: dark ? "#E5E7EB" : "#111827",
      lockedBg: dark ? "#1F2937" : "#E5E7EB",
      lockedBorder: dark ? "#374151" : "#D1D5DB",
      lockedIcon: dark ? "#94A3B8" : "#9CA3AF",
      lockedLabel: dark ? "#9CA3AF" : "#6B7280",
      doneBg: "#22C55E",
      doneBorder: "#16A34A",
      doneIcon: "#FFFFFF",
      doneLabel: "#FFFFFF",
    },
    // هدر پله‌ها
    step1: dark
      ? {
          bg: "#3B2A1D",
          border: "#6B4E2E",
          text: "#FDE68A",
          icon: "flame" as const,
          iconColor: "#FBBF24",
        }
      : {
          bg: "#FFEAD5",
          border: "#FDBA74",
          text: "#7C2D12",
          icon: "flame" as const,
          iconColor: "#EA580C",
        },
    step2: dark
      ? {
          bg: "#102A17",
          border: "#14532D",
          text: "#BBF7D0",
          icon: "leaf" as const,
          iconColor: "#22C55E",
        }
      : {
          bg: "#DCFCE7",
          border: "#86EFAC",
          text: "#065F46",
          icon: "leaf" as const,
          iconColor: "#16A34A",
        },
    step3: dark
      ? {
          bg: "#0F223A",
          border: "#1E3A8A",
          text: "#BFDBFE",
          icon: "cloud" as const,
          iconColor: "#60A5FA",
        }
      : {
          bg: "#DBEAFE",
          border: "#93C5FD",
          text: "#1E3A8A",
          icon: "cloud" as const,
          iconColor: "#2563EB",
        },
    startFlag: dark
      ? { bg: "#3F2D1C", border: "#F59E0B55", text: "#FDE68A", icon: "#FBBF24" }
      : { bg: "#FEF3C7", border: "#FCD34D", text: "#92400E", icon: "#F59E0B" },
  };

  // سبک گرافیکی برای هدر هر پله
  const stepStyle = (stepId: string) => {
    switch (stepId) {
      case "step1":
        return palette.step1;
      case "step2":
        return palette.step2;
      case "step3":
        return palette.step3;
      default:
        return {
          bg: palette.card,
          border: palette.border,
          text: palette.text,
          icon: "ellipse-outline" as const,
          iconColor: dark ? "#9CA3AF" : "#6B7280",
        };
    }
  };

  // آیتم‌های مسیر
  const pathItems = useMemo(() => {
    const items: Array<
      | { kind: "start"; id: string }
      | { kind: "header"; id: string; title: string; stepId: string }
      | {
          kind: "day";
          id: string;
          stepIdx: number;
          dayIdx: number;
          zig: "L" | "R";
        }
      | { kind: "spacer"; id: string }
    > = [];

    items.push({ kind: "start", id: "start-flag" });
    items.push({ kind: "spacer", id: "sp-0" });

    let counter = 0;
    for (let s = 1; s < STEPS.length; s++) {
      items.push({
        kind: "header",
        id: `${STEPS[s].id}-h`,
        title: STEPS[s].title,
        stepId: STEPS[s].id,
      });
      for (let d = 0; d < STEPS[s].days; d++) {
        const zig = counter++ % 2 === 0 ? "L" : "R";
        items.push({
          kind: "day",
          id: `${STEPS[s].id}-${d}`,
          stepIdx: s,
          dayIdx: d,
          zig,
        });
      }
      items.push({ kind: "spacer", id: `sp-${s}` });
    }
    return items;
  }, []);

  const isCompleted = (s: number, d: number) => {
    if (s < progress.stepIndex) return true;
    if (s > progress.stepIndex) return false;
    return d < progress.dayIndex;
  };

  const isAvailable = (s: number, d: number) =>
    s === progress.stepIndex && d === progress.dayIndex;

  const handleCompleteToday = async () => {
    let { stepIndex, dayIndex, gems, streak, isPro } = progress;
    const curStep = STEPS[stepIndex];
    const nextDay = dayIndex + 1;

    if (nextDay >= curStep.days) {
      stepIndex = Math.min(stepIndex + 1, STEPS.length - 1);
      dayIndex = 0;
    } else {
      dayIndex = nextDay;
    }

    gems += 3;
    streak = Math.min(999, streak + 1);
    await persist({ stepIndex, dayIndex, gems, streak, isPro });
  };

  const onTapDay = async (
    s: number,
    d: number,
    done: boolean,
    available: boolean
  ) => {
    if (!isProPlan) {
      setPlanInfoModal(planView === "expired" ? "expired" : "free");
      return;
    }
    await handleCompleteToday();
  };

  const renderItem = ({ item }: { item: any }) => {
    switch (item.kind) {
      case "start":
        return (
          <View
            style={{
              height: CELL_H * 0.8,
              width: PATH_W,
              alignSelf: "center",
              justifyContent: "center",
            }}
          >
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                if (!isProPlan) {
                  setPlanInfoModal(
                    planView === "expired" ? "expired" : "free"
                  );
                  return;
                } else {
                  Alert.alert(
                    "تبریک ✨",
                    "پلکان برای تو باز است؛ از روزها شروع کن."
                  );
                }
              }}
              style={{
                alignSelf: "center",
                backgroundColor: palette.startFlag.bg,
                borderColor: palette.startFlag.border,
                borderWidth: 2,
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 16,
                flexDirection: "row-reverse",
                alignItems: "center",
                gap: 8,
                shadowColor: "#000",
                shadowOpacity: 0.06,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
              }}
            >
              <Ionicons name="flag" size={20} color={palette.startFlag.icon} />
              <Text
                style={{ fontWeight: "900", color: palette.startFlag.text }}
              >
                {planView === "expired"
                  ? "اشتراک منقضی شده"
                  : isProPlan
                  ? "شروع شد"
                  : "شروع (نسخه رایگان)"}
              </Text>
            </TouchableOpacity>
          </View>
        );

      case "header": {
        const s = stepStyle(item.stepId);
        return (
          <View
            style={{
              alignItems: "center",
              alignSelf: "center",
              width: PATH_W,
            }}
          >
            <View
              style={[
                styles.stepHeaderCard,
                { backgroundColor: s.bg, borderColor: s.border },
              ]}
            >
              <Ionicons
                name={s.icon}
                size={18}
                color={s.iconColor}
                style={{ marginLeft: 6 }}
              />
              <Text style={[styles.stepHeaderText, { color: s.text }]}>
                {item.title}
              </Text>
            </View>
            <View
              style={{
                width: 64,
                height: 10,
                backgroundColor: s.bg,
                borderBottomLeftRadius: 12,
                borderBottomRightRadius: 12,
                borderWidth: 1,
                borderTopWidth: 0,
                borderColor: s.border,
                marginTop: -2,
              }}
            />
          </View>
        );
      }

      case "spacer":
        return <View style={{ height: 10 }} />;

      case "day": {
        const s = item.stepIdx;
        const d = item.dayIdx;
        const done = isCompleted(s, d);
        const available = isAvailable(s, d);
        const locked = !done && !available;

        const nodeX = item.zig === "L" ? NODE_X_LEFT : NODE_X_RIGHT;

        const bg = done
          ? palette.node.doneBg
          : available
          ? palette.node.availableBg
          : palette.node.lockedBg;
        const border = done
          ? palette.node.doneBorder
          : available
          ? palette.node.availableBorder
          : palette.node.lockedBorder;
        const iconCol = done
          ? palette.node.doneIcon
          : available
          ? palette.node.availableIcon
          : palette.node.lockedIcon;
        const label = done
          ? palette.node.doneLabel
          : available
          ? palette.node.availableLabel
          : palette.node.lockedLabel;

        const bottomY = CELL_H;
        const topY = 0;
        const pathD = `
          M ${MID_X} ${bottomY}
          C ${MID_X} ${bottomY - 30}, ${nodeX} ${CELL_H * 0.65}, ${nodeX} ${
          CELL_H * 0.5
        }
          C ${nodeX} ${CELL_H * 0.35}, ${MID_X} ${topY + 30}, ${MID_X} ${topY}
        `;

        const NodeWrapper = available ? Pulsing : React.Fragment;

        return (
          <View
            style={{ height: CELL_H, width: PATH_W, alignSelf: "center" }}
          >
            <Svg
              width={PATH_W}
              height={CELL_H}
              style={{ position: "absolute" }}
            >
              <Path
                d={pathD}
                stroke={done ? palette.pathDone : palette.pathIdle}
                strokeWidth={6}
                fill="none"
                strokeLinecap="round"
              />
            </Svg>

            <NodeWrapper {...(available ? { playing: true } : {})}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => onTapDay(s, d, done, available)}
                style={[
                  styles.node,
                  {
                    left: nodeX - NODE_R,
                    top: CELL_H / 2 - NODE_R,
                    backgroundColor: bg,
                    borderColor: border,
                    elevation: available ? 3 : 0,
                    zIndex: 2,
                    shadowOpacity: dark ? 0.3 : 0.08,
                  },
                ]}
              >
                <Ionicons
                  name={
                    done
                      ? "checkmark-circle"
                      : locked
                      ? "lock-closed-outline"
                      : "star"
                  }
                  size={22}
                  color={iconCol}
                />
                <Text style={[styles.nodeText, { color: label }]}>
                  روز {d + 1}
                </Text>
              </TouchableOpacity>
            </NodeWrapper>
          </View>
        );
      }

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.center, { backgroundColor: colors.background }]}
      >
        <Text style={{ color: colors.text }}>در حال بارگذاری…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: colors.background }]}
      edges={["top", "left", "right", "bottom"]}
    >
      <Header
        planView={planView}
        gems={progress.gems}
        streak={progress.streak}
        expiringDaysLeft={expiringDaysLeft}
      />

      <FlatList
        data={pathItems}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        inverted
        contentContainerStyle={{
          paddingTop: 8,
          paddingBottom: 16 + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      />

      {/* مودال شیک برای حالت FREE / EXPIRED */}
      {planInfoModal && (
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              planInfoModal === "expired"
                ? styles.modalCardExpired
                : styles.modalCardFree,
            ]}
          >
            <View
              style={{
                flexDirection: "row-reverse",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <Ionicons
                name={
                  planInfoModal === "expired"
                    ? "time-outline"
                    : "lock-closed-outline"
                }
                size={22}
                color={planInfoModal === "expired" ? "#F97373" : "#FBBF24"}
                style={{ marginLeft: 6 }}
              />
              <Text style={styles.modalTitle}>
                {planInfoModal === "expired"
                  ? "اشتراک منقضی شده"
                  : "محدودیت دسترسی"}
              </Text>
            </View>

            <Text style={styles.modalBody}>
              {planInfoModal === "expired"
                ? "اشتراک ققنوس تو منقضی شده.\nبرای باز شدن پله‌ها و ادامهٔ مسیر، پلن رو تمدید کن."
                : "در حال حاضر روی نسخهٔ رایگان هستی.\nبرای باز شدن پله‌ها و تمرین‌ها، پلن PRO را فعال کن."}
            </Text>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setPlanInfoModal(null)}
              style={styles.modalButton}
            >
              <Text style={styles.modalButtonText}>باشه</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

/* ------------------------------- هدر بالایی ------------------------------ */
function Header({
  planView,
  gems,
  streak,
  expiringDaysLeft,
}: {
  planView: PlanView;
  gems: number;
  streak: number;
  expiringDaysLeft: number | null;
}) {
  const { colors } = useTheme();

  let badgeBg = "#111827";
  let badgeTextColor = "#E5E7EB";
  let badgeLabel: "FREE" | "PRO" | "EXPIRED" = "FREE";

  if (planView === "pro") {
    badgeBg = "#064E3B";
    badgeTextColor = "#4ADE80";
    badgeLabel = "PRO";
  } else if (planView === "expiring") {
    badgeBg = "#451A03";
    badgeTextColor = "#FBBF24";
    badgeLabel = "PRO";
  } else if (planView === "expired") {
    badgeBg = "#7F1D1D";
    badgeTextColor = "#FCA5A5";
    badgeLabel = "EXPIRED";
  }

  const showExpiring =
    planView === "expiring" &&
    expiringDaysLeft != null &&
    expiringDaysLeft > 0;

  return (
    <View
      style={[
        styles.topBar,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {/* ستون وضعیت پلن (راست) */}
      <View style={[styles.topItem, { justifyContent: "flex-start" }]}>
        <View style={[styles.badge, { backgroundColor: badgeBg }]}>
          <Text
            style={[
              styles.badgeText,
              { color: badgeTextColor },
            ]}
          >
            {badgeLabel}
          </Text>
        </View>
        {showExpiring && (
          <Text style={styles.expiringText}>
            {expiringDaysLeft} روز تا پایان اشتراک
          </Text>
        )}
      </View>

      {/* ستون وسط: الماس – همیشه وسط */}
      <View style={[styles.topItem, { justifyContent: "center" }]}>
        <Ionicons name="diamond" size={18} color="#60A5FA" />
        <Text style={[styles.topText, { color: colors.text }]}> {gems}</Text>
      </View>

      {/* ستون چپ: استریک */}
      <View style={[styles.topItem, { justifyContent: "flex-end" }]}>
        <Ionicons name="flame" size={18} color="#F97316" />
        <Text style={[styles.topText, { color: colors.text }]}>{streak}</Text>
      </View>
    </View>
  );
}

/* -------------------------------- استایل‌ها -------------------------------- */
const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  topBar: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  topItem: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
  },
  topText: { fontWeight: "900" },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontWeight: "900",
    fontSize: 12,
  },
  expiringText: {
    color: "#FBBF24",
    fontWeight: "900",
    fontSize: 11,
  },

  // هدر هر پله
  stepHeaderCard: {
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    alignSelf: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  stepHeaderText: { fontWeight: "900", fontSize: 16 },

  node: {
    position: "absolute",
    width: NODE_R * 2,
    height: NODE_R * 2,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    backgroundColor: "#fff",
  },
  nodeText: {
    position: "absolute",
    bottom: -22,
    fontSize: 12,
    fontWeight: "900",
  },

  // مودال داخلی
  modalOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCard: {
    width: "82%",
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderWidth: 1,
  },
  modalCardFree: {
    backgroundColor: "#020617",
    borderColor: "#1F2937",
  },
  modalCardExpired: {
    backgroundColor: "#111827",
    borderColor: "#7F1D1D",
  },
  modalTitle: {
    color: "#F9FAFB",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "right",
    flex: 1,
  },
  modalBody: {
    color: "#E5E7EB",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "right",
    marginTop: 4,
  },
  modalButton: {
    alignSelf: "flex-start",
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#2563EB",
  },
  modalButtonText: {
    color: "#E5E7EB",
    fontSize: 13,
    fontWeight: "800",
  },
});