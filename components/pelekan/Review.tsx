// phoenix-app/components/pelekan/Review.tsx
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
type ReviewQuestion = {
  index: number;
  key?: string | null;
  textFa: string;
  helpFa?: string | null;
  options: ReviewOption[];
};

type QuestionSetResponse = {
  ok: boolean;
  error?: string;
  data?: {
    questionSet: { id: string; code: string; version: number; titleFa?: string | null };
    tests: { test1: ReviewQuestion[]; test2: ReviewQuestion[] };
  };
};

type ReviewStateResponse = {
  ok: boolean;
  error?: string;
  data?: {
    hasSession: boolean;
    canEnterPelekan?: boolean;
    paywallRequired?: boolean;
    session: {
      id: string;
      status: "in_progress" | "completed_locked" | "unlocked";
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

const API_BASE = "https://qoqnoos.app/api/pelekan/review";

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

  // ✅ ضد-لوپ برای bootstrap: برای هر phone فقط یکبار خودکار
  const bootRef = useRef<{ phone: string | null; done: boolean }>({ phone: null, done: false });

  // ✅ ضد-تکرار برای start (اگر سرور کند بود یا رندرها زیاد شدند)
  const startLockRef = useRef(false);

  // ✅ جلوگیری از setState بعد از unmount
  const mountedRef = useRef(true);

  // ✅ ضد دابل‌کلیک / چند submit پشت هم
  const submitLockRef = useRef(false);

  // ✅ Confirm شیشه‌ای (جایگزین Alert) - نسخه دو دکمه‌ای
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMsg, setConfirmMsg] = useState("");
  const [confirmPrimaryText, setConfirmPrimaryText] = useState("بله، ادامه");
  const [confirmSecondaryText, setConfirmSecondaryText] = useState("نه");
  const confirmPrimaryRef = useRef<null | (() => Promise<void> | void)>(null);
  const confirmSecondaryRef = useRef<null | (() => Promise<void> | void)>(null);

  const openConfirm = useCallback(
    (
      t: string,
      m: string,
      primaryText: string,
      primaryAction: () => Promise<void> | void,
      secondaryText?: string,
      secondaryAction?: (() => Promise<void> | void) | null
    ) => {
      confirmPrimaryRef.current = primaryAction;
      confirmSecondaryRef.current = secondaryAction ?? null;
      setConfirmTitle(t);
      setConfirmMsg(m);
      setConfirmPrimaryText(primaryText || "بله، ادامه");
      setConfirmSecondaryText(secondaryText || "نه");
      setConfirmOpen(true);
    },
    []
  );

  const closeConfirm = useCallback(() => {
    setConfirmOpen(false);
    confirmPrimaryRef.current = null;
    confirmSecondaryRef.current = null;
  }, []);

  const palette = useMemo(
    () => ({
      bg: "#0b0f14",
      glass: "rgba(3,7,18,.92)",
      border: "rgba(255,255,255,.10)",
      text: "#F9FAFB",
      sub: "rgba(231,238,247,.75)",
      gold: "#D4AF37",
      orange: "#E98A15",
      red: "#ef4444",
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

    const res = await fetch(`${API_BASE}/state?phone=${encodeURIComponent(phone)}`, {
      headers: { "Cache-Control": "no-store" },
    });

    const json: ReviewStateResponse = await res.json().catch(() => ({ ok: false } as any));
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

  // ✅ فقط وقتی session.questionSetId خالیه start بزن، با lock
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

    setError(null);
    setQsLoading(true);

    try {
      console.log("[Review] bootstrap begin", { phone });

      const st = await fetchReviewState();
      console.log("[Review] state", st);

      const qsid = await fetchQuestionSet();
      console.log("[Review] question-set loaded", { qsid });

      await ensureStarted(st);
      console.log("[Review] ensureStarted done");
    } catch (e: any) {
      console.log("[Review] bootstrap error", e?.message || e);
      if (mountedRef.current) setError(String(e?.message || "UNKNOWN_ERROR"));
    } finally {
      if (mountedRef.current) setQsLoading(false);
    }
  }, [phone, fetchReviewState, fetchQuestionSet, ensureStarted]);

  // ✅ bootstrap خودکار فقط یکبار برای هر phone
  useEffect(() => {
    // reset guards when phone changes
    if (bootRef.current.phone !== phone) {
      bootRef.current.phone = phone;
      bootRef.current.done = false;
      startLockRef.current = false;
      submitLockRef.current = false;
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

  // ✅ لاگِ رندر (اختیاری)
  useEffect(() => {
    console.log("[Review] render", {
      currentTest,
      currentIndex,
      qLen: questions?.length ?? 0,
      hasQuestion: !!currentQuestion,
      sessionStatus: session?.status,
      qsId: session?.questionSetId,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTest, currentIndex, questions?.length, !!currentQuestion, session?.status, session?.questionSetId]);

  const title = useMemo(() => {
    if (currentTest === 1) return "آزمون بازسنجی";
    return "آزمون «آیا برمی‌گرده؟»";
  }, [currentTest]);

  const isEndOfTest = useMemo(() => {
    if (!session) return false;
    if (!questions?.length) return false;
    return (session.currentIndex ?? 0) >= questions.length;
  }, [session, questions]);

  const isPro = !!reviewState?.user?.isPro;

  const goToAnalysis = useCallback(
    (mode: "test1" | "final") => {
      // ✅ به‌جای string، مسیر رو با pathname/params بده تا TS قرمز نشه
      const analysisNav = {
        pathname: "/pelekan/review/analysis",
        params: { mode },
      } as const;

      if (isPro) {
        // @ts-ignore - expo-router بعضی وقت‌ها روی object route هم گیر می‌دهد
        router.push(analysisNav);
        return;
      }

      // ✅ next را به شکل string ساده نگه می‌داریم (برای صفحه اشتراک)
      const next = `/pelekan/review/analysis?mode=${encodeURIComponent(mode)}`;

      // @ts-ignore
      router.push({
        pathname: "/(tabs)/Subscription",
        params: { next },
      });
    },
    [isPro, router]
  );

  const goToPelekanStart = useCallback(() => {
    router.replace("/(tabs)/Pelekan");
  }, [router]);

  const ensureCompleteTest1 = useCallback(async () => {
    if (!phone) return { ok: false };
    if (reviewState?.session?.test1CompletedAt) return { ok: true };

    const res = await fetch(`${API_BASE}/complete-test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, testNo: 1 }),
    }).then((r) => r.json());

    if (!res?.ok) {
      Alert.alert("خطا", res?.error || "SERVER_ERROR");
      return { ok: false };
    }

    await fetchReviewState();
    onRefresh?.();
    return { ok: true };
  }, [phone, reviewState?.session?.test1CompletedAt, fetchReviewState, onRefresh]);

  const submitAnswer = useCallback(
    async (value: number) => {
      if (!phone || !session) return;

      if (submitLockRef.current) return;
      submitLockRef.current = true;

      const idx = session.currentIndex ?? 0;

      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, testNo: currentTest, index: idx, value }),
        });

        const json = await res.json().catch(() => null);
        if (!json?.ok) {
          Alert.alert("خطا", json?.error || "SERVER_ERROR");
          return;
        }

        await fetchReviewState();
        onRefresh?.();
      } catch (e: any) {
        Alert.alert("خطا", e?.message || "SERVER_ERROR");
      } finally {
        setLoading(false);
        submitLockRef.current = false;
      }
    },
    [phone, session, currentTest, fetchReviewState, onRefresh]
  );

  // ✅ دکمه «ادامه» در پایان آزمون ۱: فقط وارد آزمون ۲ شود
  const goToTest2FromEndOfTest1 = useCallback(async () => {
    if (!phone) return;

    if (submitLockRef.current) return;
    submitLockRef.current = true;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/complete-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, testNo: 1 }),
      }).then((r) => r.json());

      if (!res?.ok) {
        Alert.alert("خطا", res?.error || "SERVER_ERROR");
        return;
      }

      await fetchReviewState();
      onRefresh?.();
      // ✅ با آپدیت state، خود کامپوننت میره روی test2
    } finally {
      setLoading(false);
      submitLockRef.current = false;
    }
  }, [phone, fetchReviewState, onRefresh]);

  // ✅ عبور از آزمون دوم از پایان آزمون ۱: اگر کاربر «ورود به پلکان» را انتخاب کرد
  // 1) complete-test(1)
  // 2) skip-test2
  // 3) finish
  const passTest2AndEnterPelekanFromEndTest1 = useCallback(async () => {
    if (!phone) return;

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
        Alert.alert("خطا", c1?.error || "SERVER_ERROR");
        return;
      }

      const s2 = await fetch(`${API_BASE}/skip-test2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      }).then((r) => r.json());

      if (!s2?.ok) {
        Alert.alert("خطا", s2?.error || "SERVER_ERROR");
        return;
      }

      const f = await fetch(`${API_BASE}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      }).then((r) => r.json());

      if (!f?.ok) {
        Alert.alert("خطا", f?.error || "SERVER_ERROR");
        return;
      }

      await fetchReviewState();
      onRefresh?.();
      goToPelekanStart();
    } finally {
      setLoading(false);
      submitLockRef.current = false;
    }
  }, [phone, fetchReviewState, onRefresh, goToPelekanStart]);

  // ✅ پایان آزمون ۲: قبل از تحلیل/پلکان باید complete-test2 + finish انجام شود
  const finalizeAfterTest2 = useCallback(async () => {
    if (!phone) return { ok: false as const };

    if (submitLockRef.current) return { ok: false as const };
    submitLockRef.current = true;

    setLoading(true);
    try {
      const c = await fetch(`${API_BASE}/complete-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, testNo: 2 }),
      }).then((r) => r.json());

      if (!c?.ok) {
        Alert.alert("خطا", c?.error || "SERVER_ERROR");
        return { ok: false as const };
      }

      const f = await fetch(`${API_BASE}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      }).then((r) => r.json());

      if (!f?.ok) {
        Alert.alert("خطا", f?.error || "SERVER_ERROR");
        return { ok: false as const };
      }

      await fetchReviewState();
      onRefresh?.();
      return { ok: true as const };
    } finally {
      setLoading(false);
      submitLockRef.current = false;
    }
  }, [phone, fetchReviewState, onRefresh]);

  // ✅ عبور از آزمون دوم وقتی داخل آزمون دوم هستی:
  // 1) skip-test2
  // 2) finish
  const passTest2FromInsideTest2 = useCallback(async () => {
    if (!phone) return;

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
        Alert.alert("خطا", s2?.error || "SERVER_ERROR");
        return;
      }

      const f = await fetch(`${API_BASE}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      }).then((r) => r.json());

      if (!f?.ok) {
        Alert.alert("خطا", f?.error || "SERVER_ERROR");
        return;
      }

      await fetchReviewState();
      onRefresh?.();

      goToPelekanStart();
    } finally {
      setLoading(false);
      submitLockRef.current = false;
    }
  }, [phone, fetchReviewState, onRefresh, goToPelekanStart]);

  const manualReload = useCallback(() => {
    bootRef.current.done = false;
    startLockRef.current = false;
    submitLockRef.current = false;
    bootstrap();
  }, [bootstrap]);

  const ConfirmGlass = useMemo(() => {
    if (!confirmOpen) return null;

    return (
      <View style={styles.confirmOverlay}>
        <View style={[styles.confirmCard, { backgroundColor: palette.glass, borderColor: palette.border }]}>
          <Text style={{ color: palette.text, fontWeight: "900", fontSize: 16 }}>{confirmTitle}</Text>
          <Text style={{ color: palette.sub, marginTop: 8, lineHeight: 22, fontSize: 12 }}>{confirmMsg}</Text>

          <View style={{ height: 14 }} />

          <Pressable
            disabled={loading}
            style={[styles.btn, { borderColor: palette.border }]}
            onPress={async () => {
              const fn = confirmPrimaryRef.current;
              closeConfirm();
              if (fn) await fn();
            }}
          >
            <Text style={[styles.btnText, { color: palette.text }]}>{loading ? "..." : confirmPrimaryText}</Text>
          </Pressable>

          <View style={{ height: 10 }} />

          <Pressable
            disabled={loading}
            style={[
              styles.btnGhost,
              { borderColor: palette.border, backgroundColor: "rgba(255,255,255,.04)" },
            ]}
            onPress={async () => {
              const fn = confirmSecondaryRef.current;
              closeConfirm();
              if (fn) await fn();
            }}
          >
            <Text style={[styles.btnText, { color: palette.sub }]}>{loading ? "..." : confirmSecondaryText}</Text>
          </Pressable>
        </View>
      </View>
    );
  }, [
    confirmOpen,
    confirmTitle,
    confirmMsg,
    confirmPrimaryText,
    confirmSecondaryText,
    palette,
    loading,
    closeConfirm,
  ]);

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
        <Text style={{ color: palette.red, fontWeight: "900", marginBottom: 8 }}>خطا در دریافت داده‌ها</Text>
        <Text style={{ color: palette.sub, fontSize: 12, lineHeight: 18 }}>{error}</Text>

        <View style={{ height: 14 }} />

        <Pressable style={[styles.btn, { borderColor: palette.border }]} onPress={manualReload}>
          <Text style={[styles.btnText, { color: palette.text }]}>تلاش مجدد</Text>
        </Pressable>
      </View>
    );
  }

  // پایان آزمون 1
  if (session && currentTest === 1 && isEndOfTest) {
    return (
      <View style={[styles.container, { backgroundColor: palette.bg }]}>
        <View style={[styles.card, { backgroundColor: palette.glass, borderColor: palette.border }]}>
          <Text style={[styles.title, { color: palette.text }]}>پایان آزمون بازسنجی</Text>

          <Text style={{ color: palette.sub, marginTop: 8, lineHeight: 22 }}>
            آماده‌ای بریم آزمون دوم («آیا برمی‌گرده؟»)؟
          </Text>

          <View style={{ height: 14 }} />

          <Pressable style={[styles.btn, { borderColor: palette.border }]} onPress={goToTest2FromEndOfTest1} disabled={loading}>
            <Text style={[styles.btnText, { color: palette.text }]}>
              {loading ? "..." : "ادامه → رفتن به آزمون دوم"}
            </Text>
          </Pressable>

          <View style={{ height: 10 }} />

          <Pressable
            style={[styles.btnGhost, { borderColor: "rgba(239,68,68,.45)" }]}
            disabled={loading}
            onPress={() =>
              openConfirm(
                "عبور از آزمون دوم",
                "قبل از عبور، می‌تونی تحلیل آزمون بازسنجی رو ببینی. تحلیل فقط برای کاربران پرو فعاله.\n\nمی‌خوای تحلیل رو ببینی یا فعلاً وارد پلکان بشی؟",
                "دیدن تحلیل آزمون اول (پرو)",
                async () => {
                  const r = await ensureCompleteTest1();
                  if (r?.ok) goToAnalysis("test1");
                },
                "فعلاً نه، ورود به پلکان",
                passTest2AndEnterPelekanFromEndTest1
              )
            }
          >
            <Text style={[styles.btnText, { color: palette.red }]}>
              {loading ? "..." : "عبور از آزمون دوم"}
            </Text>
          </Pressable>

          <Text style={{ color: "rgba(231,238,247,.55)", marginTop: 10, fontSize: 12 }}>
            نکته: با «ادامه»، وارد آزمون دوم می‌شوی.
          </Text>
        </View>

        {ConfirmGlass}
      </View>
    );
  }

  // پایان آزمون 2
  if (session && currentTest === 2 && isEndOfTest) {
    return (
      <View style={[styles.container, { backgroundColor: palette.bg }]}>
        <View style={[styles.card, { backgroundColor: palette.glass, borderColor: palette.border }]}>
          <Text style={[styles.title, { color: palette.text }]}>پایان آزمون «آیا برمی‌گرده؟»</Text>

          <Text style={{ color: palette.sub, marginTop: 8, lineHeight: 22 }}>
            حالا می‌تونی تحلیل نهایی (ترکیب دو آزمون) رو ببینی. تحلیل فقط برای کاربران پرو فعاله.
          </Text>

          <View style={{ height: 14 }} />

          <Pressable
            style={[styles.btn, { borderColor: palette.border }]}
            disabled={loading}
            onPress={() =>
              openConfirm(
                "تحلیل نهایی دو آزمون",
                "می‌خوای تحلیل نهایی رو ببینی یا فعلاً وارد پلکان بشی؟",
                "دیدن تحلیل دو آزمون (پرو)",
                async () => {
                  const r = await finalizeAfterTest2();
                  if (r?.ok) goToAnalysis("final");
                },
                "فعلاً نه، ورود به پلکان",
                async () => {
                  const r = await finalizeAfterTest2();
                  if (r?.ok) goToPelekanStart();
                }
              )
            }
          >
            <Text style={[styles.btnText, { color: palette.text }]}>{loading ? "..." : "ادامه"}</Text>
          </Pressable>
        </View>

        {ConfirmGlass}
      </View>
    );
  }

  // اگر session یا سوال فعلی نداریم: sync نشده یا mismatch
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
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: palette.glass, borderColor: palette.border }]}>
          <Text style={[styles.title, { color: palette.text }]}>{title}</Text>

          <Text style={{ color: palette.sub, marginTop: 6, fontSize: 12 }}>
            سوال {currentIndex + 1} از {questions.length}
          </Text>

          <View style={styles.hr} />

          <Text style={[styles.qText, { color: palette.text }]}>{currentQuestion.textFa}</Text>

          {!!currentQuestion.helpFa && (
            <Text style={{ color: "rgba(231,238,247,.55)", marginTop: 8, lineHeight: 20 }}>
              {currentQuestion.helpFa}
            </Text>
          )}

          <View style={{ height: 16 }} />

          {currentQuestion.options.map((op) => (
            <Pressable
              key={`${currentQuestion.index}-${op.value}`}
              onPress={() => submitAnswer(op.value)}
              disabled={loading}
              // @ts-ignore
              pointerEvents={loading ? "none" : "auto"}
              style={({ pressed }) => [
                styles.option,
                { borderColor: palette.border, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={{ color: palette.text, fontSize: 14 }}>{op.labelFa}</Text>
            </Pressable>
          ))}

          {currentTest === 2 && (
            <>
              <View style={{ height: 14 }} />
              <Pressable
                disabled={loading}
                onPress={() =>
                  openConfirm(
                    "عبور از آزمون دوم",
                    "اگر عبور کنی، آزمون دوم ثبت نمی‌شود ولی می‌توانی وارد پلکان شوی. ادامه؟",
                    "بله، عبور و ورود به پلکان",
                    passTest2FromInsideTest2,
                    "نه",
                    null
                  )
                }
                style={[styles.btnGhost, { borderColor: "rgba(239,68,68,.45)" }]}
              >
                <Text style={[styles.btnText, { color: palette.red }]}>{loading ? "..." : "عبور از آزمون دوم"}</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>

      {ConfirmGlass}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { flex: 1 },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  title: { fontSize: 18, fontWeight: "900" },
  hr: {
    height: 1,
    backgroundColor: "rgba(255,255,255,.08)",
    marginVertical: 14,
  },
  qText: { fontSize: 16, fontWeight: "800", lineHeight: 24 },
  option: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  btn: {
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
    backgroundColor: "rgba(239,68,68,.06)",
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
});