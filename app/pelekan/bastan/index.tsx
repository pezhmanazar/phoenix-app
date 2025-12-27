// app/pelekan/bastan/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
    // ✅ اگر بک‌اند start هم می‌فرستد، اینجا هم پشتیبانی می‌کنیم
    start?: { completedAt: string | null; locked: boolean; paywallNeededAfterIntro: boolean };
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

  // ✅ فقط یک منبع حقیقت برای "شروع درمان"
  // (introCompletedAt = یعنی ویس شروع درمان کامل شده)
  const [introDone, setIntroDone] = useState(false);

  // ✅ آیا بعد از intro باید paywall نشان بدهیم؟
  const [paywallAfterIntro, setPaywallAfterIntro] = useState(false);

  const router = useRouter();
  const apiBase = "https://api.qoqnoos.app";

  const fetchState = useCallback(
    async (opts?: { initial?: boolean }) => {
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

        let json: BastanStateResponse | null = null;
        try {
          json = (await res.json()) as BastanStateResponse;
        } catch {
          json = null;
        }

        if (!res.ok || !json?.ok || !json.data) {
          setErr(json?.error || `HTTP_${res.status}`);
          setActions([]);
          return;
        }

        setActions(Array.isArray(json.data.actions) ? json.data.actions : []);

        // ✅ "شروع درمان" را فقط از completedAt می‌فهمیم
        // اولویت: start.completedAt اگر بک‌اند داد، وگرنه intro.completedAt
        const introCompletedAt = json.data.start?.completedAt ?? json.data.intro?.completedAt ?? null;

        const paywallNeededAfterIntro =
          json.data.start?.paywallNeededAfterIntro ??
          json.data.intro?.paywallNeededAfterIntro ??
          false;

        setIntroDone(!!introCompletedAt);
        setPaywallAfterIntro(!!paywallNeededAfterIntro);

        // ✅ لاگ تشخیصی
        console.log("[bastan] introDone=", !!introCompletedAt, "completedAt=", introCompletedAt);
      } catch (e: any) {
        setErr(String(e?.message || e));
        setActions([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [phone]
  );

  useEffect(() => {
    fetchState({ initial: true });
  }, [fetchState]);

  const headerHint = useMemo(() => {
    if (!introDone) return "اول «شروع درمان» را انجام بده تا اقدام‌ها باز شوند.";
    if (paywallAfterIntro) return "بعد از شروع درمان، ادامه‌ی اقدام‌ها نیاز به پرو دارد.";
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

      {/* Glow ها */}
      <View pointerEvents="none" style={styles.glowTop} />
      <View pointerEvents="none" style={styles.glowBottom} />

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
        showsVerticalScrollIndicator={false}
      >
        {/* ✅ تنها کارت "شروع درمان" (قبل از اقدام ۱) */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={[
            styles.startCard,
            introDone && styles.startCardDone,
            !introDone && { borderColor: "rgba(212,175,55,.35)" },
          ]}
          onPress={() => {
            // 1) اگر شروع درمان انجام نشده → برو صفحه ویس
            if (!introDone) {
              router.push("/pelekan/bastan/intro" as any);
              return;
            }
            // 2) اگر انجام شده ولی نیاز به پرو دارد → برو اشتراک
            if (paywallAfterIntro) {
              router.push("/(tabs)/Subscription" as any);
              return;
            }
            // 3) انجام شده و paywall هم ندارد → هیچ
          }}
        >
          <View style={styles.startRow}>
            <View style={styles.startBadge}>
              <Text style={styles.startBadgeText}>{introDone ? "✓" : "۱"}</Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.startTitle}>شروع درمان</Text>
              <Text style={styles.startSub}>
                {introDone ? "انجام شده" : "برای باز شدن اقدام‌ها باید ویس را کامل گوش کنی."}
              </Text>

              {introDone && paywallAfterIntro ? (
                <View style={styles.paywallPill}>
                  <Ionicons name="lock-closed-outline" size={14} color="rgba(231,238,247,.85)" />
                  <Text style={styles.paywallText}>برای ادامه نیاز به پرو داری</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.startIcon}>
              <Ionicons name={introDone ? "checkmark" : "play"} size={18} color="#0b0f14" />
            </View>
          </View>
        </TouchableOpacity>

        {/* لیست اقدامات */}
        {actions.map((a, idx) => {
          const isLocked = !!a.locked;
          const isDone = a.status === "done";

          // ✅ وقتی introDone نیست، هیچ اقدام نباید قابل کلیک باشد
          const hardLocked = !introDone || isLocked;

          const iconName = isDone ? "checkmark-circle" : hardLocked ? "lock-closed-outline" : "flame";

          const label = `اقدام ${idx + 1}`;
          const prog = `${a.progress.done}/${a.progress.required}`;

          return (
            <TouchableOpacity
              key={a.code}
              activeOpacity={0.85}
              style={[
                styles.card,
                isDone && { borderColor: "rgba(34,197,94,.45)" },
                hardLocked && { opacity: 0.55 },
              ]}
              onPress={() => {
                if (hardLocked) return;
                router.push(`/pelekan/bastan/action/${encodeURIComponent(a.code)}` as any);
              }}
            >
              <View style={styles.row}>
                <View style={styles.iconWrap}>
                  <Ionicons
                    name={iconName as any}
                    size={20}
                    color={isDone ? "#22C55E" : hardLocked ? "rgba(231,238,247,.7)" : "#E98A15"}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>
                    {label} — {a.titleFa}
                  </Text>

                  <Text style={styles.cardMeta}>
                    وضعیت: {a.status === "done" ? "انجام شده" : a.status === "active" ? "فعال" : "قفل"}{"  "}
                    •{"  "}
                    پیشرفت: {prog}{"  "}
                    •{"  "}
                    کل: {a.progress.total}
                    {a.isProLocked ? "  •  پرو" : ""}
                  </Text>

                  {/* اگر introDone نیست، دلیل قفل را واضح کنیم */}
                  {!introDone ? (
                    <Text style={styles.lockReason}>قفل: ابتدا «شروع درمان» را انجام بده</Text>
                  ) : a.lockReason ? (
                    <Text style={styles.lockReason}>قفل: {a.lockReason}</Text>
                  ) : null}
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
  muted: { color: "rgba(231,238,247,.75)", marginTop: 10, fontSize: 12, textAlign: "center" },

  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(3,7,18,.92)",
  },
  title: { color: "#F9FAFB", fontWeight: "900", fontSize: 18, textAlign: "center" },
  sub: { color: "rgba(231,238,247,.75)", marginTop: 6, fontSize: 12, textAlign: "center" },

  glowTop: {
    position: "absolute",
    top: -10,
    left: -80,
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: "rgba(212,175,55,.14)",
    transform: [{ rotate: "12deg" }],
  },
  glowBottom: {
    position: "absolute",
    bottom: -40,
    right: -90,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: "rgba(233,138,21,.10)",
    transform: [{ rotate: "-10deg" }],
  },

  errBox: { padding: 16 },
  errText: { color: "#FCA5A5", fontWeight: "700", textAlign: "right" },
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

  // ✅ کارت شروع درمان
  startCard: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(255,255,255,.04)",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  startCardDone: {
    backgroundColor: "rgba(34,197,94,.10)",
    borderColor: "rgba(34,197,94,.22)",
  },
  startRow: { flexDirection: "row-reverse", alignItems: "center", gap: 12 },
  startBadge: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,.25)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
  },
  startBadgeText: { color: "rgba(231,238,247,.9)", fontWeight: "900", fontSize: 12 },
  startIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(212,175,55,.92)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,.35)",
  },
  startTitle: { color: "#F9FAFB", fontWeight: "900", fontSize: 14, textAlign: "right" },
  startSub: { color: "rgba(231,238,247,.75)", marginTop: 6, fontSize: 12, textAlign: "right" },

  paywallPill: {
    marginTop: 10,
    alignSelf: "flex-start",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.12)",
    backgroundColor: "rgba(0,0,0,.18)",
  },
  paywallText: { color: "rgba(231,238,247,.85)", fontWeight: "800", fontSize: 11, textAlign: "right" },

  // کارت‌های اقدام
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
  cardTitle: { color: "#F9FAFB", fontWeight: "900", fontSize: 14, textAlign: "right" },
  cardMeta: { color: "rgba(231,238,247,.70)", fontSize: 12, marginTop: 6, textAlign: "right" },
  lockReason: { color: "rgba(252,165,165,.85)", fontSize: 11, marginTop: 6, fontWeight: "800", textAlign: "right" },
});