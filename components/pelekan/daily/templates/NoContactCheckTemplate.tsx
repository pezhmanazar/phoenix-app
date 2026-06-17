import { ScreenLayout } from "@/components/ScreenLayout";
import { palette } from "@/constants/theme/palette";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
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

import { useLocalTaskDraft } from "../useLocalTaskDraft";

import type {
  NoContactEmotionalGuidance,
  NoContactEventType,
  NoContactFlowStatus,
  NoContactFlowStep,
  NoContactGuidanceContent,
  NoContactQuestion,
  NoContactQuestionOption,
  ResolvedTask,
} from "../types";

type Props = {
  task: ResolvedTask<"no_contact_check">;
  dayCode: string;
  onComplete: (data?: {
    noContactEventType: NoContactEventType;
    noContactNote?: string;
  }) => void | Promise<void>;
  onBackToDailyTasks?: () => void;
  submissionResult?: Record<string, unknown> | null;
};

type AnswerValue = string | string[];

type AnswersMap = Record<string, AnswerValue>;

type NoContactDraftValues = {
  currentStepIndex?: number;
  selected?: NoContactEventType | null;
  answers?: AnswersMap;
  note?: string;
  finalCommitments?: Record<number, boolean>;
  guidanceCommitments?: Record<number, boolean>;
};

function mapEventTypeToStatus(
  value: NoContactEventType | null,
): NoContactFlowStatus | null {
  if (value === "none") return "no_contact";
  if (value === "role_based") return "necessary_contact";
  if (value === "emotional") return "emotional_contact";
  return null;
}

export default function NoContactCheckTemplate({
  task,
  dayCode,
  onComplete,
  onBackToDailyTasks,
  submissionResult,
}: Props) {
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const meta = task.config.meta;

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selected, setSelected] = useState<NoContactEventType | null>(null);
  const [answers, setAnswers] = useState<AnswersMap>({});
  const [note, setNote] = useState("");
  const [finalCommitments, setFinalCommitments] = useState<
    Record<number, boolean>
  >({});
  const [guidanceCommitments, setGuidanceCommitments] = useState<
    Record<number, boolean>
  >({});
  const [resultCommitments, setResultCommitments] = useState<
    Record<number, boolean>
  >({});
  const [submitting, setSubmitting] = useState(false);

  const draft = useLocalTaskDraft(dayCode, task.config.code);
  const draftValues = useMemo(() => {
    return (draft.draft.values ?? {}) as NoContactDraftValues;
  }, [draft.draft.values]);

  const taskRecord = task as ResolvedTask<"no_contact_check"> & {
    status?: string;
    completedAt?: string | null;
    backendTask?: {
      isDone?: boolean;
    } | null;
  };

  const hasSubmissionResult = !!submissionResult;
  const showSubmissionResultScreen = hasSubmissionResult;

  const isTaskAlreadyCompleted =
    taskRecord.status === "done" ||
    taskRecord.status === "completed" ||
    !!taskRecord.backendTask?.isDone;

  const isReadOnlyReview =
    isTaskAlreadyCompleted && !showSubmissionResultScreen;

  const showPendingEmotionalStreakNotice =
    !hasSubmissionResult && selected === "emotional";

  const warningState =
    typeof submissionResult?.warningState === "string"
      ? submissionResult.warningState
      : null;

  const backendNoContactStreak = task.backendTask?.noContactStreak ?? null;

  const taskStreakCurrentDays =
    backendNoContactStreak &&
    typeof backendNoContactStreak.currentDays === "number" &&
    Number.isFinite(backendNoContactStreak.currentDays)
      ? backendNoContactStreak.currentDays
      : null;

  const submissionStreakCurrentDays =
    typeof submissionResult?.streakCurrentDays === "number" &&
    Number.isFinite(submissionResult.streakCurrentDays)
      ? submissionResult.streakCurrentDays
      : submissionResult?.noContactStreak &&
          typeof submissionResult.noContactStreak === "object" &&
          "currentDays" in submissionResult.noContactStreak &&
          typeof submissionResult.noContactStreak.currentDays === "number" &&
          Number.isFinite(submissionResult.noContactStreak.currentDays)
        ? submissionResult.noContactStreak.currentDays
        : typeof submissionResult?.currentDays === "number" &&
            Number.isFinite(submissionResult.currentDays)
          ? submissionResult.currentDays
          : null;

  const streakCurrentDays =
    submissionStreakCurrentDays !== null
      ? submissionStreakCurrentDays
      : taskStreakCurrentDays;

  const displayedResultStreakDays = streakCurrentDays ?? 0;


  const wasReset =
    typeof submissionResult?.reset === "boolean"
      ? submissionResult.reset
      : false;

  
  const stepFlow = useMemo<NoContactFlowStep[]>(() => {
    return meta?.steps ?? [];
  }, [meta?.steps]);

  const currentStep = stepFlow[currentStepIndex] ?? null;

  useEffect(() => {
    if (draft.loading) return;

    setCurrentStepIndex(draftValues.currentStepIndex ?? 0);
    setSelected(draftValues.selected ?? null);
    setAnswers(draftValues.answers ?? {});
    setNote(draftValues.note ?? "");
    setFinalCommitments(draftValues.finalCommitments ?? {});
    setGuidanceCommitments(draftValues.guidanceCommitments ?? {});
  }, [draft.loading, draftValues]);

  const selectedOption = useMemo(() => {
    return (
      (meta?.options ?? []).find((option) => option.key === selected) ?? null
    );
  }, [meta?.options, selected]);

  const selectedStatus = useMemo<NoContactFlowStatus | null>(() => {
    return mapEventTypeToStatus(selected);
  }, [selected]);

  const questionsForStatus = useMemo<NoContactQuestion[]>(() => {
    if (!selectedStatus || !meta?.questionsByStatus) return [];
    return meta.questionsByStatus[selectedStatus] ?? [];
  }, [meta?.questionsByStatus, selectedStatus]);

  const visibleQuestions = useMemo<NoContactQuestion[]>(() => {
    return questionsForStatus.filter((question) => {
      if (!question.showIf) return true;

      const answer = answers[question.showIf.questionId];

      if (Array.isArray(answer)) {
        return answer.includes(question.showIf.equals);
      }

      return answer === question.showIf.equals;
    });
  }, [questionsForStatus, answers]);

  const activeGuidance = useMemo<NoContactGuidanceContent | null>(() => {
    if (!selectedStatus || !meta?.guidanceByStatus) return null;

    if (selectedStatus === "no_contact") {
      return meta.guidanceByStatus.no_contact ?? null;
    }

    if (selectedStatus === "necessary_contact") {
      return meta.guidanceByStatus.necessary_contact ?? null;
    }

    const guidance: NoContactEmotionalGuidance | undefined =
      meta.guidanceByStatus.emotional_contact;

    if (!guidance) return null;

    if (guidance.useBackendResult) {
      if (wasReset && guidance.reset) {
        return guidance.reset;
      }

      if (warningState === "serious_warning" && guidance.serious_warning) {
        return guidance.serious_warning;
      }

      if (warningState === "promise_required" && guidance.promise_required) {
        return guidance.promise_required;
      }
    }

    return guidance.fallback;
  }, [meta?.guidanceByStatus, selectedStatus, warningState, wasReset]);

  const finalStep = meta?.finalStep;

  const isEmotionalResult =
    selected === "emotional" ||
    warningState === "promise_required" ||
    warningState === "serious_warning" ||
    wasReset;

  const showEmotionalSubmissionResult =
    showSubmissionResultScreen && isEmotionalResult;

  const showNonEmotionalSubmissionResult =
    showSubmissionResultScreen && !isEmotionalResult;

  const emotionalResultTitle = wasReset
    ? "استمرار قطع ارتباط تو شکسته شد"
    : warningState === "serious_warning"
      ? "این دومین لغزش جدی توئه"
      : warningState === "promise_required"
        ? "امروز یک لغزش ثبت شد، اما هنوز شکست کامل اتفاق نیفتاده"
        : "";

  const emotionalResultMessage = wasReset
    ? "این اتفاق نباید می‌افتاد، اما حالا که افتاده، خطر بزرگ‌تر اینه که بگی «دیگر خراب شد» و چند روز پشت‌سرهم ادامه بدی.\nشکست واقعی این نیست که امروز لغزیدی؛ شکست واقعی اینه که از فردا دوباره شروع نکنی."
    : warningState === "serious_warning"
      ? "هنوز فرصت داری جلوی شکستن کامل استمرار رو بگیری، اما دیگه نباید با این موضوع ساده برخورد کنی.\nهر بار ارتباط هیجانی، مغزت رو دوباره به همون چرخه وابستگی برمی‌گردونه.\nامروز امتیاز این اقدام به تو تعلق نمی‌گیره."
      : warningState === "promise_required"
        ? "مهم‌ترین کار الان این نیست که خودت رو له کنی؛ مهم‌ترین کار اینه که همین‌جا زنجیره لغزش رو قطع کنی.\nامروز امتیاز این اقدام به تو تعلق نمی‌گیره، اما استمرار تو فعلاً حفظ شده."
        : "";

  const emotionalResultStreakText = wasReset
    ? "شمارنده استمرار تو از نو شروع می‌شه.\nامروز نقطه شروع دوباره‌ست."
    : warningState === "serious_warning"
      ? `تو هنوز در روز ${streakCurrentDays ?? 0} استمرار هستی، اما این استمرار در خطر جدیه.`
      : warningState === "promise_required"
        ? `تو هنوز در روز ${streakCurrentDays ?? 0} استمرار قطع ارتباط هستی.\nاین فرصت رو جدی بگیر.`
        : "";

  const pendingEmotionalStreakLabel =
    "وضعیت استمرار تو تا قبل از این ارتباط هیجانی:";

  const pendingEmotionalStreakValue =
    typeof streakCurrentDays === "number"
      ? `${streakCurrentDays} روز`
      : "خطا در دریافت اطلاعات";

  const emotionalResultCommitments = wasReset
    ? [
        "قبول دارم که استمرارم شکسته شد، اما درمانم تموم نشده.",
        "از همین امروز دوباره شروع می‌کنم، نه از هفته بعد و نه بعد از یک لغزش دیگه.",
        "تا ۲۴ ساعت آینده هیچ ارتباط یا چک‌کردن هیجانی انجام نمی‌دم.",
        "محرک اصلی لغزش امروز رو جدی می‌گیرم و براش برنامه می‌ذارم.",
        "اگه دوباره وسوسه شدم، قبل از هر اقدامی از ابزارهای کمکی ققنوس استفاده می‌کنم.",
      ]
    : warningState === "serious_warning"
      ? [
          "می‌پذیرم که ادامه این رفتار، استمرارم رو می‌شکنه.",
          "تا ۲۴ ساعت آینده هیچ نوع پیام، تماس، چک‌کردن یا پیگیری انجام نمی‌دم.",
          "اگه تحریک شدم، گوشی رو از دسترسم خارج می‌کنم یا محیطم رو عوض می‌کنم.",
          "به خودم اجازه نمی‌دم با بهونه‌هایی مثل «فقط ببینم حالش چطوره» وارد چرخه اشتباه بشم.",
          "اگه لازم شد، از یک آدم امن یا تکنیک‌های پناهگاه کمک می‌گیرم، نه از رابطه قبلی.",
        ]
      : warningState === "promise_required"
        ? [
            "قبول دارم این ارتباط از روی نیاز عاطفی یا هیجانی بود، نه ضرورت واقعی.",
            "قول می‌دم امروز دوباره پیام، تماس، چک‌کردن یا پیگیری انجام ندم.",
            "اگه موج دلتنگی برگشت، قبل از هر اقدامی ۱۰ دقیقه صبر می‌کنم.",
            "به جای رفتن سمتش، احساساتم رو داخل برنامه یا روی کاغذ تخلیه می‌کنم.",
            "می‌پذیرم که آرامش کوتاه‌مدت، ارزش خراب‌کردن روند درمانم رو نداره.",
          ]
        : [];

  const toggleResultCommitment = (index: number) => {
    if (submitting) return;

    setResultCommitments((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const requiresResultCommitments =
    showEmotionalSubmissionResult && emotionalResultCommitments.length > 0;

  const allResultCommitmentsChecked =
    !requiresResultCommitments ||
    emotionalResultCommitments.every((_, index) => !!resultCommitments[index]);

  const isResultBackButtonDisabled =
    requiresResultCommitments && !allResultCommitmentsChecked;

  const handleBackToDailyTasks = () => {
    if (showEmotionalSubmissionResult && isResultBackButtonDisabled) return;
    onBackToDailyTasks?.();
  };

  const submitLabel = useMemo(() => {
    if (isTaskAlreadyCompleted) return "این مرحله قبلاً ثبت شده";
    if (submitting) return "";
    return finalStep?.submitLabel || meta?.submitLabel || "ثبت";
  }, [
    isTaskAlreadyCompleted,
    submitting,
    finalStep?.submitLabel,
    meta?.submitLabel,
  ]);

  const encouragementText = useMemo(() => {
    if (!selected || !meta?.encouragements) return "";

    if (selected === "none") return meta.encouragements.safe || "";
    if (selected === "role_based") return meta.encouragements.roleBased || "";
    if (selected === "emotional") return meta.encouragements.relapse || "";

    return "";
  }, [selected, meta?.encouragements]);

  const scrollToTop = () => {
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({
        y: 0,
        animated: false,
      });
    });
  };

  useEffect(() => {
    if (!showSubmissionResultScreen) return;
    scrollToTop();
  }, [showSubmissionResultScreen]);

  const saveDraft = (nextValues: Partial<NoContactDraftValues>) => {
    if (isTaskAlreadyCompleted) return;

    void draft.saveDraft({
      values: {
        ...draftValues,
        currentStepIndex,
        selected,
        answers,
        note,
        finalCommitments,
        guidanceCommitments,
        ...nextValues,
      },
    });
  };

  const handleSelect = (key: NoContactEventType) => {
    if (submitting || isTaskAlreadyCompleted) return;

    setSelected(key);
    setAnswers({});
    setNote("");
    setGuidanceCommitments({});
    setResultCommitments({});
    setFinalCommitments({});

    saveDraft({
      selected: key,
      answers: {},
      note: "",
      guidanceCommitments: {},
      finalCommitments: {},
      currentStepIndex,
    });

    scrollToTop();
  };

  const clearDependentAnswers = (
    nextAnswers: AnswersMap,
    changedQuestionId: string,
    changedValue: AnswerValue,
  ) => {
    questionsForStatus.forEach((question) => {
      if (question.showIf?.questionId !== changedQuestionId) return;

      const shouldKeep = Array.isArray(changedValue)
        ? changedValue.includes(question.showIf.equals)
        : question.showIf.equals === changedValue;

      if (!shouldKeep) {
        delete nextAnswers[question.id];
      }
    });
  };

  const handleAnswerSelect = (questionId: string, value: string) => {
    if (submitting || isTaskAlreadyCompleted) return;

    setAnswers((prev) => {
      const next = { ...prev, [questionId]: value };
      clearDependentAnswers(next, questionId, value);

      saveDraft({
        answers: next,
      });

      return next;
    });
  };

  const handleAnswerMultiSelect = (questionId: string, value: string) => {
    if (submitting || isTaskAlreadyCompleted) return;

    setAnswers((prev) => {
      const currentValue = prev[questionId];
      const currentValues = Array.isArray(currentValue) ? currentValue : [];

      const nextValues = currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value];

      const next = {
        ...prev,
        [questionId]: nextValues,
      };

      clearDependentAnswers(next, questionId, nextValues);

      saveDraft({
        answers: next,
      });

      return next;
    });
  };

  const handleTextAnswerChange = (questionId: string, value: string) => {
    if (submitting || isTaskAlreadyCompleted) return;

    setAnswers((prev) => {
      const next = {
        ...prev,
        [questionId]: value,
      };

      saveDraft({
        answers: next,
      });

      return next;
    });
  };

  const getTextAnswerValue = (questionId: string): string => {
    const value = answers[questionId];

    if (typeof value === "string") {
      return value;
    }

    return "";
  };

  const handleNoteChange = (value: string) => {
    if (submitting || isTaskAlreadyCompleted) return;

    setNote(value);
    saveDraft({
      note: value,
    });
  };

  const toggleGuidanceCommitment = (index: number) => {
    if (submitting || isTaskAlreadyCompleted) return;

    setGuidanceCommitments((prev) => {
      const next = {
        ...prev,
        [index]: !prev[index],
      };

      saveDraft({
        guidanceCommitments: next,
      });

      return next;
    });
  };

  const toggleFinalCommitment = (index: number) => {
    if (submitting || isTaskAlreadyCompleted) return;

    setFinalCommitments((prev) => {
      const next = {
        ...prev,
        [index]: !prev[index],
      };

      saveDraft({
        finalCommitments: next,
      });

      return next;
    });
  };

  const areQuestionsValid = useMemo(() => {
    if (!visibleQuestions.length) return true;

    return visibleQuestions.every((question) => {
      if (!question.required) return true;

      const value = answers[question.id];

      if (question.type === "text") {
        return typeof value === "string" && !!value.trim();
      }

      if (question.type === "multi_select") {
        return Array.isArray(value) && value.length > 0;
      }

      return typeof value === "string" && !!value;
    });
  }, [visibleQuestions, answers]);

  const isNoteValid = useMemo(() => {
    if (!meta?.noteField?.required) return true;
    return !!note.trim();
  }, [meta?.noteField?.required, note]);

  const areGuidanceCommitmentsValid = useMemo(() => {
    const commitments = activeGuidance?.commitments ?? [];
    if (!commitments.length) return true;

    return commitments.every((_, index) => !!guidanceCommitments[index]);
  }, [activeGuidance, guidanceCommitments]);

  const areFinalCommitmentsValid = useMemo(() => {
    const commitments = finalStep?.commitments ?? [];
    if (!commitments.length) return true;

    return commitments.every((_, index) => !!finalCommitments[index]);
  }, [finalStep?.commitments, finalCommitments]);

  const canGoNext = useMemo(() => {
    if (showSubmissionResultScreen) return false;
    if (isTaskAlreadyCompleted) return false;
    if (!currentStep) return false;

    if (currentStep.key === "status") {
      return !!selected;
    }

    if (currentStep.key === "questions") {
      return areQuestionsValid && isNoteValid;
    }

    if (currentStep.key === "guidance") {
      return areGuidanceCommitmentsValid;
    }

    return false;
  }, [
    showSubmissionResultScreen,
    isTaskAlreadyCompleted,
    currentStep,
    selected,
    areQuestionsValid,
    isNoteValid,
    areGuidanceCommitmentsValid,
  ]);

  const canSubmit = useMemo(() => {
    return (
      !!selected &&
      areQuestionsValid &&
      isNoteValid &&
      areFinalCommitmentsValid &&
      !submitting &&
      !isTaskAlreadyCompleted &&
      !showSubmissionResultScreen
    );
  }, [
    selected,
    areQuestionsValid,
    isNoteValid,
    areFinalCommitmentsValid,
    submitting,
    isTaskAlreadyCompleted,
    showSubmissionResultScreen,
  ]);

  const goNext = () => {
    if (currentStepIndex >= stepFlow.length - 1) return;
    if (!isTaskAlreadyCompleted && !canGoNext) return;

    const nextStepIndex = currentStepIndex + 1;

    setCurrentStepIndex(nextStepIndex);

    if (!isTaskAlreadyCompleted) {
      saveDraft({
        currentStepIndex: nextStepIndex,
      });
    }

    scrollToTop();
  };

  const goBack = () => {
    if (submitting) return;
    if (currentStepIndex <= 0) return;

    const nextStepIndex = currentStepIndex - 1;

    setCurrentStepIndex(nextStepIndex);

    if (!isTaskAlreadyCompleted) {
      saveDraft({
        currentStepIndex: nextStepIndex,
      });
    }

    scrollToTop();
  };

  const buildNotePayload = () => {
    const summary = {
      status: selectedStatus,
      selectedOptionKey: selected,
      selectedOptionLabel: selectedOption?.label ?? null,
      answers,
      freeNote: note.trim() || null,
    };

    return JSON.stringify(summary);
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();

    if (!canSubmit || !selected) return;

    try {
      setSubmitting(true);
      await draft.saveDraft({
        values: {
          currentStepIndex,
          selected,
          answers,
          note,
          finalCommitments,
          guidanceCommitments,
        },
      });

      await onComplete({
        noContactEventType: selected,
        noContactNote: buildNotePayload(),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const submittedEventType =
    typeof submissionResult?.noContactEventType === "string"
      ? submissionResult.noContactEventType
      : selected;

  const resultTitle = showEmotionalSubmissionResult
    ? "نتیجه امروز"
    : submittedEventType === "none"
      ? "استمرار امروزت ثبت شد"
      : submittedEventType === "role_based"
        ? "ثبت تماس ضروری انجام شد"
        : "نتیجه ثبت شد";

  const resultHint = showEmotionalSubmissionResult
    ? "نتیجه ثبت امروزت رو با دقت بخون."
    : " قبل از خروج، نتیجه استمرارت رو ببین.";

  const stepTitle = showSubmissionResultScreen
    ? resultTitle
    : currentStep?.label || "";

  const stepHint = showSubmissionResultScreen
    ? resultHint
    : currentStep?.hint || "";

  return (
    <ScreenLayout title={task.effectiveTitleFa}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        {!!stepFlow.length && !showSubmissionResultScreen && (
          <View style={styles.pillsContainer}>
            {[...stepFlow].reverse().map((step, reverseIndex) => {
              const realIndex = stepFlow.length - 1 - reverseIndex;

              return (
                <View
                  key={step.key}
                  style={[
                    styles.pill,
                    realIndex === currentStepIndex && styles.activePill,
                    realIndex < currentStepIndex && styles.donePill,
                  ]}
                />
              );
            })}
          </View>
        )}

        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 140 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.mainCard}>
            {(!!currentStep || showSubmissionResultScreen) && (
              <View
                style={[styles.instructionSection, styles.firstSectionNoBorder]}
              >
                <Text style={styles.stepTitle}>{stepTitle}</Text>
                {!!stepHint && <Text style={styles.stepHint}>{stepHint}</Text>}
              </View>
            )}

            <View style={styles.contentSection}>
              {!showSubmissionResultScreen && currentStep?.key === "status" && (
                <>
                  <View style={styles.optionsContainer}>
                    {(meta?.options ?? []).map((option) => {
                      const isSelected = selected === option.key;

                      return (
                        <TouchableOpacity
                          key={option.key}
                          activeOpacity={0.85}
                          style={[
                            styles.optionCard,
                            isSelected && styles.optionCardSelected,
                            isTaskAlreadyCompleted && styles.disabledOption,
                          ]}
                          onPress={() => handleSelect(option.key)}
                          disabled={submitting || isTaskAlreadyCompleted}
                        >
                          <View style={styles.optionHeader}>
                            <View
                              style={[
                                styles.radioOuter,
                                isSelected && styles.radioOuterSelected,
                              ]}
                            >
                              {isSelected && <View style={styles.radioInner} />}
                            </View>

                            <Text
                              style={[
                                styles.optionTitle,
                                isSelected && styles.optionTitleSelected,
                              ]}
                            >
                              {option.label}
                            </Text>
                          </View>

                          {!!option.helpText && (
                            <Text
                              style={[
                                styles.optionHelp,
                                isSelected && styles.optionHelpSelected,
                              ]}
                            >
                              {option.helpText}
                            </Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {!!selectedOption && (
                    <View style={styles.selectedSummaryBox}>
                      <Text style={styles.selectedSummaryLabel}>
                        انتخاب فعلی:
                      </Text>
                      <Text style={styles.selectedSummaryText}>
                        {selectedOption.label}
                      </Text>
                    </View>
                  )}

                  {!!encouragementText && (
                    <View
                      style={[
                        styles.encouragementBox,
                        selected === "emotional" && styles.relapseBox,
                        selected === "none" && styles.safeBox,
                        selected === "role_based" && styles.roleBasedBox,
                      ]}
                    >
                      <Text style={styles.encouragementText}>
                        {encouragementText}
                      </Text>
                    </View>
                  )}
                </>
              )}

              {!showSubmissionResultScreen &&
                currentStep?.key === "questions" && (
                  <>
                    {!selectedStatus ? (
                      <View style={styles.inlineNotice}>
                        <Text style={styles.inlineNoticeText}>
                          اول وضعیت امروز را مشخص کن.
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.questionsContainer}>
                        {visibleQuestions.map((question) => (
                          <View key={question.id} style={styles.questionCard}>
                            <Text style={styles.questionTitle}>
                              {question.title}
                              {question.required ? " *" : ""}
                            </Text>

                            {question.type === "single_select" && (
                              <View style={styles.questionOptionsContainer}>
                                {(question.options ?? []).map(
                                  (option: NoContactQuestionOption) => {
                                    const isSelected =
                                      answers[question.id] === option.value;

                                    return (
                                      <TouchableOpacity
                                        key={option.value}
                                        activeOpacity={0.85}
                                        style={[
                                          styles.questionOption,
                                          isSelected &&
                                            styles.questionOptionSelected,
                                        ]}
                                        onPress={() =>
                                          handleAnswerSelect(
                                            question.id,
                                            option.value,
                                          )
                                        }
                                        disabled={
                                          submitting || isTaskAlreadyCompleted
                                        }
                                      >
                                        <Text
                                          style={[
                                            styles.questionOptionText,
                                            isSelected &&
                                              styles.questionOptionTextSelected,
                                          ]}
                                        >
                                          {option.label}
                                        </Text>
                                      </TouchableOpacity>
                                    );
                                  },
                                )}
                              </View>
                            )}

                            {question.type === "multi_select" && (
                              <View style={styles.questionOptionsContainer}>
                                {(question.options ?? []).map(
                                  (option: NoContactQuestionOption) => {
                                    const currentValue = answers[question.id];
                                    const selectedValues = Array.isArray(
                                      currentValue,
                                    )
                                      ? currentValue
                                      : [];
                                    const isSelected = selectedValues.includes(
                                      option.value,
                                    );

                                    return (
                                      <TouchableOpacity
                                        key={option.value}
                                        activeOpacity={0.85}
                                        style={[
                                          styles.questionOption,
                                          isSelected &&
                                            styles.questionOptionSelected,
                                        ]}
                                        onPress={() =>
                                          handleAnswerMultiSelect(
                                            question.id,
                                            option.value,
                                          )
                                        }
                                        disabled={
                                          submitting || isTaskAlreadyCompleted
                                        }
                                      >
                                        <View
                                          style={styles.multiSelectOptionRow}
                                        >
                                          <View
                                            style={[
                                              styles.smallCheckbox,
                                              isSelected &&
                                                styles.smallCheckboxChecked,
                                            ]}
                                          >
                                            {isSelected && (
                                              <Text
                                                style={styles.smallCheckboxTick}
                                              >
                                                ✓
                                              </Text>
                                            )}
                                          </View>

                                          <Text
                                            style={[
                                              styles.questionOptionText,
                                              isSelected &&
                                                styles.questionOptionTextSelected,
                                            ]}
                                          >
                                            {option.label}
                                          </Text>
                                        </View>
                                      </TouchableOpacity>
                                    );
                                  },
                                )}
                              </View>
                            )}

                            {question.type === "text" && (
                              <TextInput
                                value={getTextAnswerValue(question.id)}
                                onChangeText={(value) =>
                                  handleTextAnswerChange(question.id, value)
                                }
                                placeholder={question.placeholder || ""}
                                placeholderTextColor="rgba(255,255,255,0.35)"
                                multiline
                                style={[
                                  styles.noteInput,
                                  isTaskAlreadyCompleted &&
                                    styles.disabledInput,
                                ]}
                                textAlign="right"
                                textAlignVertical="top"
                                editable={
                                  !submitting && !isTaskAlreadyCompleted
                                }
                              />
                            )}
                          </View>
                        ))}

                        {meta?.noteField && (
                          <View style={styles.noteContainer}>
                            {!!meta.noteField.label && (
                              <Text style={styles.noteLabel}>
                                {meta.noteField.label}
                                {meta.noteField.required ? " *" : ""}
                              </Text>
                            )}

                            <TextInput
                              value={note}
                              onChangeText={handleNoteChange}
                              placeholder={meta.noteField.placeholder || ""}
                              placeholderTextColor="rgba(255,255,255,0.35)"
                              multiline={meta.noteField.multiline ?? true}
                              style={[
                                styles.noteInput,
                                isTaskAlreadyCompleted && styles.disabledInput,
                              ]}
                              textAlign="right"
                              textAlignVertical="top"
                              editable={!submitting && !isTaskAlreadyCompleted}
                            />
                          </View>
                        )}
                      </View>
                    )}
                  </>
                )}

              {!showSubmissionResultScreen &&
                currentStep?.key === "guidance" && (
                  <>
                    {!!activeGuidance && (
                      <View style={styles.guidanceCard}>
                        {!!activeGuidance.message && (
                          <Text style={styles.guidanceMessage}>
                            {activeGuidance.message}
                          </Text>
                        )}
                        {showPendingEmotionalStreakNotice ? (
                          <>
                            <View style={styles.streakHeroBox}>
                              <Text style={styles.streakHeroLabel}>
                                {pendingEmotionalStreakLabel}
                              </Text>
                              <Text style={styles.streakHeroValue}>
                                {pendingEmotionalStreakValue}
                              </Text>
                            </View>

                            <View style={styles.pendingResultBox}>
                              <Text style={styles.pendingResultText}>
                                به دلیل وجود ارتباط هیجانی، وضعیت تعهدت بعد از
                                مرحله آخر مشخص میشه.
                              </Text>
                            </View>
                          </>
                        ) : (
                          !!activeGuidance.streakText && (
                            <View style={styles.streakHeroBox}>
                              <Text style={styles.streakHeroLabel}>
                                تعداد روزهایی که متعهد بودی:
                              </Text>
                              <Text style={styles.streakHeroValue}>
                              {typeof streakCurrentDays === "number"
                              ? `${streakCurrentDays} روز`
                              : "خطا در دریافت اطلاعات"}
                             </Text>
                            </View>
                          )
                        )}

                        {(activeGuidance.commitments ?? []).map(
                          (commitment, index) => {
                            const checked = !!guidanceCommitments[index];

                            return (
                              <TouchableOpacity
                                key={`${commitment}-${index}`}
                                activeOpacity={0.85}
                                style={styles.commitmentRow}
                                onPress={() => toggleGuidanceCommitment(index)}
                                disabled={submitting || isTaskAlreadyCompleted}
                              >
                                <View
                                  style={[
                                    styles.checkbox,
                                    checked && styles.checkboxChecked,
                                  ]}
                                >
                                  {checked && (
                                    <Text style={styles.checkboxTick}>✓</Text>
                                  )}
                                </View>

                                <Text style={styles.commitmentText}>
                                  {commitment}
                                </Text>
                              </TouchableOpacity>
                            );
                          },
                        )}

                        {!!activeGuidance.closingNote && (
                          <Text style={styles.guidanceClosing}>
                            {activeGuidance.closingNote}
                          </Text>
                        )}
                      </View>
                    )}
                  </>
                )}

              {!showSubmissionResultScreen && currentStep?.key === "final" && (
                <>
                  {!!finalStep && (
                    <View style={styles.guidanceCard}>
                      {!!finalStep.message && (
                        <Text style={styles.guidanceMessage}>
                          {finalStep.message}
                        </Text>
                      )}

                      {(finalStep.commitments ?? []).map(
                        (commitment, index) => {
                          const checked = !!finalCommitments[index];

                          return (
                            <TouchableOpacity
                              key={`${commitment}-${index}`}
                              activeOpacity={0.85}
                              style={styles.commitmentRow}
                              onPress={() => toggleFinalCommitment(index)}
                              disabled={submitting || isTaskAlreadyCompleted}
                            >
                              <View
                                style={[
                                  styles.checkbox,
                                  checked && styles.checkboxChecked,
                                ]}
                              >
                                {checked && (
                                  <Text style={styles.checkboxTick}>✓</Text>
                                )}
                              </View>

                              <Text style={styles.commitmentText}>
                                {commitment}
                              </Text>
                            </TouchableOpacity>
                          );
                        },
                      )}
                    </View>
                  )}
                </>
              )}

              {isReadOnlyReview && currentStepIndex === stepFlow.length - 1 && (
                <View style={styles.doneNotice}>
                  <Text style={styles.doneNoticeText}>
                    این اقدام قبلاً تکمیل شده.
                  </Text>
                </View>
              )}

              {showEmotionalSubmissionResult && (
                <View
                  style={[
                    styles.resultCard,
                    wasReset
                      ? styles.resultCardDanger
                      : warningState === "serious_warning"
                        ? styles.resultCardWarning
                        : styles.resultCardAlert,
                  ]}
                >
                  {!!emotionalResultTitle && (
                    <Text style={styles.resultTitle}>
                      {emotionalResultTitle}
                    </Text>
                  )}

                  {!!emotionalResultMessage && (
                    <Text style={styles.resultMessage}>
                      {emotionalResultMessage}
                    </Text>
                  )}

                  {!!emotionalResultStreakText && !wasReset && (
                    <View style={styles.streakHeroBox}>
                      <Text style={styles.streakHeroLabel}>
                        وضعیت استمرار تو
                      </Text>
                      <Text style={styles.streakHeroValue}>
                        {displayedResultStreakDays} روز
                      </Text>
                    </View>
                  )}

                  {!!emotionalResultCommitments.length && (
                    <View style={styles.resultCommitmentsBox}>
                      {emotionalResultCommitments.map((commitment, index) => {
                        const checked = !!resultCommitments[index];

                        return (
                          <TouchableOpacity
                            key={`${commitment}-${index}`}
                            activeOpacity={0.85}
                            style={styles.commitmentRow}
                            onPress={() => toggleResultCommitment(index)}
                          >
                            <View
                              style={[
                                styles.checkbox,
                                checked && styles.checkboxChecked,
                              ]}
                            >
                              {checked && (
                                <Text style={styles.checkboxTick}>✓</Text>
                              )}
                            </View>

                            <Text style={styles.commitmentText}>
                              {commitment}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                      {!allResultCommitmentsChecked && (
                        <Text style={styles.resultCommitmentHint}>
                          برای ادامه، همه تعهدها رو با آگاهی تیک بزن.
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              )}

              {showNonEmotionalSubmissionResult && (
                <View
                  style={[
                    styles.resultCard,
                    submittedEventType === "none"
                      ? styles.successResultCard
                      : styles.neutralResultCard,
                  ]}
                >
                  <Text style={styles.successResultEmoji}>
                    {submittedEventType === "none" ? "🔥" : "🛡️"}
                  </Text>

                  <Text
                    style={[
                      styles.successResultTitle,
                      submittedEventType === "none"
                        ? styles.successResultTitleSafe
                        : styles.successResultTitleRoleBased,
                    ]}
                  >
                    {submittedEventType === "none"
                      ? "آفرین، امروز هم زنجیره رو حفظ کردی"
                      : "تماس ضروری ثبت شد و مسیرت هنوز روشنه"}
                  </Text>

                  <Text style={styles.successResultMessage}>
                    {submittedEventType === "none"
                      ? "امروز بدون ارتباط، جلو رفتی و این یعنی استمرار تو فقط یک عدد نیست؛ یک تصمیم تکرارشونده عالیه."
                      : "این تماس از جنس ضرورت بوده و به معنی برگشت به چرخه عاطفی نیست. مهم اینه که مرزت رو نگه داری."}
                  </Text>

                  <View style={styles.streakHeroBox}>
                    <Text style={styles.streakHeroLabel}>استمرار فعلی تو</Text>
                    <Text
                      style={[
                        styles.streakHeroValue,
                        submittedEventType === "none"
                          ? styles.streakHeroValueSafe
                          : styles.streakHeroValueRoleBased,
                      ]}
                    >
                      {streakCurrentDays ?? 0} روز
                    </Text>
                  </View>

                  {true && (
                    <Text style={styles.successResultFooter}>
                      {submittedEventType === "none"
                        ? "همین‌طور ادامه بده. هر روزی که استمرارت رو حفظ می‌کنی، مغزت بیشتر از وابستگی فاصله می‌گیره."
                        : "با اینکه تماس ضروری بوده ولی ادامه مسیر یادت نره که فقط در حد ضرورت باهاش ارتباط برقرار کنی اون هم بدون بازکردن درِ ارتباط عاطفی."}
                    </Text>
                  )}
                </View>
              )}
              {showSubmissionResultScreen && (
                <View style={styles.resultActionsContainer}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[
                      styles.resultBackButton,
                      showEmotionalSubmissionResult &&
                        isResultBackButtonDisabled &&
                        styles.submitButtonDisabled,
                      showEmotionalSubmissionResult
                        ? wasReset
                          ? styles.resultBackButtonDanger
                          : warningState === "serious_warning"
                            ? styles.resultBackButtonWarning
                            : styles.resultBackButtonAlert
                        : submittedEventType === "none"
                          ? styles.resultBackButtonSuccess
                          : styles.resultBackButtonRoleBased,
                    ]}
                    onPress={handleBackToDailyTasks}
                    disabled={
                      showEmotionalSubmissionResult &&
                      isResultBackButtonDisabled
                    }
                  >
                    <Text style={styles.resultBackButtonText}>
                      {showEmotionalSubmissionResult
                        ? "خروج و بازگشت به لیست اقدامات روز"
                        : "خروج"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        {!isTaskAlreadyCompleted && !showSubmissionResultScreen && (
          <View style={[styles.footer, { bottom: insets.bottom + 20 }]}>
            <View style={styles.footerRow}>
              {currentStepIndex > 0 ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.secondaryButton}
                  onPress={goBack}
                  disabled={submitting}
                >
                  <Text style={styles.secondaryButtonText}>قبلی</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.secondaryButtonPlaceholder} />
              )}

              {currentStep?.key === "final" ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[
                    styles.submitButton,
                    !canSubmit && styles.submitButtonDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={!canSubmit}
                >
                  {submitting ? (
                    <ActivityIndicator color={palette.bg} />
                  ) : (
                    <Text style={styles.submitButtonText}>{submitLabel}</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[
                    styles.submitButton,
                    !canGoNext && styles.submitButtonDisabled,
                  ]}
                  onPress={goNext}
                  disabled={!canGoNext}
                >
                  <Text style={styles.submitButtonText}>ادامه</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {isTaskAlreadyCompleted && !hasSubmissionResult && (
          <View style={[styles.footer, { bottom: insets.bottom + 20 }]}>
            <View style={styles.footerRow}>
              {currentStepIndex > 0 ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.secondaryButton}
                  onPress={goBack}
                  disabled={submitting}
                >
                  <Text style={styles.secondaryButtonText}>قبلی</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.secondaryButtonPlaceholder} />
              )}

              {currentStepIndex < stepFlow.length - 1 ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.submitButton}
                  onPress={goNext}
                  disabled={submitting}
                >
                  <Text style={styles.submitButtonText}>ادامه مرور</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.secondaryButtonPlaceholder} />
              )}
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  instructionSection: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.02)",
  },

  stepTitle: {
    fontSize: 16,
    lineHeight: 24,
    color: "#7CB8FF",
    textAlign: "center",
    fontWeight: "800",
    marginBottom: 6,
  },

  stepHint: {
    fontSize: 13,
    lineHeight: 22,
    color: palette.sub,
    textAlign: "center",
  },

  contentSection: {
    padding: 20,
  },

  optionsContainer: {
    gap: 12,
    marginBottom: 18,
  },

  optionCard: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 18,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  optionCardSelected: {
    borderColor: palette.gold,
    backgroundColor: "rgba(212,175,55,0.12)",
  },

  disabledOption: {
    opacity: 0.7,
  },

  optionHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },

  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },

  radioOuterSelected: {
    borderColor: palette.gold,
  },

  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.gold,
  },

  optionTitle: {
    flex: 1,
    color: palette.text,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
  },

  optionTitleSelected: {
    color: palette.gold,
  },

  optionHelp: {
    color: palette.sub,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "right",
  },

  optionHelpSelected: {
    color: palette.text,
  },

  selectedSummaryBox: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 18,
    alignItems: "flex-end",
  },

  selectedSummaryLabel: {
    color: palette.sub,
    fontSize: 13,
    marginBottom: 4,
  },

  selectedSummaryText: {
    color: palette.gold,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
  },

  questionsContainer: {
    gap: 16,
  },

  questionCard: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.03)",
  },

  questionTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
    lineHeight: 24,
    marginBottom: 12,
  },

  questionOptionsContainer: {
    gap: 10,
  },

  questionOption: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  questionOptionSelected: {
    borderColor: palette.gold,
    backgroundColor: "rgba(212,175,55,0.12)",
  },

  questionOptionText: {
    color: palette.text,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "right",
  },

  questionOptionTextSelected: {
    color: palette.gold,
    fontWeight: "800",
  },

  noteContainer: {
    marginTop: 4,
    marginBottom: 8,
  },

  noteLabel: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: 8,
  },

  noteInput: {
    width: "100%",
    minHeight: 130,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.05)",
    color: palette.text,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    textAlign: "right",
  },

  disabledInput: {
    opacity: 0.7,
  },

  encouragementBox: {
    borderRadius: 16,
    backgroundColor: "rgba(124,184,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(124,184,255,0.25)",
    padding: 14,
    marginBottom: 18,
  },

  safeBox: {
    backgroundColor: "rgba(46,204,113,0.12)",
    borderColor: "rgba(46,204,113,0.28)",
  },

  roleBasedBox: {
    backgroundColor: "rgba(124,184,255,0.10)",
    borderColor: "rgba(124,184,255,0.25)",
  },

  relapseBox: {
    backgroundColor: "rgba(255,77,77,0.12)",
    borderColor: "rgba(255,77,77,0.28)",
  },

  encouragementText: {
    color: palette.text,
    fontSize: 14,
    lineHeight: 24,
    textAlign: "right",
  },

  guidanceCard: {
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 16,
  },

  guidanceMessage: {
    color: palette.text,
    fontSize: 15,
    lineHeight: 26,
    textAlign: "right",
    marginBottom: 14,
  },

  streakBox: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    paddingVertical: 14,
    marginBottom: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  streakLabel: {
    color: palette.sub,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 6,
  },

  streakValue: {
    color: "#7ED957",
    fontSize: 24,
    lineHeight: 30,
    textAlign: "center",
    fontWeight: "900",
  },

  commitmentRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 12,
  },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },

  checkboxChecked: {
    borderColor: "#2FBF71",
    backgroundColor: "rgba(47,191,113,0.16)",
  },

  checkboxTick: {
    color: "#2FBF71",
    fontSize: 13,
    fontWeight: "900",
  },

  commitmentText: {
    flex: 1,
    color: palette.text,
    fontSize: 14,
    lineHeight: 24,
    textAlign: "right",
  },

  guidanceClosing: {
    color: "#7CB8FF",
    fontSize: 14,
    lineHeight: 24,
    textAlign: "right",
    marginTop: 6,
  },

  inlineNotice: {
    borderRadius: 16,
    backgroundColor: "rgba(255,77,77,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.24)",
    padding: 14,
  },

  inlineNoticeText: {
    color: "#FF9A9A",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    fontWeight: "700",
  },

  doneNotice: {
    borderRadius: 16,
    backgroundColor: "rgba(46,204,113,0.12)",
    borderWidth: 1,
    borderColor: "rgba(46,204,113,0.28)",
    padding: 14,
  },

  doneNoticeText: {
    color: "#7ED957",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    fontWeight: "700",
  },

  footer: {
    position: "absolute",
    left: 20,
    right: 20,
  },

  footerRow: {
    flexDirection: "row-reverse",
    gap: 12,
  },

  secondaryButton: {
    flex: 1,
    height: 60,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.cardStrong,
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryButtonPlaceholder: {
    flex: 1,
  },

  secondaryButtonText: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },

  submitButton: {
    flex: 2,
    height: 60,
    borderRadius: 20,
    backgroundColor: palette.gold,
    alignItems: "center",
    justifyContent: "center",
  },

  submitButtonDisabled: {
    opacity: 0.5,
  },

  submitButtonText: {
    color: palette.bg,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  firstSectionNoBorder: {
    borderTopWidth: 0,
  },
  resultCard: {
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 18,
  },

  resultTitle: {
    color: "#FFB3B3",
    fontSize: 18,
    lineHeight: 28,
    textAlign: "center",
    fontWeight: "900",
    marginBottom: 12,
  },

  resultMessage: {
    color: palette.text,
    fontSize: 15,
    lineHeight: 26,
    textAlign: "right",
    marginBottom: 14,
  },

  resultStreakText: {
    color: palette.text,
    fontSize: 14,
    lineHeight: 24,
    textAlign: "center",
  },

  resultMetaText: {
    color: palette.sub,
    fontSize: 13,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 10,
  },
  resultCommitmentsBox: {
    marginTop: 14,
  },
  resultCommitmentHint: {
    color: "#FFB3B3",
    fontSize: 12,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 10,
  },
  pendingResultBox: {
    borderRadius: 16,
    backgroundColor: "rgba(255,77,77,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.24)",
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 14,
  },

  pendingResultText: {
    color: "#FF9A9A",
    fontSize: 14,
    lineHeight: 24,
    textAlign: "center",
    fontWeight: "800",
  },
  resultBackButton: {
    width: "100%",
    height: 60,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  successResultCard: {
    backgroundColor: "rgba(46,204,113,0.10)",
    borderColor: "rgba(46,204,113,0.28)",
  },

  neutralResultCard: {
    backgroundColor: "rgba(124,184,255,0.10)",
    borderColor: "rgba(124,184,255,0.25)",
  },

  resultCardDanger: {
    backgroundColor: "rgba(255,77,77,0.10)",
    borderColor: "rgba(255,77,77,0.24)",
  },

  resultCardWarning: {
    backgroundColor: "rgba(255,159,67,0.10)",
    borderColor: "rgba(255,159,67,0.26)",
  },

  resultCardAlert: {
    backgroundColor: "rgba(255,214,10,0.10)",
    borderColor: "rgba(255,214,10,0.24)",
  },

  successResultEmoji: {
    fontSize: 34,
    textAlign: "center",
    marginBottom: 10,
  },

  successResultTitle: {
    fontSize: 20,
    lineHeight: 30,
    textAlign: "center",
    fontWeight: "900",
    marginBottom: 12,
  },

  successResultTitleSafe: {
    color: "#7ED957",
  },

  successResultTitleRoleBased: {
    color: "#7CB8FF",
  },

  successResultMessage: {
    color: palette.text,
    fontSize: 15,
    lineHeight: 26,
    textAlign: "right",
    marginBottom: 16,
  },

  streakHeroBox: {
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  streakHeroLabel: {
    color: palette.sub,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 8,
  },

  streakHeroValue: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "900",
    textAlign: "center",
    color: "#FDE68A",
  },

  streakHeroValueSafe: {
    color: "#7ED957",
  },

  streakHeroValueRoleBased: {
    color: "#7CB8FF",
  },

  successResultFooter: {
    color: palette.text,
    fontSize: 14,
    lineHeight: 24,
    textAlign: "center",
  },

  resultBackButtonText: {
    color: palette.bg,
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
  },

  resultBackButtonSuccess: {
    backgroundColor: "#7ED957",
  },

  resultBackButtonRoleBased: {
    backgroundColor: "#7CB8FF",
  },

  resultBackButtonDanger: {
    backgroundColor: "#FF6B6B",
  },

  resultBackButtonWarning: {
    backgroundColor: "#FF9F43",
  },

  resultBackButtonAlert: {
    backgroundColor: "#FFD60A",
  },
  multiSelectOptionRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },

  smallCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },

  smallCheckboxChecked: {
    backgroundColor: palette.gold,
    borderColor: palette.gold,
  },

  smallCheckboxTick: {
    color: palette.bg,
    fontSize: 14,
    fontWeight: "900",
  },
  resultActionsContainer: {
    marginTop: 20,
    paddingTop: 8,
  },
});
