// phoenix-app/components/pelekan/Review.tsx
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type Props = {
  me: any;
  state: any;
  onRefresh: () => void;
};

type ReviewOption = { value: number; labelFa: string };

// ✅ NEW: UI hint coming from backend
type ReviewQuestionUI = {
  layout?: "row2" | "grid2x2" | "grid3x2_last2" | "grid3x2" | "stack" | string;
  columns?: number;
  rows?: number;
};

type ReviewQuestion = {
  index: number;
  key?: string | null;
  textFa: string;
  helpFa?: string | null;
  options: ReviewOption[];
  ui?: ReviewQuestionUI; // ✅ NEW
};

type QuestionSetResponse = {
  ok: boolean;
  error?: string;
  data?: {
    questionSet: { id: string; code: string; version: number; titleFa?: string | null };
    tests: { test1: ReviewQuestion[]; test2: ReviewQuestion[] };
  };
};

type SessStatus = "in_progress" | "completed_locked" | "unlocked"; // completed_locked فقط برای backward-compat

type ReviewStateResponse = {
  ok: boolean;
  error?: string;
  data?: {
    hasSession: boolean;
    canEnterPelekan?: boolean;
    paywallRequired?: boolean;
    session: {
      id: string;
      status: SessStatus;
      chosenPath: "skip_review" | "review" | null;
      currentTest: number;
      currentIndex: number;
      test1CompletedAt?: string | null;
      test2CompletedAt?: string | null;
      test2SkippedAt?: string | null;
      paywallShownAt?: string | null;
      unlockedAt?: string | null;
      questionSetId?: string | null;
    } | null;
    user: { plan: string; isPro: boolean };
  };
};

type ResultResponse = {
  ok: boolean;
  error?: string;
  data?: {
    status: SessStatus;
    canEnterPelekan?: boolean;
    result: any | null;
  };
};

const API_BASE = "https://qoqnoos.app/api/pelekan/review";

// ✅ NEW: timing helper (برای لاگ‌های پرفورمنس)
const now = () => ((global as any)?.performance?.now ? performance.now() : Date.now());

export default function Review({ me, state, onRefresh }: Props) {
  const router = useRouter();
  const phone = String(me?.phone || "").trim();

  const [loading, setLoading] = useState(false);
  const [qsLoading, setQsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reviewState, setReviewState] = useState<ReviewStateResponse["data"] | null>(null);
  const [questionSetId, setQuestionSetId] = useState<string | null>(null);
  const [test1, setTest1] = useState<ReviewQuestion[]>([]);
  const [test2, setTest2] = useState<ReviewQuestion[]>([]);

  const bootRef = useRef<{ phone: string | null; done: boolean }>({ phone: null, done: false });
  const startLockRef = useRef(false);
  const mountedRef = useRef(true);
  const submitLockRef = useRef(false);
  const bootingRef = useRef(false);
  const bootSeqRef = useRef(0);

  // ✅ NEW: ضد-ریدایرکت چندباره (برای جلوگیری از باگ‌های "برگشت به شروع")
  const redirectedRef = useRef(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMsg, setConfirmMsg] = useState("");
  const confirmActionRef = useRef<null | (() => Promise<void> | void)>(null);

  const [resultOpen, setResultOpen] = useState(false);
  const [resultLoading, setResultLoading] = useState(false);
  const [resultError, setResultError] = useState<string | null>(null);
  const [resultData, setResultData] = useState<any | null>(null);

  const [selectedValue, setSelectedValue] = useState<number | null>(null);

  const fade = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(10)).current;

  const openConfirm = useCallback((t: string, m: string, action: () => Promise<void> | void) => {
    confirmActionRef.current = action;
    setConfirmTitle(t);
    setConfirmMsg(m);
    setConfirmOpen(true);
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmOpen(false);
    confirmActionRef.current = null;
  }, []);

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

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchReviewState = useCallback(async () => {
    if (!phone) return null;

    const t0 = now();
    console.log("🟦 [Review] fetchReviewState:start", { t0 });

    const res = await fetch(`${API_BASE}/state?phone=${encodeURIComponent(phone)}`, {
      headers: { "Cache-Control": "no-store" },
    });

    console.log("🟩 [Review] fetchReviewState:after_fetch", {
      dt: now() - t0,
      http: res.status,
    });

    const json: ReviewStateResponse = await res.json().catch(() => ({ ok: false } as any));

    console.log("🟩 [Review] fetchReviewState:after_json", {
      dt: now() - t0,
      ok: json?.ok,
      err: json?.error,
      status: json?.data?.session?.status,
      test: json?.data?.session?.currentTest,
      idx: json?.data?.session?.currentIndex,
    });

    if (!json?.ok) throw new Error(json?.error || "STATE_FAILED");

    if (mountedRef.current) setReviewState(json.data || null);
    return json.data || null;
  }, [phone]);

  const fetchQuestionSet = useCallback(async () => {
    const res = await fetch(`${API_BASE}/question-set`, {
      headers: { "Cache-Control": "no-store" },
    });

    const json: QuestionSetResponse = await res.json().catch(() => ({ ok: false } as any));

    if (!json?.ok || !json?.data?.tests || !json?.data?.questionSet?.id) {
      throw new Error(json?.error || "QS_FAILED");
    }

    if (!mountedRef.current) return null;

    setQuestionSetId(json.data.questionSet.id);
    setTest1(Array.isArray(json.data.tests.test1) ? json.data.tests.test1 : []);
    setTest2(Array.isArray(json.data.tests.test2) ? json.data.tests.test2 : []);

    return json.data.questionSet.id;
  }, []);

  const fetchResult = useCallback(async () => {
    if (!phone) return null;

    setResultLoading(true);
    setResultError(null);

    try {
      const res = await fetch(`${API_BASE}/result?phone=${encodeURIComponent(phone)}`, {
        headers: { "Cache-Control": "no-store" },
      });

      const json: ResultResponse = await res.json().catch(() => ({ ok: false } as any));
      if (!json?.ok) throw new Error(json?.error || "RESULT_FAILED");

      const r = json?.data?.result ?? null;
      if (mountedRef.current) setResultData(r);

      return r;
    } catch (e: any) {
      if (mountedRef.current) setResultError(String(e?.message || "RESULT_FAILED"));
      return null;
    } finally {
      if (mountedRef.current) setResultLoading(false);
    }
  }, [phone]);

  // ✅ FIX (1): ناوبری نتیجه بدون query-string (رفع TS2872 و گیرهای محیطی)
  const goToResultPage = useCallback(() => {
    if (!phone) return;

    router.push({
      pathname: "/(tabs)/ReviewResult",
      params: { phone },
    } as any);
  }, [router, phone]);

  // ✅ NEW LOGIC: هر وقت از in_progress خارج شد، برو نتیجه (دیگه paywall نداریم)
  const openResultScreen = useCallback(async () => {
    const st = await fetchReviewState();
    onRefresh?.();

    const sessStatus = String(st?.session?.status || "");
    if (sessStatus && sessStatus !== "in_progress") {
      goToResultPage();
    }
  }, [fetchReviewState, onRefresh, goToResultPage]);

  // ✅ NEW LOGIC: اگر از in_progress خارج شد، مستقیم ریدایرکت کن
  // 🔧 PERF FIX: onRefresh رو از اینجا حذف کردیم تا بعد هر سوال PelekanTab بی‌خودی fetch نکند
  const syncAndMaybeGoResult = useCallback(
  async () => {
    const st = await fetchReviewState();

    const sessStatus = String(st?.session?.status || "");
    if (sessStatus && sessStatus !== "in_progress") {
      goToResultPage();
      return true;
    }
    return false;
  },
  [fetchReviewState, goToResultPage]
);

  const ensureStarted = useCallback(
    async (stData: ReviewStateResponse["data"] | null) => {
      if (!phone) return;

      const st = stData?.session;
      if (st?.questionSetId) return;

      if (startLockRef.current) return;
      startLockRef.current = true;

      try {
        const r = await fetch(`${API_BASE}/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone }),
        })
          .then((x) => x.json())
          .catch(() => null);

        console.log("[Review] start response", r);

        await fetchReviewState();
        onRefresh?.();
      } finally {
        startLockRef.current = false;
      }
    },
    [phone, fetchReviewState, onRefresh]
  );

  const bootstrap = useCallback(async () => {
  if (!phone) return;

  // ✅ single-flight: دوبار همزمان اجرا نشه
  if (bootingRef.current) return;
  bootingRef.current = true;

  // ✅ seq: اگر بوت جدید شروع شد، نتایج بوت قبلی اعمال نشه
  const seq = ++bootSeqRef.current;

  setError(null);
  setQsLoading(true);

  try {
    console.log("[Review] bootstrap begin", { phone, seq });

    // ✅ اول سوال‌ها (تا از qsLoading سریع خارج بشیم)
    const qsid = await fetchQuestionSet();
    console.log("[Review] question-set loaded", { qsid, seq });

    // ✅ بعد state
    const st = await fetchReviewState();
    console.log("[Review] state", st);

    // ✅ اگر session questionSetId ندارد، start کن
    await ensureStarted(st);

    // ✅ بعد از start یکبار دوباره state بگیر تا questionSetId قطعاً sync شود
    await fetchReviewState();

    console.log("[Review] ensureStarted done");
  } catch (e: any) {
    console.log("[Review] bootstrap error", e?.message || e);
    if (mountedRef.current && bootSeqRef.current === seq) {
      setError(String(e?.message || "UNKNOWN_ERROR"));
    }
  } finally {
    if (mountedRef.current && bootSeqRef.current === seq) {
      setQsLoading(false);
    }
    bootingRef.current = false;
  }
}, [phone, fetchQuestionSet, fetchReviewState, ensureStarted]);

  useEffect(() => {
    if (bootRef.current.phone !== phone) {
      bootRef.current.phone = phone;
      bootRef.current.done = false;
      startLockRef.current = false;
      submitLockRef.current = false;

      // ✅ ریست ضد-ریدایرکت
      redirectedRef.current = false;

      setResultOpen(false);
      setResultData(null);
      setResultError(null);
      setResultLoading(false);

      setSelectedValue(null);
    }

    if (!phone) return;
    if (bootRef.current.done) return;

    (async () => {
      await bootstrap();
      if (!mountedRef.current) return;
      bootRef.current.done = true;
    })();
  }, [phone, bootstrap]);

  const session = reviewState?.session || null;
  const currentTest = session?.currentTest ?? 1;
  const currentIndex = session?.currentIndex ?? 0;

  const questions = currentTest === 1 ? test1 : test2;
  const currentQuestion = questions[currentIndex] || null;

  const sessStatus = String(session?.status || "");
  const showUnlocked = sessStatus === "unlocked" || sessStatus === "completed_locked"; // completed_locked => treat as unlocked (compat)

  // ✅ وقتی از in_progress خارج شد، سوال نده و برو نتیجه (فقط یک‌بار)
  useEffect(() => {
    if (!session) return;
    if (redirectedRef.current) return;

    if (sessStatus && sessStatus !== "in_progress") {
      redirectedRef.current = true;
      goToResultPage();
    }
  }, [session, sessStatus, goToResultPage]);

  useEffect(() => {
    setSelectedValue(null);
    fade.setValue(0);
    slideY.setValue(10);

    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(slideY, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTest, currentIndex]);

  const title = useMemo(() => {
    if (currentTest === 1) return "آزمون بازسنجی";
    return "آزمون «آیا برمی‌گرده؟»";
  }, [currentTest]);

  const titleColor = useMemo(() => {
    return currentTest === 1 ? palette.gold : palette.orange;
  }, [currentTest, palette.gold, palette.orange]);

  const accentColor = useMemo(() => {
    const t = reviewState?.session?.currentTest ?? 1;
    return t === 1 ? palette.gold : palette.orange;
  }, [reviewState?.session?.currentTest, palette.gold, palette.orange]);

  const isEndOfTest = useMemo(() => {
    if (!session) return false;
    if (!questions?.length) return false;
    return (session.currentIndex ?? 0) >= questions.length;
  }, [session, questions]);

  // ✅ PERF FIX: UI رو بعد از جواب، لوکال جلو می‌بریم تا برای سوال بعد منتظر GET /state نمانیم
  const optimisticAdvance = useCallback((idx: number) => {
    setReviewState((prev) => {
      if (!prev?.session) return prev;
      return {
        ...prev,
        session: {
          ...prev.session,
          currentIndex: idx + 1,
        },
      };
    });
  }, []);

  const InlineLoading = useCallback(
    ({ label }: { label: string }) => (
      <View style={styles.inlineLoading}>
        <ActivityIndicator color={palette.gold} size="small" />
        <Text style={[styles.inlineLoadingText, { color: palette.sub }]}>{label}</Text>
      </View>
    ),
    [palette.gold, palette.sub]
  );

  const submitAnswer = useCallback(
    async (value: number) => {
      if (!phone || !session) return;

      // ✅ اگر از in_progress خارج شده، اجازه نده
      if (session?.status !== "in_progress") {
        await openResultScreen();
        return;
      }

      if (submitLockRef.current) return;
      submitLockRef.current = true;

      const idx = session.currentIndex ?? 0;

      const t0 = now();
      console.log("🟦 [Review] NEXT tap", { testNo: currentTest, idx, t0 });

      setLoading(true);
      try {
        console.log("🟨 [Review] before POST /answer", { dt: now() - t0 });

        const res = await fetch(`${API_BASE}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, testNo: currentTest, index: idx, value }),
        });

        console.log("🟩 [Review] after fetch() /answer", {
          dt: now() - t0,
          http: res.status,
        });

        const json = await res.json().catch(() => null);

        console.log("🟩 [Review] after json() /answer", {
          dt: now() - t0,
          ok: json?.ok,
          error: json?.error,
        });

        if (!json?.ok) {
          setError(json?.error || "SERVER_ERROR");
          return;
        }

        // ✅ فوراً برو سوال بعدی (بدون sync شبکه)
        optimisticAdvance(idx);

        // ✅ SAFETY: هر ۵ سوال یک بار sync کن + آخر تست حتماً sync
        const nextIdx = idx + 1;
        const len = questions?.length || 0;
        const isLast = nextIdx >= len;
        const shouldPeriodicSync = nextIdx % 5 === 0;

        if (isLast || shouldPeriodicSync) {
          console.log("🟨 [Review] before syncAndMaybeGoResult", {
            dt: now() - t0,
            reason: isLast ? "last" : "periodic",
            nextIdx,
          });

          const finished = await syncAndMaybeGoResult();

          console.log("🟩 [Review] after syncAndMaybeGoResult", {
            dt: now() - t0,
            finished,
          });

          requestAnimationFrame(() => {
            console.log("🟪 [Review] raf after sync", { dt: now() - t0 });
          });

          if (finished) return;
        } else {
          requestAnimationFrame(() => {
            console.log("🟪 [Review] raf after optimistic advance", { dt: now() - t0 });
          });
        }
      } catch (e: any) {
        console.log("🟥 [Review] submitAnswer error", String(e?.message || e));
        setError(e?.message || "SERVER_ERROR");
      } finally {
        console.log("⬛ [Review] submitAnswer finally", { dt: now() - t0 });
        setLoading(false);
        submitLockRef.current = false;
      }
    },
    [
      phone,
      session,
      currentTest,
      openResultScreen,
      syncAndMaybeGoResult,
      optimisticAdvance,
      questions?.length,
    ]
  );

  const goToTest2 = useCallback(async () => {
    if (!phone) return;

    if (session?.status !== "in_progress") {
      await openResultScreen();
      return;
    }

    if (submitLockRef.current) return;
    submitLockRef.current = true;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/complete-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, testNo: 1 }),
      });

      const json = await res.json().catch(() => null);
      if (!json?.ok) {
        setError(json?.error || "SERVER_ERROR");
        return;
      }

      await fetchReviewState();
      onRefresh?.();
    } finally {
      setLoading(false);
      submitLockRef.current = false;
    }
  }, [phone, session?.status, fetchReviewState, onRefresh, openResultScreen]);

  // ✅ FIX: حذف finish اضافه (skip-test2 خودش نتیجه را می‌سازد/وضعیت را تغییر می‌دهد)
  const passTest2FromEndOfTest1 = useCallback(async () => {
    if (!phone) return;

    if (session?.status !== "in_progress") {
      await openResultScreen();
      return;
    }

    if (submitLockRef.current) return;
    submitLockRef.current = true;

    setLoading(true);
    try {
      const c1 = await fetch(`${API_BASE}/complete-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, testNo: 1 }),
      }).then((r) => r.json());

      if (!c1?.ok) {
        setError(c1?.error || "SERVER_ERROR");
        return;
      }

      const s2 = await fetch(`${API_BASE}/skip-test2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      }).then((r) => r.json());

      if (!s2?.ok) {
        setError(s2?.error || "SERVER_ERROR");
        return;
      }

      // ✅ فقط sync
      await syncAndMaybeGoResult();
    } finally {
      setLoading(false);
      submitLockRef.current = false;
    }
  }, [phone, session?.status, syncAndMaybeGoResult, openResultScreen]);

  const finishAfterTest2 = useCallback(async () => {
    if (!phone) return;

    if (session?.status !== "in_progress") {
      await openResultScreen();
      return;
    }

    if (submitLockRef.current) return;
    submitLockRef.current = true;

    setLoading(true);
    try {
      const c = await fetch(`${API_BASE}/complete-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, testNo: 2 }),
      }).then((r) => r.json());

      if (!c?.ok) {
        setError(c?.error || "SERVER_ERROR");
        return;
      }

      const f = await fetch(`${API_BASE}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      }).then((r) => r.json());

      if (!f?.ok) {
        setError(f?.error || "SERVER_ERROR");
        return;
      }

      // ✅ فقط sync
      await syncAndMaybeGoResult();
    } finally {
      setLoading(false);
      submitLockRef.current = false;
    }
  }, [phone, session?.status, syncAndMaybeGoResult, openResultScreen]);

  // ✅ FIX: حذف finish اضافه
  const passTest2 = useCallback(async () => {
    if (!phone) return;

    if (session?.status !== "in_progress") {
      await openResultScreen();
      return;
    }

    if (submitLockRef.current) return;
    submitLockRef.current = true;

    setLoading(true);
    try {
      const s2 = await fetch(`${API_BASE}/skip-test2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      }).then((r) => r.json());

      if (!s2?.ok) {
        setError(s2?.error || "SERVER_ERROR");
        return;
      }

      // ✅ فقط sync
      await syncAndMaybeGoResult();
    } finally {
      setLoading(false);
      submitLockRef.current = false;
    }
  }, [phone, session?.status, syncAndMaybeGoResult, openResultScreen]);

  const manualReload = useCallback(() => {
    bootRef.current.done = false;
    startLockRef.current = false;
    submitLockRef.current = false;

    // ✅ ریست ضد-ریدایرکت
    redirectedRef.current = false;

    bootstrap();
  }, [bootstrap]);

  const ConfirmGlass = useMemo(() => {
    if (!confirmOpen) return null;

    return (
      <View style={styles.confirmOverlay}>
        <View style={[styles.confirmCard, { backgroundColor: palette.glass, borderColor: palette.border }]}>
          <Text style={[styles.rtlText, { color: palette.text, fontWeight: "900", fontSize: 16, textAlign: "center" }]}>
            {confirmTitle}
          </Text>
          <Text style={[styles.rtlText, { color: palette.sub, marginTop: 10, lineHeight: 22, fontSize: 12, textAlign: "right" }]}>
            {confirmMsg}
          </Text>

          <View style={{ height: 14 }} />

          <Pressable
            disabled={loading}
            style={[
              styles.btnPrimary,
              { borderColor: "rgba(212,175,55,.35)", backgroundColor: "rgba(212,175,55,.10)" },
            ]}
            onPress={async () => {
              const fn = confirmActionRef.current;
              closeConfirm();
              if (fn) await fn();
            }}
          >
            {loading ? (
              <InlineLoading label="در حال ثبت…" />
            ) : (
              <Text style={[styles.btnText, { color: palette.text }]}>بله، ادامه</Text>
            )}
          </Pressable>

          <View style={{ height: 10 }} />

          <Pressable
            disabled={loading}
            style={[
              styles.btnGhost,
              { borderColor: palette.border, backgroundColor: "rgba(255,255,255,.04)" },
            ]}
            onPress={closeConfirm}
          >
            {loading ? (
              <InlineLoading label="در حال پردازش…" />
            ) : (
              <Text style={[styles.btnText, { color: palette.sub }]}>نه</Text>
            )}
          </Pressable>
        </View>
      </View>
    );
  }, [confirmOpen, confirmTitle, confirmMsg, palette, loading, closeConfirm, InlineLoading]);

  const ResultScreen = useMemo(() => {
    if (!resultOpen) return null;

    // ✅ paywall removed: locked is always false (even if old backend returns it, we ignore in UI)
    const locked = false;
    const didSkipTest2 = !!resultData?.meta?.didSkipTest2;

    const resultTitle = didSkipTest2 ? "نتیجه آزمون بازسنجی" : "نتیجه دو آزمون";
    const msg = String(resultData?.message || "نتیجه آماده است.");

    return (
      <View style={[styles.container, { backgroundColor: palette.bg, justifyContent: "center" }]}>
        <View style={[styles.card, styles.cardFancy, { backgroundColor: palette.glass, borderColor: palette.border }]}>
          <View style={[styles.accentBarTop, { backgroundColor: locked ? palette.red : palette.lime }]} />

          <Text style={[styles.title, { color: locked ? palette.red : palette.lime, textAlign: "center" }]}>
            {resultTitle}
          </Text>

          <Text style={[styles.rtlText, { color: palette.sub, marginTop: 10, lineHeight: 22, textAlign: "right" }]}>
            {msg}
          </Text>

          {!!resultError && (
            <Text style={[styles.rtlText, { color: palette.red, marginTop: 10, fontSize: 12, textAlign: "right" }]}>
              {resultError}
            </Text>
          )}

          <View style={{ height: 16 }} />

          {resultLoading ? (
            <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 10 }}>
              <ActivityIndicator color={palette.gold} />
              <Text style={{ color: palette.sub, marginTop: 10, fontSize: 12 }}>در حال دریافت نتیجه…</Text>
            </View>
          ) : (
            <>
              <Pressable
                style={[styles.btn, { borderColor: palette.border }]}
                onPress={async () => {
                  setResultOpen(false);

                  // ✅ FIX (2): رفتن به پلکان زیگزاگ (دایره‌ها) => focus را صراحتاً خالی کن
                  router.replace(
                    {
                      pathname: "/(tabs)/Pelekan",
                      params: { phone, focus: "" },
                    } as any
                  );

                  setTimeout(() => onRefresh?.(), 50);
                }}
              >
                <Text style={[styles.btnText, { color: palette.text }]}>رفتن به پلکان درمان</Text>
              </Pressable>

              <View style={{ height: 10 }} />

              <Pressable
                style={[styles.btnGhost, { borderColor: palette.border, backgroundColor: "rgba(255,255,255,.04)" }]}
                onPress={() => setResultOpen(false)}
              >
                <Text style={[styles.btnText, { color: palette.sub }]}>بازگشت</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    );
  }, [resultOpen, resultData, resultLoading, resultError, palette, router, onRefresh, phone]);

  // ✅ NEW: option renderer with layouts
  const OptionsBlock = useMemo(() => {
    if (!currentQuestion) return null;

    const opts = currentQuestion.options || [];
    const rawLayout = String(currentQuestion.ui?.layout || "").trim();
    const layout =
      rawLayout ||
      (opts.length === 4 ? "grid2x2" : opts.length === 5 ? "grid3x2_last2" : "stack");

    const renderBtn = (op: ReviewOption) => {
      const isSelected = selectedValue === op.value;
      return (
        <Pressable
          key={`${currentQuestion.index}-${op.value}`}
          disabled={loading}
          onPress={() => setSelectedValue(op.value)}
          style={({ pressed }) => [
            styles.option,
            {
              borderColor: isSelected ? accentColor : palette.border,
              backgroundColor: isSelected ? "rgba(255,255,255,.06)" : "transparent",
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.995 : 1 }],
            },
          ]}
        >
          <Text style={[styles.centerText, styles.rtlText, { color: palette.text, fontSize: 14 }]}>{op.labelFa}</Text>
        </Pressable>
      );
    };

    // ✅ 2 گزینه کنار هم
    if (layout === "row2" && opts.length === 2) {
      return (
        <View style={styles.row2}>
          <View style={styles.rowItem}>{renderBtn(opts[0])}</View>
          <View style={styles.rowItem}>{renderBtn(opts[1])}</View>
        </View>
      );
    }

    // ✅ 4 گزینه: 2 بالا + 2 پایین
    if (layout === "grid2x2" && opts.length === 4) {
      return (
        <View>
          <View style={styles.gridRow}>
            <View style={styles.gridCol}>{renderBtn(opts[0])}</View>
            <View style={styles.gridCol}>{renderBtn(opts[1])}</View>
          </View>
          <View style={styles.gridRow}>
            <View style={styles.gridCol}>{renderBtn(opts[2])}</View>
            <View style={styles.gridCol}>{renderBtn(opts[3])}</View>
          </View>
        </View>
      );
    }

    // ✅ 5 گزینه: 3 بالا + 2 پایین
    if (layout === "grid3x2_last2" && opts.length === 5) {
      return (
        <View>
          <View style={styles.gridRow}>
            <View style={styles.gridCol}>{renderBtn(opts[0])}</View>
            <View style={styles.gridCol}>{renderBtn(opts[1])}</View>
            <View style={styles.gridCol}>{renderBtn(opts[2])}</View>
          </View>

          {/* ✅ ردیف دوم: دو آیتم وسط‌چین با عرض 1.5 ستون */}
          <View style={[styles.gridRow, styles.centerRow]}>
            <View style={styles.gridColWide}>{renderBtn(opts[3])}</View>
            <View style={styles.gridColWide}>{renderBtn(opts[4])}</View>
          </View>
        </View>
      );
    }

    // ✅ 6 گزینه: 3 بالا + 3 پایین
    if (layout === "grid3x2" && opts.length === 6) {
      return (
        <View>
          <View style={styles.gridRow}>
            <View style={styles.gridCol}>{renderBtn(opts[0])}</View>
            <View style={styles.gridCol}>{renderBtn(opts[1])}</View>
            <View style={styles.gridCol}>{renderBtn(opts[2])}</View>
          </View>
          <View style={styles.gridRow}>
            <View style={styles.gridCol}>{renderBtn(opts[3])}</View>
            <View style={styles.gridCol}>{renderBtn(opts[4])}</View>
            <View style={styles.gridCol}>{renderBtn(opts[5])}</View>
          </View>
        </View>
      );
    }

    // ✅ fallback: همان عمودی قبلی
    return <View>{opts.map(renderBtn)}</View>;
  }, [currentQuestion, selectedValue, loading, accentColor, palette.border, palette.text]);

  if (!phone) {
    return (
      <View style={[styles.root, { backgroundColor: palette.bg }]}>
        <Text style={{ color: palette.sub }}>شماره کاربر پیدا نشد.</Text>
      </View>
    );
  }

  if (qsLoading) {
    return (
      <View style={[styles.root, { backgroundColor: palette.bg }]}>
        <ActivityIndicator color={palette.gold} />
        <Text style={{ color: palette.sub, marginTop: 10, fontSize: 12 }}>در حال دریافت سوال‌ها…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.root, { backgroundColor: palette.bg, paddingHorizontal: 18 }]}>
        <Text style={{ color: palette.red, fontWeight: "900", marginBottom: 8, textAlign: "center" }}>خطا</Text>
        <Text style={[styles.rtlText, { color: palette.sub, fontSize: 12, lineHeight: 18, textAlign: "right" }]}>
          {error}
        </Text>

        <View style={{ height: 14 }} />

        <Pressable style={[styles.btn, { borderColor: palette.border }]} onPress={manualReload}>
          <Text style={[styles.btnText, { color: palette.text }]}>تلاش مجدد</Text>
        </Pressable>
      </View>
    );
  }

  // ✅ اگر نتیجه باز است
  if (resultOpen) {
    return <View style={{ flex: 1, backgroundColor: palette.bg }}>{ResultScreen}</View>;
  }

  // ✅ اگر unlocked است (یا حالت قدیمی completed_locked)، نتیجه را نشان بده
  if (session && showUnlocked) {
    return (
      <View style={[styles.container, { backgroundColor: palette.bg, justifyContent: "center" }]}>
        <View style={[styles.card, styles.cardFancy, { backgroundColor: palette.glass, borderColor: palette.border }]}>
          <View style={[styles.accentBarTop, { backgroundColor: palette.lime }]} />

          <Text style={[styles.title, { color: palette.lime, textAlign: "center" }]}>نتیجه آماده است</Text>

          <Text style={[styles.rtlText, { color: palette.sub, marginTop: 10, lineHeight: 22, textAlign: "right" }]}>
            آزمون‌ها کامل شده‌اند و نتیجه قابل مشاهده است.
          </Text>

          <View style={{ height: 14 }} />

          <Pressable style={[styles.btnPrimary, { borderColor: palette.border }]} onPress={goToResultPage}>
            <Text style={[styles.btnText, { color: palette.text }]}>رفتن به نتیجه</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // پایان آزمون 1
  if (session && currentTest === 1 && isEndOfTest) {
    return (
      <View style={[styles.container, { backgroundColor: palette.bg, justifyContent: "center" }]}>
        <View style={[styles.card, styles.cardFancy, { backgroundColor: palette.glass, borderColor: palette.border }]}>
          <View style={[styles.accentBarTop, { backgroundColor: palette.gold }]} />

          <Text style={[styles.title, { color: palette.gold, textAlign: "center" }]}>پایان آزمون بازسنجی</Text>

          <Text style={[styles.rtlText, { color: palette.sub, marginTop: 10, lineHeight: 22, textAlign: "right" }]}>
            آزمون بازسنجی به پایان رسید و پاسخ‌های تو ثبت شد.
            {"\n"}
            اگر «ادامه» رو بزنی، وارد آزمون دوم یعنی آزمون («آیا برمی‌گرده؟») میشی و در پایان، نتیجه‌ی کامل هر دو نمایش داده میشه.
          </Text>

          <View style={{ height: 14 }} />

          <Pressable style={[styles.btnPrimary, { borderColor: palette.border }]} onPress={goToTest2} disabled={loading}>
            {loading ? (
              <InlineLoading label="در حال انتقال به آزمون دوم…" />
            ) : (
              <Text style={[styles.btnText, { color: palette.text }]}>ادامه: رفتن به آزمون دوم</Text>
            )}
          </Pressable>

          <View style={{ height: 10 }} />

          <Pressable
            style={[styles.btnGhost, { borderColor: "rgba(239,68,68,.45)" }]}
            disabled={loading}
            onPress={() =>
              openConfirm(
                "عبور از آزمون دوم",
                "اگر عبور کنی، آزمون دوم انجام نمی‌شود.\nنتیجه بر اساس آزمون اول نمایش داده می‌شود.",
                passTest2FromEndOfTest1
              )
            }
          >
            {loading ? (
              <InlineLoading label="در حال پردازش…" />
            ) : (
              <Text style={[styles.btnText, { color: palette.red }]}>عبور از آزمون دوم</Text>
            )}
          </Pressable>
        </View>

        {ConfirmGlass}
      </View>
    );
  }

  // پایان آزمون 2
  if (session && currentTest === 2 && isEndOfTest) {
    return (
      <View style={[styles.container, { backgroundColor: palette.bg, justifyContent: "center" }]}>
        <View style={[styles.card, styles.cardFancy, { backgroundColor: palette.glass, borderColor: palette.border }]}>
          <View style={[styles.accentBarTop, { backgroundColor: palette.orange }]} />

          <Text style={[styles.title, { color: palette.orange, textAlign: "center" }]}>
            پایان آزمون «آیا برمی‌گرده؟»
          </Text>

          <Text style={[styles.rtlText, { color: palette.sub, marginTop: 10, lineHeight: 22, textAlign: "center" }]}>
            با «ثبت نهایی»، نتیجه‌ی درمان‌محور دو آزمون نمایش داده می‌شود.
          </Text>

          <View style={{ height: 14 }} />

          <Pressable
            style={[styles.btnPrimary, { borderColor: palette.border }]}
            onPress={() => {
              if (session?.status !== "in_progress") {
                goToResultPage();
                return;
              }
              finishAfterTest2();
            }}
            disabled={loading}
          >
            {loading ? (
              <InlineLoading label="در حال ثبت نهایی…" />
            ) : (
              <Text style={[styles.btnText, { color: palette.text }]}>ثبت نهایی و رفتن به نتیجه</Text>
            )}
          </Pressable>

          <View style={{ height: 10 }} />
        </View>

        {ConfirmGlass}
      </View>
    );
  }

  if (!session || !currentQuestion) {
    return (
      <View style={[styles.root, { backgroundColor: palette.bg }]}>
        <ActivityIndicator color={palette.gold} />
        <Text style={{ color: palette.sub, marginTop: 10, fontSize: 12 }}>در حال همگام‌سازی…</Text>

        <View style={{ height: 12 }} />

        <Pressable style={[styles.btn, { borderColor: palette.border }]} onPress={manualReload}>
          <Text style={[styles.btnText, { color: palette.text }]}>رفرش</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          style={[
            styles.card,
            styles.cardFancy,
            {
              backgroundColor: palette.glass,
              borderColor: palette.border,
              opacity: fade,
              transform: [{ translateY: slideY }],
            },
          ]}
        >
          <View style={[styles.accentBarTop, { backgroundColor: accentColor }]} />

          <Text style={[styles.title, { color: titleColor, textAlign: "center" }]}>{title}</Text>

          <Text style={[styles.centerText, { color: palette.sub, marginTop: 6, fontSize: 12 }]}>
            سوال {currentIndex + 1} از {questions.length}
          </Text>

          <View style={styles.hr} />

          <Text style={[styles.qText, styles.rtlText, { color: palette.text }]}>{currentQuestion.textFa}</Text>

          {!!currentQuestion.helpFa && (
            <Text style={[styles.rtlText, { color: palette.sub2, marginTop: 10, lineHeight: 20, textAlign: "right" }]}>
              {currentQuestion.helpFa}
            </Text>
          )}

          <View style={{ height: 16 }} />

          {/* ✅ UPDATED: options rendering based on ui.layout */}
          {OptionsBlock}

          <View style={{ height: 6 }} />

          <Pressable
            disabled={loading || selectedValue === null}
            onPress={() => {
              if (selectedValue === null) return;
              submitAnswer(selectedValue);
            }}
            style={[
              styles.btnPrimary,
              {
                borderColor: selectedValue === null ? palette.border : "rgba(212,175,55,.35)",
                backgroundColor: selectedValue === null ? "rgba(255,255,255,.04)" : "rgba(212,175,55,.10)",
                opacity: loading ? 0.85 : 1,
              },
            ]}
          >
            {loading ? (
              <InlineLoading label="در حال ثبت پاسخ…" />
            ) : (
              <Text style={[styles.btnText, { color: selectedValue === null ? palette.sub : palette.text }]}>
                ادامه
              </Text>
            )}
          </Pressable>
        </Animated.View>
      </ScrollView>

      {ConfirmGlass}
    </View>
  );
}

const styles = StyleSheet.create({
  rtlText: { writingDirection: "rtl" as any },
  centerText: { textAlign: "center" as any, writingDirection: "rtl" as any },

  root: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { flex: 1 },

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
    backgroundColor: "rgba(3,7,18,.92)",
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
    paddingHorizontal: 12,
    marginBottom: 10,
  },

  // ✅ NEW layouts
  row2: {
    flexDirection: "row-reverse",
    gap: 10 as any,
    marginBottom: 10,
  },
  rowItem: {
    flex: 1,
  },

  gridRow: {
    flexDirection: "row-reverse",
    gap: 10 as any,
    marginBottom: 10,
  },
  gridCol: {
    flex: 1,
  },

  btn: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },

  centerRow: {
    justifyContent: "center",
  },

  gridColWide: {
    flexGrow: 0,
    flexBasis: "47%", // دو تا کنار هم، وسط‌چین (با gap)
  },

  btnPrimary: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },

  btnGhost: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },

  btnText: { fontSize: 14, fontWeight: "900" },

  confirmOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  confirmCard: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },

  inlineLoading: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8 as any,
  },
  inlineLoadingText: {
    fontSize: 12,
    fontWeight: "900",
    writingDirection: "rtl" as any,
  },
});