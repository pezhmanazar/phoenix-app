// app/(tabs)/Pelekan.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  InteractionManager,
  StyleSheet,
  Text,
  View,
} from "react-native";
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
  | "review_result" // ✅ NEW: سرور می‌فرستد
  | "treating";
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

// ✅ همان کلیدی که در IdlePlaceholder گذاشتی
const KEY_START_GATE = "pelekan:idle:start_gate:v1";

export default function PelekanTab() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const focus = String((params as any)?.focus || "").trim();
  const autoStart = String((params as any)?.autoStart || "").trim(); // ✅ NEW
  const enterTreatment = String((params as any)?.enterTreatment || "").trim(); // ✅ NEW

  const insets = useSafeAreaInsets();
  const tabBarH = useBottomTabBarHeight();
  const { me } = useUser();

  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [state, setState] = useState<PelekanState>(initialState);
  const [headerHeight, setHeaderHeight] = useState(0);

  const [forceView, setForceView] = useState<null | "review">(null);

  // ✅ اگر لازم شد tabState را به زور override کنیم (autoStart / gate)
  const [forceTab, setForceTab] = useState<null | TabState>(null);

  const mountedRef = useRef(false);
  const lastFocusRef = useRef<string>("__init__");
  const fetchSeqRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // ✅ FlatList ref برای اسکرول خودکار به روز فعال
  const listRef = useRef<FlatList<ListItem>>(null);
  const lastAutoScrolledDayIdRef = useRef<string | null>(null);

  // ✅ جلوگیری از دیده شدن “لیست نصفه” قبل از آماده شدن activeIndex
  const [treatingBoot, setTreatingBoot] = useState(false);

  // ✅ NEW: Gate boot + ready
  const [gateBoot, setGateBoot] = useState(true);
  const [startGateReady, setStartGateReady] = useState(false);

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

  // ✅ NEW: read start gate (persisted)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const v = await AsyncStorage.getItem(KEY_START_GATE);
        if (!alive) return;
        setStartGateReady(v === "1");
      } catch {
        if (!alive) return;
        setStartGateReady(false);
      } finally {
        if (!alive) return;
        setGateBoot(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* ----------------------------- Fetch State ----------------------------- */
  const fetchState = useCallback(
    async (opts?: { initial?: boolean; reason?: string }) => {
      const isInitial = !!opts?.initial;
      const reason = opts?.reason || (isInitial ? "initial" : "refresh");
      const phone = me?.phone;

      const seq = ++fetchSeqRef.current;

      try {
        abortRef.current?.abort();
      } catch {}
      const controller = new AbortController();
      abortRef.current = controller;

      console.log("🧭 [PelekanTab] fetchState:start", {
        seq,
        reason,
        isInitial,
        phone: phone || null,
        focus,
        autoStart,
        enterTreatment, // ✅ NEW
        forceView,
        forceTab,
        startGateReady,
        gateBoot,
      });

      try {
        if (isInitial) setInitialLoading(true);
        else setRefreshing(true);

        if (!phone) {
          console.log("⚠️ [PelekanTab] no phone -> initialState", { seq });
          if (seq === fetchSeqRef.current) setState(initialState);
          return;
        }

        // ✅ NEW: build qs properly + pass enterTreatment to backend (one-shot)
        const qs = new URLSearchParams({ phone: String(phone) });
        if (enterTreatment) qs.set("enterTreatment", enterTreatment);

        const url = `https://api.qoqnoos.app/api/pelekan/state?${qs.toString()}`;
        console.log("🌐 [PelekanTab] GET", { seq, url });

        const res = await fetch(url, {
          headers: { "Cache-Control": "no-store" },
          signal: controller.signal,
        });

        if (controller.signal.aborted) {
          console.log("🧯 [PelekanTab] aborted after fetch()", { seq });
          return;
        }

        let json: any = null;
        try {
          json = await res.json();
        } catch {
          json = null;
        }

        if (seq !== fetchSeqRef.current) {
          console.log("🧯 [PelekanTab] stale response ignored", {
            seq,
            latest: fetchSeqRef.current,
            http: res.status,
            ok: json?.ok,
          });
          return;
        }

        if (!res.ok || !json?.ok) {
          console.log("❌ [PelekanTab] state not ok", {
            seq,
            http: res.status,
            ok: json?.ok,
            error: json?.error,
          });
          setState(initialState);
          return;
        }

        const data = json.data || {};

        // merge stage meta
        const stagesWithDays = Array.isArray(data?.stages) ? data.stages : [];
        const tStages = Array.isArray(data?.treatment?.stages)
          ? data.treatment.stages
          : [];

        const tMap = new Map<string, any>();
        for (const s of tStages) {
          const code = String(s?.code || "").trim();
          if (code) tMap.set(code, s);
        }

        const mergedStages = stagesWithDays.map((s: any) => {
          const code = String(s?.code || "").trim();
          const tMeta = tMap.get(code);
          return {
            ...s,
            id: s?.id ?? `stage:${code}`,
            title: s?.title ?? tMeta?.title ?? code,
            status: s?.status ?? tMeta?.status ?? "locked",
          };
        });

        // derive activeDayId
        const t = data?.treatment;
        const activeStageCode = String(t?.activeStage || "").trim();
        const activeDayNumber = Number(t?.activeDay || 0);

        let derivedActiveDayId: string | null = null;
        if (activeStageCode && activeDayNumber > 0) {
          const st = mergedStages.find(
            (x: any) => String(x?.code || "").trim() === activeStageCode
          );
          const dayRow = (st?.days || []).find(
            (d: any) => Number(d?.dayNumberInStage || 0) === activeDayNumber
          );
          derivedActiveDayId = dayRow?.id ?? null;
        }

        const progressFromApi = data?.progress ?? null;
        const activeDayIdFinal =
          progressFromApi?.activeDayId ?? derivedActiveDayId ?? null;

        const safeProgress = progressFromApi
          ? { ...progressFromApi, activeDayId: activeDayIdFinal }
          : {
              activeDayId: activeDayIdFinal,
              dayProgress: [],
              taskProgress: [],
              xpTotal: 0,
              streak: { currentDays: 0, bestDays: 0, lastCompletedAt: null },
            };

        const merged: PelekanState = {
          ...initialState,
          ...data,
          tabState: (data.tabState as TabState) || initialState.tabState,
          ui: {
            paywall: data?.ui?.paywall ?? initialState.ui.paywall,
            flags: data?.ui?.flags ?? {},
          },
          treatment: data?.treatment ?? null,
          stages: mergedStages,
          progress: safeProgress,
        };

        if (seq === fetchSeqRef.current) setState(merged);
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (
          msg.toLowerCase().includes("aborted") ||
          msg.toLowerCase().includes("abort")
        ) {
          console.log("🧯 [PelekanTab] fetch aborted (caught)");
          return;
        }
        console.log("💥 [PelekanTab] fetchState:error", { msg });
        if (seq === fetchSeqRef.current) setState(initialState);
      } finally {
        if (seq === fetchSeqRef.current) {
          if (isInitial) setInitialLoading(false);
          else setRefreshing(false);
          console.log("🧭 [PelekanTab] fetchState:end", { seq, reason, isInitial });
        }
      }
    },
    [
      me?.phone,
      focus,
      autoStart,
      enterTreatment, // ✅ NEW
      forceView,
      forceTab,
      startGateReady,
      gateBoot,
    ]
  );

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      console.log("🔁 [PelekanTab] mount");
    }
    fetchState({ initial: true, reason: "mount_or_phone_change" });
  }, [me?.phone, fetchState]);

  useFocusEffect(
    useCallback(() => {
      if (initialLoading) {
        console.log("⏭️ [PelekanTab] focus refresh skipped (initialLoading)");
        return;
      }
      fetchState({ initial: false, reason: "focus" });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchState, initialLoading])
  );

  // ✅ NEW: one-shot param cleanup (enterTreatment should not stick)
  useEffect(() => {
    if (!enterTreatment) return;

    const t = setTimeout(() => {
      router.replace("/(tabs)/Pelekan");
    }, 0);

    return () => clearTimeout(t);
  }, [enterTreatment, router]);

  // ✅ وضعیت baseline (گیت سخت)
  const baselineStatus = String(state?.baseline?.session?.status || "");
  const baselineDone = baselineStatus === "completed";
  const baselineInProgress =
    !!state?.ui?.flags?.isBaselineInProgress ||
    (!!state?.baseline?.session && !baselineDone);

  const baselineCompletedFlag = state?.ui?.flags?.isBaselineCompleted;
  const baselineCompleted = baselineCompletedFlag === true || baselineDone;

  /**
   * ✅ focus/autoStart handler
   */
  useEffect(() => {
    const key = `${focus}__${autoStart}`;
    if (lastFocusRef.current === key) return;
    lastFocusRef.current = key;

    const wantsReview = focus === "review_tests" || autoStart === "review_tests";
    const wantsBaseline = autoStart === "baseline";

    if (wantsReview) {
      setForceView("review");
      setForceTab(null);

      const t = setTimeout(() => {
        router.replace("/(tabs)/Pelekan");
      }, 0);

      return () => clearTimeout(t);
    }

    if (wantsBaseline) {
      setForceTab("baseline_assessment");
      setForceView(null);

      const t = setTimeout(() => {
        router.replace("/(tabs)/Pelekan");
      }, 0);

      return () => clearTimeout(t);
    }
  }, [focus, autoStart, router]);

  const reviewSessStatus = String(state?.review?.session?.status || "");
  const keepReview =
    forceView === "review" ||
    state.tabState === "review" ||
    reviewSessStatus === "in_progress";

  // ✅ VIEW: اول forceTab، بعد keepReview، بعد tabState
  let view: TabState = ((forceTab as any) ||
    (keepReview ? "review" : state.tabState)) as TabState;

  // ✅ FIX: review_result باید همان مسیر درمان را نشان بدهد (وگرنه می‌افتد تو IdlePlaceholder)
  if (view === "review_result") view = "treating";

  /**
   * ✅ NEW: gate start (دایره شروع)
   * - تا وقتی کاربر "شروع" نزده و baseline هم شروع نشده => view باید idle بماند
   * - اگر baseline واقعاً شروع شده (session ساخته شده) یا autoStart=baseline => گیت بی‌اثر
   */
  const baselineHasSession = !!state?.baseline?.session;
  const gateAllowsBaseline =
    startGateReady ||
    baselineHasSession ||
    autoStart === "baseline" ||
    forceTab === "baseline_assessment";

  // ✅ گیت baseline/treating
  if (!baselineCompleted) {
    if (!gateAllowsBaseline) {
      // هنوز اجازه ندادی آزمون شروع بشه => فقط Idle (دایره شروع)
      view = "idle";
    } else {
      // اجازه داده شده/شروع شده => رفتار قبلی تو
      if (!baselineDone || baselineInProgress) view = "baseline_assessment";
      else view = "baseline_result";
    }
  }

  // ✅ NEW: stateForView تا کامپوننت‌ها با view همگام باشند
  const stateForView = useMemo(() => {
    return { ...state, tabState: view };
  }, [state, view]);

  // ✅ XP for header (right side)
  const xpTotal = Number(state?.progress?.xpTotal ?? 0);
  const xpText = String(xpTotal);

  /* ----------------------------- Treating List ----------------------------- */
  const pathItems: ListItem[] = useMemo(() => {
    if (view !== "treating") return [];

    const stages = state.stages || [];
    const list: ListItem[] = [];
    let zigCounter = 0;

    const baselineDoneLocal = state?.baseline?.session?.status === "completed";
    const reviewChosen = !!state?.review?.session?.chosenPath;
    const rs = String(state?.review?.session?.status || "");
    const reviewDone =
      rs === "completed_locked" ||
      rs === "unlocked" ||
      !!state?.review?.session?.completedAt ||
      !!state?.review?.session?.test2CompletedAt ||
      !!state?.review?.session?.test1CompletedAt ||
      !!state?.review?.session?.test2SkippedAt;

    const resultsDone = !!(baselineDoneLocal && reviewChosen && reviewDone);

    list.push({
      kind: "results",
      id: "results-0",
      zig: "L",
      titleFa: "سنجش",
      done: resultsDone,
    } as any);

    list.push({
      kind: "start",
      id: "start-0",
      zig: "R",
      titleFa: "شـــروع",
      done: false,
    } as any);

    const activeStageCode = String(state?.treatment?.activeStage || "").trim();
    const activeStage =
      stages.find((s) => String(s?.code || "").trim() === activeStageCode) ||
      null;

    for (const st of stages) {
      const code = String(st?.code || "").trim();
      const isActive = !!activeStage && code === String(activeStage.code || "");
      const isPast =
        !!activeStage && (st.sortOrder ?? 0) < (activeStage.sortOrder ?? 0);

      const zig: "L" | "R" = zigCounter++ % 2 === 0 ? "L" : "R";
      list.push({
        kind: "stage_node",
        id: `sn-${st.id}`,
        zig,
        stage: st,
        done: isPast ? true : false,
        active: isActive ? true : false,
      } as any);

      if (isActive || String(st?.code || "") === "bastan") {
        for (const d of st.days || []) {
          const z2: "L" | "R" = zigCounter++ % 2 === 0 ? "L" : "R";
          list.push({
            kind: "day",
            id: `d-${d.id}`,
            day: d as PelekanDay,
            stage: st,
            zig: z2,
          });
        }
      }

      list.push({ kind: "spacer", id: `sp-${st.id}` } as any);
    }

    return list;
  }, [
    view,
    state.stages,
    state?.baseline?.session,
    state?.review?.session,
    state?.treatment?.activeStage,
  ]);

  const activeDayId = state?.progress?.activeDayId ?? null;

  const activeIndex = useMemo(() => {
    if (!activeDayId) return -1;
    return pathItems.findIndex(
      (it: any) =>
        it?.kind === "day" && String(it?.day?.id || "") === String(activeDayId)
    );
  }, [pathItems, activeDayId]);

  const ITEM_H = 120;
  const SPACER_H = 10;

  const heights = useMemo(
    () =>
      pathItems.map((it: any) => (it?.kind === "spacer" ? SPACER_H : ITEM_H)),
    [pathItems]
  );

  const offsets = useMemo(() => {
    const out: number[] = new Array(heights.length);
    let acc = 0;
    for (let i = 0; i < heights.length; i++) {
      out[i] = acc;
      acc += heights[i];
    }
    return out;
  }, [heights]);

  const getItemLayout = useCallback(
    (_: any, index: number) => {
      const length = heights[index] ?? ITEM_H;
      const offset = offsets[index] ?? 0;
      return { length, offset, index };
    },
    [heights, offsets]
  );

  useEffect(() => {
    if (view !== "treating") return;
    if (!activeDayId) return;
    if (activeIndex < 0) return;
    if (!pathItems.length) return;

    if (lastAutoScrolledDayIdRef.current === activeDayId) return;
    lastAutoScrolledDayIdRef.current = activeDayId;

    const task = InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        console.log("🎯 [PelekanTab] scrollToActive", {
          activeDayId,
          activeIndex,
          total: pathItems.length,
          inverted: true,
        });
        try {
          listRef.current?.scrollToIndex({
            index: activeIndex,
            animated: false,
            viewPosition: 0.35,
          });
        } catch (e: any) {
          console.log(
            "🧯 [PelekanTab] scrollToIndex threw",
            String(e?.message || e)
          );
        }
      });
    });

    return () => task.cancel?.();
  }, [view, activeDayId, activeIndex, pathItems.length]);

  useEffect(() => {
    if (view !== "treating") {
      setTreatingBoot(false);
      return;
    }

    // ✅ اگر هنوز activeDayId نداریم (قبل از روز ۱ / هنوز درمان شروع نشده)
    // نباید لودینگ بی‌نهایت بگیریم؛ لیست باید نمایش داده شود.
    if (!activeDayId) {
      setTreatingBoot(false);
      return;
    }

    // ✅ اگر activeDayId داریم ولی هنوز ایندکسش پیدا نشده/لیست خالی است، آنوقت لودینگ منطقی است
    if (activeIndex < 0 || !pathItems.length) {
      setTreatingBoot(true);
      return;
    }

    const t = setTimeout(() => setTreatingBoot(false), 60);
    return () => clearTimeout(t);
  }, [view, activeDayId, activeIndex, pathItems.length]);

  /* ----------------------------- Handlers ----------------------------- */
  const onTapStart = useCallback(() => {
    console.log("👆 [PelekanTab] onTapStart -> /pelekan/bastan");
    router.push("/pelekan/bastan" as any);
  }, [router]);

  const onTapActiveDay = useCallback(
    (day: PelekanDay, opts?: { mode: "active" | "preview" }) => {
      const stageId = String((day as any)?.stageId || "");
      const st = (state?.stages || []).find(
        (x: any) => String(x?.id) === stageId
      );
      const stageCode = String(st?.code || "").trim();
      const n = Number((day as any)?.dayNumberInStage || 0);

      console.log("👆 [PelekanTab] onTapActiveDay", {
        dayId: day?.id,
        stageCode,
        mode: opts?.mode,
        dayNumberInStage: n,
        paywallNeeded: state?.ui?.paywall?.needed,
        treatmentAccess: state?.treatmentAccess,
      });

      if (state?.ui?.paywall?.needed || state?.treatmentAccess !== "full") {
        console.log("🔒 [PelekanTab] blocked by paywall/access -> Subscription");
        router.push("/(tabs)/Subscription");
        return;
      }

      if (stageCode === "bastan") {
        const BASTAN_ACTION_CODES = [
          "reality_check",
          "adult_responsibility",
          "unsent_letter",
          "trigger_detox",
          "limited_contact",
          "meaning_learning",
          "closure_ritual",
          "commitment_contract",
        ] as const;

        const actionCode = BASTAN_ACTION_CODES[n - 1];

        console.log("🧭 [PelekanTab] bastan -> action route", { n, actionCode });

        if (!actionCode) {
          console.log(
            "⚠️ [PelekanTab] bastan actionCode missing -> go to bastan list"
          );
          router.push("/pelekan/bastan" as any);
          return;
        }

        router.push(
          `/pelekan/bastan/action/${encodeURIComponent(actionCode)}` as any
        );
        return;
      }

      if (stageCode === "gosastan") {
        console.log("🧭 [PelekanTab] gosastan -> day route", { n });
        router.push("/pelekan/gosastan/day1" as any);
        return;
      }

      router.push({
        pathname: "/pelekan/day/[id]",
        params: { id: day.id },
      } as any);
    },
    [router, state?.ui?.paywall?.needed, state?.treatmentAccess, state?.stages]
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

  // ✅ ضد فلیکر: اگر گیت هنوز لود نشده و baseline هم کامل نیست، نمایش را نگه دار
  if (initialLoading || (gateBoot && !baselineCompleted)) {
    return (
      <SafeAreaView
        edges={["top"]}
        style={[styles.root, { backgroundColor: palette.bg }]}
      >
        <View style={styles.center}>
          <ActivityIndicator color="#D4AF37" />
          <Text style={{ color: "#E5E7EB", marginTop: 8, fontSize: 12 }}>
            در حال بارگذاری…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: palette.bg }]}
      edges={["top", "left", "right", "bottom"]}
    >
      {/* Header */}
      <View
        onLayout={(e) => {
          const h = e?.nativeEvent?.layout?.height ?? 0;
          if (h && h !== headerHeight) setHeaderHeight(h);
        }}
        style={[
          styles.topBar,
          { backgroundColor: palette.glass, borderBottomColor: palette.border },
        ]}
      >
        <View style={[styles.topCol, styles.colLeft]}>
          <PlanStatusBadge me={me} showExpiringText />
        </View>

        <View style={[styles.topCol, styles.colCenter]}>
          <Text style={{ color: palette.text, fontWeight: "900" }}>پلکــــان</Text>
        </View>

        <View style={[styles.topCol, styles.colRight]}>
          <View style={styles.xpPill}>
            <Ionicons name="flash" size={14} color="#D4AF37" />
            <Text style={styles.xpText}>{xpText}</Text>
            <Text style={styles.xpLabel}>XP</Text>
          </View>
        </View>
      </View>

      <TopBanner enabled headerHeight={headerHeight} />

      {refreshing && (
        <View style={{ paddingVertical: 8, alignItems: "center" }}>
          <ActivityIndicator color="#D4AF37" />
        </View>
      )}

      <View style={{ flex: 1 }}>
        {view === "baseline_assessment" || view === "baseline_result" ? (
          <View style={{ flex: 1, paddingBottom: bottomSafe }}>
            <Baseline
              me={me}
              state={stateForView}
              onRefresh={() =>
                fetchState({ initial: false, reason: "baseline_refresh" })
              }
            />
          </View>
        ) : view === "choose_path" ? (
          <View style={{ flex: 1, paddingBottom: bottomSafe }}>
            <ChoosePath
              me={me}
              state={stateForView}
              onRefresh={() =>
                fetchState({ initial: false, reason: "choose_path_refresh" })
              }
            />
          </View>
        ) : view === "review" ? (
          <View style={{ flex: 1, paddingBottom: bottomSafe }}>
            <Review
              me={me}
              state={stateForView}
              onRefresh={async () => {
                await fetchState({ initial: false, reason: "review_refresh" });
                setForceView(null);
                setForceTab(null);
              }}
            />
          </View>
        ) : view === "treating" ? (
          <View style={{ flex: 1 }}>
            {treatingBoot ? (
              <View style={styles.center}>
                <ActivityIndicator color="#D4AF37" />
                <Text style={{ color: "#E5E7EB", marginTop: 8, fontSize: 12 }}>
                  در حال آماده‌سازی مسیر…
                </Text>
              </View>
            ) : null}

            <FlatList
              ref={listRef}
              style={{ flex: 1, opacity: treatingBoot ? 0 : 1 }}
              data={pathItems}
              keyExtractor={(it) => it.id}
              renderItem={({ item, index }) => (
                <TreatmentView
                  item={item}
                  index={index}
                  state={stateForView as unknown as TreatmentViewState}
                  onTapActiveDay={onTapActiveDay}
                  onTapResults={onTapResults}
                  onTapStart={onTapStart}
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
              getItemLayout={getItemLayout}
              initialScrollIndex={
                activeIndex >= 0 && activeIndex < pathItems.length
                  ? activeIndex
                  : undefined
              }
              onScrollToIndexFailed={(info) => {
                console.log("🧯 [PelekanTab] onScrollToIndexFailed", {
                  index: info.index,
                  highestMeasuredFrameIndex: info.highestMeasuredFrameIndex,
                  averageItemLength: info.averageItemLength,
                });

                requestAnimationFrame(() => {
                  try {
                    const approxOffset =
                      (info.averageItemLength || ITEM_H) * info.index;
                    listRef.current?.scrollToOffset({
                      offset: Math.max(0, approxOffset),
                      animated: false,
                    });
                    requestAnimationFrame(() => {
                      listRef.current?.scrollToIndex({
                        index: info.index,
                        animated: false,
                        viewPosition: 0.35,
                      });
                    });
                  } catch {}
                });
              }}
            />
          </View>
        ) : (
          <View style={{ flex: 1, paddingBottom: bottomSafe }}>
            <IdlePlaceholder
              me={me}
              state={stateForView}
              onRefresh={() =>
                fetchState({ initial: false, reason: "idle_refresh" })
              }
            />
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

  xpPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.12)",
    backgroundColor: "rgba(255,255,255,.04)",
  },
  xpText: {
    color: "#F9FAFB",
    fontWeight: "900",
    fontSize: 13,
    textAlign: "left",
  },
  xpLabel: {
    color: "rgba(231,238,247,.70)",
    fontWeight: "900",
    fontSize: 11,
    marginLeft: 2,
  },
});