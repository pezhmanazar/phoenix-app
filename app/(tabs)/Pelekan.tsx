// app/(tabs)/Pelekan.tsx
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
type Paywall = { needed: boolean; reason: "start_treatment" | "continue_treatment" | null };
type PelekanFlags = { suppressPaywall?: boolean; isBaselineInProgress?: boolean; isBaselineCompleted?: boolean };

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

  const [forceView, setForceView] = useState<null | "review">(null);

  const mountedRef = useRef(false);
  const lastFocusRef = useRef<string>("__init__");
  const fetchSeqRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

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

      const seq = ++fetchSeqRef.current;

      try {
        abortRef.current?.abort();
      } catch {}
      const controller = new AbortController();
      abortRef.current = controller;

      console.log("🧭 [PelekanTab] fetchState:start", { seq, reason, isInitial, phone: phone || null, focus, forceView });

      try {
        if (isInitial) setInitialLoading(true);
        else setRefreshing(true);

        if (!phone) {
          console.log("⚠️ [PelekanTab] no phone -> initialState", { seq });
          if (seq === fetchSeqRef.current) setState(initialState);
          return;
        }

        const url = `https://api.qoqnoos.app/api/pelekan/state?phone=${encodeURIComponent(phone)}`;
        console.log("🌐 [PelekanTab] GET", { seq, url });

        const res = await fetch(url, { headers: { "Cache-Control": "no-store" }, signal: controller.signal });

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
          console.log("🧯 [PelekanTab] stale response ignored", { seq, latest: fetchSeqRef.current, http: res.status, ok: json?.ok });
          return;
        }

        if (!res.ok || !json?.ok) {
          console.log("❌ [PelekanTab] state not ok", { seq, http: res.status, ok: json?.ok, error: json?.error });
          setState(initialState);
          return;
        }

        const data = json.data || {};

        // merge stage meta
        const stagesWithDays = Array.isArray(data?.stages) ? data.stages : [];
        const tStages = Array.isArray(data?.treatment?.stages) ? data.treatment.stages : [];

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
          const st = mergedStages.find((x: any) => String(x?.code || "").trim() === activeStageCode);
          const dayRow = (st?.days || []).find((d: any) => Number(d?.dayNumberInStage || 0) === activeDayNumber);
          derivedActiveDayId = dayRow?.id ?? null;
        }

        const progressFromApi = data?.progress ?? null;
        const activeDayIdFinal = progressFromApi?.activeDayId ?? derivedActiveDayId ?? null;

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
          ui: { paywall: data?.ui?.paywall ?? initialState.ui.paywall, flags: data?.ui?.flags ?? {} },
          treatment: data?.treatment ?? null,
          stages: mergedStages,
          progress: safeProgress,
        };

        if (seq === fetchSeqRef.current) setState(merged);
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (msg.toLowerCase().includes("aborted") || msg.toLowerCase().includes("abort")) {
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
    [me?.phone, focus, forceView]
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

  const reviewChosenPath = String(state?.review?.session?.chosenPath || "");

  useEffect(() => {
    if (lastFocusRef.current === focus) return;
    lastFocusRef.current = focus;

    if (focus !== "review_tests") return;

    if (reviewChosenPath === "review") setForceView("review");

    const t = setTimeout(() => {
      router.replace("/(tabs)/Pelekan");
    }, 0);

    return () => clearTimeout(t);
  }, [focus, router, reviewChosenPath]);

  const reviewSessStatus = String(state?.review?.session?.status || "");
  const keepReview = forceView === "review" || state.tabState === "review" || reviewSessStatus === "in_progress";
  const view: TabState = (keepReview ? "review" : state.tabState) as TabState;

  /* ----------------------------- Treating List ----------------------------- */
  const pathItems: ListItem[] = useMemo(() => {
    if (state.tabState !== "treating") return [];

    const stages = state.stages || [];
    const list: ListItem[] = [];
    let zigCounter = 0;

    // ✅ نتایج
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
      titleFa: "سنجش",
      done: resultsDone,
    } as any);

    // ✅ NEW: دایره شروع درمان (بعد از سنجش)
    list.push({
      kind: "start",
      id: "start-0",
      zig: "R",
      titleFa: "شــــــــروع",
      // این دایره همیشه قابل کلیک است (حتی اگر کاربر free باشد)
      // ویس + paywall را داخل /pelekan/bastan مدیریت می‌کنیم
      done: false,
    } as any);

    // ✅ مرحله فعال از state.treatment.activeStage
    const activeStageCode = String(state?.treatment?.activeStage || "").trim();
    const activeStage = stages.find((s) => String(s?.code || "").trim() === activeStageCode) || null;

    // ✅ برای مراحل: فقط activeStage روز دارد، بقیه فقط اسم مرحله به شکل دایره (StageNode)
    for (const st of stages) {
      const code = String(st?.code || "").trim();
      const isActive = !!activeStage && code === String(activeStage.code || "");
      const isPast = !!activeStage && (st.sortOrder ?? 0) < (activeStage.sortOrder ?? 0);

      // دایره اسم مرحله (همه مراحل)
      const zig: "L" | "R" = zigCounter++ % 2 === 0 ? "L" : "R";
      list.push({
        kind: "stage_node",
        id: `sn-${st.id}`,
        zig,
        stage: st,
        // past stages => done style (فقط ظاهری)
        done: isPast ? true : false,
        // active stage => available style (فقط ظاهری)
        active: isActive ? true : false,
      } as any);

      // فقط برای مرحله فعال: روزها را نشان بده
      if (isActive) {
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
  }, [state.tabState, state.stages, state?.baseline?.session, state?.review?.session, state?.treatment?.activeStage]);

  /* ----------------------------- Handlers ----------------------------- */

  // ✅ کلیک روی start: همیشه برو به bastan list (ویس + paywall)
  const onTapStart = useCallback(() => {
    console.log("👆 [PelekanTab] onTapStart -> /pelekan/bastan");
    router.push("/pelekan/bastan" as any);
  }, [router]);

  const onTapActiveDay = useCallback(
    (day: PelekanDay, opts?: { mode: "active" | "preview" }) => {
      const stageId = String((day as any)?.stageId || "");
      const st = (state?.stages || []).find((x: any) => String(x?.id) === stageId);
      const stageCode = String(st?.code || "");

      console.log("👆 [PelekanTab] onTapActiveDay", {
        dayId: day?.id,
        stageCode,
        mode: opts?.mode,
        dayNumberInStage: (day as any)?.dayNumberInStage,
        paywallNeeded: state?.ui?.paywall?.needed,
        treatmentAccess: state?.treatmentAccess,
      });

      // paywall gate (برای dayها)
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

        const n = Number((day as any)?.dayNumberInStage || 0);
        const actionCode = BASTAN_ACTION_CODES[n - 1];

        console.log("🧭 [PelekanTab] bastan -> action route", { n, actionCode });

        if (!actionCode) {
          console.log("⚠️ [PelekanTab] bastan actionCode missing -> go to bastan list");
          router.push("/pelekan/bastan" as any);
          return;
        }

        router.push(`/pelekan/bastan/action/${encodeURIComponent(actionCode)}` as any);
        return;
      }

      router.push({ pathname: "/pelekan/day/[id]", params: { id: day.id } });
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
                await fetchState({ initial: false, reason: "review_refresh" });
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