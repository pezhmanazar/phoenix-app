import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

  // ✅ refs برای لاگ امن (بدون dependency-loop)
  const mountedRef = useRef(false);
  const lastFocusRef = useRef<string>("__init__");

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
    async (opts?: { initial?: boolean; reason?: string }) => {
      const isInitial = !!opts?.initial;
      const reason = opts?.reason || (isInitial ? "initial" : "refresh");

      const phone = me?.phone;

      console.log("🧭 [PelekanTab] fetchState:start", {
        reason,
        isInitial,
        phone: phone || null,
        focus,
        forceView,
      });

      try {
        if (isInitial) setInitialLoading(true);
        else setRefreshing(true);

        if (!phone) {
          console.log("⚠️ [PelekanTab] no phone -> initialState");
          setState(initialState);
          return;
        }

        const url = `https://api.qoqnoos.app/api/pelekan/state?phone=${encodeURIComponent(phone)}`;
        console.log("🌐 [PelekanTab] GET", url);

        const res = await fetch(url, { headers: { "Cache-Control": "no-store" } });
        const json = await res.json().catch(() => null);

        if (!json?.ok) {
          console.log("❌ [PelekanTab] state not ok", json);
          setState(initialState);
          return;
        }

        const data = json.data || {};

        console.log("✅ [PelekanTab] state ok", {
          tabState: data?.tabState,
          treatmentAccess: data?.treatmentAccess,
          paywall: data?.ui?.paywall,
          baselineStatus: data?.baseline?.session?.status,
          reviewStatus: data?.review?.session?.status,
          reviewChosenPath: data?.review?.session?.chosenPath,
        });

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
      } catch (e: any) {
        console.log("💥 [PelekanTab] fetchState:error", String(e?.message || e));
        setState(initialState);
      } finally {
        if (isInitial) setInitialLoading(false);
        else setRefreshing(false);

        console.log("🧭 [PelekanTab] fetchState:end", { reason, isInitial });
      }
    },
    [me?.phone, focus, forceView]
  );

  // ✅ Initial fetch فقط وقتی phone عوض شد (نه هر رندر)
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      console.log("🔁 [PelekanTab] mount");
    }
    fetchState({ initial: true, reason: "mount_or_phone_change" });
    // فقط phone trigger باشد
  }, [me?.phone, fetchState]);

  // ✅ Refresh وقتی تب فوکوس می‌گیرد (بدون params در deps)
  useFocusEffect(
    useCallback(() => {
      console.log("🎯 [PelekanTab] focus -> refresh", {
        phone: me?.phone || null,
        focus,
        forceView,
        tabState: state.tabState,
      });
      fetchState({ initial: false, reason: "focus" });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchState])
  );

  // ✅ NEW: chosenPath برای گیت‌کردن focus=review_tests
  const reviewChosenPath = String(state?.review?.session?.chosenPath || "");

  // ✅ focus handler (فقط وقتی واقعاً عوض شده)
  useEffect(() => {
    if (lastFocusRef.current === focus) return;
    lastFocusRef.current = focus;

    console.log("🧩 [PelekanTab] focus param changed", { focus });

    if (focus !== "review_tests") return;

    // ✅ فقط وقتی کاربر مسیر review را انتخاب کرده باشد forceView را review کن
    if (reviewChosenPath === "review") {
      console.log("🚨 [PelekanTab] focus=review_tests -> forceView=review (allowed)");
      setForceView("review");
    } else {
      console.log("🚫 [PelekanTab] focus=review_tests ignored (chosenPath != review)", { reviewChosenPath });
    }

    // پاک کردن پارامتر: بدون اینکه دوباره focus=review_tests بماند
    const t = setTimeout(() => {
      console.log("🧹 [PelekanTab] cleaning focus param -> router.replace(/(tabs)/Pelekan)");
      router.replace("/(tabs)/Pelekan");
    }, 0);

    return () => clearTimeout(t);
  }, [focus, router, reviewChosenPath]);

  // ✅ اگر Review در حال انجامه، حتی اگر tabState از سرور "treating" باشه، توی Review بمون
  const reviewSessStatus = String(state?.review?.session?.status || "");
  const keepReview =
    forceView === "review" ||
    state.tabState === "review" ||
    reviewSessStatus === "in_progress";

  const view: TabState = (keepReview ? "review" : state.tabState) as TabState;

  useEffect(() => {
    console.log("🟩 [PelekanTab] VIEW RESOLVE", {
      tabState: state.tabState,
      forceView,
      view,
      reviewChosenPath: state?.review?.session?.chosenPath,
      reviewStatus: state?.review?.session?.status,
    });
  }, [state.tabState, forceView, view, state?.review?.session?.chosenPath, state?.review?.session?.status]);

  /* ----------------------------- Treating List ----------------------------- */
  const pathItems: ListItem[] = useMemo(() => {
    if (state.tabState !== "treating") return [];
    const stages = state.stages || [];
    const list: ListItem[] = [];
    let zigCounter = 0;

    const baselineDone = state?.baseline?.session?.status === "completed";
    const reviewChosen = !!state?.review?.session?.chosenPath;
    const rs = String(state?.review?.session?.status || "");
const reviewDone =
  rs === "completed_locked" ||
  rs === "unlocked" ||
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
      console.log("👆 [PelekanTab] onTapActiveDay", {
        dayId: day?.id,
        paywallNeeded: state?.ui?.paywall?.needed,
        treatmentAccess: state?.treatmentAccess,
      });

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
    console.log("👆 [PelekanTab] onTapResults", { phone });
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
            <Baseline me={me} state={state} onRefresh={() => fetchState({ initial: false, reason: "baseline_refresh" })} />
          </View>
        ) : view === "choose_path" ? (
          <View style={{ flex: 1, paddingBottom: bottomSafe }}>
            <ChoosePath me={me} state={state} onRefresh={() => fetchState({ initial: false, reason: "choose_path_refresh" })} />
          </View>
        ) : view === "review" ? (
          <View style={{ flex: 1, paddingBottom: bottomSafe }}>
            <Review
              me={me}
              state={state}
              onRefresh={async () => {
                console.log("🔄 [PelekanTab] Review.onRefresh()");
                await fetchState({ initial: false, reason: "review_refresh" });
                console.log("🧯 [PelekanTab] releasing forceView");
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
            <IdlePlaceholder me={me} state={state} onRefresh={() => fetchState({ initial: false, reason: "idle_refresh" })} />
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