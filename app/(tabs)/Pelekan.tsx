// app/(tabs)/Pelekan.tsx
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useUser } from "../../hooks/useUser";

import PlanStatusBadge from "../../components/PlanStatusBadge";
import TopBanner from "../../components/TopBanner";

import Baseline from "../../components/pelekan/Baseline";
import ChoosePath from "../../components/pelekan/ChoosePath";
import IdlePlaceholder from "../../components/pelekan/IdlePlaceholder";

// ✅ این همون فایل جدیدته: components/pelekan/TreatmentView.tsx
import TreatmentView, { ListItem, PelekanDay, PelekanStage } from "../../components/pelekan/TreatmentView";

/* ----------------------------- Types ----------------------------- */
type PlanStatus = "free" | "pro" | "expired" | "expiring";
type TabState = "idle" | "baseline_assessment" | "choose_path" | "treating";
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
  ui: {
    paywall: Paywall;
    flags?: PelekanFlags;
  };
  baseline: any | null;
  path: any | null;
  review: any | null;
  bastanIntro: any | null;

  // ✅ برای TS: ممکنه سرور بده یا نده
  treatment: any | null;

  hasContent: boolean;
  stages: PelekanStage[]; // ✅ از تایپ TreatmentView استفاده کردیم
  progress: {
    activeDayId: string | null;
    dayProgress: any[];
    taskProgress: any[];
    xpTotal: number;
    streak: any;
  } | null;
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
  const insets = useSafeAreaInsets();
  const { me } = useUser();

  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<PelekanState>(initialState);
  const [headerHeight, setHeaderHeight] = useState(0);

  const fetchState = useCallback(async () => {
    try {
      setLoading(true);

      const phone = me?.phone;
      if (!phone) {
        setState(initialState);
        return;
      }

      const res = await fetch(
        `https://qoqnoos.app/api/pelekan/state?phone=${encodeURIComponent(phone)}`,
        { headers: { "Cache-Control": "no-store" } }
      );

      const json = await res.json();
      if (!json?.ok) {
        setState(initialState);
        return;
      }

      const data = json.data || {};
      const merged: PelekanState = {
        ...initialState,
        ...data,
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
      setLoading(false);
    }
  }, [me?.phone]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  useFocusEffect(
    useCallback(() => {
      fetchState();
    }, [fetchState])
  );

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

  // ✅ لیست پلکان برای FlatList (فقط وقتی treating هست)
  const pathItems: ListItem[] = useMemo(() => {
    if (state.tabState !== "treating") return [];
    const stages = state.stages || [];
    const list: ListItem[] = [];
    let zigCounter = 0;

    for (const st of stages) {
      list.push({ kind: "header", id: `h-${st.id}`, stage: st });

      for (const d of st.days || []) {
        const zig: "L" | "R" = zigCounter++ % 2 === 0 ? "L" : "R";
        list.push({ kind: "day", id: `d-${d.id}`, day: d as PelekanDay, stage: st, zig });
      }

      list.push({ kind: "spacer", id: `sp-${st.id}` });
    }

    return list;
  }, [state.tabState, state.stages]);

  const onTapActiveDay = useCallback((day: PelekanDay) => {
    // فعلاً فقط اینجاست تا کلیک کار کنه.
    // بعداً اینجا می‌فرستی به صفحه Day / Task.
    // مثلا: router.push(`/pelekan/day/${day.id}`)
    // فعلاً هیچ کاری نمی‌کنیم.
  }, []);

  if (loading) {
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

      {/* Header (همون ساختار قبلی) */}
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
          {/* فعلاً placeholder — بعداً XP و استریک جدید رو اینجا می‌ذاریم */}
          <Text style={{ color: palette.text, fontWeight: "900" }}>پلکان</Text>
        </View>

        <View style={[styles.topCol, styles.colRight]}>
          {/* فعلاً placeholder */}
          <Text style={{ color: "rgba(231,238,247,.7)", fontWeight: "900" }}> </Text>
        </View>
      </View>

      <TopBanner enabled headerHeight={headerHeight} />

      {/* Content */}
      <View style={{ flex: 1, paddingBottom: 12 + insets.bottom }}>
        {state.tabState === "baseline_assessment" ? (
          <Baseline me={me} state={state} onRefresh={fetchState} />
        ) : state.tabState === "choose_path" ? (
          <ChoosePath me={me} state={state} onRefresh={fetchState} />
        ) : state.tabState === "treating" ? (
          <FlatList
            data={pathItems}
            keyExtractor={(it) => it.id}
            renderItem={({ item, index }) => (
              <TreatmentView item={item} index={index} state={state} onTapActiveDay={onTapActiveDay} />
            )}
            inverted
            contentContainerStyle={{
              paddingTop: 8,
              paddingBottom: 16 + insets.bottom,
            }}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <IdlePlaceholder me={me} state={state} onRefresh={fetchState} />
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