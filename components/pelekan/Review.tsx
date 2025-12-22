// phoenix-app/components/pelekan/Review.tsx
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
  data?: {
    questionSet: { id: string; code: string; version: number; titleFa?: string | null };
    tests: { test1: ReviewQuestion[]; test2: ReviewQuestion[] };
  };
};

type ReviewStateResponse = {
  ok: boolean;
  data?: {
    hasSession: boolean;
    canEnterPelekan?: boolean;
    paywallRequired?: boolean;
    session: {
      id: string;
      status: "in_progress" | "completed_locked" | "unlocked";
      chosenPath: "skip_review" | "review" | null;
      currentTest: number; // 1 | 2
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

export default function Review({ me, onRefresh }: Props) {
  const phone = String(me?.phone || "").trim();

  const [loading, setLoading] = useState(true);
  const [qsLoading, setQsLoading] = useState(true);

  const [reviewState, setReviewState] = useState<ReviewStateResponse["data"] | null>(null);
  const [questionSetId, setQuestionSetId] = useState<string | null>(null);
  const [test1, setTest1] = useState<ReviewQuestion[]>([]);
  const [test2, setTest2] = useState<ReviewQuestion[]>([]);

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

  const fetchReviewState = useCallback(async () => {
    if (!phone) return;
    const res = await fetch(`${API_BASE}/state?phone=${encodeURIComponent(phone)}`, {
      headers: { "Cache-Control": "no-store" },
    });
    const json: ReviewStateResponse = await res.json().catch(() => ({ ok: false } as any));
    if (!json?.ok) throw new Error("STATE_FAILED");
    setReviewState(json.data || null);
  }, [phone]);

  const fetchQuestionSet = useCallback(async () => {
    const res = await fetch(`${API_BASE}/question-set`, {
      headers: { "Cache-Control": "no-store" },
    });
    const json: QuestionSetResponse = await res.json().catch(() => ({ ok: false } as any));
    if (!json?.ok || !json?.data?.tests) throw new Error("QS_FAILED");
    setQuestionSetId(json.data.questionSet.id);
    setTest1(json.data.tests.test1 || []);
    setTest2(json.data.tests.test2 || []);
  }, []);

  const ensureStarted = useCallback(async () => {
    // اگر session نداشت یا questionSetId نداشت، start می‌زنیم تا سشن قفل بشه به بانک سوالات
    if (!phone) return;
    const st = reviewState?.session;
    if (!st || !st.questionSetId) {
      await fetch(`${API_BASE}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      })
        .then((r) => r.json())
        .catch(() => null);
      await fetchReviewState();
      onRefresh?.();
    }
  }, [phone, reviewState?.session, fetchReviewState, onRefresh]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setQsLoading(true);

        await fetchReviewState();
        if (!mounted) return;

        await fetchQuestionSet();
        if (!mounted) return;

        setQsLoading(false);

        // سشن رو اگر لازم بود استارت کن (قفل به questionSetId)
        await ensureStarted();
      } catch (e) {
        // silent
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [fetchReviewState, fetchQuestionSet, ensureStarted]);

  const session = reviewState?.session || null;
  const currentTest = session?.currentTest ?? 1;
  const currentIndex = session?.currentIndex ?? 0;

  const questions = currentTest === 1 ? test1 : test2;
  const currentQuestion = questions[currentIndex] || null;

  const title = useMemo(() => {
    if (currentTest === 1) return "آزمون بازسنجی";
    return "آزمون «آیا برمی‌گرده؟»";
  }, [currentTest]);

  const submitAnswer = useCallback(
    async (value: number) => {
      if (!phone || !session) return;
      const idx = session.currentIndex ?? 0;
      // optimistic: disable taps by temp loading
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
      } finally {
        setLoading(false);
      }
    },
    [phone, session, currentTest, fetchReviewState, onRefresh]
  );

  const completeTest1 = useCallback(async () => {
    if (!phone) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/complete-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, testNo: 1 }),
      });
      const json = await res.json().catch(() => null);
      if (!json?.ok) {
        Alert.alert("خطا", json?.error || "SERVER_ERROR");
        return;
      }
      await fetchReviewState();
      onRefresh?.();
    } finally {
      setLoading(false);
    }
  }, [phone, fetchReviewState, onRefresh]);

  const finishAfterTest2 = useCallback(async () => {
    if (!phone) return;
    setLoading(true);
    try {
      // اول test2 رو complete کن
      const c = await fetch(`${API_BASE}/complete-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, testNo: 2 }),
      }).then((r) => r.json());
      if (!c?.ok) {
        Alert.alert("خطا", c?.error || "SERVER_ERROR");
        return;
      }

      // بعد finish
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
    } finally {
      setLoading(false);
    }
  }, [phone, fetchReviewState, onRefresh]);

  const skipTest2 = useCallback(async () => {
    if (!phone) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/skip-test2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const json = await res.json().catch(() => null);
      if (!json?.ok) {
        Alert.alert("خطا", json?.error || "SERVER_ERROR");
        return;
      }
      await fetchReviewState();
      onRefresh?.();
    } finally {
      setLoading(false);
    }
  }, [phone, fetchReviewState, onRefresh]);

  // اگر سوال‌ها تمام شد:
  const isEndOfTest = useMemo(() => {
    if (!session) return false;
    if (!questions?.length) return false;
    return (session.currentIndex ?? 0) >= questions.length;
  }, [session, questions]);

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

  // حالت پایان آزمون 1
  if (session && currentTest === 1 && isEndOfTest) {
    return (
      <View style={[styles.container, { backgroundColor: palette.bg }]}>
        <View style={[styles.card, { backgroundColor: palette.glass, borderColor: palette.border }]}>
          <Text style={[styles.title, { color: palette.text }]}>پایان آزمون بازسنجی</Text>
          <Text style={{ color: palette.sub, marginTop: 8, lineHeight: 22 }}>
            آماده‌ای بریم آزمون دوم («آیا برمی‌گرده؟») یا می‌خوای ازش رد بشی؟
          </Text>

          <View style={{ height: 14 }} />

          <Pressable style={[styles.btn, { borderColor: palette.border }]} onPress={completeTest1}>
            <Text style={[styles.btnText, { color: palette.text }]}>ادامه → رفتن به آزمون دوم</Text>
          </Pressable>

          <View style={{ height: 10 }} />

          {/* اسکیپ آزمون 2 فقط بعد از complete-test(1) مجازه؛ پس اول completeTest1 لازمه.
              اینجا همون "ادامه" رو می‌زنن، بعد در تست2 دکمه اسکیپ داریم. */}
          <Text style={{ color: "rgba(231,238,247,.55)", marginTop: 10, fontSize: 12 }}>
            نکته: اسکیپ آزمون دوم از داخل صفحه آزمون دوم فعال می‌شود.
          </Text>
        </View>
      </View>
    );
  }

  // حالت پایان آزمون 2
  if (session && currentTest === 2 && isEndOfTest) {
    return (
      <View style={[styles.container, { backgroundColor: palette.bg }]}>
        <View style={[styles.card, { backgroundColor: palette.glass, borderColor: palette.border }]}>
          <Text style={[styles.title, { color: palette.text }]}>پایان آزمون «آیا برمی‌گرده؟»</Text>
          <Text style={{ color: palette.sub, marginTop: 8, lineHeight: 22 }}>
            با زدن دکمه زیر، نتیجه قفل/باز می‌شود (بسته به PRO).
          </Text>

          <View style={{ height: 14 }} />

          <Pressable style={[styles.btn, { borderColor: palette.border }]} onPress={finishAfterTest2}>
            <Text style={[styles.btnText, { color: palette.text }]}>ثبت نهایی و دیدن وضعیت نتیجه</Text>
          </Pressable>

          <View style={{ height: 10 }} />

          <Pressable style={[styles.btnGhost, { borderColor: "rgba(239,68,68,.45)" }]} onPress={skipTest2}>
            <Text style={[styles.btnText, { color: palette.red }]}>اسکیپ آزمون دوم و ورود به پلکان</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // اگر سوال فعلی نداریم ولی end هم نیست: یعنی state هنوز sync نشده
  if (!session || !currentQuestion) {
    return (
      <View style={[styles.root, { backgroundColor: palette.bg }]}>
        <ActivityIndicator color={palette.gold} />
        <Text style={{ color: palette.sub, marginTop: 10, fontSize: 12 }}>در حال همگام‌سازی…</Text>
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
              style={({ pressed }) => [
                styles.option,
                {
                  borderColor: palette.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={{ color: palette.text, fontSize: 14 }}>{op.labelFa}</Text>
            </Pressable>
          ))}

          {/* اسکیپ فقط وقتی آزمون 2 هست */}
          {currentTest === 2 && (
            <>
              <View style={{ height: 14 }} />
              <Pressable
                onPress={() => {
                  Alert.alert(
                    "اسکیپ آزمون دوم",
                    "اگر اسکیپ کنی، نتیجه‌ی کامل قفل می‌ماند ولی می‌توانی وارد پلکان شوی. ادامه؟",
                    [
                      { text: "نه", style: "cancel" },
                      { text: "بله، اسکیپ", style: "destructive", onPress: skipTest2 },
                    ]
                  );
                }}
                style={[styles.btnGhost, { borderColor: "rgba(239,68,68,.45)" }]}
              >
                <Text style={[styles.btnText, { color: palette.red }]}>اسکیپ آزمون دوم</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
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
});