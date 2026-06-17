import { ScreenLayout } from "@/components/ScreenLayout";
import SharedInlineAudioPlayer from "@/components/pelekan/SharedInlineAudioPlayer";
import AppBannerModal from "@/components/ui/AppBannerModal";
import { AUDIO_KEYS, mediaUrl } from "@/constants/media";
import { palette } from "@/constants/theme/palette";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isTaskOfTemplate, type ResolvedTask } from "../types";
import { useLocalTaskDraft } from "../useLocalTaskDraft";

type QuizOption = {
  id: string;
  text: string;
};

type QuizQuestion = {
  id: string;
  prompt: string;
  options: QuizOption[];
  correctOptionId: string;
  explanation?: string;
};

type QuizMeta = {
  audioKey?: string;
  submitLabel?: string;
  questions?: QuizQuestion[];
};

type Props = {
  dayCode: string;
  task: ResolvedTask;
  onComplete: (data?: unknown) => void;
};

const STEPS = [
  {
    key: "audio",
    label: "فایل صوتی",
    hint: "ابتدا فایل صوتی رو کامل گوش بده.",
  },
  {
    key: "quiz",
    label: "سوالات",
    hint: "حالا به سوالات جواب بده.",
  },
  {
    key: "summary",
    label: "مرور نهایی",
    hint: "جواب‌ها رو مرور کن و اگه آماده‌ای ثبت نهایی رو بزن.",
  },
] as const;

export default function QuizAudioTemplate({
  dayCode,
  task,
  onComplete,
}: Props) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const isValidTask = isTaskOfTemplate(task, "quiz_audio");

  const taskCode = isValidTask ? task.config.code : "";
  const meta = useMemo<QuizMeta>(() => {
    if (!isValidTask) return {};
    return (task.config.meta ?? {}) as QuizMeta;
  }, [isValidTask, task]);

  const submitLabel = meta.submitLabel || "ثبت پاسخ‌ها";

  const questions = useMemo<QuizQuestion[]>(() => {
    return Array.isArray(meta.questions) ? meta.questions : [];
  }, [meta.questions]);

  const completionRuleMeta = useMemo(() => {
    const raw = task.config.completionRule as
      | {
          passingScorePercent?: number;
          requireAudioCompleted?: boolean;
        }
      | undefined;

    return {
      requireAudioCompleted: raw?.requireAudioCompleted === true,
      passingScorePercent:
        typeof raw?.passingScorePercent === "number"
          ? raw.passingScorePercent
          : 0,
    };
  }, [task.config.completionRule]);

  const requireAudioCompleted = completionRuleMeta.requireAudioCompleted;
  const passingScorePercent = completionRuleMeta.passingScorePercent;
  const [showAudioWarning, setShowAudioWarning] = useState(false);
  const [hasShownAudioWarning, setHasShownAudioWarning] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [notes, setNotes] = useState("");

  const resolvedAudioUrl = useMemo(() => {
    const key = meta.audioKey;

    if (!key) return "";

    if (key.includes("/") || key.endsWith(".mp3") || key.endsWith(".m4a")) {
      const directUrl = mediaUrl(key);
      return directUrl;
    }

    const getNestedValue = (obj: unknown, path: string): unknown => {
      if (!obj || typeof obj !== "object") return undefined;

      return path.split(".").reduce<unknown>((acc, part) => {
        if (!acc || typeof acc !== "object") return undefined;
        return (acc as Record<string, unknown>)[part];
      }, obj);
    };

    const audioValue = getNestedValue(AUDIO_KEYS, key);
    if (typeof audioValue !== "string" || !audioValue) return "";

    const finalUrl = mediaUrl(audioValue);
    return finalUrl;
  }, [meta.audioKey]);

  const audioStorageKey = useMemo(() => {
    return `${dayCode}:${taskCode}:audio:v1`;
  }, [dayCode, taskCode]);

  const { loading, draft, setValue, markStepCompleted, saveDraft } =
    useLocalTaskDraft(dayCode, taskCode);

  const [idx, setIdx] = useState(0);
  const [draftLoaded, setDraftLoaded] = useState(false);

  const [audioCompleted, setAudioCompleted] = useState(false);
  const [activeAudioKey, setActiveAudioKey] = useState<string | null>(null);
  const [expandedAudioKey, setExpandedAudioKey] = useState<string | null>(null);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const [attemptCount, setAttemptCount] = useState(1);
  const [showAnswersInSummary, setShowAnswersInSummary] = useState(false);

  useEffect(() => {
    if (!isValidTask) return;
    if (loading || draftLoaded) return;

    const values = draft.values || {};

    setAudioCompleted(values.audioCompleted === true);

    if (
      values.answers &&
      typeof values.answers === "object" &&
      !Array.isArray(values.answers)
    ) {
      setAnswers(values.answers as Record<string, string>);
    }

    if (typeof values.currentStepIndex === "number") {
      const safeIndex = Math.min(
        Math.max(values.currentStepIndex, 0),
        STEPS.length - 1,
      );
      setIdx(safeIndex);
    }

    if (typeof values.currentQuestionIndex === "number") {
      const safeQuestionIndex = Math.min(
        Math.max(values.currentQuestionIndex, 0),
        Math.max(questions.length - 1, 0),
      );
      setCurrentQuestionIndex(safeQuestionIndex);
    }

    if (typeof values.attemptCount === "number" && values.attemptCount > 0) {
      setAttemptCount(values.attemptCount);
    }

    if (values.showAnswersInSummary === true) {
      setShowAnswersInSummary(true);
    }

    setDraftLoaded(true);
  }, [draft, draftLoaded, loading, isValidTask, questions.length]);

  const currentStep = STEPS[idx];
  const isAudioStep = currentStep.key === "audio";
  const isQuizStep = currentStep.key === "quiz";
  const isSummaryStep = currentStep.key === "summary";
  const isLastStep = idx === STEPS.length - 1;
  const isTaskAlreadyCompleted = task.backendTask?.isDone === true;

  const totalQuestions = questions.length;

  const scoreData = useMemo(() => {
    const correctCount = questions.filter(
      (q) => answers[q.id] === q.correctOptionId,
    ).length;

    const percent =
      totalQuestions > 0
        ? Math.round((correctCount / totalQuestions) * 100)
        : 0;

    const passed = totalQuestions > 0 ? percent >= passingScorePercent : false;

    return {
      correctCount,
      percent,
      passed,
    };
  }, [questions, answers, totalQuestions, passingScorePercent]);

  const nextButtonLabel = useMemo(() => {
    if (isSummaryStep) return submitLabel;
    return "بعدی";
  }, [isSummaryStep, submitLabel]);

  const backButtonLabel = useMemo(() => {
    if (isQuizStep && currentQuestionIndex > 0) return "سوال قبلی";
    return "قبلی";
  }, [isQuizStep, currentQuestionIndex]);

  const resolvedNextButtonLabel = useMemo(() => {
    if (isQuizStep && currentQuestionIndex < questions.length - 1) {
      return "سوال بعدی";
    }
    // اگر در مرحله آخر بود و مردود شده بود و تلاش اولش بود
    if (isSummaryStep && !scoreData.passed && attemptCount === 1) {
      return "امتحان مجدد";
    }
    return nextButtonLabel;
  }, [
    isQuizStep,
    currentQuestionIndex,
    questions.length,
    nextButtonLabel,
    isSummaryStep,
    scoreData.passed,
    attemptCount,
  ]);

  const saveCurrentStepIndex = (nextIndex: number) => {
    void setValue("currentStepIndex", nextIndex);
  };

  const handleAudioComplete = async () => {
    setAudioCompleted(true);
    await setValue("audioCompleted", true);
    await markStepCompleted("audio");
  };

  const handleSelectAnswer = async (questionId: string, optionId: string) => {
    const nextAnswers = {
      ...answers,
      [questionId]: optionId,
    };

    setAnswers(nextAnswers);
    await setValue("answers", nextAnswers);

    // اضافه کردن این خط برای اطمینان از سینک شدن سریع
    await saveDraft({ values: { ...draft.values, answers: nextAnswers } });
  };

  const canGoNext = useMemo(() => {
    if (isAudioStep) return true;

    if (isQuizStep) {
      // چک کن ببین سوالی که الان توش هستیم جواب داده شده یا نه
      const currentQuestionId = questions[currentQuestionIndex]?.id;
      return !!answers[currentQuestionId];
    }

    if (isSummaryStep) return true;
    return false;
  }, [
    isAudioStep,
    isQuizStep,
    questions,
    currentQuestionIndex,
    answers,
    isSummaryStep,
  ]);

  const goNext = async () => {
    if (!canGoNext) return;

    // حرکت بین سوال‌ها در مرحله کوییز
    if (isQuizStep && currentQuestionIndex < questions.length - 1) {
      const nextQuestionIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextQuestionIndex);
      await setValue("currentQuestionIndex", nextQuestionIndex);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    // رفتن از audio به quiz
    if (isAudioStep && idx < STEPS.length - 1) {
      // اگر هنوز ۸۰ درصد گوش نداده و قبلاً هم هشدار نگرفته، جلوش رو بگیر و هشدار بده
      if (audioProgress < 0.8 && !hasShownAudioWarning) {
        setShowAudioWarning(true);
        setHasShownAudioWarning(true);
        return;
      }

      const nextIndex = idx + 1;
      setIdx(nextIndex);
      saveCurrentStepIndex(nextIndex);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    // رفتن از quiz به summary
    if (isQuizStep && idx < STEPS.length - 1) {
      const nextIndex = idx + 1;
      setIdx(nextIndex);
      saveCurrentStepIndex(nextIndex);

      // اگر قبول شده باشه یا تلاش دومش باشه، جواب‌ها رو نشون بده
      const shouldShowAnswers = scoreData.passed || attemptCount >= 2;
      setShowAnswersInSummary(shouldShowAnswers);
      await setValue("showAnswersInSummary", shouldShowAnswers);

      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    // منطق مرحله summary
    if (isSummaryStep) {
      // بار اول مردود شده: باید آزمون را دوباره بدهد
      if (!scoreData.passed && attemptCount === 1) {
        const nextAttempt = 2;

        setAttemptCount(nextAttempt);
        setCurrentQuestionIndex(0);
        setIdx(1); // برگشت به استپ quiz
        setShowAnswersInSummary(false);

        await saveDraft({
          values: {
            ...draft.values,
            answers: {},
            audioCompleted,
            currentStepIndex: 1,
            attemptCount: nextAttempt,
            showAnswersInSummary: false,
          },
        });

        setAnswers({});
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        return;
      }

      // تلاش دوم یا قبول شدن: اجازه ثبت نهایی
      if (isTaskAlreadyCompleted) return;

      await saveDraft({
        values: {
          answers,
          audioCompleted,
          currentStepIndex: idx,
          currentQuestionIndex,
          completed: true,
          scorePercent: scoreData.percent,
          correctAnswersCount: scoreData.correctCount,
          passed: scoreData.passed,
          attemptCount,
          showAnswersInSummary: scoreData.passed || attemptCount >= 2,
        },
      });

      onComplete({
        answers,
        audioCompleted,
        scorePercent: scoreData.percent,
        correctAnswersCount: scoreData.correctCount,
        passed: scoreData.passed,
        attemptCount,
      });
    }
  };

  const goBack = () => {
    // اگر داخل مرحله سوالات هستیم و سوال قبلی وجود دارد
    if (isQuizStep && currentQuestionIndex > 0) {
      const prevQuestionIndex = currentQuestionIndex - 1;
      setCurrentQuestionIndex(prevQuestionIndex);
      void setValue("currentQuestionIndex", prevQuestionIndex);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    // اگر روی اولین سوال هستیم، برگرد به استپ قبلی
    if (idx <= 0) return;

    const prevIndex = idx - 1;
    setIdx(prevIndex);
    saveCurrentStepIndex(prevIndex);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const activateAudio = (key: string) => {
    setActiveAudioKey(key);
    setExpandedAudioKey(key);
  };

  const deactivateAudio = (key: string) => {
    setActiveAudioKey((prev) => (prev === key ? null : prev));
    setExpandedAudioKey((prev) => (prev === key ? null : prev));
  };

  const handleNoteFocus = () => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 300);
  };

  if (!isValidTask) {
    return null;
  }

  if (loading || !draftLoaded) {
    return (
      <ScreenLayout title={task.effectiveTitleFa}>
        <View style={styles.loadingBox}>
          <Text style={styles.loadingText}>در حال آماده‌سازی...</Text>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout title={task.effectiveTitleFa}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <View style={styles.pillsContainer}>
          {[...STEPS].reverse().map((step, reverseIndex) => {
            const realIndex = STEPS.length - 1 - reverseIndex;

            return (
              <View
                key={step.key}
                style={[
                  styles.pill,
                  realIndex === idx && styles.activePill,
                  realIndex < idx && styles.donePill,
                ]}
              />
            );
          })}
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 120 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {isAudioStep && (
            <View style={styles.mainCard}>
              <View style={styles.headerSection}>
                <Text style={[styles.cardTitle, { color: palette.gold }]}>
                  {currentStep.label}
                </Text>
              </View>

              <View style={styles.instructionSection}>
                <Text style={styles.instructionText}>{currentStep.hint}</Text>
              </View>

              <View style={styles.contentSection}>
                {resolvedAudioUrl ? (
                  <SharedInlineAudioPlayer
                    url={resolvedAudioUrl}
                    storageKey={audioStorageKey}
                    onProgress={(p) => setAudioProgress(p)}
                    expanded={expandedAudioKey === audioStorageKey}
                    isActive={activeAudioKey === audioStorageKey}
                    onPlayRequest={() => activateAudio(audioStorageKey)}
                    onPauseRequest={() => deactivateAudio(audioStorageKey)}
                    onPlaybackFinish={() => {
                      deactivateAudio(audioStorageKey);
                      void handleAudioComplete();
                    }}
                    palette={{
                      border2: palette.border,
                      text: palette.text,
                      sub2: palette.sub,
                      gold: palette.gold,
                      glass2: palette.cardStrong,
                    }}
                  />
                ) : (
                  <View style={styles.warningBox}>
                    <Text style={styles.warningText}>
                      فایل صوتی برای این مرحله پیدا نشد.
                    </Text>
                  </View>
                )}

                {audioCompleted && (
                  <View style={styles.doneBadge}>
                    <Text style={styles.doneBadgeText}>
                      پخش فایل صوتی انجام شد
                    </Text>
                  </View>
                )}

                {requireAudioCompleted && !audioCompleted && (
                  <Text style={styles.helperText}>
                    برای رفتن به مرحله بعد باید فایل صوتی رو تا انتها گوش بدی.
                  </Text>
                )}
              </View>
              {/* بخش یادداشت برداری */}
              <View style={{ marginTop: 20 }}>
                <Text
                  style={[
                    styles.summaryKey,
                    { marginBottom: 8, textAlign: "center" },
                  ]}
                >
                  نکات مهم فایل آموزشی:
                </Text>
                <TextInput
                  style={{
                    backgroundColor: "rgba(255,255,255,0.05)",
                    borderRadius: 12,
                    padding: 12,
                    color: palette.text,
                    textAlign: "right",
                    minHeight: 100,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.1)",
                    verticalAlign: "top",
                  }}
                  placeholder="نکات مهم رو حین گوش کردن اینجا بنویس..."
                  placeholderTextColor={palette.sub}
                  multiline
                  value={notes}
                  onChangeText={setNotes}
                  onFocus={handleNoteFocus}
                />
              </View>
              <AppBannerModal
                visible={showAudioWarning}
                kind="warning"
                title="نکته مهم"
                message="آگاهی، اولین و مهم‌ترین قدم برای عبور از رنج و رشد فردیه. این آموزش‌ها ابزار تو برای بازسازی دوباره‌ تو هستن؛ پس با تمرکز کامل تا انتها فایل رو گوش بده چون سوالات آزمون از دلِ همین نکات طراحی شدن."
                onClose={() => setShowAudioWarning(false)}
              />
            </View>
          )}

          {isQuizStep && questions.length > 0 && (
            <View style={styles.mainCard}>
              <View style={styles.headerSection}>
                <Text style={[styles.cardTitle, { color: palette.gold }]}>
                  سوال {currentQuestionIndex + 1} از {questions.length}
                </Text>
              </View>

              <View style={styles.contentSection}>
                <View style={styles.questionCard}>
                  <Text style={styles.questionPrompt}>
                    {questions[currentQuestionIndex].prompt}
                  </Text>

                  <View style={styles.optionsWrap}>
                    {questions[currentQuestionIndex].options.map((option) => {
                      const selected =
                        answers[questions[currentQuestionIndex].id] ===
                        option.id;

                      return (
                        <TouchableOpacity
                          key={option.id}
                          style={[
                            styles.optionBtn,
                            selected && styles.optionBtnSelected,
                          ]}
                          onPress={() =>
                            void handleSelectAnswer(
                              questions[currentQuestionIndex].id,
                              option.id,
                            )
                          }
                          activeOpacity={0.9}
                        >
                          <Text
                            style={[
                              styles.optionText,
                              selected && styles.optionTextSelected,
                            ]}
                          >
                            {option.text}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>
            </View>
          )}

          {isSummaryStep && (
            <View style={styles.mainCard}>
              <View style={styles.headerSection}>
                <Text style={[styles.cardTitle, { color: palette.gold }]}>
                  {currentStep.label}
                </Text>
              </View>

              <View style={styles.instructionSection}>
                <Text style={styles.instructionText}>{currentStep.hint}</Text>
              </View>

              <View style={styles.contentSection}>
                {!scoreData.passed && attemptCount === 1 && (
                  <View style={styles.retryInfoBox}>
                    <Text style={styles.retryInfoTitle}>
                      نتیجه آزمون به حدنصاب نرسید
                    </Text>
                    <Text style={styles.retryInfoText}>
                      لطفاً یک بار دیگه آزمون رو با دقت بیشتری انجام بده و به
                      سوال‌ها با تمرکز جواب بده.
                      {"\n\n"}
                      اگر در تلاش بعدی هم قبول نشی، پاسخ درست سوال‌ها بهت نمایش
                      داده می‌شه و می‌تونی از این مرحله عبور کنی.
                    </Text>
                  </View>
                )}

                <View style={styles.summaryBox}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryKey}>گوش دادن به فایل صوتی</Text>
                    <Text style={styles.summaryVal}>
                      {audioCompleted ? "انجام شده" : "انجام نشده"}
                    </Text>
                  </View>

                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryKey}>تعداد پاسخ صحیح</Text>
                    <Text style={styles.summaryVal}>
                      {`${scoreData.correctCount} از ${totalQuestions}`}
                    </Text>
                  </View>

                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryKey}>درصد نتیجه</Text>
                    <Text
                      style={styles.summaryVal}
                    >{`${scoreData.percent}%`}</Text>
                  </View>

                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryKey}>حداقل درصد قبولی</Text>
                    <Text style={styles.summaryVal}>
                      {`${passingScorePercent}%`}
                    </Text>
                  </View>

                  <View style={styles.summaryItemNoBorder}>
                    <Text style={styles.summaryKey}>وضعیت</Text>
                    <Text
                      style={[
                        styles.summaryVal,
                        scoreData.passed
                          ? styles.successText
                          : styles.errorText,
                      ]}
                    >
                      {scoreData.passed ? "قبول شده" : "نیاز به تلاش بیشتر"}
                    </Text>
                  </View>
                </View>

                {questions.length > 0 && showAnswersInSummary && (
                  <View style={styles.summaryBox}>
                    <Text
                      style={[
                        styles.cardTitle,
                        { color: palette.gold, fontSize: 18, marginBottom: 16 },
                      ]}
                    >
                      پاسخ درست سوالات
                    </Text>

                    {questions.map((question, index) => {
                      const correctOption = question.options.find(
                        (option) => option.id === question.correctOptionId,
                      );

                      const selectedOption = question.options.find(
                        (option) => option.id === answers[question.id],
                      );

                      const isCorrect =
                        answers[question.id] === question.correctOptionId;

                      return (
                        <View
                          key={question.id}
                          style={{
                            marginBottom: 16,
                            paddingBottom: 16,
                            borderBottomWidth:
                              index === questions.length - 1 ? 0 : 1,
                            borderBottomColor: "rgba(255,255,255,0.06)",
                            alignItems: "flex-end",
                          }}
                        >
                          <Text style={styles.summaryKey}>
                            سوال {index + 1}
                          </Text>

                          <Text style={styles.summaryVal}>
                            {question.prompt}
                          </Text>

                          <Text
                            style={[
                              styles.summaryVal,
                              { color: palette.sub, marginTop: 6 },
                            ]}
                          >
                            پاسخ شما: {selectedOption?.text ?? "بدون پاسخ"}
                          </Text>

                          <Text
                            style={[
                              styles.summaryVal,
                              {
                                marginTop: 6,
                                color: palette.gold,
                                fontWeight: "900",
                              },
                            ]}
                          >
                            پاسخ درست: {correctOption?.text ?? "-"}
                          </Text>

                          <Text
                            style={[
                              styles.summaryVal,
                              {
                                marginTop: 6,
                                color: isCorrect ? "#2FBF71" : "#FF6B6B",
                                fontWeight: "700",
                              },
                            ]}
                          >
                            {isCorrect
                              ? "پاسخ شما درست بوده"
                              : "پاسخ شما نادرست بوده"}
                          </Text>

                          {question.explanation ? (
                            <Text
                              style={[
                                styles.summaryVal,
                                { marginTop: 8, color: "#7CB8FF" },
                              ]}
                            >
                              توضیح: {question.explanation}
                            </Text>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>
          )}
        </ScrollView>

        <View style={[styles.footer, { bottom: insets.bottom + 20 }]}>
          {idx > 0 && (
            <TouchableOpacity style={styles.backBtn} onPress={goBack}>
              <Text style={styles.backBtnText}>{backButtonLabel}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.nextBtn,
              (!canGoNext || (isLastStep && isTaskAlreadyCompleted)) &&
                styles.disabledBtn,
            ]}
            onPress={goNext}
            disabled={!canGoNext || (isLastStep && isTaskAlreadyCompleted)}
          >
            <Text style={styles.nextBtnText}>
              {isLastStep && isTaskAlreadyCompleted
                ? "این مرحله قبلاً ثبت شده"
                : resolvedNextButtonLabel}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  loadingText: {
    color: palette.sub,
    fontSize: 15,
    textAlign: "center",
  },

  pillsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 20,
  },

  pill: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(126,217,87,0.22)",
  },

  activePill: {
    backgroundColor: "#7ED957",
  },

  donePill: {
    backgroundColor: "#2FBF71",
  },

  scrollContent: {
    padding: 24,
    alignItems: "center",
  },

  mainCard: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
    marginTop: 10,
  },

  headerSection: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
  },

  cardTitle: {
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },

  instructionSection: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.02)",
  },

  instructionText: {
    fontSize: 15,
    lineHeight: 24,
    color: "#7CB8FF",
    textAlign: "center",
  },

  contentSection: {
    padding: 20,
    gap: 16,
  },

  warningBox: {
    width: "100%",
    backgroundColor: "rgba(255,107,107,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,107,107,0.30)",
    borderRadius: 16,
    padding: 14,
  },

  warningText: {
    color: "#FFB4B4",
    textAlign: "center",
    fontSize: 14,
    lineHeight: 22,
  },

  doneBadge: {
    alignSelf: "center",
    backgroundColor: "rgba(212,175,55,0.14)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  doneBadgeText: {
    color: palette.gold,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },

  helperText: {
    color: palette.sub,
    fontSize: 13,
    textAlign: "right",
    lineHeight: 22,
    width: "100%",
  },

  questionCard: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 14,
  },

  questionTitle: {
    color: palette.gold,
    fontSize: 14,
    fontWeight: "900",
    textAlign: "right",
  },

  questionPrompt: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "right",
    lineHeight: 24,
  },

  optionsWrap: {
    gap: 10,
  },

  optionBtn: {
    width: "100%",
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.03)",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  optionBtnSelected: {
    backgroundColor: "rgba(212,175,55,0.16)",
    borderColor: "rgba(212,175,55,0.45)",
  },

  optionText: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "right",
    lineHeight: 22,
  },

  optionTextSelected: {
    color: palette.gold,
  },

  footer: {
    position: "absolute",
    left: 20,
    right: 20,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
  },

  backBtn: {
    flex: 1,
    height: 60,
    borderRadius: 20,
    backgroundColor: palette.cardStrong,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: palette.border,
  },

  backBtnText: {
    color: palette.text,
    fontSize: 16,
  },

  nextBtn: {
    flex: 2,
    height: 60,
    borderRadius: 20,
    backgroundColor: palette.gold,
    alignItems: "center",
    justifyContent: "center",
  },

  nextBtnText: {
    color: palette.bg,
    fontSize: 18,
    fontWeight: "bold",
  },

  disabledBtn: {
    opacity: 0.5,
  },

  summaryBox: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  summaryItem: {
    marginBottom: 14,
    alignItems: "flex-end",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },

  summaryItemNoBorder: {
    alignItems: "flex-end",
  },

  summaryKey: {
    color: palette.gold,
    fontWeight: "bold",
    fontSize: 14,
    marginBottom: 4,
  },

  summaryVal: {
    color: palette.text,
    fontSize: 16,
    textAlign: "right",
    lineHeight: 24,
  },

  successText: {
    color: "#2FBF71",
    fontWeight: "900",
  },

  errorText: {
    color: "#FF6B6B",
    fontWeight: "900",
  },
  retryInfoBox: {
    width: "100%",
    backgroundColor: "rgba(255, 193, 7, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(255, 193, 7, 0.28)",
    borderRadius: 16,
    padding: 14,
    marginTop: 16,
  },

  retryInfoTitle: {
    color: palette.gold,
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 8,
  },

  retryInfoText: {
    color: palette.text,
    fontSize: 14,
    lineHeight: 24,
    textAlign: "right",
  },
});
