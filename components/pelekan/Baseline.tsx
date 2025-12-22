import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

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
      text: "#F9FAFB",
      sub: "rgba(231,238,247,.74)",
      faint: "rgba(231,238,247,.55)",

      gold: "#D4AF37",

      // ✅ شیشه‌ای‌تر تا بک‌گراند دیده بشه
      glass: "rgba(3,7,18,.62)",
      border: "rgba(255,255,255,.09)",

      btnBg: "rgba(255,255,255,.06)",
      btnBorder: "rgba(255,255,255,.14)",

      // ✅ رنگ پاستلی برای حس “امید”
      mint: "rgba(74,222,128,.95)", // سبز پاستلی
      mintBorder: "rgba(74,222,128,.40)",
      mintBg: "rgba(74,222,128,.10)",

      optionBg: "rgba(255,255,255,.045)",
      danger: "#EF4444",
    }),
    []
  );

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

  const [localSelected, setLocalSelected] = useState<number | null>(null);

  const consentCount: number = useMemo(() => {
    const arr = state?.baseline?.content?.consentSteps;
    return Array.isArray(arr) ? arr.length : 0;
  }, [state?.baseline?.content?.consentSteps]);

  const fetchBaselineState = useCallback(async () => {
    if (!phone) {
      setLoading(false);
      setStep(null);
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
        setNav({ index: 0, total: 0, canNext: false, canSubmit: false });
        setStatus("error");
        return;
      }

      const data = json.data || {};
      setStatus(String(data.status || "in_progress"));
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
        const res = await fetch(
          `https://qoqnoos.app/api/pelekan/baseline/answer`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone, ...payload }),
          }
        );
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
      const res = await fetch(
        `https://qoqnoos.app/api/pelekan/baseline/submit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone }),
        }
      );
      const json = await res.json();
      if (!json?.ok) {
        Alert.alert("خطا", "ثبت نهایی آزمون ناموفق بود.");
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

  // ✅ شمارنده‌ی سوال‌ها (نه کل استپ‌ها)
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

      // ✅ اول جواب سوال آخر رو ثبت کن
      const ok = await postAnswer({
        stepType: "question",
        stepId: step.id,
        optionIndex: localSelected,
      });
      if (!ok) return;

      // ✅ اگر سوال آخره، مستقیم submit (نه اینکه دوباره همین سوال بیاد)
      if (isLastQuestion) {
        await submit();
        return;
      }

      await fetchBaselineState();
      return;
    }

    if (step.type === "review_missing") {
      Alert.alert(
        "نیاز به ریست",
        step.message || "چند پاسخ ثبت نشده. لطفاً آزمون را ریست کن."
      );
    }
  }, [step, localSelected, postAnswer, fetchBaselineState, isLastQuestion, submit]);

  // ---------------- UI ----------------
  if (loading) {
    return (
      <View style={[styles.full, { backgroundColor: palette.bg }]}>
        <View style={styles.centerWrap}>
          <ActivityIndicator color={palette.gold} />
          <Text style={{ color: palette.faint, marginTop: 10, fontWeight: "800" }}>
            در حال بارگذاری…
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.full, { backgroundColor: palette.bg }]}>
      <View style={styles.centerWrap}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: palette.glass,
              borderColor: palette.border,
            },
          ]}
        >
          {step?.type === "consent" ? (
            <>
              <Text style={[styles.stepText, { color: palette.text }]}>
                {step.text}
              </Text>

              <TouchableOpacity
                activeOpacity={0.9}
                onPress={goNext}
                disabled={busy}
                style={[
                  styles.primaryBtnGlass,
                  {
                    marginTop: 24,
                    backgroundColor: palette.btnBg,
                    borderColor: palette.btnBorder,
                    opacity: busy ? 0.6 : 1,
                  },
                ]}
              >
                {busy ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <ActivityIndicator color={palette.gold} />
                    <Text style={[styles.primaryBtnText, { color: palette.text }]}>
                      در حال ثبت…
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.primaryBtnText, { color: palette.text }]}>
                    {step.optionText || "متوجه شدم"}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          ) : step?.type === "question" ? (
            <>
              {/* ✅ هدر شمارنده کاملاً وسط */}
              <Text style={[styles.counter, { color: palette.faint }]}>
                سوال {(questionIndex ?? 0) + 1} از {questionTotal ?? 0}
              </Text>

              {/* ✅ فونت سوال کوچیک‌تر + فاصله کنترل شده تا به هدر نچسبه */}
              <Text style={[styles.question, { color: palette.text }]}>
                {step.text}
              </Text>

              <View style={{ marginTop: 14, gap: 12 }}>
                {step.options.map((opt) => {
                  const selected = localSelected === opt.index;
                  return (
                    <TouchableOpacity
                      key={String(opt.index)}
                      activeOpacity={0.9}
                      onPress={() => setLocalSelected(opt.index)}
                      disabled={busy}
                      style={[
                        styles.option,
                        {
                          borderColor: selected ? palette.mintBorder : palette.border,
                          backgroundColor: selected ? palette.mintBg : palette.optionBg,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          { color: selected ? palette.text : palette.sub },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* ✅ دکمه پایین: اگر سوال آخره از همینجا "ثبت نهایی" */}
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={goNext}
                disabled={busy || typeof localSelected !== "number"}
                style={[
                  styles.primaryBtnGlass,
                  {
                    marginTop: 16,
                    backgroundColor: palette.btnBg,
                    borderColor: palette.btnBorder,
                    opacity: busy || typeof localSelected !== "number" ? 0.55 : 1,
                  },
                ]}
              >
                {busy ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <ActivityIndicator color={palette.gold} />
                    <Text style={[styles.primaryBtnText, { color: palette.text }]}>
                      در حال ثبت…
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.primaryBtnText, { color: palette.text }]}>
                    {isLastQuestion ? "ثبت نهایی" : "ادامه"}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          ) : step?.type === "review_missing" ? (
            <Text style={[styles.stepText, { color: palette.danger }]}>
              {step.message || "چند پاسخ ثبت نشده. لطفاً آزمون را ریست کن."}
            </Text>
          ) : (
            <Text style={[styles.stepText, { color: palette.faint }]}>
              قدم بعدی آماده نیست. یک‌بار رفرش کن.
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1 },

  // ✅ همیشه وسط، ولی با فاصله امن از بالا/پایین
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 18,
  },

  // ✅ card شیشه‌ای، جمع‌وجور، بک‌گراند رو کمتر می‌پوشونه
  card: {
    width: "100%",
    maxWidth: 520,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    overflow: "hidden",
  },

  counter: {
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 8,
  },

  // ✅ کوچیک‌تر تا بالا نره و به هدر نچسبه
  question: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    fontWeight: "900",
  },

  stepText: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    fontWeight: "900",
  },

  option: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },

  optionText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    fontWeight: "800",
  },

  primaryBtnGlass: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  primaryBtnText: {
    fontSize: 14,
    fontWeight: "900",
  },
});