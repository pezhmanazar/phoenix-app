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
  TouchableOpacity,
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
const HEADER_H = 92; // headerWrap (با marginها) حدوداً
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
  treatment: any;
  progress: { activeDayId: string | null };
};

type FlattenItem =
  | { kind: "header"; stage: PelekanStage; id: string }
  | { kind: "day"; day: PelekanDay; zig: Zig; id: string };

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
  const stages = state?.stages || [];
  const activeDayId = state?.progress?.activeDayId || null;

  const listRef = useRef<FlatList<FlattenItem>>(null);
  const lastScrolledDayIdRef = useRef<string | null>(null);

  /* ---------- flatten days ---------- */
  const days = useMemo<FlattenItem[]>(() => {
    const list: FlattenItem[] = [];
    let zig = 0;

    stages.forEach((stage) => {
      list.push({ kind: "header", stage, id: `h-${stage.id}` });
      (stage.days || []).forEach((day) => {
        list.push({
          kind: "day",
          day,
          zig: zig++ % 2 === 0 ? "L" : "R",
          id: `d-${day.id}`,
        });
      });
    });

    return list;
  }, [stages]);

  /* ---------- active index ---------- */
  const activeIndex = useMemo(() => {
    if (!activeDayId) return -1;
    return days.findIndex((it) => it.kind === "day" && it.day.id === activeDayId);
  }, [days, activeDayId]);

  /* ---------- getItemLayout (برای scrollToIndex پایدار) ---------- */
  const getItemLayout = (_: ArrayLike<FlattenItem> | null | undefined, index: number) => {
    // چون header/day ارتفاع ثابت داریم، offset ساده میشه:
    // offset = sum(heights[0..index-1])
    // ولی برای ساده‌سازی: با یک حلقه کوتاه تا index محاسبه می‌کنیم (روزها زیاد هم باشه اوکیه)
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
      // یک فریم صبر کن تا layout کامل‌تر بشه
      requestAnimationFrame(() => {
        console.log("🎯 [TreatmentPelekan] scrollToActive", { activeDayId, activeIndex, total: days.length });

        try {
          listRef.current?.scrollToIndex({
            index: activeIndex,
            animated: false,
            viewPosition: 0.35,
          });
        } catch (e: any) {
          console.log("🧯 [TreatmentPelekan] scrollToIndex threw", String(e?.message || e));
        }
      });
    });

    return () => task.cancel?.();
  }, [activeDayId, activeIndex, days.length]);

  /* ============================ RENDER ============================ */
  const renderItem = ({ item }: { item: FlattenItem }) => {
    if (item.kind === "header") {
      return (
        <View style={styles.headerWrap}>
          <View style={styles.headerCard}>
            <Text style={styles.headerText}>{item.stage.titleFa}</Text>
          </View>
        </View>
      );
    }

    const { day, zig } = item;
    const isActive = !!activeDayId && day.id === activeDayId;

    const nodeX = zig === "L" ? NODE_X_LEFT : NODE_X_RIGHT;

    const pathD = `
      M ${MID_X} ${CELL_H}
      C ${MID_X} ${CELL_H - 30}, ${nodeX} ${CELL_H * 0.65}, ${nodeX} ${CELL_H * 0.5}
      C ${nodeX} ${CELL_H * 0.35}, ${MID_X} 30, ${MID_X} 0
    `;

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
          <TouchableOpacity
            activeOpacity={0.85}
            style={[
              styles.node,
              {
                left: nodeX - NODE_R,
                top: CELL_H / 2 - NODE_R,
                borderColor: isActive ? "rgba(212,175,55,.70)" : "rgba(255,255,255,.20)",
                opacity: isActive ? 1 : 0.9,
              },
            ]}
            onPress={() => {
              // فعلاً فقط روز active کلیک‌پذیر
              if (!isActive) return;
              // TODO: navigate to Day screen
            }}
          >
            <Ionicons
              name={isActive ? "star" : "lock-closed-outline"}
              size={22}
              color={isActive ? "#D4AF37" : "rgba(231,238,247,.55)"}
            />
            <Text style={styles.nodeText}>روز {day.dayNumberInStage}</Text>
          </TouchableOpacity>
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
          // با getItemLayout معمولاً رخ نمی‌دهد، ولی برای اطمینان:
          console.log("🧯 [TreatmentPelekan] onScrollToIndexFailed", {
            index: info.index,
            highestMeasuredFrameIndex: info.highestMeasuredFrameIndex,
            averageItemLength: info.averageItemLength,
          });

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

  // مهم: ارتفاع تقریباً ثابت برای کمک به getItemLayout
  headerWrap: { alignItems: "center", height: HEADER_H, justifyContent: "center" },
  headerCard: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.12)",
    backgroundColor: "rgba(255,255,255,.04)",
  },
  headerText: { color: "#F9FAFB", fontWeight: "900", fontSize: 16 },

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