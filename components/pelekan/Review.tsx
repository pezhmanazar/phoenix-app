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

type ResultResponse = {
  ok: boolean;
  error?: string;
  data?: {
    status: "in_progress" | "completed_locked" | "unlocked";
    canEnterPelekan?: boolean;
    result: any | null; // {locked:boolean,message:string,meta?:{didSkipTest2:boolean}}
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

  // ✅ Confirm شیشه‌ای (جایگزین Alert)
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMsg, setConfirmMsg] = useState("");
  const confirmActionRef = useRef<null | (() => Promise<void> | void)>(null);

  // ✅ نمایش نتیجه (بعد از finish)
  const [resultOpen, setResultOpen] = useState(false);
  const [resultLoading, setResultLoading] = useState(false);
  const [resultError, setResultError] = useState<string | null>(null);
  const [resultData, setResultData] = useState<any | null>(null);

  // ✅ انتخاب گزینه + دکمه ادامه (برای جلوگیری از لمس اشتباهی)
  const [selectedValue, setSelectedValue] = useState<number | null>(null);

  // ✅ ترنزیشن نرم بین سوال‌ها
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
      lime: "#86efac", // سبز فسفری ملایم (برای تاکید)
    }),
    []
  );

  const accentColor = useMemo(() => {
    // تست ۱ طلایی، تست ۲ نارنجی
    const t = reviewState?.session?.currentTest ?? 1;
    return t === 1 ? palette.gold : palette.orange;
  }, [reviewState?.session?.currentTest, palette.gold, palette.orange]);

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

  const openResultScreen = useCallback(async () => {
    setResultOpen(true);
    await fetchResult();
  }, [fetchResult]);

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
    if (bootRef.current.phone !== phone) {
      bootRef.current.phone = phone;
      bootRef.current.done = false;
      startLockRef.current = false;
      submitLockRef.current = false;

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

  // ✅ وقتی سوال عوض شد: انتخاب ریست + انیمیشن
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

  const isEndOfTest = useMemo(() => {
    if (!session) return false;
    if (!questions?.length) return false;
    return (session.currentIndex ?? 0) >= questions.length;
  }, [session, questions]);

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
          setError(json?.error || "SERVER_ERROR");
          return;
        }

        await fetchReviewState();
        onRefresh?.();
      } catch (e: any) {
        setError(e?.message || "SERVER_ERROR");
      } finally {
        setLoading(false);
        submitLockRef.current = false;
      }
    },
    [phone, session, currentTest, fetchReviewState, onRefresh]
  );

  // ✅ ادامه بعد از پایان آزمون 1: برو آزمون 2
  const goToTest2 = useCallback(async () => {
    if (!phone) return;

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
  }, [phone, fetchReviewState, onRefresh]);

  // ✅ عبور از آزمون دوم از پایان آزمون ۱ => finish => نتیجه (قفل/باز) => امکان رفتن پلکان
  const passTest2FromEndOfTest1 = useCallback(async () => {
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

      const f = await fetch(`${API_BASE}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      }).then((r) => r.json());

      if (!f?.ok) {
        setError(f?.error || "SERVER_ERROR");
        return;
      }

      await fetchReviewState();
      onRefresh?.();
      await openResultScreen();
    } finally {
      setLoading(false);
      submitLockRef.current = false;
    }
  }, [phone, fetchReviewState, onRefresh, openResultScreen]);

  // ✅ پایان آزمون 2 => finish => نتیجه
  const finishAfterTest2 = useCallback(async () => {
    if (!phone) return;

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

      await fetchReviewState();
      onRefresh?.();
      await openResultScreen();
    } finally {
      setLoading(false);
      submitLockRef.current = false;
    }
  }, [phone, fetchReviewState, onRefresh, openResultScreen]);

  // ✅ عبور از آزمون دوم (داخل تست۲) => finish => نتیجه
  const passTest2 = useCallback(async () => {
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
        setError(s2?.error || "SERVER_ERROR");
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

      await fetchReviewState();
      onRefresh?.();
      await openResultScreen();
    } finally {
      setLoading(false);
      submitLockRef.current = false;
    }
  }, [phone, fetchReviewState, onRefresh, openResultScreen]);

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
            <Text style={[styles.btnText, { color: palette.text }]}>{loading ? "..." : "بله، ادامه"}</Text>
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
            <Text style={[styles.btnText, { color: palette.sub }]}>{loading ? "..." : "نه"}</Text>
          </Pressable>
        </View>
      </View>
    );
  }, [confirmOpen, confirmTitle, confirmMsg, palette, loading, closeConfirm]);

  const ResultScreen = useMemo(() => {
    if (!resultOpen) return null;

    const locked = !!resultData?.locked;
    const didSkipTest2 = !!resultData?.meta?.didSkipTest2;

    const resultTitle = didSkipTest2 ? "نتیجه آزمون بازسنجی" : "نتیجه دو آزمون";
    const msg = String(
      resultData?.message ||
        (locked ? "برای دیدن تحلیل کامل باید PRO را فعال کنی." : "نتیجه آماده است.")
    );

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
              {locked && (
                <>
                  <Pressable
                    style={[
                      styles.btnPrimary,
                      { borderColor: "rgba(212,175,55,.35)", backgroundColor: "rgba(212,175,55,.10)" },
                    ]}
                    onPress={() => router.push("/(tabs)/Subscription")}
                  >
                    <Text style={[styles.btnText, { color: palette.text }]}>فعال‌سازی PRO برای دیدن تحلیل</Text>
                  </Pressable>

                  <View style={{ height: 10 }} />
                </>
              )}

              <Pressable
                style={[styles.btn, { borderColor: palette.border }]}
                onPress={() => {
                  setResultOpen(false);
                  router.replace("/(tabs)/Pelekan");
                }}
              >
                <Text style={[styles.btnText, { color: palette.text }]}>فعلاً رفتن به پلکان</Text>
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
  }, [resultOpen, resultData, resultLoading, resultError, palette, router]);

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
            اگر «ادامه» را بزنی، وارد آزمون دوم («آیا برمی‌گرده؟») می‌شوی و در پایان، نتیجه‌ی کامل نمایش داده می‌شود.
          </Text>

          <View style={{ height: 14 }} />

          <Pressable style={[styles.btnPrimary, { borderColor: palette.border }]} onPress={goToTest2} disabled={loading}>
            <Text style={[styles.btnText, { color: palette.text }]}>{loading ? "..." : "ادامه → رفتن به آزمون دوم"}</Text>
          </Pressable>

          <View style={{ height: 10 }} />

          <Pressable
            style={[styles.btnGhost, { borderColor: "rgba(239,68,68,.45)" }]}
            disabled={loading}
            onPress={() =>
              openConfirm(
                "عبور از آزمون دوم",
                "اگر عبور کنی، آزمون دوم انجام نمی‌شود.\nابتدا نتیجه‌ی آزمون بازسنجی نمایش داده می‌شود (ممکن است قفل PRO باشد) و بعد می‌توانی وارد پلکان شوی.",
                passTest2FromEndOfTest1
              )
            }
          >
            <Text style={[styles.btnText, { color: palette.red }]}>{loading ? "..." : "عبور از آزمون دوم"}</Text>
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

          <Text style={[styles.rtlText, { color: palette.sub, marginTop: 10, lineHeight: 22, textAlign: "right" }]}>
            با «ثبت نهایی»، نتیجه‌ی درمان‌محور دو آزمون نمایش داده می‌شود.
            {"\n"}
            (ممکن است برای دیدن تحلیل کامل نیاز به PRO باشد.)
          </Text>

          <View style={{ height: 14 }} />

          <Pressable style={[styles.btnPrimary, { borderColor: palette.border }]} onPress={finishAfterTest2} disabled={loading}>
            <Text style={[styles.btnText, { color: palette.text }]}>{loading ? "..." : "ثبت نهایی و رفتن به نتیجه"}</Text>
          </Pressable>

          <View style={{ height: 10 }} />

          <Pressable
            style={[styles.btnGhost, { borderColor: "rgba(239,68,68,.45)" }]}
            disabled={loading}
            onPress={() =>
              openConfirm(
                "عبور از آزمون دوم",
                "اگر عبور کنی، آزمون دوم تکمیل نمی‌شود.\nنتیجه ممکن است قفل PRO باشد، ولی می‌توانی وارد پلکان شوی.",
                passTest2
              )
            }
          >
            <Text style={[styles.btnText, { color: palette.red }]}>{loading ? "..." : "عبور از آزمون دوم"}</Text>
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

          {/* عنوان */}
          <Text style={[styles.title, { color: titleColor, textAlign: "center" }]}>{title}</Text>

          {/* پیشرفت */}
          <Text style={[styles.centerText, { color: palette.sub, marginTop: 6, fontSize: 12 }]}>
            سوال {currentIndex + 1} از {questions.length}
          </Text>

          <View style={styles.hr} />

          {/* متن سوال */}
          <Text style={[styles.qText, styles.rtlText, { color: palette.text }]}>
            {currentQuestion.textFa}
          </Text>

          {!!currentQuestion.helpFa && (
            <Text style={[styles.rtlText, { color: palette.sub2, marginTop: 10, lineHeight: 20, textAlign: "right" }]}>
              {currentQuestion.helpFa}
            </Text>
          )}

          <View style={{ height: 16 }} />

          {/* گزینه‌ها */}
          {currentQuestion.options.map((op) => {
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
                <Text style={[styles.centerText, styles.rtlText, { color: palette.text, fontSize: 14 }]}>
                  {op.labelFa}
                </Text>
              </Pressable>
            );
          })}

          {/* CTA ادامه */}
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
            <Text style={[styles.btnText, { color: selectedValue === null ? palette.sub : palette.text }]}>
              {loading ? "..." : "ادامه"}
            </Text>
          </Pressable>

          {/* فقط داخل آزمون دوم: یک دکمه عبور (نه کنار هر گزینه، نه تکراری) */}
          {currentTest === 2 && (
            <>
              <View style={{ height: 10 }} />
              <Pressable
                disabled={loading}
                onPress={() =>
                  openConfirm(
                    "عبور از آزمون دوم",
                    "اگر عبور کنی، آزمون دوم تکمیل نمی‌شود.\nنتیجه ممکن است قفل PRO باشد، ولی می‌توانی وارد پلکان شوی.",
                    passTest2
                  )
                }
                style={[
                  styles.btnGhost,
                  {
                    borderColor: "rgba(239,68,68,.45)",
                    backgroundColor: "rgba(239,68,68,.06)",
                  },
                ]}
              >
                <Text style={[styles.btnText, { color: palette.red }]}>{loading ? "..." : "عبور از آزمون دوم"}</Text>
              </Pressable>
            </>
          )}
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

  // کمی رنگ و لعاب (بدون شلوغی)
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

  btn: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
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
});