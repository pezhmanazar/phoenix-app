import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";

type Props = {
  me: any;
  state: any; // PelekanState
  onRefresh?: () => Promise<void> | void;
};

type UiStep =
  | { type: "consent"; id: string; text: string; optionText?: string }
  | {
      type: "question";
      id: string;
      text: string;
      options: { index: number; label: string }[];
      selectedIndex: number | null;
    }
  | { type: "review_missing"; message?: string }
  | null;

type Nav = {
  index: number;
  total: number;
  canPrev?: boolean;
  canNext?: boolean;
  canSubmit?: boolean;
};

export default function Baseline({ me, state, onRefresh }: Props) {
  const phone = me?.phone as string | undefined;

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
      track: "rgba(231,238,247,.14)",
    }),
    []
  );

  // meta از state
  const baselineMeta = state?.baseline?.content?.meta || {};
  const baselineTitle = String(baselineMeta?.titleFa || "سنجش وضعیت");
  const baselineMaxScore = Number(baselineMeta?.maxScore || 31);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [step, setStep] = useState<UiStep>(null);
  const [nav, setNav] = useState<Nav>({
    index: 0,
    total: 0,
    canNext: false,
    canSubmit: false,
  });

  const [status, setStatus] = useState<string>("in_progress");

  const [completedResult, setCompletedResult] = useState<{
    totalScore: number;
    level: string | null;
    interpretationText: string | null;
    completedAt?: any;
  } | null>(null);

  const [localSelected, setLocalSelected] = useState<number | null>(null);

  const consentCount: number = useMemo(() => {
    const arr = state?.baseline?.content?.consentSteps;
    return Array.isArray(arr) ? arr.length : 0;
  }, [state?.baseline?.content?.consentSteps]);

  const clamp = (n: number, min: number, max: number) =>
    Math.max(min, Math.min(max, n));

  const percent = useMemo(() => {
    const score = Number(completedResult?.totalScore ?? 0);
    const max = baselineMaxScore > 0 ? baselineMaxScore : 31;
    return clamp(Math.round((score / max) * 100), 0, 100);
  }, [completedResult?.totalScore, baselineMaxScore]);

  const levelColor = useMemo(() => {
    const lvl = String(completedResult?.level || "");
    if (lvl === "severe") return palette.red;
    if (lvl === "moderate") return palette.gold;
    return palette.lime;
  }, [completedResult?.level, palette.red, palette.gold, palette.lime]);

  const fetchBaselineState = useCallback(async () => {
    if (!phone) {
      setLoading(false);
      setStep(null);
      setCompletedResult(null);
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(
        `https://qoqnoos.app/api/pelekan/baseline/state?phone=${encodeURIComponent(
          phone
        )}`,
        { headers: { "Cache-Control": "no-store" } }
      );

      const json = await res.json();

      if (!json?.ok) {
        setStep(null);
        setCompletedResult(null);
        setNav({ index: 0, total: 0, canNext: false, canSubmit: false });
        setStatus("error");
        return;
      }

      const data = json.data || {};
      const st = String(data.status || "in_progress");
      setStatus(st);

      if (st === "completed" && data?.result) {
        setCompletedResult({
          totalScore: Number(data.result.totalScore ?? 0),
          level: data.result.level ?? null,
          interpretationText: data.result.interpretationText ?? null,
          completedAt: data.result.completedAt ?? null,
        });
        setStep(null);
        setNav({ index: 0, total: 0, canNext: false, canSubmit: false });
        setLocalSelected(null);
        return;
      }

      setCompletedResult(null);

      setNav(
        data.nav || { index: 0, total: 0, canNext: false, canSubmit: false }
      );

      const s: UiStep = data.step || null;
      setStep(s);

      if (s?.type === "question") {
        setLocalSelected(
          typeof s.selectedIndex === "number" ? s.selectedIndex : null
        );
      } else {
        setLocalSelected(null);
      }
    } catch {
      setStatus("error");
      setStep(null);
      setCompletedResult(null);
    } finally {
      setLoading(false);
    }
  }, [phone]);

  useEffect(() => {
    fetchBaselineState();
  }, [fetchBaselineState]);

  const postAnswer = useCallback(
    async (payload: any) => {
      if (!phone) return false;
      try {
        setBusy(true);
        const res = await fetch(`https://qoqnoos.app/api/pelekan/baseline/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, ...payload }),
        });
        const json = await res.json();
        if (!json?.ok) {
          Alert.alert("خطا", "ثبت پاسخ ناموفق بود.");
          return false;
        }
        return true;
      } catch {
        Alert.alert("خطا", "ارتباط با سرور برقرار نشد.");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [phone]
  );

  const submit = useCallback(async () => {
    if (!phone) return;
    try {
      setBusy(true);
      const res = await fetch(`https://qoqnoos.app/api/pelekan/baseline/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const json = await res.json();
      if (!json?.ok) {
        Alert.alert("خطا", "ثبت نهایی سنجش ناموفق بود.");
        return;
      }
      await onRefresh?.();
      await fetchBaselineState();
    } catch {
      Alert.alert("خطا", "ارتباط با سرور برقرار نشد.");
    } finally {
      setBusy(false);
    }
  }, [phone, onRefresh, fetchBaselineState]);

  const questionIndex = useMemo(() => {
    if (step?.type !== "question") return null;
    const q = nav.index - consentCount;
    return Math.max(0, q);
  }, [step?.type, nav.index, consentCount]);

  const questionTotal = useMemo(() => {
    if (step?.type !== "question") return null;
    const t = nav.total - consentCount;
    return Math.max(0, t);
  }, [step?.type, nav.total, consentCount]);

  const isLastQuestion = useMemo(() => {
    if (step?.type !== "question") return false;
    if (questionIndex == null || questionTotal == null) return false;
    return questionTotal > 0 && questionIndex + 1 === questionTotal;
  }, [step?.type, questionIndex, questionTotal]);

  const goNext = useCallback(async () => {
    if (!step) return;

    if (step.type === "consent") {
      const ok = await postAnswer({
        stepType: "consent",
        stepId: step.id,
        acknowledged: true,
      });
      if (ok) await fetchBaselineState();
      return;
    }

    if (step.type === "question") {
      if (typeof localSelected !== "number") {
        Alert.alert("یک گزینه را انتخاب کن", "برای ادامه باید یکی از گزینه‌ها را انتخاب کنی.");
        return;
      }

      const ok = await postAnswer({
        stepType: "question",
        stepId: step.id,
        optionIndex: localSelected,
      });
      if (!ok) return;

      if (isLastQuestion) {
        await submit();
        return;
      }

      await fetchBaselineState();
      return;
    }

    if (step.type === "review_missing") {
      Alert.alert("نیاز به ریست", step.message || "چند پاسخ ثبت نشده. لطفاً سنجش را ریست کن.");
    }
  }, [step, localSelected, postAnswer, fetchBaselineState, isLastQuestion, submit]);

  // ----------- Donut -----------
  const Donut = ({ valuePercent }: { valuePercent: number }) => {
    const size = 132;
    const stroke = 12;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const dash = (valuePercent / 100) * c;

    return (
      <View style={{ alignItems: "center", justifyContent: "center", marginTop: 6 }}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={palette.track}
            strokeWidth={stroke}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={levelColor}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c - dash}`}
            rotation={-90}
            originX={size / 2}
            originY={size / 2}
          />
        </Svg>

        <View style={{ position: "absolute", alignItems: "center" }}>
          <Text style={{ color: palette.text, fontWeight: "900", fontSize: 26 }}>
            {String(completedResult?.totalScore ?? 0)}
          </Text>
          <Text style={{ color: palette.sub2, fontWeight: "900", marginTop: 2, fontSize: 12 }}>
            از {baselineMaxScore}
          </Text>
        </View>
      </View>
    );
  };

  // ---------------- UI ----------------
  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: palette.bg }]}>
        <ActivityIndicator color={palette.gold} />
        <Text style={{ color: palette.sub, marginTop: 10, fontSize: 12 }}>
          در حال بارگذاری…
        </Text>
      </View>
    );
  }

  // Accent برای هماهنگی با Review
const accent =
  status === "completed" && completedResult ? levelColor : palette.gold;

const header = baselineTitle;

// ✅ ADD THIS — منبع ضدگلوله تفسیر
const interpretationText =
  completedResult?.interpretationText ||
  state?.baseline?.session?.scalesJson?.interpretationTextSafe ||
  null;

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.card,
            styles.cardFancy,
            { backgroundColor: palette.glass, borderColor: palette.border },
          ]}
        >
          <View style={[styles.accentBarTop, { backgroundColor: accent }]} />

          {/* عنوان */}
          <Text style={[styles.title, { color: accent, textAlign: "center" }]}>{header}</Text>

          {/* حالت completed */}
          {status === "completed" && completedResult ? (
            <>
              <View style={{ height: 6 }} />
              <Donut valuePercent={percent} />
              <Text style={[styles.centerText, { color: palette.sub2, marginTop: 8, fontSize: 12 }]}>
                {percent}% از بیشترین میزان
              </Text>

              {interpretationText ? (
  <Text
    style={[
      styles.rtlText,
      {
        color: palette.sub,
        marginTop: 12,
        lineHeight: 20,
        textAlign: "right",
      },
    ]}
  >
    {interpretationText}
  </Text>
) : (
  <Text
    style={[
      styles.rtlText,
      {
        color: palette.sub2,
        marginTop: 12,
        fontSize: 12,
        textAlign: "right",
      },
    ]}
  >
    تفسیر در حال آماده‌سازی است…
  </Text>
)}

              <View style={{ height: 14 }} />

              <Pressable
                disabled={busy}
                onPress={() => onRefresh?.()}
                style={[
                  styles.btnPrimary,
                  { borderColor: "rgba(212,175,55,.35)", backgroundColor: "rgba(212,175,55,.10)", opacity: busy ? 0.7 : 1 },
                ]}
              >
                <Text style={[styles.btnText, { color: palette.text }]}>رفتن به ادامه مسیر</Text>
              </Pressable>
            </>
          ) : step?.type === "consent" ? (
            <>
              <Text style={[styles.rtlText, { color: palette.text, marginTop: 10, lineHeight: 22, textAlign: "right" }]}>
                {step.text}
              </Text>

              <View style={{ height: 14 }} />

              <Pressable
                disabled={busy}
                onPress={goNext}
                style={[
                  styles.btnPrimary,
                  { borderColor: "rgba(212,175,55,.35)", backgroundColor: "rgba(212,175,55,.10)", opacity: busy ? 0.7 : 1 },
                ]}
              >
                {busy ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <ActivityIndicator color={palette.gold} />
                    <Text style={[styles.btnText, { color: palette.text }]}>در حال ثبت…</Text>
                  </View>
                ) : (
                  <Text style={[styles.btnText, { color: palette.text }]}>{step.optionText || "متوجه شدم"}</Text>
                )}
              </Pressable>
            </>
          ) : step?.type === "question" ? (
            <>
              <Text style={[styles.centerText, { color: palette.sub, marginTop: 6, fontSize: 12 }]}>
  سوال {(questionIndex ?? 0) + 1} از {questionTotal ?? 0}
</Text>

<Text style={[styles.centerText, { color: palette.sub2, marginTop: 4, fontSize: 11 }]}>
  برای دیدن همه گزینه‌ها صفحه رو به بالا بکش
</Text>

<View style={styles.hr} />

              <View style={styles.hr} />

              <Text style={[styles.qText, styles.rtlText, { color: palette.text }]}>
                {step.text}
              </Text>

              <View style={{ height: 16 }} />

              {step.options.map((opt) => {
                const selected = localSelected === opt.index;
                return (
                  <Pressable
                    key={String(opt.index)}
                    disabled={busy}
                    onPress={() => setLocalSelected(opt.index)}
                    style={({ pressed }) => [
                      styles.option,
                      {
                        borderColor: selected ? palette.gold : palette.border,
                        backgroundColor: selected ? "rgba(255,255,255,.06)" : "transparent",
                        opacity: pressed ? 0.92 : 1,
                        transform: [{ scale: pressed ? 0.995 : 1 }],
                      },
                    ]}
                  >
                    <Text style={[styles.centerText, styles.rtlText, { color: palette.text, fontSize: 14 }]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}

              <View style={{ height: 6 }} />

              <Pressable
                disabled={busy || typeof localSelected !== "number"}
                onPress={goNext}
                style={[
                  styles.btnPrimary,
                  {
                    borderColor: typeof localSelected !== "number" ? palette.border : "rgba(212,175,55,.35)",
                    backgroundColor: typeof localSelected !== "number" ? "rgba(255,255,255,.04)" : "rgba(212,175,55,.10)",
                    opacity: busy ? 0.85 : 1,
                  },
                ]}
              >
                {busy ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <ActivityIndicator color={palette.gold} />
                    <Text style={[styles.btnText, { color: palette.text }]}>در حال ثبت…</Text>
                  </View>
                ) : (
                  <Text style={[styles.btnText, { color: typeof localSelected !== "number" ? palette.sub : palette.text }]}>
                    {isLastQuestion ? "ثبت نهایی" : "ادامه"}
                  </Text>
                )}
              </Pressable>
            </>
          ) : step?.type === "review_missing" ? (
            <Text style={[styles.rtlText, { color: palette.red, marginTop: 10, lineHeight: 22, textAlign: "right" }]}>
              {step.message || "چند پاسخ ثبت نشده. لطفاً سنجش را ریست کن."}
            </Text>
          ) : (
            <Text style={[styles.centerText, { color: palette.sub2, marginTop: 10, lineHeight: 20 }]}>
              وضعیت مشخص نیست. یک بار دوباره وارد شو.
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  rtlText: { writingDirection: "rtl" as any },
  centerText: { textAlign: "center" as any, writingDirection: "rtl" as any },

  container: { flex: 1 },
  root: { flex: 1, alignItems: "center", justifyContent: "center" },

  scrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 28,
    justifyContent: "center",
  },

  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    overflow: "hidden",
  },

  cardFancy: {
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },

  accentBarTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.95,
  },

  title: { fontSize: 18, fontWeight: "900" },

  hr: {
    height: 1,
    backgroundColor: "rgba(255,255,255,.08)",
    marginVertical: 14,
  },

  qText: { fontSize: 16, fontWeight: "800", lineHeight: 26, textAlign: "right" as any },

  option: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 10,
  },

  btnPrimary: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },

  btnText: { fontSize: 14, fontWeight: "900" },
});