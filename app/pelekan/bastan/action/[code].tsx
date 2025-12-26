// app/pelekan/bastan/action/[code].tsx
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useUser } from "../../../../hooks/useUser"; // ✅ FIXED

type SubtaskUi = {
  key: string;
  kind: string;
  titleFa: string;
  helpFa?: string | null;
  isRequired: boolean;
  isFree: boolean;
  sortOrder: number;
  xpReward: number;
};

type ActionUi = {
  code: string;
  titleFa: string;
  status: "locked" | "done" | "active";
  locked: boolean;
  lockReason: string | null;
  isProLocked: boolean;
  progress: { done: number; required: number; total: number };
  subtasks?: SubtaskUi[];
};

type BastanStateResponse = {
  ok: boolean;
  data?: {
    actions: ActionUi[];
    intro?: { completedAt: string | null; paywallNeededAfterIntro: boolean };
  };
  error?: string;
};

export default function BastanActionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();

  const actionCode = String((params as any)?.code || "").trim();

  const { me } = useUser();
  const phone = String(me?.phone || "").trim();

  const apiBase = "https://api.qoqnoos.app";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [action, setAction] = useState<ActionUi | null>(null);

  const mountedRef = useRef(false);
  const seqRef = useRef(0);

  // ✅ MOUNT log (همون چیزی که می‌خواستی)
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    console.log("✅ ACTION SCREEN MOUNTED", {
      file: "app/pelekan/bastan/action/[code].tsx",
      code: actionCode || null,
      phone: phone || null,
    });
  }, [actionCode, phone]);

  const fetchOne = useCallback(
    async (opts?: { initial?: boolean; reason?: string }) => {
      const isInitial = !!opts?.initial;
      const reason = opts?.reason || (isInitial ? "initial" : "refresh");
      const seq = ++seqRef.current;

      console.log("🧭 [BastanAction] fetchOne:start", {
        seq,
        reason,
        isInitial,
        phone: phone || null,
        code: actionCode || null,
      });

      if (!phone) {
        console.log("⚠️ [BastanAction] NO_PHONE", { seq });
        setErr("NO_PHONE");
        setAction(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (!actionCode) {
        console.log("⚠️ [BastanAction] NO_ACTION_CODE", { seq, params });
        setErr("NO_ACTION_CODE");
        setAction(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        setErr(null);
        if (isInitial) setLoading(true);
        else setRefreshing(true);

        const url = `${apiBase}/api/pelekan/bastan/state?phone=${encodeURIComponent(phone)}`;
        console.log("🌐 [BastanAction] GET", { seq, url });

        const res = await fetch(url, { headers: { "Cache-Control": "no-store" } });

        let json: BastanStateResponse | null = null;
        try {
          json = (await res.json()) as BastanStateResponse;
        } catch {
          json = null;
        }

        console.log("📦 [BastanAction] response", {
          seq,
          http: res.status,
          ok: json?.ok,
          hasData: !!json?.data,
          error: json?.error || null,
          actionsLen: Array.isArray(json?.data?.actions) ? json?.data?.actions.length : 0,
        });

        if (!res.ok || !json?.ok || !json.data) {
          setErr(json?.error || `HTTP_${res.status}`);
          setAction(null);
          return;
        }

        const list = Array.isArray(json.data.actions) ? json.data.actions : [];
        const found = list.find((a) => String(a?.code || "").trim() === actionCode) || null;

        console.log("🔎 [BastanAction] find action", {
          seq,
          lookingFor: actionCode,
          found: !!found,
          foundCode: found?.code || null,
          foundTitle: found?.titleFa || null,
          subtasksLen: Array.isArray(found?.subtasks) ? found!.subtasks!.length : 0,
          foundKeys: found ? Object.keys(found) : [],
        });

        if (!found) {
          setErr("ACTION_NOT_FOUND");
          setAction(null);
          return;
        }

        // ✅ این لاگ دقیقا میگه مشکل از بک‌اند هست یا نه
        if (!Array.isArray(found.subtasks) || found.subtasks.length === 0) {
          console.log("🚨 [BastanAction] NO_SUBTASKS_IN_RESPONSE", {
            seq,
            code: found.code,
            note: "Backend is likely not including subtasks in /bastan/state actionsUi.",
          });
        }

        setAction(found);
      } catch (e: any) {
        const msg = String(e?.message || e);
        console.log("💥 [BastanAction] fetchOne:error", { seq, msg });
        setErr(msg);
        setAction(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
        console.log("🧭 [BastanAction] fetchOne:end", { seq });
      }
    },
    [phone, actionCode]
  );

  useEffect(() => {
    fetchOne({ initial: true, reason: "mount_or_params_change" });
  }, [fetchOne]);

  const subtasks = useMemo(() => {
    const s = action?.subtasks || [];
    return [...s].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [action?.subtasks]);

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
        <View style={[styles.center, { paddingTop: insets.top }]}>
          <ActivityIndicator color="#D4AF37" />
          <Text style={styles.muted}>در حال بارگذاری…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right", "bottom"]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          onPress={() => {
            console.log("👈 [BastanAction] back()");
            router.back();
          }}
          style={styles.backBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-forward" size={20} color="#F9FAFB" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.title}>اقدام</Text>
          <Text style={styles.sub}>{action ? action.titleFa : "—"}</Text>
        </View>
      </View>

      {err ? (
        <View style={styles.errBox}>
          <Text style={styles.errText}>خطا: {err}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchOne({ initial: true, reason: "retry" })}>
            <Text style={styles.retryText}>تلاش مجدد</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: Math.max(24, insets.bottom + 24),
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchOne({ initial: false, reason: "pull_to_refresh" })} />}
      >
        {!action ? (
          <Text style={styles.muted}>اقدام پیدا نشد.</Text>
        ) : (
          <>
            {/* Summary */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>{action.titleFa}</Text>
              <Text style={styles.summaryMeta}>
                وضعیت: {action.status} • پیشرفت: {action.progress.done}/{action.progress.required} • کل: {action.progress.total}
                {action.isProLocked ? " • پرو" : ""}
              </Text>
              {action.lockReason ? <Text style={styles.lockReason}>قفل: {action.lockReason}</Text> : null}
              <Text style={[styles.summaryMeta, { marginTop: 10 }]}>کد: {action.code}</Text>
            </View>

            {/* Subtasks */}
            <Text style={styles.sectionTitle}>ریز‌اقدام‌ها</Text>

            {subtasks.map((s, i) => (
              <View key={s.key} style={styles.subtaskCard}>
                <View style={styles.subtaskRow}>
                  <View style={styles.bullet}>
                    <Text style={styles.bulletText}>{i + 1}</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.subtaskTitle}>{s.titleFa}</Text>
                    {!!s.helpFa ? <Text style={styles.subtaskHelp}>{s.helpFa}</Text> : null}
                    <Text style={styles.subtaskMeta}>
                      {s.isRequired ? "اجباری" : "اختیاری"} • {s.isFree ? "رایگان" : "پرو"} • XP: {s.xpReward}
                    </Text>
                    <Text style={styles.subtaskMeta}>کلید: {s.key}</Text>
                  </View>
                </View>
              </View>
            ))}

            {!subtasks.length ? (
              <Text style={styles.muted}>برای این اقدام ریز‌اقدامی نیامده. (لاگ‌ها را چک کن: NO_SUBTASKS_IN_RESPONSE)</Text>
            ) : null}
          </>
        )}
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
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(3,7,18,.92)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
  },
  title: { color: "#F9FAFB", fontWeight: "900", fontSize: 16 },
  sub: { color: "rgba(231,238,247,.80)", marginTop: 4, fontSize: 12 },

  errBox: { padding: 16 },
  errText: { color: "#FCA5A5", fontWeight: "700" },
  retryBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.16)",
  },
  retryText: { color: "#F9FAFB", fontWeight: "800" },

  summaryCard: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(255,255,255,.04)",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  summaryTitle: { color: "#F9FAFB", fontWeight: "900", fontSize: 14 },
  summaryMeta: { color: "rgba(231,238,247,.70)", fontSize: 12, marginTop: 6 },
  lockReason: { color: "rgba(252,165,165,.85)", fontSize: 11, marginTop: 6, fontWeight: "800" },

  sectionTitle: { color: "#F9FAFB", fontWeight: "900", fontSize: 13, marginTop: 6, marginBottom: 10 },

  subtaskCard: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(255,255,255,.03)",
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  subtaskRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  bullet: {
    width: 26,
    height: 26,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,.25)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
  },
  bulletText: { color: "rgba(231,238,247,.85)", fontWeight: "900", fontSize: 12 },
  subtaskTitle: { color: "#F9FAFB", fontWeight: "900", fontSize: 13 },
  subtaskHelp: { color: "rgba(231,238,247,.75)", fontSize: 12, marginTop: 6, lineHeight: 18 },
  subtaskMeta: { color: "rgba(231,238,247,.60)", fontSize: 11, marginTop: 8 },
});