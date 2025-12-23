// phoenix-app/app/(tabs)/ReviewResult.tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const API_BASE = "https://qoqnoos.app/api/pelekan/review";

type ResultResponse = {
  ok: boolean;
  error?: string;
  data?: {
    status: "in_progress" | "completed_locked" | "unlocked";
    canEnterPelekan?: boolean;
    result: any | null;
  };
};

export default function ReviewResult() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const phone = String(params?.phone || "").trim();

  console.log("[ReviewResult] phone param =", phone);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  const palette = useMemo(
    () => ({
      bg: "#0b0f14",
      glass: "rgba(3,7,18,.92)",
      border: "rgba(255,255,255,.10)",
      text: "#F9FAFB",
      sub: "rgba(231,238,247,.75)",
      sub2: "rgba(231,238,247,.55)",
      gold: "#D4AF37",
      orange: "#E98A15",
      red: "#ef4444",
      lime: "#86efac",
    }),
    []
  );

  const fetchResult = useCallback(async () => {
    if (!phone) {
      setErr("PHONE_MISSING");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      const res = await fetch(`${API_BASE}/result?phone=${encodeURIComponent(phone)}`, {
        headers: { "Cache-Control": "no-store" },
      });

      const json: ResultResponse = await res.json().catch(() => ({ ok: false } as any));
      if (!json?.ok) throw new Error(json?.error || "RESULT_FAILED");

      setResult(json?.data?.result ?? null);
    } catch (e: any) {
      setErr(String(e?.message || "RESULT_FAILED"));
    } finally {
      setLoading(false);
    }
  }, [phone]);

  useEffect(() => {
    fetchResult();
  }, [fetchResult]);

  const locked = !!result?.locked;
  const didSkipTest2 = !!result?.meta?.didSkipTest2;

  // اگر بک‌اند بعداً diagrams بده، اینجا می‌کشیم
  const diagrams = result?.diagrams || null;
  const summary = result?.summary || null;

  const statusColor = locked ? palette.red : palette.lime;

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: palette.glass, borderColor: palette.border }]}>
          <View style={[styles.accent, { backgroundColor: statusColor }]} />

          <Text style={[styles.h1, { color: statusColor }]}>
            {didSkipTest2 ? "نتیجه آزمون بازسنجی" : "نتیجه دو آزمون"}
          </Text>

          <Text style={[styles.rtl, { color: palette.sub, marginTop: 10 }]}>
            {String(
              result?.message ||
                (locked
                  ? "نتیجه آماده است، اما برای دیدن تحلیل کامل باید PRO را فعال کنی."
                  : "تحلیل آماده است.")
            )}
          </Text>

          {loading && (
            <View style={{ paddingVertical: 16, alignItems: "center" }}>
              <ActivityIndicator color={palette.gold} />
              <Text style={{ color: palette.sub2, marginTop: 10, fontSize: 12 }}>در حال دریافت نتیجه…</Text>
            </View>
          )}

          {!!err && !loading && (
            <Text style={[styles.rtl, { color: palette.red, marginTop: 10 }]}>{err}</Text>
          )}

          {/* کارت یک‌نگاه (فعلاً placeholder تا بک‌اند summary بده) */}
          {!loading && !err && (
            <View style={[styles.oneLook, { borderColor: palette.border }]}>
              <Text style={[styles.h2, { color: palette.text }]}>وضعیت کلی تو (یک‌نگاه)</Text>
              <Text style={[styles.rtl, { color: palette.sub2, marginTop: 6 }]}>
                {summary?.oneLook ||
                  "به‌زودی اینجا یک جمع‌بندی خیلی سریع و تصمیم‌ساز می‌آید (وقتی بک‌اند summary را تولید کرد)."}
              </Text>
            </View>
          )}

          {/* نمودارها (فعلاً اگر وجود داشت) */}
          {!loading && !err && diagrams && (
            <View style={{ marginTop: 14 }}>
              <Text style={[styles.h2, { color: palette.text }]}>نمودارها</Text>

              {Array.isArray(diagrams) &&
                diagrams.map((d: any, idx: number) => (
                  <View key={idx} style={[styles.diagram, { borderColor: palette.border }]}>
                    <Text style={[styles.rtl, { color: palette.text, fontWeight: "900" }]}>{d.title}</Text>

                    <View style={[styles.barWrap, { borderColor: palette.border }]}>
                      <View
                        style={[
                          styles.barFill,
                          { width: `${Math.max(0, Math.min(100, Number(d.percent || 0)))}%`, backgroundColor: palette.gold },
                        ]}
                      />
                    </View>

                    <Text style={[styles.rtl, { color: palette.sub2, marginTop: 6, fontSize: 12 }]}>
                      {d.label} — {d.percent}%
                    </Text>
                  </View>
                ))}
            </View>
          )}

          <View style={{ height: 14 }} />

          {locked && (
            <>
              <Pressable
                style={[
                  styles.btnPrimary,
                  { borderColor: "rgba(212,175,55,.35)", backgroundColor: "rgba(212,175,55,.10)" },
                ]}
                onPress={() => router.push("/(tabs)/Subscription")}
              >
                <Text style={[styles.btnText, { color: palette.text }]}>فعال‌سازی PRO برای دیدن تحلیل کامل</Text>
              </Pressable>

              <View style={{ height: 10 }} />
            </>
          )}

          <Pressable
            style={[styles.btn, { borderColor: palette.border }]}
            onPress={() => router.replace("/(tabs)/Pelekan")}
          >
            <Text style={[styles.btnText, { color: palette.text }]}>رفتن به پلکان</Text>
          </Pressable>

          <View style={{ height: 10 }} />

          <Pressable
            style={[styles.btnGhost, { borderColor: palette.border, backgroundColor: "rgba(255,255,255,.04)" }]}
            onPress={fetchResult}
            disabled={loading}
          >
            <Text style={[styles.btnText, { color: palette.sub }]}>{loading ? "..." : "رفرش نتیجه"}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, padding: 16, justifyContent: "center" },

  rtl: { writingDirection: "rtl" as any, textAlign: "right" as any },

  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    overflow: "hidden",
  },
  accent: { position: "absolute", top: 0, left: 0, right: 0, height: 2, opacity: 0.95 },

  h1: { fontSize: 18, fontWeight: "900", textAlign: "center" as any, writingDirection: "rtl" as any },
  h2: { fontSize: 14, fontWeight: "900", textAlign: "center" as any, writingDirection: "rtl" as any },

  oneLook: { marginTop: 14, borderWidth: 1, borderRadius: 16, padding: 12 },

  diagram: { marginTop: 10, borderWidth: 1, borderRadius: 16, padding: 12 },
  barWrap: {
    marginTop: 10,
    height: 10,
    borderWidth: 1,
    borderRadius: 999,
    overflow: "hidden",
  },
  barFill: { height: "100%" },

  btn: { borderWidth: 1, borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  btnPrimary: { borderWidth: 1, borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  btnGhost: { borderWidth: 1, borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  btnText: { fontSize: 14, fontWeight: "900", writingDirection: "rtl" as any },
});