// components/pelekan/TreatmentView.tsx
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Dimensions, Easing, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Svg, { Path } from "react-native-svg";

/* ----------------------------- Types ----------------------------- */
export type PlanStatus = "free" | "pro" | "expired" | "expiring";
export type TreatmentAccess = "full" | "frozen_current" | "archive_only";

// ✅ اینجا review رو اضافه کردیم
export type TabState = "idle" | "baseline_assessment" | "choose_path" | "treating" | "review";

export type PelekanTask = {
  id: string;
  titleFa: string;
  description?: string | null;
  sortOrder: number;
  weightPercent: number;
  xpReward: number;
  isRequired: boolean;
};

export type PelekanDay = {
  id: string;
  stageId: string;
  dayNumberInStage: number;
  globalDayNumber: number;
  title: string;
  description?: string | null;
  requiredPercent: number;
  tasks: PelekanTask[];
};

export type PelekanStage = {
  id: string;
  code: string;
  titleFa: string;
  sortOrder: number;
  days: PelekanDay[];
};

export type DayProgressRow = {
  dayId: string;
  status: "active" | "done" | "locked" | "idle" | string;
  completionPercent: number;
  lastActivityAt?: string | null;
  completedAt?: string | null;
  xpEarned?: number | null;
};

export type PelekanState = {
  tabState: TabState;
  user: { planStatus: PlanStatus; daysLeft: number };
  treatmentAccess: TreatmentAccess;
  stages: PelekanStage[];
  progress:
    | {
        activeDayId: string | null;
        dayProgress: DayProgressRow[];
        xpTotal: number;
        streak: { currentDays: number; bestDays: number; lastCompletedAt: string | null };
      }
    | null;
  ui?: any;
  treatment?: any;
};

export type HeaderItem = { kind: "header"; id: string; stage: PelekanStage };
export type DayItem = { kind: "day"; id: string; day: PelekanDay; stage: PelekanStage; zig: "L" | "R" };
export type SpacerItem = { kind: "spacer"; id: string };
export type ListItem = HeaderItem | DayItem | SpacerItem;

type Props = {
  item: ListItem;
  index: number;
  state: PelekanState;
  onTapActiveDay?: (day: PelekanDay) => void;
};

/* ----------------------------- UI Consts ----------------------------- */
const { width: SCREEN_W } = Dimensions.get("window");
const PATH_W = SCREEN_W - 32;
const MID_X = PATH_W / 2;
const NODE_X_LEFT = 70;
const NODE_X_RIGHT = PATH_W - 70;
const NODE_R = 28;
const CELL_H = 120;

const palette = {
  bg: "#0b0f14",
  text: "#F9FAFB",
  pathIdle: "rgba(226,232,240,.55)",
  pathDone: "rgba(34,197,94,.75)",
  node: {
    availableBg: "#0B0F14",
    availableBorder: "rgba(212,175,55,.55)",
    availableIcon: "#D4AF37",
    availableLabel: "#F9FAFB",
    lockedBg: "#0B0F14",
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
    bastan: "#E98A15",
    gosastan: "#FBBF24",
    sookhtan: "#F97316",
    sarashtan: "#60A5FA",
    ziestan: "#4ADE80",
    sakhtan: "#A78BFA",
    rastan: "#F472B6",
    default: "rgba(231,238,247,.70)",
  },
};

function stageIcon(code: string): { name: keyof typeof Ionicons.glyphMap; color: string } {
  const color = (palette.stepIcon as any)[code] ?? palette.stepIcon.default;
  const name =
    code === "bastan"
      ? ("flame" as const)
      : code === "ziestan"
      ? ("leaf" as const)
      : code === "rastan"
      ? ("sparkles" as const)
      : ("ellipse-outline" as const);
  return { name, color };
}

/* ----------------------------- Pulsing ----------------------------- */
function Pulsing({ children, playing }: { children: React.ReactNode; playing: boolean }) {
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

/* ----------------------------- Component (ONE ITEM) ----------------------------- */
export default function TreatmentView({ item, state, onTapActiveDay }: Props) {
  const activeDayId = state.progress?.activeDayId || null;

  const dayProgressMap = useMemo(() => {
    const m = new Map<string, DayProgressRow>();
    const rows = state.progress?.dayProgress || [];
    for (const r of rows) m.set(r.dayId, r);
    return m;
  }, [state.progress?.dayProgress]);

  const access = state.treatmentAccess;
  const canEnterActive = access === "full" || access === "frozen_current";

  const isDone = (dayId: string) => {
    const dp = dayProgressMap.get(dayId);
    if (!dp) return false;
    if (dp.status === "done") return true;
    if (typeof dp.completionPercent === "number" && dp.completionPercent >= 100) return true;
    return false;
  };

  if (item.kind === "spacer") return <View style={{ height: 10 }} />;

  if (item.kind === "header") {
    const { stage } = item;
    const icon = stageIcon(stage.code);
    return (
      <View style={{ alignItems: "center", alignSelf: "center", width: PATH_W }}>
        <View
          style={[
            styles.stepHeaderCard,
            { backgroundColor: palette.stepGlass.bg, borderColor: palette.stepGlass.border },
          ]}
        >
          <Ionicons name={icon.name} size={18} color={icon.color} style={{ marginLeft: 6 }} />
          <Text style={[styles.stepHeaderText, { color: palette.stepGlass.text }]}>{stage.titleFa}</Text>
        </View>

        <View
          style={{
            width: 64,
            height: 10,
            backgroundColor: palette.stepGlass.bg,
            borderBottomLeftRadius: 12,
            borderBottomRightRadius: 12,
            borderWidth: 1,
            borderTopWidth: 0,
            borderColor: palette.stepGlass.border,
            marginTop: -2,
          }}
        />
      </View>
    );
  }

  // day
  const { day, zig } = item;
  const available = !!activeDayId && day.id === activeDayId;
  const done = isDone(day.id);
  const locked = !done && !available;
  const canEnter = available ? canEnterActive : false;

  const nodeX = zig === "L" ? NODE_X_LEFT : NODE_X_RIGHT;

  const bg = done ? palette.node.doneBg : available ? palette.node.availableBg : palette.node.lockedBg;
  const border = done ? palette.node.doneBorder : available ? palette.node.availableBorder : palette.node.lockedBorder;
  const iconCol = done ? palette.node.doneIcon : available ? palette.node.availableIcon : palette.node.lockedIcon;
  const labelCol = done ? palette.node.doneLabel : available ? palette.node.availableLabel : palette.node.lockedLabel;

  const bottomY = CELL_H;
  const topY = 0;

  const pathD = `
    M ${MID_X} ${bottomY}
    C ${MID_X} ${bottomY - 30}, ${nodeX} ${CELL_H * 0.65}, ${nodeX} ${CELL_H * 0.5}
    C ${nodeX} ${CELL_H * 0.35}, ${MID_X} ${topY + 30}, ${MID_X} ${topY}
  `;

  const node = (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => {
        if (!available) return;
        if (!canEnter) return;
        onTapActiveDay?.(day);
      }}
      style={[
        styles.node,
        {
          left: nodeX - NODE_R,
          top: CELL_H / 2 - NODE_R,
          backgroundColor: bg,
          borderColor: border,
          opacity: available && !canEnter ? 0.55 : 1,
        },
      ]}
    >
      <Ionicons
        name={done ? "checkmark-circle" : locked ? "lock-closed-outline" : "star"}
        size={22}
        color={iconCol}
      />
      <Text style={[styles.nodeText, { color: labelCol }]}>روز {day.dayNumberInStage}</Text>
    </TouchableOpacity>
  );

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

      {available ? <Pulsing playing={true}>{node}</Pulsing> : node}
    </View>
  );
}

/* ----------------------------- Styles ----------------------------- */
const styles = StyleSheet.create({
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
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
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
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  nodeText: {
    position: "absolute",
    bottom: -22,
    fontSize: 12,
    fontWeight: "900",
  },
});