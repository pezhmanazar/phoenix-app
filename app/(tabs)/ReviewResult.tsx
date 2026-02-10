// phoenix-app/app/(tabs)/ReviewResult.tsx
import { useFocusEffect } from "@react-navigation/native"; // ✅ NEW
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
  // ✅ FIX (only change here): force focus="" to land on main zigzag (circles)
  const goPelekan = useCallback(() => {
    if (!phone) return;
    router.replace({
      pathname: "/(tabs)/Pelekan",
      params: { phone, enterTreatment: "1" },
    } as any);
  }, [router, phone]);

  const goPelekanReviewTests = useCallback(() => {
    if (!phone) return;
    router.replace(`/(tabs)/Pelekan?phone=${encodeURIComponent(phone)}&focus=review_tests`);
  }, [router, phone]);

  const goPelekanBaselineTests = useCallback(() => {
    if (!phone) return;
    router.replace(`/(tabs)/Pelekan?phone=${encodeURIComponent(phone)}&focus=baseline_tests`);
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

  // ✅ NEW: وقتی صفحه فوکوس می‌گیرد، خودکار یک sync می‌زنیم (برای حالتی که سرور هنوز وضعیت done را ثبت نکرده)
  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll])
  );

  // ✅ NEW: اگر review هنوز in_progress باشد، چند بار با تاخیر کوتاه retry کن تا نتایج بدون «تازه‌سازی» بیاید
  const retryRef = useRef(0);
  const retryTimerRef = useRef<any>(null);

  useEffect(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    if (loading || err) return;
    if (!phone) return;

    const r = reviewSession;
    const rStatus = String(r?.status || "");
    const chosen = String(r?.chosenPath || "");

    const isDone = rStatus === "completed_locked" || rStatus === "unlocked";
    if (isDone) {
      retryRef.current = 0;
      return;
    }

    // فقط زمانی که مسیر review است و هنوز done نشده (مشکل تو همینجاست)
    if (chosen !== "review") return;

    // اگر هنوز نتیجه نداریم، چند بار تلاش کن (محدود)
    if (retryRef.current >= 6) return;

    retryTimerRef.current = setTimeout(() => {
      retryRef.current += 1;
      fetchAll();
    }, 700);

    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [loading, err, phone, reviewSession?.status, reviewSession?.chosenPath, fetchAll]);

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
      router.push({
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
      return (
        "این شاخص میگه «چقدر خط قرمز جدی» در رابطه وجود داشته؛ چیزهایی که معمولاً با تکرارشون، رابطه ناایمن و آسیب‌زا می‌شد.\n" +
        "مثلا خشونت، اعتیاد، خیانت، تحقیرکردن، عدم جدی بودن در تغییر.\n\n" +
        "🟢 نمره پایین یعنی خط قرمزها داخل رابطه کم یا نادر بودن.\n" +
        "🟡 نمره متوسط یعنی چند مورد جدی وجود داشته.\n" +
        "🔴 نمره بالا یعنی الگوی تکرارشونده‌ی خطرناک وجود داشته و احتمال برگشت آسیب‌ها زیاده."
      );

    case "t1_satisfaction":
      return (
        "این شاخص نشون می‌ده «تجربه‌ی تو از رابطه چقدر خوب بوده»؛ یعنی حس دیده‌شدن، آرامش، صمیمیت، احترام، و امنیت عاطفی.\n" +
        "مثلا وقتی ناراحت بودی به حرفات گوش می‌داد؟ یا موقع ناراحتی کنارت می‌موند؟ یا در کنارش احساس ارزشمندی می‌کردی؟ یا باید مدام ثابت می‌کردی کافی هستی؟\n\n" +
        "🔴 نمره پایین یعنی رابطه بیشتر فرسایشی بوده تا آروم‌کننده.\n" +
        "🟡 نمره متوسط یعنی رابطه، هم لحظات خوب داشته هم فشار و ناراحتی.\n" +
        "🟢 نمره بالا یعنی از نظر تجربه‌ی ذهنی، رابطه برای تو بیشتر «خوب و دلگرم‌کننده» بوده."
      );

    case "t1_attachment":
      return (
        "این شاخص میزان «وابستگی» رو می‌سنجه؛ یعنی رابطه چقدر روی زخم‌های وابستگی فشار آورده مثل اضطرابِ رهاشدگی یا ترس از صمیمیت.\n" +
        "مثلا با یک دیر جواب دادن، آیا ذهنت قفل می‌کرد و دنبال نشونه می‌گشتی؟.\n" +
        "یا وقتی رابطه بیش از حد صمیمی میشد آیا از رابطه سرد می‌شدی یا فرار می‌کردی؟.\n\n" +
        "🟢 نمره پایین یعنی رابطه نسبتاً آروم و بدون قفل‌شدن‌های شدید بوده.\n" +
        "🟡 نمره متوسط یعنی بعض وقت‌ها الگوی وابستگی فعال می‌شده ولی قابل کنترل بوده.\n" +
        "🔴 نمره بالا یعنی رابطه شدیداً سیستم عصبی تو رو فعال می‌کرده و تصمیم‌گیری شفاف رو برات سخت می‌کرده."
      );

    case "t1_conflict":
      return (
        "این شاخص کیفیت «اختلاف و تعارض» رو می‌سنجه یعنی آیا اختلاف‌ها قابل حل بوده یا تبدیل به یک چرخه‌ی فرساینده می‌شده.\n" +
        "مثلا در تعارضِ ناسالم تحقیر، قهرهای طولانی، حالت دفاعی‌بودن، سرزنش، تهدید، برچسب‌زدن و دعواهایی که هیچ‌وقت حل نمی‌شد دیده می‌شد.\n\n" +
        "🟢 نمره پایین یعنی اختلاف‌ها معمولاً با گفت‌وگو حل می‌شده.\n" +
        "🟡 نمره متوسط یعنی دعواها گاهی سنگین بوده ولی هنوز قابل مدیریت بوده.\n" +
        "🔴 نمره بالا یعنی الگوی دعوا «مسموم و تکرارشونده» بوده و احتمال آسیب دوباره بشدت بالاست."
      );

    case "t2_evidence":
      return (
        "این شاخص میگه «چقدر شواهد واقعی برای برگشت وجود داره»؛ یعنی نشونه‌هایی که از جنس عمل هستند نه حرف.\n" +
        "مثلا پذیرش مسئولیت اشتباهات، عذرخواهی بالغانه، اقدام عملی برای تغییر، ثبات رفتاری در زمان، احترام به مرزها و قطع رابطه‌های موازی.\n\n" +
        "🔴 نمره پایین یعنی بیشتر وعده احساسی داده و شواهد عملی کمه  یا اینکه اصلا تمایلی به برگشت نداره و رابطه رو از سمت خودش تموم شده می‌بینه.\n" +
        "🟡 نمره متوسط یعنی بعضی رفتارهای خوب رو داره ولی هنوز کافی و پایدار نیست.\n" +
        "🟢 نمره بالا یعنی نشونه‌های عملی به شکل جدی دیده می‌شه و احتمال برگشتن واقعی وجود داره."
      );

    case "t2_ambiguity":
      return (
        "این شاخص «ابهام و تعلیق» رو می‌سنجه یعنی چقدر طرف مقابل با گرم‌وسرد کردن رابطه، تو رو در حالت انتظار نگه داشته.\n" +
        "مثلا یک روز خیلی نزدیک میشه، چند روز ناپدید میشه یا پیام‌های مبهم مثل «نمی‌دونم»، «فعلاً صبر کن»، «بعداً حرف می‌زنیم» بهت میده، یا تو رو در دسترس نگه می‌داره ولی بدون تصمیم مشخص.\n\n" +
        "🟢 نمره پایین یعنی رفتارها نسبتاً روشن و قابل پیش‌بینی هستند.\n" +
        "🟡 نمره متوسط یعنی کمی ابهام وجود داره ولی هنوز ممکنه قابل مدیریت باشه.\n" +
        "🔴 نمره بالا یعنی احتمال بازی دادن یا تعلیق  روانی زیاد بالاست و این حالت معمولاً بیشترین فرسایش روانی رو ایجاد می‌کنه."
      );

    case "t2_cost":
      return (
        "این شاخص «هزینه‌ی روانی انتظار» رو نشون می‌ده؛ یعنی منتظر موندن چقدر به ذهن، خواب، تمرکز و زندگی تو ضربه می‌زنه.\n" +
        "مثلا چک کردن مداوم گوشی، نشخوار فکری، بی‌خوابی، افت کارکرد، عقب افتادن زندگی، ترس از شروع دوباره.\n\n" +
        "🟢 نمره پایین یعنی حتی اگه منتظر باشی، زندگیت خیلی از ریتم نمی‌افته.\n" +
        "🟡 نمره متوسط یعنی انتظار برای تو انرژی‌بره و داره کندت می‌کنه.\n" +
        "🔴 نمره بالا یعنی انتظار زندگیت رو کامل معلق کرده و بهتره سریع وارد مسیر درمان و رهایی بشی."
      );

    case "t2_maturity":
      return (
        "این شاخص «بلوغ عاطفی طرف مقابل» رو می‌سنجه یعنی توانایی گفت‌وگوی بالغانه، ثبات هیجانی، احترام به مرزها و مسئولیت‌پذیری.\n" +
        "مثلا کسی که بلوغ بالا داره یعنی گفتگوهای روشن انجام میده، سهم خودش از رابطه رو می‌پذیره، بازی روانی انجام نمیده، رفتارهای آسیب‌زا نداره و برای تغییر مثبت تلاش می‌کنه.\n" +
        "و کسی که بلوغ پایین داره یعنی از گفتگو فرار می‌کنه، در نقش قربانی خودش رو قرار میده، رفتارهای اشتباهش رو توجیه می‌کنه، تهدید می‌کنه، کنترل می‌کنه و ناپایداری شدید داره.\n\n" +
        "🔴 نمره پایین یعنی ساختن رابطه سالم با این آدم سخته چون ظرفیت لازم رو نداره.\n" +
        "🟡 نمره متوسط یعنی بعضی ظرفیت‌ها در درونش هست اما هنوز ناپایدار و نیمه کاره هستن.\n" +
        "🟢 نمره بالا یعنی شانس ساختن رابطه سالم‌ با این آدم بالاست البته اگه در عمل هم رفتارهاش پایدار بمونه."
      );

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
                    
                        {/* ✅ NEW: دکمه رفتن به پلکان قبل از جزئیات تحلیلی */}
                     <View style={{ height: 12 }} />
                    <Pressable
                    style={[styles.btn, { borderColor: palette.border }]}
                     onPress={reviewInProgress ? goPelekanReviewTests : goPelekan}
                       >
                   <Text style={[styles.btnText, { color: palette.text }]}>رفتن به پلکان درمــــان</Text>
                    </Pressable>

                    <View style={{ height: 12 }} />

                    <View
                    style={{
                    height: 1,
                    alignSelf: "stretch",
                    backgroundColor: palette.border2,
                    opacity: 0.7,
                    marginTop: 14,
                   marginBottom: 10,
                    }}
                   />

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
                      وضعیت آزمون‌ها نامشخصه. برای همگام‌سازی وارد پلکان شو.
                    </Text>

                    <View style={{ height: 12 }} />

                    <Pressable style={[styles.btnPrimary, { borderColor: palette.border }]} onPress={goPelekan}>
                      <Text style={[styles.btnText, { color: palette.text }]}>رفتن به پلکان درمــــان</Text>
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