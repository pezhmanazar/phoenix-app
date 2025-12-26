// app/pelekan/bastan/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useUser } from "../../../hooks/useUser";

type ActionUi = {
  code: string;
  titleFa: string;
  status: "locked" | "done" | "active";
  locked: boolean;
  lockReason: string | null;
  isProLocked: boolean;
  progress: { done: number; required: number; total: number };
};

type BastanStateResponse = {
  ok: boolean;
  data?: {
    user: { planStatus: "free" | "pro" | "expiring" | "expired"; daysLeft: number };
    intro: { completedAt: string | null; paywallNeededAfterIntro: boolean };
    contract: any;
    safety: any;
    gosastan: any;
    actions: ActionUi[];
  };
  error?: string;
};

export default function BastanScreen() {

  const insets = useSafeAreaInsets();
  const { me } = useUser();
  const phone = String(me?.phone || "").trim();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [actions, setActions] = useState<ActionUi[]>([]);
  const [introDone, setIntroDone] = useState(false);
  const [paywallAfterIntro, setPaywallAfterIntro] = useState(false);
  const router = useRouter();
  const apiBase = "https://api.qoqnoos.app";

  const fetchState = useCallback(async (opts?: { initial?: boolean }) => {
    const isInitial = !!opts?.initial;
    if (!phone) {
      setErr("NO_PHONE");
      setActions([]);
      setLoading(false);
      return;
    }

    try {
      setErr(null);
      if (isInitial) setLoading(true);
      else setRefreshing(true);

      const url = `${apiBase}/api/pelekan/bastan/state?phone=${encodeURIComponent(phone)}`;
      const res = await fetch(url, { headers: { "Cache-Control": "no-store" } });
      const json = (await res.json()) as BastanStateResponse;

      if (!res.ok || !json?.ok || !json.data) {
        setErr(json?.error || `HTTP_${res.status}`);
        setActions([]);
        return;
      }

      setActions(Array.isArray(json.data.actions) ? json.data.actions : []);
      setIntroDone(!!json.data.intro?.completedAt);
      setPaywallAfterIntro(!!json.data.intro?.paywallNeededAfterIntro);
    } catch (e: any) {
      setErr(String(e?.message || e));
      setActions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [phone]);

  useEffect(() => {
    fetchState({ initial: true });
  }, [fetchState]);

  const headerHint = useMemo(() => {
    if (!introDone) return "اول باید فایل صوتی مقدمه را کامل گوش کنی تا اقدام‌ها باز شوند.";
    if (paywallAfterIntro) return "بعد از مقدمه، ادامه‌ی اقدام‌ها نیاز به پرو دارد.";
    return "۸ اقدام مرحله «بستن»";
  }, [introDone, paywallAfterIntro]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, { paddingTop: insets.top }]} edges={["top", "left", "right"]}>
        <View style={styles.center}>
          <ActivityIndicator color="#D4AF37" />
          <Text style={styles.muted}>در حال بارگذاری…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { paddingTop: insets.top }]} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text style={styles.title}>مرحله بستن</Text>
        <Text style={styles.sub}>{headerHint}</Text>
      </View>

      {err ? (
        <View style={styles.errBox}>
          <Text style={styles.errText}>خطا: {err}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchState({ initial: true })}>
            <Text style={styles.retryText}>تلاش مجدد</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchState({ initial: false })} />}
      >
        {actions.map((a, idx) => {
          const isLocked = !!a.locked;
          const isDone = a.status === "done";
          const iconName = isDone ? "checkmark-circle" : isLocked ? "lock-closed-outline" : "flame";

          const label = `اقدام ${idx + 1}`;
          const prog = `${a.progress.done}/${a.progress.required}`;

          return (
            <TouchableOpacity
              key={a.code}
              activeOpacity={0.85}
              style={[
                styles.card,
                isDone && { borderColor: "rgba(34,197,94,.45)" },
                isLocked && { opacity: 0.55 },
              ]}
              onPress={() => {
               if (a.locked) return;
                router.push(`/pelekan/bastan/action/${encodeURIComponent(a.code)}` as any);
               }}
            >
              <View style={styles.row}>
                <View style={styles.iconWrap}>
                  <Ionicons name={iconName as any} size={20} color={isDone ? "#22C55E" : isLocked ? "rgba(231,238,247,.7)" : "#E98A15"} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>
                    {label} — {a.titleFa}
                  </Text>

                  <Text style={styles.cardMeta}>
                    وضعیت: {a.status}  •  پیشرفت: {prog}  •  کل: {a.progress.total}
                    {a.isProLocked ? "  •  پرو" : ""}
                  </Text>

                  {a.lockReason ? <Text style={styles.lockReason}>قفل: {a.lockReason}</Text> : null}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {!actions.length ? (
          <View style={{ paddingVertical: 20 }}>
            <Text style={styles.muted}>هیچ اقدامی برگشت داده نشد.</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b0f14" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: "rgba(231,238,247,.75)", marginTop: 10, fontSize: 12 },

  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(3,7,18,.92)",
  },
  title: { color: "#F9FAFB", fontWeight: "900", fontSize: 18 },
  sub: { color: "rgba(231,238,247,.75)", marginTop: 6, fontSize: 12 },

  errBox: { padding: 16 },
  errText: { color: "#FCA5A5", fontWeight: "700" },
  retryBtn: { marginTop: 10, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,.16)" },
  retryText: { color: "#F9FAFB", fontWeight: "800" },

  card: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(255,255,255,.04)",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,.25)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
  },
  cardTitle: { color: "#F9FAFB", fontWeight: "900", fontSize: 14 },
  cardMeta: { color: "rgba(231,238,247,.70)", fontSize: 12, marginTop: 6 },
  lockReason: { color: "rgba(252,165,165,.85)", fontSize: 11, marginTop: 6, fontWeight: "800" },
});