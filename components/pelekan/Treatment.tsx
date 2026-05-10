import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  FlatList,
  InteractionManager,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import PlanStatusBadge from "../PlanStatusBadge";

/* ------------------ constants (گرافیک قبلی) ------------------ */
const { width: SCREEN_W } = Dimensions.get("window");
const PATH_W = SCREEN_W - 32;
const CELL_H = 120;
const MID_X = PATH_W / 2;
const NODE_X_LEFT = 70;
const NODE_X_RIGHT = PATH_W - 70;
const NODE_R = 28;

// برای getItemLayout (تقریبی ولی ثابت)
const HEADER_H = 92;
const DAY_H = CELL_H;

/* ------------------ types ------------------ */
type Zig = "L" | "R";

type PelekanTask = {
  id: string;
  titleFa: string;
  description?: string | null;
  sortOrder: number;
  weightPercent: number;
  xpReward: number;
  isRequired: boolean;
};

type PelekanDay = {
  id: string;
  stageId: string;
  dayNumberInStage: number;
  globalDayNumber: number;
  title?: string | null;
  description?: string | null;
  requiredPercent: number;
  tasks: PelekanTask[];
};

type PelekanStage = {
  id: string;
  code: string;
  titleFa: string;
  sortOrder: number;
  days: PelekanDay[];
};

type PelekanState = {
  user: { planStatus: "free" | "pro" | "expiring" | "expired"; daysLeft: number };
  stages: PelekanStage[];
  treatment: any; // شامل activeStage/activeDay...
  progress: { activeDayId: string | null };
};

type FlattenItem =
  | { kind: "header"; stage: PelekanStage; id: string }
  | {
      kind: "day";
      day: PelekanDay;
      zig: Zig;
      id: string;
      stageCode: string;
      stageOrder: number;
      isFutureStage: boolean;
      isPastStage: boolean;
      isActiveStage: boolean;
    };

type Props = {
  me: any;
  state: PelekanState;
};

/* ------------------ pulse wrapper ------------------ */
function Pulsing({ children }: { children: React.ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.08,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scale]);

  return <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>;
}

/* ============================ MAIN ============================ */
export default function TreatmentPelekan({ me, state }: Props) {
  const insets = useSafeAreaInsets();
  const stages = useMemo(() => state?.stages ?? [], [state?.stages]);
  const activeDayId = state?.progress?.activeDayId || null;


  // مهم: activeStageCode از backend (درست‌ترین)
  const activeStageCode = useMemo(() => {
    return String(state?.treatment?.activeStage || "").trim();
  }, [state?.treatment?.activeStage]);

  // fallback: اگر activeStageCode نبود، stage را از activeDayId پیدا کن
  const fallbackActiveStageId = useMemo(() => {
    if (activeStageCode) return null;
    if (!activeDayId) return null;
    for (const st of stages) {
      if ((st.days || []).some((d) => d.id === activeDayId)) return st.id;
    }
    return null;
  }, [activeStageCode, activeDayId, stages]);

  const listRef = useRef<FlatList<FlattenItem>>(null);
  const lastScrolledDayIdRef = useRef<string | null>(null);

  /* ---------- flatten list: گذشته + فعال (روزها) / آینده (فقط عنوان) ---------- */
  const days = useMemo<FlattenItem[]>(() => {
    const list: FlattenItem[] = [];
    let zig = 0;

    // چون stages بر اساس sortOrder میاد، خطی جلو می‌ریم
    let reachedActiveStage = false;

    stages.forEach((stage) => {
      list.push({ kind: "header", stage, id: `h-${stage.id}` });

      const stageCode = String(stage.code || "").trim();
      const stageOrder = Number(stage.sortOrder || 0);

      const thisIsActiveStage =
        (!!activeStageCode && stageCode === activeStageCode) ||
        (!!fallbackActiveStageId && stage.id === fallbackActiveStageId);

      const isPastStage = !reachedActiveStage && !thisIsActiveStage;
      const isActiveStage = thisIsActiveStage;
      const isFutureStage = reachedActiveStage && !thisIsActiveStage;

      // فقط برای stageهای past + active روزها را اضافه کن
      const shouldIncludeDays = !isFutureStage;

      if (shouldIncludeDays) {
        (stage.days || []).forEach((day) => {
          list.push({
            kind: "day",
            day,
            zig: zig++ % 2 === 0 ? "L" : "R",
            id: `d-${day.id}`,
            stageCode,
            stageOrder,
            isFutureStage,
            isPastStage,
            isActiveStage,
          });
        });
      }

      if (thisIsActiveStage) reachedActiveStage = true;
    });

    return list;
  }, [stages, activeStageCode, fallbackActiveStageId]);

  /* ---------- active index (در همین list فیلتر شده) ---------- */
  const activeIndex = useMemo(() => {
    if (!activeDayId) return -1;
    return days.findIndex((it) => it.kind === "day" && it.day.id === activeDayId);
  }, [days, activeDayId]);

  /* ---------- getItemLayout: ثابت و قابل اتکا ---------- */
  const getItemLayout = (_: ArrayLike<FlattenItem> | null | undefined, index: number) => {
    let offset = 0;
    for (let i = 0; i < index; i++) {
      const it = days[i];
      offset += it?.kind === "header" ? HEADER_H : DAY_H;
    }
    const length = days[index]?.kind === "header" ? HEADER_H : DAY_H;
    return { length, offset, index };
  };

  /* ---------- scroll to active (once per activeDayId) ---------- */
  useEffect(() => {
    if (!activeDayId) return;
    if (activeIndex < 0) return;

    // فقط وقتی activeDayId واقعاً عوض شده
    if (lastScrolledDayIdRef.current === activeDayId) return;
    lastScrolledDayIdRef.current = activeDayId;

    const task = InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
  try {
    listRef.current?.scrollToIndex({
      index: activeIndex,
      animated: false,
      viewPosition: 0.35,
    });
  } catch {}
});
    });

    return () => task.cancel?.();
  }, [activeDayId, activeIndex, days.length, activeStageCode]);

  /* ============================ RENDER ============================ */
  const renderItem = ({ item }: { item: FlattenItem }) => {
    if (item.kind === "header") {
      return (
        <View style={styles.headerWrap}>
          <View style={styles.headerCard}>
            <Text style={styles.headerText}>{item.stage.titleFa}</Text>

            {/* اگر stage بعد از active است، یک hint کوچک اضافه می‌کنیم (اختیاری) */}
            {activeStageCode &&
            String(item.stage.code || "").trim() !== activeStageCode &&
            stages.findIndex((s) => String(s.code).trim() === activeStageCode) >= 0 &&
            item.stage.sortOrder >
              (stages.find((s) => String(s.code).trim() === activeStageCode)?.sortOrder || 0) ? (
              <Text style={styles.headerSub}>بعداً باز می‌شود</Text>
            ) : null}
          </View>
        </View>
      );
    }

    const { day, zig, isPastStage, isActiveStage } = item;

    const isActive = !!activeDayId && day.id === activeDayId;
    const nodeX = zig === "L" ? NODE_X_LEFT : NODE_X_RIGHT;

    const pathD = `
      M ${MID_X} ${CELL_H}
      C ${MID_X} ${CELL_H - 30}, ${nodeX} ${CELL_H * 0.65}, ${nodeX} ${CELL_H * 0.5}
      C ${nodeX} ${CELL_H * 0.35}, ${MID_X} 30, ${MID_X} 0
    `;

    // ظاهر نودها:
    // - active: ستاره + پالس
    // - past stage: preview (آیکن چشم)
    // - باقی: قفل
    const iconName = isActive
      ? "star"
      : isPastStage
      ? ("eye-outline" as any)
      : "lock-closed-outline";

    const iconColor = isActive
      ? "#D4AF37"
      : isPastStage
      ? "rgba(231,238,247,.75)"
      : "rgba(231,238,247,.55)";

    const NodeWrapper: any = isActive ? Pulsing : React.Fragment;

    return (
      <View style={{ height: CELL_H, width: PATH_W, alignSelf: "center" }}>
        <Svg width={PATH_W} height={CELL_H} style={{ position: "absolute" }}>
          <Path
            d={pathD}
            stroke="rgba(226,232,240,.55)"
            strokeWidth={6}
            fill="none"
            strokeLinecap="round"
          />
        </Svg>

        <NodeWrapper {...(isActive ? {} : null)}>
          <View
  style={[
    styles.node,
    {
      left: nodeX - NODE_R,
      top: CELL_H / 2 - NODE_R,
      borderColor: isActive
        ? "rgba(212,175,55,.70)"
        : isPastStage
        ? "rgba(255,255,255,.28)"
        : "rgba(255,255,255,.20)",
      opacity: isActive ? 1 : isPastStage ? 0.95 : 0.85,
    },
  ]}
>
  <Ionicons name={iconName} size={22} color={iconColor} />
  <Text style={styles.nodeText}>
    {isActiveStage ? "روز " : ""} {day.dayNumberInStage}
  </Text>
</View>

        </NodeWrapper>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.root, { paddingBottom: insets.bottom }]} edges={["top", "bottom"]}>
      {/* ---------- HEADER (با me) ---------- */}
      <View style={[styles.topBar, { paddingTop: Math.max(10, insets.top * 0.2) }]}>
        <PlanStatusBadge me={me} showExpiringText />
      </View>

      {/* ---------- PATH ---------- */}
      <FlatList
        ref={listRef}
        data={days}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        inverted
        getItemLayout={getItemLayout}
        contentContainerStyle={{ paddingBottom: 24, paddingTop: 16 }}
        showsVerticalScrollIndicator={false}
        onScrollToIndexFailed={(info) => {
  requestAnimationFrame(() => {
    try {
      listRef.current?.scrollToOffset({
        offset: Math.max(0, info.averageItemLength * info.index),
        animated: false,
      });

      listRef.current?.scrollToIndex({
        index: info.index,
        animated: false,
        viewPosition: 0.35,
      });
    } catch {}
  });
}}

      />
    </SafeAreaView>
  );
}

/* ============================ STYLES ============================ */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b0f14" },

  topBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(3,7,18,.92)",
  },

  // ارتفاع ثابت برای کمک به getItemLayout
  headerWrap: { alignItems: "center", height: HEADER_H, justifyContent: "center" },
  headerCard: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.12)",
    backgroundColor: "rgba(255,255,255,.04)",
    alignItems: "center",
  },
  headerText: { color: "#F9FAFB", fontWeight: "900", fontSize: 16 },
  headerSub: {
    marginTop: 6,
    fontSize: 11,
    color: "rgba(231,238,247,.60)",
    fontWeight: "700",
  },

  node: {
    position: "absolute",
    width: NODE_R * 2,
    height: NODE_R * 2,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0B0F14",
  },

  nodeText: {
    position: "absolute",
    bottom: -22,
    fontSize: 12,
    fontWeight: "900",
    color: "#F9FAFB",
  },
});