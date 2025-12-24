import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
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
type TabState = "idle" | "baseline_assessment" | "baseline_result" | "choose_path" | "review" | "treating";

type Paywall = {
  needed: boolean;
  reason: "start_treatment" | "continue_treatment" | null;
};

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
  const params = useLocalSearchParams();
  const focus = String((params as any)?.focus || "").trim();

  const insets = useSafeAreaInsets();
  const tabBarH = useBottomTabBarHeight();
  const { me } = useUser();

  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [state, setState] = useState<PelekanState>(initialState);
  const [headerHeight, setHeaderHeight] = useState(0);

  // ✅ override view (برای وقتی از ReviewResult می‌خوایم مستقیم بیایم روی Review)
  const [forceView, setForceView] = useState<null | "review">(null);

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

  /* ----------------------------- Fetch State ----------------------------- */
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
        const merged: PelekanState = {
          ...initialState,
          ...data,
          tabState: data.tabState as TabState,
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
    [me?.phone]
  );

  useEffect(() => {
    fetchState({ initial: true });
  }, [fetchState]);

  useFocusEffect(
    useCallback(() => {
      fetchState({ initial: false });
    }, [fetchState])
  );

  // ✅ اگر از ReviewResult با focus=review_tests برگشتیم، Review رو فورس کن
  useEffect(() => {
    if (focus !== "review_tests") return;

    // 1) فورس view
    setForceView("review");

    // 2) پاک کردن پارامتر (ولی بعد از یک tick تا رندر انجام بشه و فورس اعمال بشه)
    const t = setTimeout(() => {
      router.replace("/(tabs)/Pelekan");
    }, 0);

    return () => clearTimeout(t);
  }, [focus, router]);

  // ✅ view نهایی با اولویت forceView
  const view: TabState = (forceView === "review" ? "review" : state.tabState) as TabState;

  /* ----------------------------- Treating List ----------------------------- */
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
        list.push({
          kind: "day",
          id: `d-${d.id}`,
          day: d as PelekanDay,
          stage: st,
          zig,
        });
      }

      list.push({ kind: "spacer", id: `sp-${st.id}` });
    }

    return list;
  }, [state.tabState, state.stages, state?.baseline?.session, state?.review?.session]);

  /* ----------------------------- Handlers ----------------------------- */
  const onTapActiveDay = useCallback(
    (day: PelekanDay) => {
      if (state?.ui?.paywall?.needed || state?.treatmentAccess !== "full") {
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

  /* ----------------------------- Layout ----------------------------- */
  const bottomSafe = insets.bottom + tabBarH;
  const listPaddingBottom = 24;
  const listPaddingTop = Math.max(16, bottomSafe + 16);

  if (initialLoading) {
    return (
      <SafeAreaView edges={["top"]} style={[styles.root, { backgroundColor: palette.bg }]}>
        <View style={styles.center}>
          <ActivityIndicator color="#D4AF37" />
          <Text style={{ color: "#E5E7EB", marginTop: 8, fontSize: 12 }}>در حال بارگذاری…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.bg }]} edges={["top", "left", "right", "bottom"]}>
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

        <View style={[styles.topCol, styles.colRight]} />
      </View>

      <TopBanner enabled headerHeight={headerHeight} />

      {refreshing && (
        <View style={{ paddingVertical: 8, alignItems: "center" }}>
          <ActivityIndicator color="#D4AF37" />
        </View>
      )}

      {/* Content */}
      <View style={{ flex: 1 }}>
        {view === "baseline_assessment" || view === "baseline_result" ? (
          <View style={{ flex: 1, paddingBottom: bottomSafe }}>
            <Baseline me={me} state={state} onRefresh={() => fetchState({ initial: false })} />
          </View>
        ) : view === "choose_path" ? (
          <View style={{ flex: 1, paddingBottom: bottomSafe }}>
            <ChoosePath me={me} state={state} onRefresh={() => fetchState({ initial: false })} />
          </View>
        ) : view === "review" ? (
          <View style={{ flex: 1, paddingBottom: bottomSafe }}>
            <Review
              me={me}
              state={state}
              onRefresh={async () => {
                await fetchState({ initial: false });
                // ✅ بعد از رفرش، فورس رو آزاد کن تا state.tabState دوباره کنترل رو بگیره
                setForceView(null);
              }}
            />
          </View>
        ) : view === "treating" ? (
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
            contentContainerStyle={{
              paddingTop: listPaddingTop,
              paddingBottom: listPaddingBottom,
            }}
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