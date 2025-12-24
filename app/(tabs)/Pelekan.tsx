// app/(tabs)/Pelekan.tsx
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import Baseline from "../../components/pelekan/Baseline";
import ChoosePath from "../../components/pelekan/ChoosePath";
import IdlePlaceholder from "../../components/pelekan/IdlePlaceholder";
import Review from "../../components/pelekan/Review";
import TreatmentView, {
  ListItem,
  PelekanDay,
  PelekanStage,
  PelekanState as TreatmentViewState,
} from "../../components/pelekan/TreatmentView";
import PlanStatusBadge from "../../components/PlanStatusBadge";
import TopBanner from "../../components/TopBanner";
import { useUser } from "../../hooks/useUser";

/* ----------------------------- Types ----------------------------- */
type PlanStatus = "free" | "pro" | "expired" | "expiring";
type TabState =
  | "idle"
  | "baseline_assessment"
  | "baseline_result"
  | "choose_path"
  | "review"
  | "treating";

type Paywall = { needed: boolean; reason: "start_treatment" | "continue_treatment" | null };

type PelekanFlags = {
  suppressPaywall?: boolean;
  isBaselineInProgress?: boolean;
  isBaselineCompleted?: boolean;
};

type PelekanState = {
  tabState: TabState;
  user: { planStatus: PlanStatus; daysLeft: number };
  treatmentAccess: "full" | "frozen_current" | "archive_only";
  ui: { paywall: Paywall; flags?: PelekanFlags };
  baseline: any | null;
  path: any | null;
  review: any | null;
  bastanIntro: any | null;
  treatment: any | null;
  hasContent: boolean;
  stages: PelekanStage[];
  progress:
    | {
        activeDayId: string | null;
        dayProgress: any[];
        taskProgress: any[];
        xpTotal: number;
        streak: any;
      }
    | null;
};

const initialState: PelekanState = {
  tabState: "idle",
  user: { planStatus: "free", daysLeft: 0 },
  treatmentAccess: "archive_only",
  ui: { paywall: { needed: true, reason: "start_treatment" }, flags: {} },
  baseline: null,
  path: null,
  review: null,
  bastanIntro: null,
  treatment: null,
  hasContent: true,
  stages: [],
  progress: null,
};

/* ----------------------------- Screen ----------------------------- */
export default function PelekanTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarH = useBottomTabBarHeight();
  const { me } = useUser();

  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [state, setState] = useState<PelekanState>(initialState);
  const [headerHeight, setHeaderHeight] = useState(0);

  const [baselineResultSeen, setBaselineResultSeen] = useState(false);

  const palette = useMemo(
    () => ({
      bg: "#0b0f14",
      text: "#F9FAFB",
      border: "rgba(255,255,255,.10)",
      glass: "rgba(3,7,18,.92)",
      glowTop: "rgba(212,175,55,.14)",
      glowBottom: "rgba(233,138,21,.10)",
    }),
    []
  );

  const shouldShowBaselineResult = useCallback(
    (data: any) => {
      const tabStateFromServer = String(data?.tabState || "idle");
      const baselineCompleted = data?.baseline?.session?.status === "completed";
      const hasReviewSession = !!data?.review?.hasSession;
      return (
        tabStateFromServer === "choose_path" &&
        baselineCompleted &&
        !hasReviewSession &&
        !baselineResultSeen
      );
    },
    [baselineResultSeen]
  );

  const fetchState = useCallback(
    async (opts?: { initial?: boolean }) => {
      const isInitial = !!opts?.initial;

      try {
        if (isInitial) setInitialLoading(true);
        else setRefreshing(true);

        const phone = me?.phone;
        if (!phone) {
          setState(initialState);
          return;
        }

        const res = await fetch(
          `https://api.qoqnoos.app/api/pelekan/state?phone=${encodeURIComponent(phone)}`,
          { headers: { "Cache-Control": "no-store" } }
        );

        const json = await res.json().catch(() => null);
        if (!json?.ok) {
          setState(initialState);
          return;
        }

        const data = json.data || {};

        const finalTabState: TabState = shouldShowBaselineResult(data)
          ? "baseline_result"
          : (data?.tabState as TabState) || "idle";

        const merged: PelekanState = {
          ...initialState,
          ...data,
          tabState: finalTabState,
          ui: {
            paywall: data?.ui?.paywall ?? initialState.ui.paywall,
            flags: data?.ui?.flags ?? {},
          },
          treatment: data?.treatment ?? null,
          stages: Array.isArray(data?.stages) ? data.stages : [],
        };

        setState(merged);
      } catch {
        setState(initialState);
      } finally {
        if (isInitial) setInitialLoading(false);
        else setRefreshing(false);
      }
    },
    [me?.phone, shouldShowBaselineResult]
  );

  // ✅ این hook باید قبل از هر return باشد
  const onBaselineResultContinue = useCallback(async () => {
    setBaselineResultSeen(true);
    await fetchState({ initial: false });
  }, [fetchState]);

  useEffect(() => {
    fetchState({ initial: true });
  }, [fetchState]);

  useFocusEffect(
    useCallback(() => {
      fetchState({ initial: false });
    }, [fetchState])
  );

  const pathItems: ListItem[] = useMemo(() => {
    if (state.tabState !== "treating") return [];
    const stages = state.stages || [];
    const list: ListItem[] = [];
    let zigCounter = 0;

    const baselineDone = state?.baseline?.session?.status === "completed";
    const reviewChosen = !!state?.review?.session?.chosenPath;
    const reviewDone =
      !!state?.review?.session?.completedAt ||
      !!state?.review?.session?.test2CompletedAt ||
      !!state?.review?.session?.test1CompletedAt ||
      !!state?.review?.session?.test2SkippedAt;

    const resultsDone = !!(baselineDone && reviewChosen && reviewDone);

    list.push({
      kind: "results",
      id: "results-0",
      zig: "L",
      titleFa: "سنجش وضعیت",
      done: resultsDone,
    } as any);

    for (const st of stages) {
      list.push({ kind: "header", id: `h-${st.id}`, stage: st });
      for (const d of st.days || []) {
        const zig: "L" | "R" = zigCounter++ % 2 === 0 ? "L" : "R";
        list.push({ kind: "day", id: `d-${d.id}`, day: d as PelekanDay, stage: st, zig });
      }
      list.push({ kind: "spacer", id: `sp-${st.id}` });
    }

    return list;
  }, [state.tabState, state.stages, state?.baseline?.session, state?.review?.session]);

  const onTapActiveDay = useCallback(
    (day: PelekanDay) => {
      const paywallNeeded = !!state?.ui?.paywall?.needed;
      const noFullAccess = state?.treatmentAccess !== "full";
      if (paywallNeeded || noFullAccess) {
        router.push("/(tabs)/Subscription");
        return;
      }
      router.push({ pathname: "/pelekan/day/[id]", params: { id: day.id } });
    },
    [router, state?.ui?.paywall?.needed, state?.treatmentAccess]
  );

  const onTapResults = useCallback(() => {
    const phone = String(me?.phone || "").trim();
    if (!phone) return;
    router.push(`/(tabs)/ReviewResult?phone=${encodeURIComponent(phone)}` as any);
  }, [router, me?.phone]);

  const bottomSafe = insets.bottom + tabBarH;
  const listPaddingBottom = Math.max(24, 12);
  const listPaddingTop = Math.max(16, bottomSafe + 16);

  if (initialLoading) {
    return (
      <SafeAreaView edges={["top"]} style={[styles.root, { backgroundColor: palette.bg }]}>
        <View pointerEvents="none" style={[styles.bgGlowTop, { backgroundColor: palette.glowTop }]} />
        <View pointerEvents="none" style={[styles.bgGlowBottom, { backgroundColor: palette.glowBottom }]} />
        <View style={styles.center}>
          <ActivityIndicator color="#D4AF37" />
          <Text style={{ color: "#E5E7EB", marginTop: 8, fontSize: 12 }}>در حال بارگذاری…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.bg }]} edges={["top", "left", "right", "bottom"]}>
      <View pointerEvents="none" style={[styles.bgGlowTop, { backgroundColor: palette.glowTop }]} />
      <View pointerEvents="none" style={[styles.bgGlowBottom, { backgroundColor: palette.glowBottom }]} />

      {/* Header */}
      <View
        onLayout={(e) => {
          const h = e?.nativeEvent?.layout?.height ?? 0;
          if (h && h !== headerHeight) setHeaderHeight(h);
        }}
        style={[styles.topBar, { backgroundColor: palette.glass, borderBottomColor: palette.border }]}
      >
        <View style={[styles.topCol, styles.colLeft]}>
          <PlanStatusBadge me={me} showExpiringText />
        </View>
        <View style={[styles.topCol, styles.colCenter]}>
          <Text style={{ color: palette.text, fontWeight: "900" }}>پلکان</Text>
        </View>
        <View style={[styles.topCol, styles.colRight]}>
          <Text style={{ color: "rgba(231,238,247,.7)", fontWeight: "900" }}> </Text>
        </View>
      </View>

      <TopBanner enabled headerHeight={headerHeight} />

      {refreshing && (
        <View style={{ paddingVertical: 8, alignItems: "center" }}>
          <ActivityIndicator color="#D4AF37" />
        </View>
      )}

      {/* Content */}
      <View style={{ flex: 1 }}>
        {state.tabState === "baseline_assessment" ? (
          <View style={{ flex: 1, paddingBottom: bottomSafe }}>
            <Baseline me={me} state={state} onRefresh={() => fetchState({ initial: false })} />
          </View>
        ) : state.tabState === "baseline_result" ? (
          <View style={{ flex: 1, paddingBottom: bottomSafe }}>
            <Baseline me={me} state={state} onRefresh={onBaselineResultContinue} />
          </View>
        ) : state.tabState === "choose_path" ? (
          <View style={{ flex: 1, paddingBottom: bottomSafe }}>
            <ChoosePath me={me} state={state} onRefresh={() => fetchState({ initial: false })} />
          </View>
        ) : state.tabState === "review" ? (
          <View style={{ flex: 1, paddingBottom: bottomSafe }}>
            <Review me={me} state={state} onRefresh={() => fetchState({ initial: false })} />
          </View>
        ) : state.tabState === "treating" ? (
          <FlatList
            style={{ flex: 1 }}
            data={pathItems}
            keyExtractor={(it) => it.id}
            renderItem={({ item, index }) => (
              <TreatmentView
                item={item}
                index={index}
                state={state as unknown as TreatmentViewState}
                onTapActiveDay={onTapActiveDay}
                onTapResults={onTapResults}
              />
            )}
            inverted
            bounces={false}
            overScrollMode="never"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: listPaddingTop, paddingBottom: listPaddingBottom }}
          />
        ) : (
          <View style={{ flex: 1, paddingBottom: bottomSafe }}>
            <IdlePlaceholder me={me} state={state} onRefresh={() => fetchState({ initial: false })} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

/* ----------------------------- Styles ----------------------------- */
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
  },
  bgGlowBottom: {
    position: "absolute",
    bottom: -280,
    right: -260,
    width: 560,
    height: 560,
    borderRadius: 999,
  },
  topBar: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topCol: { flex: 1, minHeight: 28 },
  colLeft: { alignItems: "flex-start", justifyContent: "center" },
  colCenter: { alignItems: "center", justifyContent: "center" },
  colRight: { alignItems: "flex-end", justifyContent: "center" },
});