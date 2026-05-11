// app/pelekan/bastan/action/[code].tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
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
import { useAuth } from "../../../../hooks/useAuth";
import { useUser } from "../../../../hooks/useUser";

/* ----------------------------- Types ----------------------------- */
type SubtaskUi = {
  key: string;
  kind: string;
  titleFa: string;
  helpFa?: string | null;
  isRequired: boolean;
  isFree: boolean;
  sortOrder: number;
  xpReward: number;

  done?: boolean;
  completedAt?: string | null;
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

  sortOrder?: number; // شماره اقدام
};

type BastanStateResponse = {
  ok: boolean;
  data?: {
    actions: ActionUi[];
    intro?: { completedAt: string | null; paywallNeededAfterIntro: boolean };
  };
  error?: string;
};

/* ----------------------------- UI ----------------------------- */
const palette = {
  bg: "#0b0f14",
  text: "#F9FAFB",
  muted: "rgba(231,238,247,.78)",
  border: "rgba(255,255,255,.10)",
  glass: "rgba(255,255,255,.04)",
  glass2: "rgba(3,7,18,.92)",
  gold: "#D4AF37",
  orange: "#E98A15",
  green: "#22C55E",
  red: "#FCA5A5",
};

function faOnlyTitle(raw?: string) {
  const s = String(raw || "").trim();
  if (!s) return "—";
  const parts = s.split("–").map((x) => x.trim());
  if (parts.length >= 2) return parts.slice(1).join(" – ");
  return s.replace(/[A-Za-z]/g, "").replace(/\s{2,}/g, " ").trim() || "—";
}

function statusFa(st?: ActionUi["status"]) {
  if (st === "done") return "انجام‌شده";
  if (st === "active") return "فعال";
  return "قفل";
}

function actionNumberFa(n?: number) {
  const num = Number(n || 0);
  const map: Record<number, string> = {
    1: "اقدام اول",
    2: "اقدام دوم",
    3: "اقدام سوم",
    4: "اقدام چهارم",
    5: "اقدام پنجم",
    6: "اقدام ششم",
    7: "اقدام هفتم",
    8: "اقدام هشتم",
  };
  return map[num] || (num ? `اقدام ${num}` : "اقدام");
}

/* ----------------------------- Storage Keys ----------------------------- */
// همونی که در subtask ست می‌کنیم
const KEY_BASTAN_DIRTY = "pelekan:bastan:dirty:v1";

export default function BastanActionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const actionCode = String((params as any)?.code || "").trim();

  const { me } = useUser();
  const phone = String(me?.phone || "").trim();

  useAuth(); // همگام با auth
  const apiBase = "https://api.qoqnoos.app";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [action, setAction] = useState<ActionUi | null>(null);

  // ✅ ضد ریس: فقط آخرین fetch حق دارد state را آپدیت کند
  const fetchSeqRef = useRef(0);

  // ✅ قفل کلیک روی یک کارت ریزاقدام تا وقتی وارد صفحه شود
  const [openingKey, setOpeningKey] = useState<string | null>(null);

  const log = useCallback((_: string, __?: any) => {}, []);

  const applyIfLatest = useCallback((seq: number, fn: () => void) => {
    if (seq !== fetchSeqRef.current) return;
    fn();
  }, []);

  const fetchOne = useCallback(
    async (opts?: { initial?: boolean; reason?: string }) => {
      const seq = ++fetchSeqRef.current;
      const isInitial = !!opts?.initial;
      const reason = opts?.reason || (isInitial ? "باز شدن صفحه" : "تازه‌سازی");

      log("fetchOne:start", { seq, code: actionCode, isInitial, phone, reason });

      if (!phone) {
        applyIfLatest(seq, () => {
          setErr("شماره پیدا نشد");
          setAction(null);
          setLoading(false);
          setRefreshing(false);
        });
        return;
      }
      if (!actionCode) {
        applyIfLatest(seq, () => {
          setErr("کد اقدام نامعتبر است");
          setAction(null);
          setLoading(false);
          setRefreshing(false);
        });
        return;
      }

      try {
        applyIfLatest(seq, () => {
          setErr(null);
          if (isInitial) setLoading(true);
          else setRefreshing(true);
        });

        const url = `${apiBase}/api/pelekan/bastan/state?phone=${encodeURIComponent(phone)}`;
        const res = await fetch(url, { headers: { "Cache-Control": "no-store" } });

        let json: BastanStateResponse | null = null;
        try {
          json = (await res.json()) as BastanStateResponse;
        } catch {
          json = null;
        }

        log("response", {
          seq,
          http: res.status,
          ok: json?.ok,
          hasData: !!json?.data,
          actionsLen: Array.isArray(json?.data?.actions) ? json!.data!.actions.length : 0,
          error: json?.error ?? null,
        });

        if (!res.ok || !json?.ok || !json.data) {
          applyIfLatest(seq, () => {
            setErr(json?.error || "دریافت اطلاعات ناموفق بود");
            setAction(null);
          });
          return;
        }

        const list = Array.isArray(json.data.actions) ? json.data.actions : [];
        const found = list.find((a) => String(a?.code || "").trim() === actionCode) || null;

        if (!found) {
          applyIfLatest(seq, () => {
            setErr("این اقدام پیدا نشد");
            setAction(null);
          });
          return;
        }

        applyIfLatest(seq, () => {
          setAction(found);
          setErr(null);
        });

        log("find action", {
          seq,
          found: true,
          foundCode: found.code,
          foundTitle: found.titleFa,
          subtasksLen: found.subtasks?.length ?? 0,
        });
      } catch (e: any) {
        applyIfLatest(seq, () => {
          setErr("بارگذاری این اقدام با مشکل مواجه شد، لطفاً دوباره تلاش کن");
          setAction(null);
        });
      } finally {
        applyIfLatest(seq, () => {
          setLoading(false);
          setRefreshing(false);
        });
        log("fetchOne:end", { seq });
      }
    },
    [actionCode, apiBase, applyIfLatest, log, phone]
  );

  // ✅ بار اول
  useEffect(() => {
    log("صفحه اقدام باز شد", { actionCode });
    fetchOne({ initial: true, reason: "باز شدن صفحه" });
  }, [fetchOne, log, actionCode]);

  // ✅ ضدگلوله: هر بار صفحه فوکوس شد (یعنی از subtask برگشتی) بررسی کن dirty هست یا نه
  useFocusEffect(
    useCallback(() => {
      let alive = true;

      const run = async () => {
        try {
          const dirty = await AsyncStorage.getItem(KEY_BASTAN_DIRTY);
          // اگر dirty بود یا حتی فقط برگشتیم، بهتره رفرش کنیم
          // اما برای جلوگیری از فشار، شرط dirty می‌ذاریم.
          if (!alive) return;

          if (dirty) {
            log("dirty detected -> refresh", { dirty });
            await AsyncStorage.removeItem(KEY_BASTAN_DIRTY); // ✅ یکبار مصرف
            fetchOne({ initial: false, reason: "بازگشت از ریزاقدام (dirty)" });
          } else {
            // این حالت اختیاریه. اگر خواستی همیشه بعد از برگشت رفرش کن:
            // fetchOne({ initial: false, reason: "بازگشت از ریزاقدام" });
          }
        } catch {
          // ignore
        } finally {
          // وقتی از subtask برمی‌گرده، قفل کلیک روی کارت را هم باز کن
          if (alive) setOpeningKey(null);
        }
      };

      run();

      return () => {
        alive = false;
      };
    }, [fetchOne, log])
  );

  const subtasks = useMemo(() => {
    const s = action?.subtasks || [];
    return [...s].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [action?.subtasks]);

  const openSubtask = useCallback(
    (key: string) => {
      const k = String(key || "").trim();
      if (!k) return;

      // ✅ ضد دوبار کلیک: اگر همین کارت در حال باز شدن است، هیچ کاری نکن
      if (openingKey === k) return;

      setOpeningKey(k);

      router.push({
        pathname: "/pelekan/bastan/subtask/[key]",
        params: { key: k },
      });
    },
    [openingKey, router]
  );

  /* ----------------------------- Render ----------------------------- */
  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={["left", "right", "bottom"]}>
        {/* Glow */}
        <View pointerEvents="none" style={styles.glowTop} />
        <View pointerEvents="none" style={styles.glowBottom} />

        <View style={[styles.center, { paddingTop: insets.top + 12 }]}>
          <ActivityIndicator color={palette.gold} />
          <Text style={styles.mutedText}>در حال بارگذاری…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const headerTitleFa = faOnlyTitle(action?.titleFa);
  const actionNo = actionNumberFa(action?.sortOrder);

  return (
    <SafeAreaView style={styles.root} edges={["left", "right", "bottom"]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="chevron-forward" size={20} color={palette.text} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{actionNo}</Text>
        </View>

        <View style={{ width: 34, height: 34 }} />
      </View>

      {/* Glow */}
      <View pointerEvents="none" style={styles.glowTop} />
      <View pointerEvents="none" style={styles.glowBottom} />

      {err ? (
        <View style={styles.errBox}>
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
            <Ionicons name="alert-circle" size={16} color={palette.red} />
            <Text style={styles.errText}>{err}</Text>
          </View>

          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => fetchOne({ initial: true, reason: "تلاش دوباره" })}
          >
            <Text style={styles.retryText}>تلاش دوباره</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 24 + insets.bottom }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchOne({ initial: false, reason: "کشیدن برای تازه‌سازی" })}
            tintColor={palette.gold as any}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {!action ? (
          <Text style={styles.mutedText}>اقدام پیدا نشد.</Text>
        ) : (
          <>
            {/* Summary */}
            <View style={styles.summaryCard}>
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
                <Ionicons name="flame" size={18} color={palette.orange} />
                <Text style={styles.summaryTitle}>{headerTitleFa}</Text>
              </View>

              <Text style={styles.summaryMeta}>
                وضعیت: {statusFa(action.status)} {"  "}•{"  "}
                پیشرفت: {action.progress.done}/{action.progress.required} {"  "}•{"  "}
                کل: {action.progress.total}
              </Text>

              {action.lockReason ? (
                <Text style={styles.lockReason}>دلیل قفل: {faOnlyTitle(action.lockReason)}</Text>
              ) : null}
            </View>

            {/* Subtasks */}
            <Text style={styles.sectionTitle}>ریز‌اقدام‌ها</Text>

            {subtasks.map((s, i) => {
              const key = String(s.key || "").trim();
              if (!key) return null;

              const isDone = !!(s as any)?.done || !!(s as any)?.completedAt;
              const isOpening = openingKey === key;

              return (
                <TouchableOpacity
                  key={key}
                  activeOpacity={0.92}
                  onPress={() => openSubtask(key)}
                  style={[styles.subtaskCard, isOpening && { opacity: 0.72 }]}
                  disabled={isOpening} // ✅ ضد چند کلیک
                >
                  <View style={styles.subtaskRow}>
                    <View style={styles.bullet}>
                      <Text style={styles.bulletText}>{i + 1}</Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.subtaskTitle}>{faOnlyTitle(s.titleFa)}</Text>

                      

                      <View style={styles.metaRow}>
                        <View style={styles.metaPill}>
                          <Ionicons
                            name={s.isRequired ? "alert" : "information-circle"}
                            size={14}
                            color="rgba(231,238,247,.85)"
                          />
                          <Text style={styles.metaPillText}>{s.isRequired ? "اجباری" : "اختیاری"}</Text>
                        </View>

                        <View style={styles.metaPill}>
                          <Ionicons name="flash" size={14} color="rgba(231,238,247,.85)" />
                          <Text style={styles.metaPillText}>امتیاز: {s.xpReward}</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", justifyContent: "flex-start", marginTop: 12 }}>
                    {isOpening ? (
                      <View style={styles.openingBadge}>
                        <ActivityIndicator />
                        <Text style={styles.openingBadgeText}>در حال باز کردن…</Text>
                      </View>
                    ) : isDone ? (
                      <View style={styles.doneBadge}>
                        <Ionicons name="checkmark-circle" size={18} color={palette.green} />
                        <Text style={styles.doneBadgeText}>انجام شده</Text>
                      </View>
                    ) : (
                      <View style={styles.openHint}>
                        <Ionicons name="chevron-back" size={18} color="rgba(231,238,247,.75)" />
                        <Text style={styles.openHintText}>باز کردن</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}

            {!subtasks.length ? <Text style={styles.mutedText}>برای این اقدام ریز‌اقدامی نیامده.</Text> : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ----------------------------- Styles ----------------------------- */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  mutedText: { color: palette.muted, marginTop: 10, fontSize: 12, textAlign: "center" },

  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.glass2,
    flexDirection: "row-reverse",
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
    borderColor: palette.border,
  },
  headerTitle: { color: palette.text, fontWeight: "900", fontSize: 16, textAlign: "center" },

  glowTop: {
    position: "absolute",
    top: 0,
    left: -80,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(212,175,55,.14)",
    transform: [{ rotate: "12deg" }],
  },
  glowBottom: {
    position: "absolute",
    bottom: -30,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: "rgba(233,138,21,.10)",
    transform: [{ rotate: "-10deg" }],
  },

  errBox: { padding: 16, gap: 10, alignItems: "flex-start" },
  errText: { color: palette.red, fontWeight: "800", textAlign: "right" },
  retryBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.16)",
    backgroundColor: "rgba(255,255,255,.03)",
  },
  retryText: { color: palette.text, fontWeight: "800" },

  summaryCard: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.glass,
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
  },
  summaryTitle: { color: palette.text, fontWeight: "900", fontSize: 14, textAlign: "center", flex: 1 },
  summaryMeta: { color: "rgba(231,238,247,.70)", fontSize: 12, marginTop: 10, textAlign: "center" },
  lockReason: {
    color: "rgba(252,165,165,.85)",
    fontSize: 11,
    marginTop: 10,
    fontWeight: "800",
    textAlign: "right",
  },

  sectionTitle: {
    color: palette.text,
    fontWeight: "900",
    fontSize: 13,
    marginTop: 6,
    marginBottom: 10,
    textAlign: "center",
  },

  subtaskCard: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,.03)",
    borderRadius: 18,
    padding: 12,
    marginBottom: 12,
  },
  subtaskRow: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 10 },
  bullet: {
    width: 28,
    height: 28,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,.25)",
    borderWidth: 1,
    borderColor: palette.border,
  },
  bulletText: { color: "rgba(231,238,247,.85)", fontWeight: "900", fontSize: 12 },

  subtaskTitle: { color: palette.text, fontWeight: "900", fontSize: 13, textAlign: "right" },
  subtaskHelp: { color: palette.muted, fontSize: 12, marginTop: 6, lineHeight: 18, textAlign: "right" },

  metaRow: {
    marginTop: 10,
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
  },
  metaPill: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(0,0,0,.18)",
  },
  metaPillText: { color: "rgba(231,238,247,.85)", fontWeight: "800", fontSize: 11, textAlign: "right" },

  doneBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,.28)",
    backgroundColor: "rgba(34,197,94,.10)",
  },
  doneBadgeText: { fontWeight: "900", color: "rgba(231,238,247,.92)", fontSize: 12 },

  openingBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.14)",
    backgroundColor: "rgba(0,0,0,.18)",
  },
  openingBadgeText: { fontWeight: "900", color: "rgba(231,238,247,.86)", fontSize: 12 },

  openHint: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.12)",
    backgroundColor: "rgba(0,0,0,.14)",
  },
  openHintText: { fontWeight: "900", color: "rgba(231,238,247,.82)", fontSize: 12 },
});