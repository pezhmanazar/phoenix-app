// components/pelekan/TreatmentView.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
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
  bastanIntro?: any; // ✅ مهم: از سرور میاد
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

export type StartItem = {
  kind: "start";
  id: string;
  zig: "L" | "R";
  titleFa: string;
  done: boolean;
};

export type StageNodeItem = {
  kind: "stage_node";
  id: string;
  zig: "L" | "R";
  stage: PelekanStage;
  done?: boolean;
  active?: boolean;
};

export type ListItem = HeaderItem | DayItem | SpacerItem | ResultsItem | StartItem | StageNodeItem;

type Props = {
  item: ListItem;
  index: number;
  state: PelekanState;

  onTapActiveDay?: (day: PelekanDay, opts?: { mode: "active" | "preview" }) => void;
  onTapResults?: () => void;
  onTapStart?: () => void;
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
};

// ✅ لوکال: ویس‌های استیج
const KEY_BASTAN_STAGE_AUDIO_V1 = "pelekan:stage_intro:bastan:heard:v1";
const KEY_GOSASTAN_STAGE_AUDIO_V1 = "pelekan:stage_intro:gosastan:heard:v1";

function stageIconName(code: string): keyof typeof Ionicons.glyphMap {
  if (code === "bastan") return "folder";
  if (code === "gosastan") return "link";
  if (code === "sookhtan") return "bonfire";
  if (code === "sarashtan") return "person";
  if (code === "ziestan") return "leaf";
  if (code === "sakhtan") return "hammer";
  if (code === "rastan") return "sparkles";
  return "ellipse-outline";
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
        Animated.timing(scale, { toValue: 1.08, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [playing, scale]);

  return <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>;
}

function isDoneRow(dp: DayProgressRow | undefined) {
  if (!dp) return false;
  const st = String(dp.status || "").toLowerCase();
  if (st === "done" || st === "completed") return true;
  if (typeof dp.completionPercent === "number" && dp.completionPercent >= 100) return true;
  return false;
}

/* ----------------------------- Component (ONE ITEM) ----------------------------- */
export default function TreatmentView({ item, state, onTapActiveDay, onTapResults, onTapStart }: Props) {
  const router = useRouter();
  const activeDayId = state.progress?.activeDayId || null;

  const dayProgressMap = useMemo(() => {
    const m = new Map<string, DayProgressRow>();
    const rows = state.progress?.dayProgress || [];
    for (const r of rows) m.set(r.dayId, r);
    return m;
  }, [state.progress?.dayProgress]);

  // ✅ stage-intro ها (لوکال)
  const [bastanHeard, setBastanHeard] = useState(false);
  const [gosastanHeard, setGosastanHeard] = useState(false);

  const refreshLocalHeards = useCallback(async () => {
    try {
      const [b, g] = await Promise.all([
        AsyncStorage.getItem(KEY_BASTAN_STAGE_AUDIO_V1),
        AsyncStorage.getItem(KEY_GOSASTAN_STAGE_AUDIO_V1),
      ]);
      setBastanHeard(b === "1");
      setGosastanHeard(g === "1");
    } catch {}
  }, []);

  useEffect(() => {
    refreshLocalHeards();
  }, [refreshLocalHeards]);

  useFocusEffect(
    useCallback(() => {
      refreshLocalHeards();
    }, [refreshLocalHeards])
  );

  // ✅ NEW: گیت واقعی از سرور (نه AsyncStorage)
  const bastanIntroCompletedAt =
    state?.bastanIntro?.completedAt ??
    state?.treatment?.bastanIntro?.completedAt ??
    state?.treatment?.start?.completedAt ??
    null;

  const bastanIntroDone = !!bastanIntroCompletedAt;

  // ✅ NEW: مودال تم‌دار برای هشدار
  const [guardOpen, setGuardOpen] = useState(false);
  const [guardText, setGuardText] = useState("ابتدا روی دکمه شروع کلیک کن");

  const openGuard = useCallback((txt?: string) => {
    setGuardText(txt || "ابتدا روی دکمه شروع کلیک کن");
    setGuardOpen(true);
  }, []);

  // ✅ فقط برای دیباگ، بفهمیم واقعاً state چی میگه
  useEffect(() => {
    // حواست باشه اسپم نشه؛ ولی همین الان برای تست خوبه
    // اگر دیدی زیاد لاگ میده، پاکش کن.
    console.log("[TreatmentView] bastanIntroDone=", bastanIntroDone, "completedAt=", bastanIntroCompletedAt);
  }, [bastanIntroDone, bastanIntroCompletedAt]);

  // ✅ یک مودال برای همه آیتم‌ها (نه تکراری)
  const GuardModal = (
    <Modal transparent visible={guardOpen} animationType="fade" onRequestClose={() => setGuardOpen(false)}>
      <View style={g.modalBackdrop}>
        <View style={g.modalCard}>
          <Text style={g.modalTitle}>توجه</Text>
          <Text style={g.modalBody}>{guardText}</Text>
          <View style={g.modalActions}>
            <Pressable onPress={() => setGuardOpen(false)} style={g.modalBtn}>
              <Text style={g.modalBtnText}>باشه</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (item.kind === "spacer") return <View style={{ height: 10 }} />;

  // ✅ results (دایره سنجش) — خط صاف عمودی
  if (item.kind === "results") {
    const done = !!item.done;
    const nodeX = MID_X;
    const lineColor = done ? palette.pathDone : palette.pathIdle;

    return (
      <View style={{ height: CELL_H, width: PATH_W, alignSelf: "center" }}>
        {GuardModal}

        <Svg width={PATH_W} height={CELL_H} style={{ position: "absolute" }}>
          <Path d={`M ${MID_X} ${CELL_H / 2} L ${MID_X} 0`} stroke={lineColor} strokeWidth={6} fill="none" strokeLinecap="round" />
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
          <Text style={[styles.nodeText, { color: done ? palette.node.doneLabel : palette.node.availableLabel }]}>{item.titleFa}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ✅ start — همان قبلی
  if (item.kind === "start") {
    const nodeX = MID_X;
    const lineColor = palette.pathDone;

    const bg = palette.node.availableBg;
    const border = palette.node.availableBorder;
    const iconCol = palette.node.availableIcon;
    const labelCol = palette.node.availableLabel;

    return (
      <View style={{ height: CELL_H, width: PATH_W, alignSelf: "center" }}>
        {GuardModal}

        <Svg width={PATH_W} height={CELL_H} style={{ position: "absolute" }}>
          <Path d={`M ${MID_X} ${CELL_H} L ${MID_X} 0`} stroke={lineColor} strokeWidth={6} fill="none" strokeLinecap="round" />
        </Svg>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => onTapStart?.()}
          style={[
            styles.node,
            {
              left: nodeX - NODE_R,
              top: CELL_H / 2 - NODE_R,
              backgroundColor: bg,
              borderColor: border,
            },
          ]}
        >
          <Ionicons name={"play"} size={22} color={iconCol} style={{ marginLeft: 2 }} />
          <Text style={[styles.nodeText, { color: labelCol }]}>{item.titleFa}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ✅ stage_node: اینجا گیت درست اعمال میشه
  if (item.kind === "stage_node") {
    const { zig, stage } = item;
    const nodeX = zig === "L" ? NODE_X_LEFT : NODE_X_RIGHT;

    const stageCode = String(stage?.code || "");
    const isBastanStage = stageCode === "bastan";
    const isGosastanStage = stageCode === "gosastan";

    const heard = isBastanStage ? bastanHeard : isGosastanStage ? gosastanHeard : false;

    const done = !!item.done;
    const active = !!item.active;

    const bg = done || heard ? palette.node.doneBg : active ? palette.node.availableBg : palette.node.lockedBg;
    const border = done || heard ? palette.node.doneBorder : active ? palette.node.availableBorder : palette.node.lockedBorder;
    const iconCol = done || heard ? palette.node.doneIcon : active ? palette.node.availableIcon : palette.node.lockedIcon;
    const labelCol = done || heard ? palette.node.doneLabel : active ? palette.node.availableLabel : palette.node.lockedLabel;

    const strokeCol = done || heard ? palette.pathDone : palette.pathIdle;

    const bottomY = CELL_H;
    const topY = 0;

    const pathD = `
      M ${MID_X} ${bottomY}
      C ${MID_X} ${bottomY - 30}, ${nodeX} ${CELL_H * 0.65}, ${nodeX} ${CELL_H * 0.5}
      C ${nodeX} ${CELL_H * 0.35}, ${MID_X} ${topY + 30}, ${MID_X} ${topY}
    `;

    const NodeWrap: any = isBastanStage || isGosastanStage ? TouchableOpacity : View;

    const wrapProps =
      isBastanStage
        ? {
            activeOpacity: 0.9,
            onPress: () => {
              // ✅ گیت اصلی همین است: تا intro تمام نشده، stage-intro باز نشود
              if (!bastanIntroDone) {
                openGuard("ابتدا روی دکمه شروع کلیک کن");
                return;
              }
              router.push("/pelekan/bastan/stage-intro" as any);
            },
          }
        : isGosastanStage
          ? { activeOpacity: 0.9, onPress: () => router.push("/pelekan/gosastan/stage-intro" as any) }
          : {};

    return (
      <View style={{ height: CELL_H, width: PATH_W, alignSelf: "center" }}>
        {GuardModal}

        <Svg width={PATH_W} height={CELL_H} style={{ position: "absolute" }}>
          <Path d={pathD} stroke={strokeCol} strokeWidth={6} fill="none" strokeLinecap="round" />
        </Svg>

        <NodeWrap
          {...wrapProps}
          style={[
            styles.node,
            {
              left: nodeX - NODE_R,
              top: CELL_H / 2 - NODE_R,
              backgroundColor: bg,
              borderColor: border,
            },
          ]}
        >
          <Ionicons name={stageIconName(stageCode) as any} size={22} color={iconCol} />
          <Text style={[styles.nodeText, { color: labelCol }]}>{stage.titleFa}</Text>
        </NodeWrap>
      </View>
    );
  }

  // day
  const { day, zig, stage } = item as any;

  const available = !!activeDayId && day.id === activeDayId;
  const done = isDoneRow(dayProgressMap.get(day.id));

  const access = state.treatmentAccess;
  const canEnterActive = access === "full" || access === "frozen_current";
  const canEnter = (available || done) && canEnterActive;

  const locked = !available && !done;

  const nodeX = zig === "L" ? NODE_X_LEFT : NODE_X_RIGHT;
  const bg = done ? palette.node.doneBg : available ? palette.node.availableBg : locked ? palette.node.lockedBg : palette.node.availableBg;
  const border =
    done ? palette.node.doneBorder : available ? palette.node.availableBorder : locked ? palette.node.lockedBorder : palette.node.availableBorder;
  const iconCol =
    done ? palette.node.doneIcon : available ? palette.node.availableIcon : locked ? palette.node.lockedIcon : palette.node.availableIcon;
  const labelCol =
    done ? palette.node.doneLabel : available ? palette.node.availableLabel : locked ? palette.node.lockedLabel : palette.node.availableLabel;

  const bottomY = CELL_H;
  const topY = 0;

  const pathD = `
    M ${MID_X} ${bottomY}
    C ${MID_X} ${bottomY - 30}, ${nodeX} ${CELL_H * 0.65}, ${nodeX} ${CELL_H * 0.5}
    C ${nodeX} ${CELL_H * 0.35}, ${MID_X} ${topY + 30}, ${MID_X} ${topY}
  `;

  const iconName = done ? "checkmark-circle" : available ? "star" : "lock-closed-outline";
  const isBastan = String(stage?.code || "") === "bastan";
  const label = isBastan ? "اقدام" : "روز";

  const node = (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => {
        if (!canEnter) return;
        onTapActiveDay?.(day, { mode: available ? "active" : "preview" });
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
      {GuardModal}

      <Svg width={PATH_W} height={CELL_H} style={{ position: "absolute" }}>
        <Path d={pathD} stroke={done ? palette.pathDone : palette.pathIdle} strokeWidth={6} fill="none" strokeLinecap="round" />
      </Svg>

      {available ? <Pulsing playing>{node}</Pulsing> : node}
    </View>
  );
}

/* ----------------------------- Styles ----------------------------- */
const styles = StyleSheet.create({
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

const g = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(3,7,18,.92)",
    padding: 16,
  },
  modalTitle: {
    color: "#F9FAFB",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "right",
  },
  modalBody: {
    marginTop: 10,
    color: "rgba(231,238,247,.75)",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "right",
  },
  modalActions: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  modalBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#E98A15",
  },
  modalBtnText: {
    color: "#0b0f14",
    fontWeight: "900",
    fontSize: 13,
  },
});