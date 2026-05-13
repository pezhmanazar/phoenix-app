import { useAuth } from "@/hooks/useAuth";
import { getFriendlyErrorMessage } from "@/lib/errors/getFriendlyErrorMessage";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import AppBannerModal from "../ui/AppBannerModal";

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

const API_BASE = "https://api.qoqnoos.app/api/pelekan/baseline";

async function fetchJson(url: string, token: string) {
  const res = await fetch(url, {
    headers: {
      "Cache-Control": "no-store",
      Authorization: `Bearer ${token}`,
    },
  });

  const json = await res.json().catch(() => null);
  return { res, json };
}

async function postJson(url: string, token: string, body: any) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => null);
  return { res, json };
}

export default function Baseline({ me, state, onRefresh }: Props) {
  const { token, loading: authLoading } = useAuth();

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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [completedResult, setCompletedResult] = useState<{
    totalScore: number;
    level: string | null;
    interpretationText: string | null;
    completedAt?: any;
  } | null>(null);

  const [localSelected, setLocalSelected] = useState<number | null>(null);

  const [appModal, setAppModal] = useState<{
    visible: boolean;
    kind: "success" | "error" | "warning" | "info";
    title: string;
    message?: string;
  }>({
    visible: false,
    kind: "info",
    title: "",
    message: "",
  });

  const consentCount: number = useMemo(() => {
    const arr = state?.baseline?.content?.consentSteps;
    return Array.isArray(arr) ? arr.length : 0;
  }, [state?.baseline?.content?.consentSteps]);

  const showAppModal = (
    kind: "success" | "error" | "warning" | "info",
    title: string,
    message?: string
  ) => {
    setAppModal({
      visible: true,
      kind,
      title,
      message,
    });
  };

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
    if (authLoading) {
      console.log("[Baseline/fetchState] skipped: authLoading");
      return;
    }

    if (!token) {
      console.log("[Baseline/fetchState] no token");
      setLoading(false);
      setStep(null);
      setCompletedResult(null);
      setStatus("error");
      setErrorMsg("TOKEN_MISSING");
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);

      const url = `${API_BASE}/state`;

      console.log("[Baseline/fetchState] request", {
        hasToken: !!token,
        tokenPreview: `${token.slice(0, 12)}...`,
        url,
      });

      const { res, json } = await fetchJson(url, token);

      console.log("[Baseline/fetchState] response", {
        status: res.status,
        ok: res.ok,
      });

      console.log("[Baseline/fetchState] json", {
        ok: json?.ok,
        error: json?.error || null,
        message: json?.message || null,
        hasData: !!json?.data,
      });

      if (!res.ok || !json?.ok) {
        setStep(null);
        setCompletedResult(null);
        setNav({ index: 0, total: 0, canNext: false, canSubmit: false });
        setStatus("error");
        setErrorMsg(String(json?.error || json?.message || `HTTP_${res.status}`));
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

      setNav(data.nav || { index: 0, total: 0, canNext: false, canSubmit: false });

      const s: UiStep = data.step || null;
      setStep(s);

      if (s?.type === "question") {
        setLocalSelected(typeof s.selectedIndex === "number" ? s.selectedIndex : null);
      } else {
        setLocalSelected(null);
      }

      if (st !== "completed" && !s) {
        setErrorMsg("STEP_MISSING");
      }
    } catch (e: any) {
      console.log("[Baseline/fetchState] catch", {
        message: e?.message || null,
      });

      setStatus("error");
      setStep(null);
      setCompletedResult(null);
      setErrorMsg(String(e?.message || "NETWORK_ERROR"));
    } finally {
      setLoading(false);
    }
  }, [token, authLoading]);

  useEffect(() => {
    console.log("[Baseline/useEffect]", {
      authLoading,
      hasToken: !!token,
      tokenPreview: token ? `${token.slice(0, 12)}...` : null,
    });

    if (authLoading) return;
    fetchBaselineState();
  }, [authLoading, token, fetchBaselineState]);

  const postAnswer = useCallback(
    async (payload: any) => {
      if (authLoading) {
        showAppModal("warning", "کمی صبر کن", "احراز هویت هنوز کامل نشده.");
        return false;
      }

      if (!token) {
        showAppModal("error", "نیاز به ورود", "توکن احراز هویت پیدا نشد.");
        return false;
      }

      try {
        setBusy(true);

        console.log("[Baseline/postAnswer] request", {
          hasToken: !!token,
          tokenPreview: `${token.slice(0, 12)}...`,
          payload,
        });

        const { res, json } = await postJson(`${API_BASE}/answer`, token, payload);

        console.log("[Baseline/postAnswer] response", {
          status: res.status,
          ok: res.ok,
        });

        console.log("[Baseline/postAnswer] json", {
          ok: json?.ok,
          error: json?.error || null,
          message: json?.message || null,
        });

        if (!res.ok || !json?.ok) {
          showAppModal(
            "error",
            "ثبت پاسخ انجام نشد",
            json?.message || json?.error || `status=${res.status}`
          );
          return false;
        }

        return true;
      } catch (e: any) {
        console.log("[Baseline/postAnswer] catch", {
          message: e?.message || null,
        });

        showAppModal(
          "error",
          "ارتباط برقرار نشد",
          e?.message || "اتصال به سرور برقرار نشد. لطفاً دوباره تلاش کن."
        );
        return false;
      } finally {
        setBusy(false);
      }
    },
    [token, authLoading]
  );

  const submit = useCallback(async () => {
    if (authLoading) {
      showAppModal("warning", "کمی صبر کن", "احراز هویت هنوز کامل نشده.");
      return;
    }

    if (!token) {
      showAppModal("error", "نیاز به ورود", "توکن احراز هویت پیدا نشد.");
      return;
    }

    try {
      setBusy(true);

      console.log("[Baseline/submit] request", {
        hasToken: !!token,
        tokenPreview: `${token.slice(0, 12)}...`,
      });

      const { res, json } = await postJson(`${API_BASE}/submit`, token, {});

      console.log("[Baseline/submit] response", {
        status: res.status,
        ok: res.ok,
      });

      console.log("[Baseline/submit] json", {
        ok: json?.ok,
        error: json?.error || null,
        message: json?.message || null,
      });

      if (!res.ok || !json?.ok) {
        showAppModal(
          "error",
          "ثبت نهایی انجام نشد",
          json?.message || json?.error || `status=${res.status}`
        );
        return;
      }

      await onRefresh?.();
      await fetchBaselineState();
    } catch (e: any) {
      console.log("[Baseline/submit] catch", {
        message: e?.message || null,
      });

      showAppModal(
        "error",
        "ارتباط برقرار نشد",
        e?.message || "اتصال به سرور برقرار نشد. لطفاً دوباره تلاش کن."
      );
    } finally {
      setBusy(false);
    }
  }, [token, authLoading, onRefresh, fetchBaselineState]);

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
        showAppModal(
          "warning",
          "یک گزینه را انتخاب کن",
          "برای ادامه، لازمه یکی از گزینه‌ها رو انتخاب کنی."
        );
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
      showAppModal(
        "warning",
        "از اول باید شروع کنی",
        step.message ||
          "چند پاسخ ثبت نشده. برای شروع دوباره، به تب پروفایل برو، وارد ویرایش پروفایل شو و گزینه «شروع از صفر» رو انتخاب کن."
      );
    }
  }, [step, localSelected, postAnswer, fetchBaselineState, isLastQuestion, submit]);

  const markSeen = useCallback(async () => {
    if (authLoading) {
      showAppModal("warning", "کمی صبر کن", "احراز هویت هنوز کامل نشده.");
      return;
    }

    if (!token) {
      showAppModal("error", "نیاز به ورود", "توکن احراز هویت پیدا نشد.");
      return;
    }

    try {
      setBusy(true);

      console.log("[Baseline/seen] request", {
        hasToken: !!token,
        tokenPreview: `${token.slice(0, 12)}...`,
      });

      const { res, json } = await postJson(`${API_BASE}/seen`, token, {});

      console.log("[Baseline/seen] response", {
        status: res.status,
        ok: res.ok,
      });

      console.log("[Baseline/seen] json", {
        ok: json?.ok,
        error: json?.error || null,
        message: json?.message || null,
      });
    } catch (e: any) {
      console.log("[Baseline/seen] catch", {
        message: e?.message || null,
      });
    } finally {
      setBusy(false);
    }

    await onRefresh?.();
  }, [token, authLoading, onRefresh]);

  const Donut = ({ valuePercent }: { valuePercent: number }) => {
    const size = 132;
    const stroke = 12;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const dash = (valuePercent / 100) * c;

    return (
      <View style={{ alignItems: "center", justifyContent: "center", marginTop: 6 }}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={palette.track} strokeWidth={stroke} fill="none" />
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

  const accent = status === "completed" && completedResult ? levelColor : palette.gold;
  const header = baselineTitle;

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
        <View style={[styles.card, styles.cardFancy, { backgroundColor: palette.glass, borderColor: palette.border }]}>
          <View style={[styles.accentBarTop, { backgroundColor: accent }]} />

          <Text style={[styles.title, { color: accent, textAlign: "center" }]}>{header}</Text>

          {status === "error" ? (
            <>
              <Text style={[styles.centerText, { color: palette.red, marginTop: 12, lineHeight: 20 }]}>
                خطا در دریافت سنجش.
              </Text>

              {!!errorMsg && (
                <Text style={[styles.centerText, { color: palette.sub2, marginTop: 8, fontSize: 12 }]}>
                  {getFriendlyErrorMessage(errorMsg)}
                </Text>
              )}

              <View style={{ height: 14 }} />
              <Pressable
                disabled={busy}
                onPress={fetchBaselineState}
                style={[
                  styles.btnPrimary,
                  {
                    borderColor: palette.border,
                    backgroundColor: "rgba(255,255,255,.04)",
                    opacity: busy ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={[styles.btnText, { color: palette.text }]}>تلاش دوباره</Text>
              </Pressable>
            </>
          ) : status === "completed" && completedResult ? (
            <>
              <View style={{ height: 6 }} />
              <Donut valuePercent={percent} />
              <Text style={[styles.centerText, { color: palette.sub2, marginTop: 8, fontSize: 12 }]}>
                {percent}% از بیشترین میزان
              </Text>

              {interpretationText ? (
                <Text style={[styles.rtlText, { color: palette.sub, marginTop: 12, lineHeight: 20, textAlign: "right" }]}>
                  {interpretationText}
                </Text>
              ) : (
                <Text style={[styles.rtlText, { color: palette.sub2, marginTop: 12, fontSize: 12, textAlign: "right" }]}>
                  تفسیر در حال آماده‌سازی است…
                </Text>
              )}

              <View style={{ height: 14 }} />

              <Pressable
                disabled={busy}
                onPress={markSeen}
                style={[
                  styles.btnPrimary,
                  {
                    borderColor: "rgba(212,175,55,.35)",
                    backgroundColor: "rgba(212,175,55,.10)",
                    opacity: busy ? 0.7 : 1,
                  },
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
                  {
                    borderColor: "rgba(212,175,55,.35)",
                    backgroundColor: "rgba(212,175,55,.10)",
                    opacity: busy ? 0.7 : 1,
                  },
                ]}
              >
                {busy ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <ActivityIndicator color={palette.gold} />
                    <Text style={[styles.btnText, { color: palette.text }]}>در حال ثبت…</Text>
                  </View>
                ) : (
                  <Text style={[styles.btnText, { color: palette.text }]}>
                    {step.optionText || "متوجه شدم"}
                  </Text>
                )}
              </Pressable>
            </>
          ) : step?.type === "question" ? (
            <>
              <Text style={[styles.centerText, { color: palette.sub, marginTop: 6, fontSize: 12 }]}>
                سوال {(questionIndex ?? 0) + 1} از {questionTotal ?? 0}
              </Text>

              <Text style={[styles.centerText, { color: palette.sub2, marginTop: 4, fontSize: 11 }]}>
                برای دیدن همه گزینه‌ها، صفحه رو به بالا بکش
              </Text>

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
                    borderColor:
                      typeof localSelected !== "number"
                        ? palette.border
                        : "rgba(212,175,55,.35)",
                    backgroundColor:
                      typeof localSelected !== "number"
                        ? "rgba(255,255,255,.04)"
                        : "rgba(212,175,55,.10)",
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
                  <Text
                    style={[
                      styles.btnText,
                      {
                        color:
                          typeof localSelected !== "number"
                            ? palette.sub
                            : palette.text,
                      },
                    ]}
                  >
                    {isLastQuestion ? "ثبت نهایی" : "ادامه"}
                  </Text>
                )}
              </Pressable>
            </>
          ) : step?.type === "review_missing" ? (
            <Text style={[styles.rtlText, { color: palette.red, marginTop: 10, lineHeight: 22, textAlign: "right" }]}>
              {step.message || "چند پاسخ ثبت نشده. لطفاً سنجش رو ریست کن."}
            </Text>
          ) : (
            <>
              <Text style={[styles.centerText, { color: palette.sub2, marginTop: 12, lineHeight: 20 }]}>
                سنجش در حال همگام‌سازی است…
              </Text>

              {!!errorMsg && (
                <Text style={[styles.centerText, { color: palette.sub2, marginTop: 8, fontSize: 12 }]}>
                  {getFriendlyErrorMessage(errorMsg)}
                </Text>
              )}

              <View style={{ height: 14 }} />
              <Pressable
                disabled={busy}
                onPress={fetchBaselineState}
                style={[
                  styles.btnPrimary,
                  {
                    borderColor: palette.border,
                    backgroundColor: "rgba(255,255,255,.04)",
                    opacity: busy ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={[styles.btnText, { color: palette.text }]}>تازه‌سازی</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>

      <AppBannerModal
        visible={appModal.visible}
        kind={appModal.kind}
        title={appModal.title}
        message={appModal.message}
        onClose={() => setAppModal((prev) => ({ ...prev, visible: false }))}
      />
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

  qText: {
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 26,
    textAlign: "right" as any,
  },

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
