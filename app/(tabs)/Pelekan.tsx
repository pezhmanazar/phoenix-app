// app/(tabs)/Pelekan.tsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
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
  ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import { useUser } from "../../hooks/useUser";
import { getPlanStatus, PRO_FLAG_KEY } from "../../lib/plan";
import PlanStatusBadge from "../../components/PlanStatusBadge";

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
  const { dark } = useTheme();
  const insets = useSafeAreaInsets();
  const { me } = useUser();

  const [progress, setProgress] = useState<Progress>(defaultProgress);
  const [loading, setLoading] = useState(true);

  const [planView, setPlanView] = useState<PlanView>("free");

  // مودال برای FREE / EXPIRED
  const [planInfoModal, setPlanInfoModal] = useState<null | "free" | "expired">(null);

  const isProPlan = planView === "pro" || planView === "expiring";

  const computePlanView = useCallback(
    async (includeProgress: boolean) => {
      try {
        const flag = await AsyncStorage.getItem(PRO_FLAG_KEY);
        const status = getPlanStatus(me);
        const flagIsPro = flag === "1";

        let view: PlanView = "free";

        if (status.rawExpiresAt) {
          if (status.isExpired) {
            view = "expired";
          } else if (status.isPro || flagIsPro) {
            const d = typeof status.daysLeft === "number" ? status.daysLeft : null;
            if (d != null && d > 0 && d <= 7) view = "expiring";
            else view = "pro";
          } else {
            view = "free";
          }
        } else {
          if (status.isPro || flagIsPro) view = "pro";
          else view = "free";
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
          setProgress({ ...base, isPro: finalIsPro });
        } else {
          setProgress((prev) => ({ ...prev, isPro: finalIsPro }));
        }

        setPlanView(view);
      } catch {
        if (includeProgress) setProgress(defaultProgress);
        setPlanView("free");
      } finally {
        if (includeProgress) setLoading(false);
      }
    },
    [me]
  );

  useEffect(() => {
    computePlanView(true);
  }, [computePlanView]);

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

  // ✅ پالت جدید: نودها «مات و تیره» (نه شیشه‌ای) تا روی مسیر گم نشن
  const palette = {
    bg: "#0b0f14",
    text: "#F9FAFB",
    border: "rgba(255,255,255,.10)",
    glassCard: "rgba(3,7,18,.92)",

    pathIdle: "rgba(226,232,240,.55)",
    pathDone: "rgba(34,197,94,.75)",

    node: {
      availableBg: "#0B0F14",          // ✅ مات و تیره
      availableBorder: "rgba(212,175,55,.55)",
      availableIcon: "#D4AF37",
      availableLabel: "#F9FAFB",

      lockedBg: "#0B0F14",            // ✅ مات و تیره
      lockedBorder: "rgba(231,238,247,.22)",
      lockedIcon: "rgba(231,238,247,.55)",
      lockedLabel: "rgba(231,238,247,.55)",

      doneBg: "#22C55E",
      doneBorder: "#16A34A",
      doneIcon: "#FFFFFF",
      doneLabel: "#FFFFFF",
    },

    stepGlass: {
      bg: "rgba(255,255,255,.04)",
      border: "rgba(255,255,255,.10)",
      text: "#F9FAFB",
    },
    stepIcon: {
      step1: "#E98A15",
      step2: "#4ADE80",
      step3: "#60A5FA",
      default: "rgba(231,238,247,.70)",
    },
    startFlag: {
      bg: "rgba(255,255,255,.04)",
      border: "rgba(255,255,255,.10)",
      text: "#F9FAFB",
      icon: "#D4AF37",
    },
  };

  const stepStyle = (stepId: string) => {
    const iconColor =
      stepId === "step1"
        ? palette.stepIcon.step1
        : stepId === "step2"
        ? palette.stepIcon.step2
        : stepId === "step3"
        ? palette.stepIcon.step3
        : palette.stepIcon.default;

    const icon =
      stepId === "step1"
        ? ("flame" as const)
        : stepId === "step2"
        ? ("leaf" as const)
        : stepId === "step3"
        ? ("cloud" as const)
        : ("ellipse-outline" as const);

    return {
      bg: palette.stepGlass.bg,
      border: palette.stepGlass.border,
      text: palette.stepGlass.text,
      icon,
      iconColor,
    };
  };

  const pathItems = useMemo(() => {
    const items: Array<
      | { kind: "start"; id: string }
      | { kind: "header"; id: string; title: string; stepId: string }
      | { kind: "day"; id: string; stepIdx: number; dayIdx: number; zig: "L" | "R" }
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
        items.push({ kind: "day", id: `${STEPS[s].id}-${d}`, stepIdx: s, dayIdx: d, zig });
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

  const isAvailable = (s: number, d: number) => s === progress.stepIndex && d === progress.dayIndex;

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

  const onTapDay = async (s: number, d: number) => {
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
          <View style={{ height: CELL_H * 0.8, width: PATH_W, alignSelf: "center", justifyContent: "center" }}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                if (!isProPlan) {
                  setPlanInfoModal(planView === "expired" ? "expired" : "free");
                  return;
                }
                Alert.alert("تبریک ✨", "پلکان برای تو باز است؛ از روزها شروع کن.");
              }}
              style={{
                alignSelf: "center",
                backgroundColor: palette.startFlag.bg,
                borderColor: palette.startFlag.border,
                borderWidth: 1,
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 16,
                flexDirection: "row-reverse",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Ionicons name="flag" size={20} color={palette.startFlag.icon} />
              <Text style={{ fontWeight: "900", color: palette.startFlag.text }}>
                {planView === "expired" ? "اشتراک منقضی شده" : isProPlan ? "شروع شد" : "شروع (نسخه رایگان)"}
              </Text>
            </TouchableOpacity>
          </View>
        );

      case "header": {
        const s = stepStyle(item.stepId);
        return (
          <View style={{ alignItems: "center", alignSelf: "center", width: PATH_W }}>
            <View style={[styles.stepHeaderCard, { backgroundColor: s.bg, borderColor: s.border }]}>
              <Ionicons name={s.icon} size={18} color={s.iconColor} style={{ marginLeft: 6 }} />
              <Text style={[styles.stepHeaderText, { color: s.text }]}>{item.title}</Text>
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

        const bg = done ? palette.node.doneBg : available ? palette.node.availableBg : palette.node.lockedBg;
        const border = done ? palette.node.doneBorder : available ? palette.node.availableBorder : palette.node.lockedBorder;
        const iconCol = done ? palette.node.doneIcon : available ? palette.node.availableIcon : palette.node.lockedIcon;
        const label = done ? palette.node.doneLabel : available ? palette.node.availableLabel : palette.node.lockedLabel;

        const bottomY = CELL_H;
        const topY = 0;
        const pathD = `
          M ${MID_X} ${bottomY}
          C ${MID_X} ${bottomY - 30}, ${nodeX} ${CELL_H * 0.65}, ${nodeX} ${CELL_H * 0.5}
          C ${nodeX} ${CELL_H * 0.35}, ${MID_X} ${topY + 30}, ${MID_X} ${topY}
        `;

        const NodeWrapper = available ? Pulsing : React.Fragment;

        return (
          <View style={{ height: CELL_H, width: PATH_W, alignSelf: "center" }}>
            <Svg width={PATH_W} height={CELL_H} style={{ position: "absolute" }}>
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
                onPress={() => onTapDay(s, d)}
                style={[
                  styles.node,
                  {
                    left: nodeX - NODE_R,
                    top: CELL_H / 2 - NODE_R,
                    backgroundColor: bg,
                    borderColor: border,
                    elevation: available ? 6 : 0,
                    zIndex: 2,
                    shadowOpacity: dark ? 0.35 : 0.18,
                  },
                ]}
              >
                <Ionicons
                  name={done ? "checkmark-circle" : locked ? "lock-closed-outline" : "star"}
                  size={22}
                  color={iconCol}
                />
                <Text style={[styles.nodeText, { color: label }]}>روز {d + 1}</Text>
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
      <SafeAreaView edges={["top"]} style={[styles.root, { backgroundColor: palette.bg }]}>
        <View pointerEvents="none" style={styles.bgGlowTop} />
        <View pointerEvents="none" style={styles.bgGlowBottom} />
        <View style={styles.center}>
          <ActivityIndicator color="#D4AF37" />
          <Text style={{ color: "#E5E7EB", marginTop: 8, fontSize: 12 }}>در حال بارگذاری…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.bg }]} edges={["top", "left", "right", "bottom"]}>
      <View pointerEvents="none" style={styles.bgGlowTop} />
      <View pointerEvents="none" style={styles.bgGlowBottom} />

      <Header me={me} gems={progress.gems} streak={progress.streak} />

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

      {planInfoModal && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, planInfoModal === "expired" ? styles.modalCardExpired : styles.modalCardFree]}>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", marginBottom: 8 }}>
              <Ionicons
                name={planInfoModal === "expired" ? "time-outline" : "lock-closed-outline"}
                size={22}
                color={planInfoModal === "expired" ? "#F97373" : "#FBBF24"}
                style={{ marginLeft: 6 }}
              />
              <Text style={styles.modalTitle}>
                {planInfoModal === "expired" ? "اشتراک منقضی شده" : "محدودیت دسترسی"}
              </Text>
            </View>

            <Text style={styles.modalBody}>
              {planInfoModal === "expired"
                ? "اشتراک ققنوس تو منقضی شده.\nبرای باز شدن پله‌ها و ادامهٔ مسیر، پلن رو تمدید کن."
                : "در حال حاضر روی نسخهٔ رایگان هستی.\nبرای باز شدن پله‌ها و تمرین‌ها، پلن PRO را فعال کن."}
            </Text>

            <TouchableOpacity activeOpacity={0.85} onPress={() => setPlanInfoModal(null)} style={styles.modalButton}>
              <Text style={styles.modalButtonText}>باشه</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

/* ------------------------------- هدر بالایی ------------------------------ */
/**
 * ✅ دقیقاً همون چیزی که خواستی:
 * - badge سمت چپ
 * - diamond وسط
 * - flame سمت راست
 *
 * نکته: چون RTL هستی، اگر flexDirection="row" باشه، آیتم اول میره چپ.
 */
function Header({ me, gems, streak }: { me: any; gems: number; streak: number }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.topBar, { paddingTop: Math.max(10, insets.top * 0.15) }]}>
      {/* ✅ LEFT: Badge */}
      <View style={[styles.topCol, styles.colLeft]}>
        <PlanStatusBadge me={me} showExpiringText />
      </View>

      {/* ✅ CENTER: Diamond */}
      <View style={[styles.topCol, styles.colCenter]}>
        <View style={styles.iconStatRow}>
          <Ionicons name="diamond" size={18} color="#60A5FA" />
          <Text style={styles.topText}>{gems}</Text>
        </View>
      </View>

      {/* ✅ RIGHT: Flame */}
      <View style={[styles.topCol, styles.colRight]}>
        <View style={styles.iconStatRow}>
          <Ionicons name="flame" size={18} color="#E98A15" />
          <Text style={styles.topText}>{streak}</Text>
        </View>
      </View>
    </View>
  );
}

/* -------------------------------- استایل‌ها -------------------------------- */
const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

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

  // ✅ هدر شیشه‌ای
  topBar: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(3,7,18,.92)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",          // ✅ مهم: با RTL، ترتیب 1→چپ، 3→راست
    alignItems: "center",
    justifyContent: "space-between",
  },
  topCol: {
    flex: 1,
    minHeight: 28,
  },
  colLeft: { alignItems: "flex-start", justifyContent: "center" },
  colCenter: { alignItems: "center", justifyContent: "center" },
  colRight: { alignItems: "flex-end", justifyContent: "center" },

  iconStatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  topText: { fontWeight: "900", color: "#F9FAFB" },

  // ✅ هدر هر پله شیشه‌ای
  stepHeaderCard: {
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,.04)",
    borderColor: "rgba(255,255,255,.10)",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  stepHeaderText: { fontWeight: "900", fontSize: 16 },

  // ✅ نودها مات و قابل‌دیدن
  node: {
    position: "absolute",
    width: NODE_R * 2,
    height: NODE_R * 2,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  nodeText: {
    position: "absolute",
    bottom: -22,
    fontSize: 12,
    fontWeight: "900",
  },

  // مودال
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