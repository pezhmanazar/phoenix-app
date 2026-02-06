// phoenix-app/app/(tabs)/ReviewResult.tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

/**
 * ✅ دو دامنه برای جلوگیری از گیرهای محیطی/کش
 */
const API_REVIEW_PRIMARY = "https://api.qoqnoos.app/api/pelekan/review";
const API_REVIEW_FALLBACK = "https://qoqnoos.app/api/pelekan/review";

const API_STATE_PRIMARY = "https://api.qoqnoos.app/api/pelekan/state";
const API_STATE_FALLBACK = "https://qoqnoos.app/api/pelekan/state";

// ✅ Baseline max score
const BASELINE_MAX_SCORE = 31;

type ResultResponse = {
  ok: boolean;
  error?: string;
  data?: {
    status: "in_progress" | "completed_locked" | "unlocked";
    canEnterPelekan?: boolean;
    result: any | null;
  };
};

type StateResponse = {
  ok: boolean;
  error?: string;
  data?: {
    baseline?: { session?: any | null } | null;
    review?: { session?: any | null } | null;
    user?: any | null;
  };
};

type DiagramItem = {
  key: string;
  title: string;
  percent: number;
  label?: string;
};

async function fetchJsonWithFallback(urlPrimary: string, urlFallback: string) {
  try {
    const res1 = await fetch(urlPrimary, { headers: { "Cache-Control": "no-store" } });
    const j1 = await res1.json().catch(() => null);
    if (j1 && j1.ok) return j1;
  } catch {}
  const res2 = await fetch(urlFallback, { headers: { "Cache-Control": "no-store" } });
  const j2 = await res2.json().catch(() => null);
  return j2;
}

// ✅ NEW: POST with primary/fallback
async function postJsonWithFallback(urlPrimary: string, urlFallback: string, body: any) {
  try {
    const res1 = await fetch(urlPrimary, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify(body),
    });
    const j1 = await res1.json().catch(() => null);
    if (j1 && j1.ok) return j1;
  } catch {}
  const res2 = await fetch(urlFallback, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  });
  const j2 = await res2.json().catch(() => null);
  return j2;
}

/** ✅ Ring (بدون کتابخانه اضافی) */
function ScoreRing({
  value,
  max = 100,
  size = 108,
  stroke = 10,
  trackColor,
  progressColor,
  textColor,
  subColor,
  label,
}: {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  trackColor: string;
  progressColor: string;
  textColor: string;
  subColor: string;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(Number(value || 0), Number(max || 100)));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  const safeMax = Number(max || 100);
  const dash = safeMax > 0 ? (clamped / safeMax) * c : 0;

  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={progressColor}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c - dash}`}
            rotation={-90}
            originX={size / 2}
            originY={size / 2}
          />
        </Svg>

        <View style={[StyleSheet.absoluteFillObject, { alignItems: "center", justifyContent: "center" }]}>
          <Text style={{ color: textColor, fontWeight: "900", fontSize: 20 }}>{clamped}</Text>
          <Text style={{ color: subColor, fontSize: 11, marginTop: 2, fontWeight: "900" }}>از {safeMax}</Text>
        </View>
      </View>

      {!!label && (
        <Text style={{ marginTop: 10, color: subColor, fontSize: 12, fontWeight: "900", writingDirection: "rtl" as any }}>
          {label}
        </Text>
      )}
    </View>
  );
}

export default function ReviewResult() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const phone = String((params as any)?.phone || "").trim();

  const mountedRef = useRef(true);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // ✅ state from /pelekan/state
  const [baselineSession, setBaselineSession] = useState<any | null>(null);
  const [reviewSession, setReviewSession] = useState<any | null>(null);

  // ✅ review result from /pelekan/review/result
  const [result, setResult] = useState<any | null>(null);
  const [reviewStatus, setReviewStatus] = useState<"in_progress" | "completed_locked" | "unlocked" | null>(null);

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

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ✅ FIX: always pass phone to Pelekan so it doesn't reset state
  const goPelekan = useCallback(() => {
    if (!phone) return;
    router.replace({ pathname: "/(tabs)/Pelekan", params: { phone } } as any);
  }, [router, phone]);

  const goPelekanReviewTests = useCallback(() => {
    if (!phone) return;
    router.replace({
      pathname: "/(tabs)/Pelekan",
      params: { phone, focus: "review_tests" },
    } as any);
  }, [router, phone]);

  // ✅ NEW: baseline focus (برای جلوگیری از ارسال اشتباه به review_tests)
  const goPelekanBaselineTests = useCallback(() => {
    if (!phone) return;
    router.replace({
      pathname: "/(tabs)/Pelekan",
      params: { phone, focus: "baseline_tests" },
    } as any);
  }, [router, phone]);

  const fetchAll = useCallback(async () => {
    if (!phone) {
      setErr("PHONE_MISSING");
      setLoading(false);
      return;
    }

    if (mountedRef.current) {
      setLoading(true);
      setErr(null);
    }

    try {
      // 1) pelekan/state -> baseline + review session
      const stJson: StateResponse = await fetchJsonWithFallback(
        `${API_STATE_PRIMARY}?phone=${encodeURIComponent(phone)}`,
        `${API_STATE_FALLBACK}?phone=${encodeURIComponent(phone)}`
      );

      if (!stJson?.ok) throw new Error(stJson?.error || "STATE_FAILED");

      const b = stJson?.data?.baseline?.session ?? null;
      const r = stJson?.data?.review?.session ?? null;

      // ✅ LOG 1: state snapshot
      console.log("🧪 [ReviewResult] state snapshot", {
        phone,
        baselineStatus: String(b?.status || ""),
        review: r
          ? {
              id: r?.id,
              chosenPath: r?.chosenPath,
              status: r?.status,
              currentTest: r?.currentTest,
              currentIndex: r?.currentIndex,
              test1CompletedAt: r?.test1CompletedAt,
              test2CompletedAt: r?.test2CompletedAt,
              test2SkippedAt: r?.test2SkippedAt,
            }
          : null,
      });

      if (mountedRef.current) {
        setBaselineSession(b);
        setReviewSession(r);
      }

      // 2) review/result only if done
      const rStatus = String(r?.status || "");
      const chosen = String(r?.chosenPath || "");

      // ✅ فقط وقتی done باشد نتیجه می‌گیریم (طبق کد خودت)
      const shouldFetchReviewResult = rStatus === "completed_locked" || rStatus === "unlocked";

      // ✅ LOG 2: decision
      console.log("🧪 [ReviewResult] decide fetch result", {
        chosen,
        rStatus,
        shouldFetchReviewResult,
      });

      // ✅ اگر هنوز done نبود: نتیجه را پاک می‌کنیم و فقط status را نگه می‌داریم
      if (!shouldFetchReviewResult) {
        if (mountedRef.current) {
          setReviewStatus((rStatus as any) || null);
          setResult(null);
        }
        return;
      }

      const rrJson: ResultResponse = await fetchJsonWithFallback(
        `${API_REVIEW_PRIMARY}/result?phone=${encodeURIComponent(phone)}`,
        `${API_REVIEW_FALLBACK}/result?phone=${encodeURIComponent(phone)}`
      );

      if (!rrJson?.ok) throw new Error(rrJson?.error || "RESULT_FAILED");

      // ✅ LOG 3: result payload
      console.log("🧪 [ReviewResult] /review/result payload", {
        ok: rrJson?.ok,
        status: rrJson?.data?.status,
        locked: rrJson?.data?.result?.locked,
        didSkipTest2: rrJson?.data?.result?.meta?.didSkipTest2,
        t1: Array.isArray(rrJson?.data?.result?.diagrams?.test1) ? rrJson.data!.result!.diagrams.test1.length : null,
        t2: Array.isArray(rrJson?.data?.result?.diagrams?.test2) ? rrJson.data!.result!.diagrams.test2.length : null,
      });

      if (mountedRef.current) {
        setReviewStatus(rrJson?.data?.status ?? null);
        setResult(rrJson?.data?.result ?? null);
      }
    } catch (e: any) {
      if (mountedRef.current) setErr(String(e?.message || "FAILED"));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [phone]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ✅ NEW: اگر کاربر مسیر skip_review دارد، اول choice را به review تغییر بده سپس بفرست به آزمون‌ها
  const goReviewTestsForceReviewPath = useCallback(async () => {
    if (!phone) return;

    if (mountedRef.current) {
      setLoading(true);
      setErr(null);
    }

    try {
      // اگر انتخاب مسیر skip_review بود، باید قبل از رفتن به تست‌ها، مسیر را به review برگردانیم
      const chosen = String(reviewSession?.chosenPath || "");
      if (chosen === "skip_review") {
        console.log("🧪 [ReviewResult] force choosePath -> review (was skip_review)", { phone });

        const cj = await postJsonWithFallback(`${API_REVIEW_PRIMARY}/choose`, `${API_REVIEW_FALLBACK}/choose`, {
          phone,
          choice: "review",
        });

        if (!cj?.ok) throw new Error(cj?.error || "CHOOSE_FAILED");

        // چون state محلی هنوز قبلی است، یک refresh سریع بزنیم تا UI همگام شود
        try {
          await fetchAll();
        } catch {}
      }

      // ✅ FIX: pass phone
      router.replace({
        pathname: "/(tabs)/Pelekan",
        params: { phone, focus: "review_tests" },
      } as any);
    } catch (e: any) {
      if (mountedRef.current) setErr(String(e?.message || "FAILED"));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [phone, reviewSession?.chosenPath, router, fetchAll]);

  // ---------------- baseline status ----------------
  const baselineStatus = String(baselineSession?.status || "");
  const baselineDone = baselineStatus === "completed";
  const baselineInProgress = !!baselineSession && !baselineDone;

  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

  // ✅ baseline score extraction (۰ تا ۳۱)
  const baselineScore = useMemo(() => {
    const n = baselineSession?.totalScore ?? null;
    const v = Number(n);
    if (!Number.isFinite(v)) return null;
    return clamp(v, 0, BASELINE_MAX_SCORE);
  }, [baselineSession]);

  // ✅ درصد baseline (برای رنگ/نمایش کمکی)
  const baselinePercent = useMemo(() => {
    if (baselineScore == null) return null;
    return clamp(Math.round((baselineScore / BASELINE_MAX_SCORE) * 100), 0, 100);
  }, [baselineScore]);

  // ✅ رنگ baseline بر اساس باندهای واقعی (۰-۹، ۱۰-۱۹، ۲۰-۳۱)
  const baselineColor = useMemo(() => {
    if (baselineScore == null) return palette.gold;
    if (baselineScore >= 20) return palette.red;
    if (baselineScore >= 10) return palette.orange;
    return palette.lime;
  }, [baselineScore, palette.red, palette.orange, palette.lime, palette.gold]);

  // ✅ baseline explanation
  const baselineExplain = useMemo(() => {
    const safeText =
      baselineSession?.scalesJson?.interpretationTextSafe ??
      baselineSession?.scalesJson?.interpretationSafe ??
      baselineSession?.interpretationTextSafe ??
      baselineSession?.scalesJson?.interpretationText ??
      null;

    if (safeText) return String(safeText);

    return "این نمره شدت «فشار و آسیب روانیِ ناشی از شکست عاطفی یا جدایی» را نشان می‌دهد. نمره بالاتر یعنی ذهن و بدن تو هنوز تحت فشار بیشتری هستند و بهتر است از یک مسیر حمایتی و درمانی ساختارمند استفاده کنی.";
  }, [baselineSession]);

  // ---------------- review / tests ----------------
  const hasReviewSession = !!reviewSession?.id;
  const chosenPath = reviewSession?.chosenPath ?? null;
  const reviewSessStatus = String(reviewSession?.status || "");
  const reviewInProgress = reviewSessStatus === "in_progress";

  // ✅ تفکیک مسیرها
  const isSkipPath = chosenPath === "skip_review";
  const isReviewPath = chosenPath === "review";

  // ✅ reviewDone فقط وقتی review انتخاب شده
  const reviewDone = isReviewPath && (reviewSessStatus === "completed_locked" || reviewSessStatus === "unlocked");

  // ✅ IMPORTANT: نتایج رایگان است → lock را در UI نادیده می‌گیریم
  const locked = false;
  const didSkipTest2 = !!result?.meta?.didSkipTest2;

  const diagramsObj = result?.diagrams || null;
  const test1Diagrams: DiagramItem[] = Array.isArray(diagramsObj?.test1) ? diagramsObj.test1 : [];
  const test2Diagrams: DiagramItem[] = Array.isArray(diagramsObj?.test2) ? diagramsObj.test2 : [];
  const summary = result?.summary || null;

  const statusColor = useMemo(() => {
    if (isSkipPath) return palette.gold;
    if (reviewDone) return locked ? palette.red : palette.lime;
    return palette.gold;
  }, [isSkipPath, reviewDone, locked, palette.red, palette.lime, palette.gold]);

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
        return "این شاخص «تنش دلبستگی» را نشان می‌دهد (اضطرابِ رهاشدگی یا اجتناب از صمیمیت). هرچه بالاتر باشد یعنی رابطه بیشتر روی زخم‌های دلبستگی فشار آورده و تصمیم‌گیری شفاف سخت‌تر می‌شود.";
      case "t1_conflict":
        return "این شاخص میزان «مسمومیت تعارض» را نشان می‌دهد (تحقیر، قهر، دفاعی‌بودن، حل‌نشدن دعواها). هرچه بالاتر باشد یعنی الگوی دعوا فرساینده‌تر و خطرناک‌تر است.";
      case "t2_evidence":
        return "این شاخص میزان «شواهد واقعیِ بازگشت» را نشان می‌دهد (اقدام شفاف، پذیرش مسئولیت، تغییر پایدار). هرچه بالاتر باشد احتمال بازگشت واقعی (نه احساسی) بیشتر است.";
      case "t2_ambiguity":
        return "این شاخص میزان «سیگنال‌های مبهم و تعلیق‌آور» را نشان می‌دهد (گرم‌وسرد، نگه‌داشتن تو در دسترس، وعده‌های نامعلوم). هرچه بالاتر باشد احتمال بازی یا ابهام بیشتر است.";
      case "t2_cost":
        return "این شاخص «هزینه روانی انتظار» را نشان می‌دهد (درگیر ذهنی، تعلیق زندگی، ترس از شروع جدید). هرچه بالاتر باشد یعنی انتظار دارد به سلامت روان و مسیر زندگی تو ضربه می‌زند.";
      case "t2_maturity":
        return "این شاخص «بلوغ رابطه‌ای طرف مقابل» را نشان می‌دهد (گفت‌وگوی بالغ، احترام به مرز، ثبات هیجانی). هرچه بالاتر باشد احتمال ساختن یک رابطه سالم‌تر بیشتر است.";
      default:
        return "";
    }
  };

  const headerTitle = "سنجش وضعیت";

  const headerSub = useMemo(() => {
    if (loading) return "در حال دریافت نتیجه…";
    if (err) return "خطا در دریافت نتیجه";
    // ✅ نتایج رایگان است → پیام پرو حذف
    return null;
  }, [loading, err]);

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
          <Text style={[styles.rtl, { color: palette.sub, marginTop: 8, fontSize: 12, lineHeight: 18 }]}>{explain}</Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.bg }]} edges={["top"]}>
      <View style={[styles.header, { backgroundColor: palette.bg, borderBottomColor: palette.border }]}>
        <View style={[styles.headerAccent, { backgroundColor: statusColor }]} />
        <Text style={[styles.headerTitle, { color: statusColor }]}>{headerTitle}</Text>
        {!!headerSub && (
          <Text
            style={[
              styles.headerSub,
              {
                color: palette.sub,
                writingDirection: "rtl" as any,
                textAlign: "center" as any,
                alignSelf: "center",
              },
            ]}
          >
            {headerSub}
          </Text>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: palette.glass, borderColor: palette.border }]}>
          {loading && (
            <View style={{ paddingVertical: 18, alignItems: "center" }}>
              <ActivityIndicator color={palette.gold} />
              <Text style={{ color: palette.sub2, marginTop: 10, fontSize: 12 }}>در حال دریافت…</Text>
            </View>
          )}

          {!!err && !loading && <Text style={[styles.rtl, { color: palette.red }]}>{err}</Text>}

          {!loading && !err && (
            <>
              {/* ---------------- Baseline ---------------- */}
              <View style={[styles.block, { borderColor: palette.border }]}>
                <Text style={[styles.h2, { color: palette.text }]}>سنجش آسیب شکست عاطفی یا جدایی</Text>

                {!baselineSession ? (
                  <>
                    <Text style={[styles.rtl, { color: palette.sub2, marginTop: 8, lineHeight: 20 }]}>هنوز این سنجش انجام نشده.</Text>
                    <View style={{ height: 12 }} />
                    <Pressable
                      style={[
                        styles.btnPrimary,
                        { borderColor: "rgba(212,175,55,.35)", backgroundColor: "rgba(212,175,55,.10)" },
                      ]}
                      onPress={goPelekanBaselineTests}
                    >
                      <Text style={[styles.btnText, { color: palette.text }]}>شروع سنجش</Text>
                    </Pressable>
                  </>
                ) : baselineDone ? (
                  <>
                    <View style={{ marginTop: 12, alignItems: "center" }}>
                      <ScoreRing
                        value={baselineScore ?? 0}
                        max={BASELINE_MAX_SCORE}
                        trackColor={palette.track}
                        progressColor={baselineColor}
                        textColor={palette.text}
                        subColor={palette.sub2}
                        label={baselinePercent != null ? `${baselinePercent}% آسیب` : "نمره کلی"}
                      />
                    </View>

                    <Text style={[styles.rtl, { color: palette.sub, marginTop: 14, fontSize: 12, lineHeight: 18 }]}>
                      {baselineExplain}
                    </Text>
                  </>
                ) : baselineInProgress ? (
                  <>
                    <Text style={[styles.rtl, { color: palette.sub2, marginTop: 8, lineHeight: 20 }]}>سنجش شروع شده ولی کامل نشده.</Text>
                    <View style={{ height: 12 }} />
                    <Pressable
                      style={[
                        styles.btnPrimary,
                        { borderColor: "rgba(212,175,55,.35)", backgroundColor: "rgba(212,175,55,.10)" },
                      ]}
                      onPress={goPelekanBaselineTests}
                    >
                      <Text style={[styles.btnText, { color: palette.text }]}>ادامه سنجش</Text>
                    </Pressable>
                  </>
                ) : null}
              </View>

              <View style={{ height: 12 }} />

              {/* ---------------- Review / Tests ---------------- */}
              <View style={[styles.block, { borderColor: palette.border }]}>
                <Text style={[styles.h2, { color: palette.text }]}>بازسنجی + «آیا برمی‌گرده؟»</Text>

                {!hasReviewSession || !chosenPath ? (
                  <>
                    <Text style={[styles.rtl, { color: palette.sub2, marginTop: 8, lineHeight: 20 }]}>
                      هنوز آزمون‌های بازسنجی شروع نشده‌اند.
                    </Text>
                    <View style={{ height: 12 }} />
                    <Pressable
                      style={[
                        styles.btnPrimary,
                        { borderColor: "rgba(233,138,21,.35)", backgroundColor: "rgba(233,138,21,.10)" },
                      ]}
                      onPress={goPelekanReviewTests}
                    >
                      <Text style={[styles.btnText, { color: palette.text }]}>انجام بازسنجی</Text>
                    </Pressable>
                  </>
                ) : isSkipPath ? (
                  <>
                    <Text style={[styles.rtl, { color: palette.sub2, marginTop: 8, lineHeight: 20 }]}>
                      چون مسیر «فراموش کردن» را انتخاب کردی، اینجا نتیجهٔ بازسنجی را به‌صورت پیش‌فرض نشان نمی‌دهیم.
                      {"\n"}اگر دوست داری می‌توانی آزمون‌های ۱ و ۲ را انجام بدهی.
                    </Text>
                    <View style={{ height: 12 }} />
                    <Pressable
                      style={[
                        styles.btnPrimary,
                        { borderColor: "rgba(233,138,21,.35)", backgroundColor: "rgba(233,138,21,.10)" },
                      ]}
                      onPress={goReviewTestsForceReviewPath}
                    >
                      <Text style={[styles.btnText, { color: palette.text }]}>انجام آزمون‌ها</Text>
                    </Pressable>
                  </>
                ) : reviewInProgress ? (
                  <>
                    <Text style={[styles.rtl, { color: palette.sub2, marginTop: 8, lineHeight: 20 }]}>
                      آزمون‌ها کامل نشده‌اند. برای ادامه، وارد پلکان شو.
                    </Text>
                    <View style={{ height: 12 }} />
                    <Pressable
                      style={[
                        styles.btnPrimary,
                        { borderColor: "rgba(233,138,21,.35)", backgroundColor: "rgba(233,138,21,.10)" },
                      ]}
                      onPress={goPelekanReviewTests}
                    >
                      <Text style={[styles.btnText, { color: palette.text }]}>ادامه آزمون‌ها</Text>
                    </Pressable>
                  </>
                ) : reviewDone ? (
                  <>
                    {/* وضعیت کلی (در یک نگاه) */}
                    <View style={{ height: 10 }} />
                    <View style={[styles.oneLook, { borderColor: palette.border2 }]}>
                      <Text style={[styles.h2, { color: palette.text, textAlign: "center" as any }]}>وضعیت کلی تو (در یک نگاه)</Text>

                      <Text style={[styles.rtl, { color: palette.sub2, marginTop: 8, lineHeight: 20 }]}>
                        {summary?.oneLook || result?.message || "—"}
                      </Text>

                      {!!summary?.nextStep && (
                        <View style={[styles.nextStep, { borderColor: "rgba(212,175,55,.25)" }]}>
                          <Text style={[styles.h3, { color: palette.gold }]}>گام پیشنهادی بعدی</Text>
                          <Text style={[styles.rtl, { color: palette.sub, marginTop: 6, lineHeight: 20 }]}>{summary.nextStep}</Text>
                        </View>
                      )}
                    </View>

                    {(test1Diagrams.length > 0 || test2Diagrams.length > 0) && (
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
                  </>
                ) : (
                  <>
                    <Text style={[styles.rtl, { color: palette.sub2, marginTop: 8, lineHeight: 20 }]}>
                      وضعیت آزمون‌ها نامشخص است. برای همگام‌سازی وارد پلکان شو.
                    </Text>

                    <View style={{ height: 12 }} />

                    <Pressable style={[styles.btnPrimary, { borderColor: palette.border }]} onPress={goPelekan}>
                      <Text style={[styles.btnText, { color: palette.text }]}>رفتن به پلکان</Text>
                    </Pressable>
                  </>
                )}
              </View>

              <View style={{ height: 14 }} />

              <Pressable
                style={[styles.btn, { borderColor: palette.border }]}
                onPress={reviewInProgress ? goPelekanReviewTests : goPelekan}
              >
                <Text style={[styles.btnText, { color: palette.text }]}>رفتن به پلکان</Text>
              </Pressable>

              <View style={{ height: 10 }} />

              {/* ✅ دکمه: تازه‌سازی نتایج */}
              <Pressable
                style={[styles.btnGhost, { borderColor: palette.border, backgroundColor: "rgba(255,255,255,.04)" }]}
                onPress={fetchAll}
                disabled={loading}
              >
                <Text style={[styles.btnText, { color: palette.sub }]}>{loading ? "..." : "تازه‌سازی نتایج"}</Text>
              </Pressable>
            </>
          )}
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
    textAlign: "center" as any,
    writingDirection: "rtl" as any,
  },

  content: { flexGrow: 1, padding: 16, paddingTop: 12 },

  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    overflow: "hidden",
  },

  block: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },

  h2: { fontSize: 14, fontWeight: "900", textAlign: "center" as any, writingDirection: "rtl" as any },
  h3: { fontSize: 12, fontWeight: "900", textAlign: "right" as any, writingDirection: "rtl" as any },

  oneLook: { borderWidth: 1, borderRadius: 16, padding: 12, backgroundColor: "rgba(255,255,255,.02)" },
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