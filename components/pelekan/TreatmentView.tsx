// components/pelekan/TreatmentView.tsx
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Dimensions, Easing, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Svg, { Path } from "react-native-svg";

/* ----------------------------- Types ----------------------------- */
export type PlanStatus = "free" | "pro" | "expired" | "expiring";
export type TreatmentAccess = "full" | "frozen_current" | "archive_only";
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

export type ResultsItem = {
  kind: "results";
  id: string;
  zig: "L" | "R";
  titleFa: string;
  done: boolean;
};

export type ListItem = HeaderItem | DayItem | SpacerItem | ResultsItem;

type Props = {
  item: ListItem;
  index: number;
  state: PelekanState;

  onTapActiveDay?: (day: PelekanDay, opts?: { mode: "active" | "preview" }) => void;
  onTapResults?: () => void;
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

/* ----------------------------- Helpers ----------------------------- */
function isDoneRow(dp: DayProgressRow | undefined) {
  if (!dp) return false;
  const st = String(dp.status || "").toLowerCase();
  if (st === "done" || st === "completed") return true;
  if (typeof dp.completionPercent === "number" && dp.completionPercent >= 100) return true;
  return false;
}

/* ----------------------------- Component (ONE ITEM) ----------------------------- */
export default function TreatmentView({ item, state, onTapActiveDay, onTapResults }: Props) {
  const activeDayId = state.progress?.activeDayId || null;

  const dayProgressMap = useMemo(() => {
    const m = new Map<string, DayProgressRow>();
    const rows = state.progress?.dayProgress || [];
    for (const r of rows) m.set(r.dayId, r);
    return m;
  }, [state.progress?.dayProgress]);

  const access = state.treatmentAccess;
  const canEnterActive = access === "full" || access === "frozen_current";

  // ✅ stage order logic: روزهای مرحله‌های قبلی فقط preview
  const activeStageCode: string | null =
    (state?.treatment?.activeStage as string | undefined) ??
    (state?.stages || []).find((s: any) => s?.status === "active")?.code ??
    null;

  const activeStageOrder: number =
    (state?.stages || []).find((s) => s.code === activeStageCode)?.sortOrder ?? 999;

  // ✅ آخرین مرحله = rastan
  const LAST_STAGE_CODE = "rastan";

  // ✅ تشخیص آخرین day کل مسیر (برای قطع کردن زیگزاگ بالا)
  const lastDayIdAll: string | null = useMemo(() => {
    const st = state?.stages || [];
    if (!st.length) return null;
    const allDays = st.flatMap((x) => x.days || []);
    if (!allDays.length) return null;
    // فرض: globalDayNumber مرتب/درست است
    const last = [...allDays].sort((a, b) => (a.globalDayNumber || 0) - (b.globalDayNumber || 0)).slice(-1)[0];
    return last?.id ?? null;
  }, [state?.stages]);

  if (item.kind === "spacer") return <View style={{ height: 10 }} />;

  if (item.kind === "header") {
    const { stage } = item;
    const icon = stageIcon(stage.code);

    return (
      <View style={{ alignItems: "center", alignSelf: "center", width: PATH_W }}>
        <View style={[styles.stepHeaderCard, { backgroundColor: palette.stepGlass.bg, borderColor: palette.stepGlass.border }]}>
          <Ionicons name={icon.name} size={18} color={icon.color} style={{ marginLeft: 6 }} />
          <Text style={[styles.stepHeaderText, { color: palette.stepGlass.text }]}>{stage.titleFa}</Text>
        </View>

        {/* ✅ اگر مرحله آخره (رستن) این کلاهک پایین رو هم نذاریم که حس ادامه نده */}
        {stage.code !== LAST_STAGE_CODE && (
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
        )}
      </View>
    );
  }

  // ✅ results (دایره نتایج)
  if (item.kind === "results") {
    const done = !!item.done;
    const nodeX = MID_X;
    const lineColor = done ? palette.pathDone : palette.pathIdle;

    return (
      <View style={{ height: CELL_H, width: PATH_W, alignSelf: "center" }}>
        <Svg width={PATH_W} height={CELL_H} style={{ position: "absolute" }}>
          <Path
            d={`M ${MID_X} ${CELL_H / 2} L ${MID_X} 0`}
            stroke={lineColor}
            strokeWidth={6}
            fill="none"
            strokeLinecap="round"
          />
        </Svg>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => onTapResults?.()}
          style={[
            styles.node,
            {
              left: nodeX - NODE_R,
              top: CELL_H / 2 - NODE_R,
              backgroundColor: done ? palette.node.doneBg : palette.node.availableBg,
              borderColor: done ? palette.node.doneBorder : palette.node.availableBorder,
            },
          ]}
        >
          <Ionicons name={done ? "checkmark-circle" : "star"} size={22} color={done ? palette.node.doneIcon : palette.node.availableIcon} />
          <Text style={[styles.nodeText, { color: done ? palette.node.doneLabel : palette.node.availableLabel }]}>سنجش</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // day
  const { day, zig, stage } = item;

  const available = !!activeDayId && day.id === activeDayId;
  const done = isDoneRow(dayProgressMap.get(day.id));

  // ✅ فقط روز active اجازه "انجام" دارد
  const canEnter = available && canEnterActive;

  // ✅ روزهای مرحله‌های قبلی (یا done شده‌ها) preview
  const thisStageOrder = stage?.sortOrder ?? 0;
  const isPastStage = thisStageOrder < activeStageOrder;
  const canPreview = isPastStage || done;

  const locked = !available && !canPreview;

  const nodeX = zig === "L" ? NODE_X_LEFT : NODE_X_RIGHT;

  const bg =
    done ? palette.node.doneBg : available ? palette.node.availableBg : locked ? palette.node.lockedBg : palette.node.availableBg;

  const border =
    done ? palette.node.doneBorder : available ? palette.node.availableBorder : locked ? palette.node.lockedBorder : palette.node.availableBorder;

  const iconCol =
    done ? palette.node.doneIcon : available ? palette.node.availableIcon : locked ? palette.node.lockedIcon : palette.node.availableIcon;

  const labelCol =
    done ? palette.node.doneLabel : available ? palette.node.availableLabel : locked ? palette.node.lockedLabel : palette.node.availableLabel;

  const bottomY = CELL_H;
  const topY = 0;

  // ✅ اگر این آخرین day کل مسیر است، زیگزاگ را تا بالا نکش (قطع کن)
  const isLastPathNode = !!lastDayIdAll && day.id === lastDayIdAll;

  const pathD = isLastPathNode
    ? `
      M ${MID_X} ${bottomY}
      C ${MID_X} ${bottomY - 30}, ${nodeX} ${CELL_H * 0.65}, ${nodeX} ${CELL_H * 0.5}
    `
    : `
      M ${MID_X} ${bottomY}
      C ${MID_X} ${bottomY - 30}, ${nodeX} ${CELL_H * 0.65}, ${nodeX} ${CELL_H * 0.5}
      C ${nodeX} ${CELL_H * 0.35}, ${MID_X} ${topY + 30}, ${MID_X} ${topY}
    `;

  const iconName = done ? "checkmark-circle" : available ? "star" : canPreview ? "eye" : "lock-closed-outline";

  // ✅ برچسب bastan = اقدام
  const isBastan = String(stage?.code || "") === "bastan";
  const label = isBastan ? "اقدام" : "روز";

  const node = (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => {
        if (canEnter) {
          onTapActiveDay?.(day, { mode: "active" });
          return;
        }
        if (canPreview) {
          onTapActiveDay?.(day, { mode: "preview" });
          return;
        }
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
      <Ionicons name={iconName as any} size={22} color={iconCol} />
      <Text style={[styles.nodeText, { color: labelCol }]}>
        {label} {day.dayNumberInStage}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ height: CELL_H, width: PATH_W, alignSelf: "center" }}>
      <Svg width={PATH_W} height={CELL_H} style={{ position: "absolute" }}>
        <Path d={pathD} stroke={done ? palette.pathDone : palette.pathIdle} strokeWidth={6} fill="none" strokeLinecap="round" />
      </Svg>

      {available ? <Pulsing playing>{node}</Pulsing> : node}
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
    bottom: -30,
    fontSize: 12,
    fontWeight: "900",
  },
});