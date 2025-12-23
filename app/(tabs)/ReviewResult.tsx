// phoenix-app/app/(tabs)/ReviewResult.tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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

type DiagramItem = {
  key: string;
  title: string;
  percent: number;
  label?: string;
};

export default function ReviewResult() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const phone = String(params?.phone || "").trim();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  const palette = useMemo(
    () => ({
      bg: "#0b0f14",
      glass: "rgba(3,7,18,.92)",
      glass2: "rgba(255,255,255,.02)",
      border: "rgba(255,255,255,.10)",
      border2: "rgba(255,255,255,.14)",
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

  const diagramsObj = result?.diagrams || null;
  const test1Diagrams: DiagramItem[] = Array.isArray(diagramsObj?.test1) ? diagramsObj.test1 : [];
  const test2Diagrams: DiagramItem[] = Array.isArray(diagramsObj?.test2) ? diagramsObj.test2 : [];
  const summary = result?.summary || null;

  const statusColor = locked ? palette.red : palette.lime;

  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

  const isHigherWorse = (key: string) => {
    const k = String(key || "");
    return k === "t1_redflags" || k === "t1_conflict" || k === "t1_attachment" || k === "t2_ambiguity" || k === "t2_cost";
  };

  const barColor = (key: string, percentRaw: any) => {
    const p = clamp(Number(percentRaw ?? 0), 0, 100);
    const worse = isHigherWorse(key);

    if (worse) {
      if (p >= 80) return palette.red;
      if (p >= 60) return palette.orange;
      if (p >= 40) return palette.gold;
      return palette.lime;
    } else {
      if (p >= 80) return palette.lime;
      if (p >= 60) return palette.gold;
      if (p >= 40) return palette.orange;
      return palette.red;
    }
  };

  const toneLabel = (key: string, percentRaw: any) => {
    const p = clamp(Number(percentRaw ?? 0), 0, 100);
    const worse = isHigherWorse(key);
    if (worse) {
      if (p >= 80) return "خیلی بالا (هشدار)";
      if (p >= 60) return "بالا";
      if (p >= 40) return "متوسط";
      return "پایین";
    } else {
      if (p >= 80) return "خیلی خوب";
      if (p >= 60) return "خوب";
      if (p >= 40) return "متوسط";
      return "ضعیف";
    }
  };

  const scaleExplain = (key: string) => {
    switch (key) {
      case "t1_redflags":
        return "این شاخص میزان «خط قرمزهای جدی» در رابطه را نشان می‌دهد. هرچه بالاتر باشد، احتمال تکرار آسیب و ناایمن بودن رابطه بیشتر است.";
      case "t1_satisfaction":
        return "این شاخص کیفیت تجربه تو از رابطه را نشان می‌دهد (رضایت، دیده‌شدن، صمیمیت). هرچه بالاتر باشد یعنی رابطه از نظر تجربه ذهنی تو مثبت‌تر بوده است.";
      case "t1_attachment":
        return "این شاخص «تنش دلبستگی» را نشان می‌دهد (اضطرابِ رهاشدگی/اجتناب از صمیمیت). هرچه بالاتر باشد یعنی رابطه بیشتر روی زخم‌های دلبستگی فشار آورده و تصمیم‌گیری شفاف سخت‌تر می‌شود.";
      case "t1_conflict":
        return "این شاخص میزان «مسمومیت تعارض» را نشان می‌دهد (تحقیر، قهر، دفاعی‌بودن، حل‌نشدن دعواها). هرچه بالاتر باشد یعنی الگوی دعوا فرساینده‌تر و خطرناک‌تر است.";
      case "t2_evidence":
        return "این شاخص میزان «شواهد واقعیِ بازگشت» را نشان می‌دهد (اقدام شفاف، پذیرش مسئولیت، تغییر پایدار). هرچه بالاتر باشد احتمال بازگشت واقعی (نه احساسی) بیشتر است.";
      case "t2_ambiguity":
        return "این شاخص میزان «سیگنال‌های مبهم و تعلیق‌آور» را نشان می‌دهد (گرم‌وسرد، نگه‌داشتن تو در دسترس، وعده‌های نامعلوم). هرچه بالاتر باشد احتمال بازی/ابهام بیشتر است.";
      case "t2_cost":
        return "این شاخص «هزینه روانی انتظار» را نشان می‌دهد (درگیر ذهنی، تعلیق زندگی، ترس از شروع جدید). هرچه بالاتر باشد یعنی انتظار دارد به سلامت روان و مسیر زندگی تو ضربه می‌زند.";
      case "t2_maturity":
        return "این شاخص «بلوغ رابطه‌ای طرف مقابل» را نشان می‌دهد (گفت‌وگوی بالغ، احترام به مرز، ثبات هیجانی). هرچه بالاتر باشد احتمال ساختن یک رابطه سالم‌تر بیشتر است.";
      default:
        return "";
    }
  };

  const headerTitle = didSkipTest2 ? "نتیجه آزمون" : "نتیجه دو آزمون";

  // ✅ طبق خواسته تو:
  // - پرو/unlocked => هیچی زیر هدر نمایش نده
  // - locked یا loading یا error => نمایش بده
  const headerSub = useMemo(() => {
    if (loading) return "در حال دریافت نتیجه…";
    if (err) return "خطا در دریافت نتیجه";
    if (locked) return "برای دیدن تحلیل کامل باید اشتراک پرو را فعال کنی.";
    return null; // ✅ unlocked: هیچ
  }, [loading, err, locked]);

  const goPelekan = useCallback(() => {
    router.replace("/(tabs)/Pelekan");
  }, [router]);

  const DiagramCard = ({ item }: { item: DiagramItem }) => {
    const p = clamp(Number(item?.percent ?? 0), 0, 100);
    const c = barColor(item.key, p);
    const explain = scaleExplain(item.key);

    return (
      <View style={[styles.diagram, { borderColor: palette.border, backgroundColor: palette.glass2 }]}>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={[styles.rtl, { color: palette.text, fontWeight: "900", flex: 1 }]}>{String(item?.title || "—")}</Text>

          <View style={[styles.pill, { borderColor: palette.border2 }]}>
            <Text style={[styles.rtl, { color: palette.sub, fontSize: 11, fontWeight: "900" }]}>{p}%</Text>
          </View>
        </View>

        <View style={[styles.barWrap, { borderColor: palette.border2 }]}>
          <View style={[styles.barFill, { width: `${p}%`, backgroundColor: c }]} />
        </View>

        <Text style={[styles.rtl, { color: palette.sub2, marginTop: 8, fontSize: 12 }]}>
          {item?.label ? `${item.label} — ` : ""}
          {toneLabel(item.key, p)}
        </Text>

        {!!explain && (
          <Text style={[styles.rtl, { color: palette.sub, marginTop: 8, fontSize: 12, lineHeight: 18 }]}>
            {explain}
          </Text>
        )}
      </View>
    );
  };

  return (
    // ✅ SafeArea بالا برای استاتوس‌بار
    <SafeAreaView style={[styles.root, { backgroundColor: palette.bg }]} edges={["top"]}>
      {/* هدر ثابت */}
      <View style={[styles.header, { backgroundColor: palette.bg, borderBottomColor: palette.border }]}>
        <View style={[styles.headerAccent, { backgroundColor: statusColor }]} />

        <Text style={[styles.headerTitle, { color: statusColor }]}>{headerTitle}</Text>

        {!!headerSub && <Text style={[styles.rtl, styles.headerSub, { color: palette.sub }]}>{headerSub}</Text>}
      </View>

      {/* اسکرول زیر هدر */}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: palette.glass, borderColor: palette.border }]}>
          {loading && (
            <View style={{ paddingVertical: 18, alignItems: "center" }}>
              <ActivityIndicator color={palette.gold} />
              <Text style={{ color: palette.sub2, marginTop: 10, fontSize: 12 }}>در حال دریافت نتیجه…</Text>
            </View>
          )}

          {!!err && !loading && <Text style={[styles.rtl, { color: palette.red }]}>{err}</Text>}

          {!loading && !err && (
            <View style={[styles.oneLook, { borderColor: palette.border }]}>
              <Text style={[styles.h2, { color: palette.text }]}>وضعیت کلی تو (یک‌نگاه)</Text>

              <Text style={[styles.rtl, { color: palette.sub2, marginTop: 8, lineHeight: 20 }]}>{summary?.oneLook || "—"}</Text>

              {!!summary?.nextStep && (
                <View style={[styles.nextStep, { borderColor: "rgba(212,175,55,.25)" }]}>
                  <Text style={[styles.h3, { color: palette.gold }]}>گام پیشنهادی بعدی</Text>
                  <Text style={[styles.rtl, { color: palette.sub, marginTop: 6, lineHeight: 20 }]}>{summary.nextStep}</Text>

                  {/* دکمه پلکان زیر گام پیشنهادی */}
                  <View style={{ height: 12 }} />
                  <Pressable style={[styles.btn, { borderColor: palette.border }]} onPress={goPelekan}>
                    <Text style={[styles.btnText, { color: palette.text }]}>رفتن به پلکان</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {!loading && !err && (test1Diagrams.length > 0 || test2Diagrams.length > 0) && (
            <View style={{ marginTop: 14 }}>
              <Text style={[styles.h2, { color: palette.text }]}>جزئیات تحلیلی</Text>

              {test1Diagrams.length > 0 && (
                <View style={{ marginTop: 10 }}>
                  <Text style={[styles.sectionTitle, { color: palette.sub }]}>آزمون ۱: بازسنجی رابطه</Text>
                  {test1Diagrams.map((d, idx) => (
                    <DiagramCard key={`${d.key}-${idx}`} item={d} />
                  ))}
                </View>
              )}

              {!didSkipTest2 && test2Diagrams.length > 0 && (
                <View style={{ marginTop: 14 }}>
                  <Text style={[styles.sectionTitle, { color: palette.sub }]}>آزمون ۲: آیا برمی‌گرده؟</Text>
                  {test2Diagrams.map((d, idx) => (
                    <DiagramCard key={`${d.key}-${idx}`} item={d} />
                  ))}
                </View>
              )}
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

          {/* دکمه پلکان پایین صفحه */}
          <Pressable style={[styles.btn, { borderColor: palette.border }]} onPress={goPelekan}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  rtl: { writingDirection: "rtl" as any, textAlign: "right" as any },

  header: {
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.95,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center" as any,
    writingDirection: "rtl" as any,
  },
  headerSub: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
  },

  content: { flexGrow: 1, padding: 16, paddingTop: 12 },

  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    overflow: "hidden",
  },

  h2: { fontSize: 14, fontWeight: "900", textAlign: "center" as any, writingDirection: "rtl" as any },
  h3: { fontSize: 12, fontWeight: "900", textAlign: "right" as any, writingDirection: "rtl" as any },

  oneLook: { borderWidth: 1, borderRadius: 16, padding: 12 },
  nextStep: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    backgroundColor: "rgba(212,175,55,.06)",
  },

  sectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center" as any,
    writingDirection: "rtl" as any,
    marginBottom: 6,
    opacity: 0.95,
  },

  diagram: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },

  pill: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginLeft: 10,
  },

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