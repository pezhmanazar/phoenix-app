//phoenix-app\components\pelekan\gosastan\templates\RoutineFlowTemplate.tsx
import { useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AppState,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenLayout } from "@/components/ScreenLayout";
import AppBannerModal from "@/components/ui/AppBannerModal";
import { palette } from "@/constants/theme/palette";
import { useMoodHistory } from "@/hooks/useMoodHistory";
import type { ResolvedTask, TaskStepValue } from "../types";
import TaskStepRenderer from "../ui/TaskStepRenderer";
import { useCompleteTask } from "../useCompleteTask";
import { useLocalTaskDraft } from "../useLocalTaskDraft";

type ReturnRoute = {
  pathname: string;
  params?: Record<string, string | number | boolean | null | undefined>;
};

type RoutineFlowTemplateProps = {
  stageCode: string;
  dayCode: string;
  task: ResolvedTask<"routine_flow">;
  onComplete: (data?: unknown) => void | Promise<void>;
  returnRoute?: ReturnRoute;
};

type RoutineStepValues = Record<string, TaskStepValue>;
type BannerModalState = {
  visible: boolean;
  kind: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
};

export default function RoutineFlowTemplate({
  stageCode,
  dayCode,
  task,
  onComplete,
  returnRoute,
}: RoutineFlowTemplateProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  const activeInputRef = useRef<TextInput | null>(null);
  const keyboardHeightRef = useRef(0);
  const inputMeasureTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const latestStepValuesRef = useRef<RoutineStepValues>({});
  const latestStepIndexRef = useRef(0);
  const hasLoadedDraftRef = useRef(false);
  const persistProgressRef = useRef<() => Promise<void>>(async () => {});
  const savingRef = useRef<Promise<void>>(Promise.resolve());

  const steps = useMemo(() => task.config.steps ?? [], [task.config.steps]);

  const {
    loading,
    draft,
    saveDraft,
    markStepCompleted,
    removeStepCompleted,
    clearDraft,
  } = useLocalTaskDraft(dayCode, task.config.code);

  const moodCheckinTaskCode =
    steps.find((s) => s.stepType === "conditional_audio")?.sourceTaskCode ??
    `${dayCode}_feelings_log`;


  const { loading: moodDraftLoading, draft: moodDraft } = useLocalTaskDraft(
  dayCode,
  moodCheckinTaskCode,
);

  const { loading: completing, completeTask } = useCompleteTask({
  stageCode,
});
  const { saveMoodEntry } = useMoodHistory();


  const isInternalStep = useCallback((step?: (typeof steps)[number]) => {
    return step?.key === "sleep_help";
  }, []);

  const visibleSteps = useMemo(() => {
    return steps.filter((step) => !isInternalStep(step));
  }, [steps, isInternalStep]);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [localStepValues, setLocalStepValues] = useState<RoutineStepValues>({});
  const [bannerModal, setBannerModal] = useState<BannerModalState | null>(null);

  const DAY_PLANNER_STEP_KEY = "day_planner_check";
  const TODAY_PLAN_WRITTEN_CHECKLIST_ID = "today_plan_written";
  const isDayPlannerStepKey = (stepKey: string) => {
    return stepKey === DAY_PLANNER_STEP_KEY;
  };

  useEffect(() => {
    latestStepIndexRef.current = currentStepIndex;
  }, [currentStepIndex]);

  const clearPendingInputMeasure = useCallback(() => {
    if (inputMeasureTimeoutRef.current) {
      clearTimeout(inputMeasureTimeoutRef.current);
      inputMeasureTimeoutRef.current = null;
    }
  }, []);

  const scrollActiveInputIntoView = useCallback(() => {
    const input = activeInputRef.current;
    const scroll = scrollRef.current;

    if (!input || !scroll) return;

    clearPendingInputMeasure();

    inputMeasureTimeoutRef.current = setTimeout(() => {
      input.measureInWindow((x, y, width, height) => {
        const keyboardHeight = keyboardHeightRef.current || 0;
        if (!keyboardHeight) return;

        const windowHeight = Dimensions.get("window").height;
        const keyboardTop = windowHeight - keyboardHeight;

        const footerHeight = 58;
        const footerBottomOffset = insets.bottom + 20;
        const footerSafeGap = 28;

        const visibleBottom =
          keyboardTop - footerHeight - footerBottomOffset - footerSafeGap;

        const inputBottom = y + height;

        if (inputBottom > visibleBottom) {
          const overlap = inputBottom - visibleBottom;

          scroll.scrollTo({
            y: Math.max(scrollYRef.current + overlap + 20, 0),
            animated: true,
          });
        }
      });
    }, 160);
  }, [clearPendingInputMeasure, insets.bottom]);

  const handleInputFocus = useCallback(
    (input: TextInput | null) => {
      activeInputRef.current = input;
      scrollActiveInputIntoView();
    },
    [scrollActiveInputIntoView],
  );

  const enqueueSave = useCallback((job: () => Promise<void>) => {
    savingRef.current = savingRef.current
      .catch(() => {})
      .then(job)
      .catch((error) => {
        console.warn("Routine draft save failed:", error);
      });

    return savingRef.current;
  }, []);

  const flushDraftSnapshot = useCallback(
    async (params?: {
      steps?: RoutineStepValues;
      currentStepIndex?: number;
      completed?: boolean;
    }) => {
      if (!hasLoadedDraftRef.current) return;

      const nextSteps = params?.steps ?? latestStepValuesRef.current;
      const nextIndex = params?.currentStepIndex ?? latestStepIndexRef.current;
      const nextCompleted = params?.completed ?? false;

      await enqueueSave(async () => {
        await saveDraft({
          values: {
            steps: nextSteps,
            currentStepIndex: nextIndex,
            completed: nextCompleted,
          },
        });
      });
    },
    [enqueueSave, saveDraft],
  );

  useEffect(() => {
    if (loading || hasLoadedDraftRef.current) return;

    const values = draft.values || {};

    let safeIndex = 0;

    if (typeof values.currentStepIndex === "number") {
      safeIndex = Math.min(
        Math.max(values.currentStepIndex, 0),
        Math.max(steps.length - 1, 0),
      );
    }

    const rawSteps = values.steps;
    const safeSteps =
      rawSteps && typeof rawSteps === "object"
        ? (rawSteps as RoutineStepValues)
        : {};

    setCurrentStepIndex(safeIndex);
    setLocalStepValues(safeSteps);

    latestStepIndexRef.current = safeIndex;
    latestStepValuesRef.current = safeSteps;

    hasLoadedDraftRef.current = true;
    setDraftLoaded(true);
  }, [loading, draft.values, steps.length]);

  const persistProgress = useCallback(async () => {
    if (!hasLoadedDraftRef.current) return;

    await flushDraftSnapshot({
      steps: latestStepValuesRef.current,
      currentStepIndex: latestStepIndexRef.current,
      completed: false,
    });
  }, [flushDraftSnapshot]);

  useEffect(() => {
    persistProgressRef.current = persistProgress;
  }, [persistProgress]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        persistProgressRef.current();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", (e) => {
      keyboardHeightRef.current = e.endCoordinates.height;
      scrollActiveInputIntoView();
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      keyboardHeightRef.current = 0;
      activeInputRef.current = null;
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [scrollActiveInputIntoView]);

  useEffect(() => {
    return () => {
      persistProgressRef.current();
    };
  }, []);

  const stepValues = localStepValues;

  const rendererStepValues: RoutineStepValues = useMemo(() => {
  const moodScore = moodDraft.values?.score;

  if (typeof moodScore !== "number") {
    return stepValues;
  }

  return {
    ...stepValues,
    score: {
      score: moodScore,
      completed: true,
    },
    morningMoodScore: {
      score: moodScore,
      completed: true,
    },
    [moodCheckinTaskCode]: {
      score: moodScore,
      completed: true,
    },
  };
}, [stepValues, moodDraft.values, moodCheckinTaskCode]);


  const currentStep = steps[currentStepIndex];

  const requiredSteps = useMemo(() => {
  return steps.filter((step) => step.required && !isInternalStep(step));
}, [steps, isInternalStep]);


  const allRequiredCompleted = useMemo(() => {
    if (requiredSteps.length === 0) return true;

    return requiredSteps.every((step) => {
      if (isDayPlannerStepKey(step.key)) {
        return true;
      }

      return rendererStepValues[step.key]?.completed === true;
    });
  }, [requiredSteps, rendererStepValues]);

  const hasWrittenTodayPlan = useMemo(() => {
    const plannerStepValue = stepValues[DAY_PLANNER_STEP_KEY];

    if (!plannerStepValue || typeof plannerStepValue !== "object") {
      return false;
    }

    const checkedItems = (plannerStepValue as any).checkedItems;

    if (!Array.isArray(checkedItems)) {
      return false;
    }

    return checkedItems.includes(TODAY_PLAN_WRITTEN_CHECKLIST_ID);
  }, [stepValues]);

  const hasDayPlannerStep = useMemo(() => {
    return steps.some((step) => step.key === DAY_PLANNER_STEP_KEY);
  }, [steps]);

  const finalSubmitLabel =
    hasDayPlannerStep && !hasWrittenTodayPlan
      ? "ثبت نهایی و رفتن به روزنگار"
      : (task.config.meta?.submitLabel ?? "ثبت نهایی");

  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStep
    ? currentStepIndex === steps.findLastIndex((step) => !isInternalStep(step))
    : false;
  const isTaskAlreadyCompleted = task.backendTask?.isDone === true;

  const currentStepValue = currentStep
  ? rendererStepValues[currentStep.key]
  : undefined;
  const currentStepCompleted = currentStepValue?.completed === true;
  const shouldShowFooter = !isInternalStep(currentStep);
  const isBannerModalVisible = !!bannerModal?.visible;

  const canGoNext = currentStep
    ? isDayPlannerStepKey(currentStep.key) ||
      !currentStep.required ||
      currentStepCompleted
    : false;

  const cleanParams = (
    input?: Record<string, string | number | boolean | null | undefined>,
  ) => {
    const output: Record<string, string> = {};

    Object.entries(input || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        output[key] = String(value);
      }
    });

    return output;
  };

  const handleNavigate = async (route: string) => {
    await persistProgress();

    router.push({
      pathname: route as any,
      params: {
        fromRoutine: "1",
        returnLabel: "بازگشت به روتین صبحگاهی",
        returnPathname: returnRoute?.pathname,
        returnParams: JSON.stringify(cleanParams(returnRoute?.params)),
      },
    });
  };

  const handleStepChange = async (stepKey: string, patch: TaskStepValue) => {
    const prevValue = latestStepValuesRef.current[stepKey] ?? {};

    const nextValue: TaskStepValue = {
      ...prevValue,
      ...patch,
    };

    const nextSteps: RoutineStepValues = {
      ...latestStepValuesRef.current,
      [stepKey]: nextValue,
    };

    latestStepValuesRef.current = nextSteps;
    setLocalStepValues(nextSteps);

    if (nextValue.completed === true) {
      await markStepCompleted(stepKey);
    } else {
      await removeStepCompleted(stepKey);
    }

    await flushDraftSnapshot({
      steps: nextSteps,
      currentStepIndex: latestStepIndexRef.current,
      completed: false,
    });
  };

  const handleGoToStep = async (stepKey: string) => {
    const targetIndex = steps.findIndex((step) => step.key === stepKey);

    if (targetIndex === -1) {
      console.warn("RoutineFlowTemplate: target step not found:", stepKey);
      return;
    }

    setCurrentStepIndex(targetIndex);
    latestStepIndexRef.current = targetIndex;

    scrollRef.current?.scrollTo({ y: 0, animated: true });

    await flushDraftSnapshot({
      steps: latestStepValuesRef.current,
      currentStepIndex: targetIndex,
      completed: false,
    });
  };

  const goBack = async () => {
    if (isFirstStep) return;

    const prevIndex = currentStepIndex - 1;

    setCurrentStepIndex(prevIndex);
    latestStepIndexRef.current = prevIndex;

    scrollRef.current?.scrollTo({ y: 0, animated: true });

    await flushDraftSnapshot({
      steps: latestStepValuesRef.current,
      currentStepIndex: prevIndex,
      completed: false,
    });
  };

  const goNext = async () => {
    if (!currentStep) return;

    if (!canGoNext) {
      return;
    }

    let nextSteps = latestStepValuesRef.current;

    if (!currentStepCompleted && !currentStep.required) {
      const prevValue = latestStepValuesRef.current[currentStep.key] ?? {};
      const nextValue: TaskStepValue = {
        ...prevValue,
        completed: true,
      };

      nextSteps = {
        ...latestStepValuesRef.current,
        [currentStep.key]: nextValue,
      };

      latestStepValuesRef.current = nextSteps;
      setLocalStepValues(nextSteps);

      await markStepCompleted(currentStep.key);
    }

    if (!isLastStep) {
      const nextIndex = steps.findIndex((step, index) => {
        return index > currentStepIndex && !isInternalStep(step);
      });

      if (nextIndex === -1) {
        return;
      }

      setCurrentStepIndex(nextIndex);
      latestStepIndexRef.current = nextIndex;

      scrollRef.current?.scrollTo({ y: 0, animated: true });

      await flushDraftSnapshot({
        steps: nextSteps,
        currentStepIndex: nextIndex,
        completed: false,
      });

      return;
    }

    await handleSubmit({
      redirectToJournal: hasDayPlannerStep && !hasWrittenTodayPlan,
    });
  };

  const finalizeCompletion = useCallback(
    async (finalPayload: unknown) => {
      await clearDraft();
      await onComplete(finalPayload);
    },
    [clearDraft, onComplete],
  );

  const handleCloseBannerModal = useCallback(() => {
    setBannerModal(null);
  }, []);

  const handleSubmit = async (options?: { redirectToJournal?: boolean }) => {
    if (!allRequiredCompleted) return;

    const finalSteps = latestStepValuesRef.current;

    const nightDayReview = finalSteps?.night_day_review as any;

    const rawNightDayScore =
      nightDayReview?.scoreFieldKey === "night_day_score"
        ? nightDayReview?.score
        : undefined;

    const nightDayScore =
      typeof rawNightDayScore === "number"
        ? rawNightDayScore
        : typeof rawNightDayScore === "string"
          ? Number(rawNightDayScore)
          : undefined;

    const finalPayload = {
      taskCode: task.config.code,
      template: task.config.template,
      completed: true,
      steps: finalSteps,
      redirectToJournal: options?.redirectToJournal === true,
    };

    await flushDraftSnapshot({
      steps: finalSteps,
      currentStepIndex: latestStepIndexRef.current,
      completed: true,
    });

        if (
      typeof nightDayScore === "number" &&
      Number.isFinite(nightDayScore) &&
      nightDayScore >= 1 &&
      nightDayScore <= 20
    ) {
      // ثبت نمره
      await saveMoodEntry({
        dayCode,
        taskCode: task.config.code,
        score: nightDayScore,
        date: new Date().toISOString(),
      });
      
      // یک تقلب کوچک برای اینکه مطمئن شویم کشِ نمودار متوجه تغییر شده است
      // اگر در هوک useMoodHistory تابعی برای refetch داری، اینجا صدا بزن
    }


    const backendTaskId = (task as any)?.backendTask?.id;

    if (backendTaskId) {
      try {
        await completeTask({
          taskId: backendTaskId,
          done: true,
        });
      } catch (error) {
        console.error("completeTask failed", error);

        setBannerModal({
          visible: true,
          kind: "error",
          title: "خطا در ثبت اطلاعات",
          message: "در ثبت وضعیت تسک مشکلی پیش آمد. لطفاً دوباره تلاش کن.",
        });
        return;
      }
    }
    await finalizeCompletion(finalPayload);
  };

  if (loading || moodDraftLoading || !draftLoaded) {
    return (
      <ScreenLayout title={task.effectiveTitleFa}>
        <View style={styles.loadingBox}>
          <Text style={styles.loadingText}>در حال آماده‌سازی روتین...</Text>
        </View>
      </ScreenLayout>
    );
  }

  if (!currentStep || steps.length === 0) {
    return (
      <ScreenLayout title={task.effectiveTitleFa}>
        <View style={styles.loadingBox}>
          <Text style={styles.loadingText}>
            برای این روتین هنوز مرحله‌ای تعریف نشده.
          </Text>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout title={task.effectiveTitleFa}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        style={styles.container}
      >
        <View style={styles.pillsContainer}>
          {visibleSteps.map((step) => {
            const realIndex = steps.findIndex((item) => item.key === step.key);
            const isActive = realIndex === currentStepIndex;
            const isDone = realIndex < currentStepIndex;

            return (
              <View
                key={step.key}
                style={[
                  styles.pill,
                  isDone && styles.donePill,
                  isActive && styles.activePill,
                ]}
              />
            );
          })}
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingBottom: shouldShowFooter
                ? insets.bottom + 220
                : insets.bottom + 40,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          scrollEventThrottle={16}
          onScroll={(event) => {
            scrollYRef.current = event.nativeEvent.contentOffset.y;
          }}
        >
          <View style={styles.hero}>
            {task.effectiveDescription ? (
              <Text style={styles.description}>
                {task.effectiveDescription}
              </Text>
            ) : null}
          </View>

          <TaskStepRenderer
            step={currentStep}
            value={stepValues[currentStep.key]}
            stepValues={rendererStepValues}
            onChange={handleStepChange}
            onNavigate={handleNavigate}
            onGoToStep={handleGoToStep}
            onInputFocus={handleInputFocus}
          />
        </ScrollView>
        {shouldShowFooter ? (
          <View style={[styles.footer, { bottom: insets.bottom + 20 }]}>
            {!isFirstStep && (
              <Pressable style={styles.backButton} onPress={goBack}>
                <Text style={styles.backButtonText}>قبلی</Text>
              </Pressable>
            )}

            <Pressable
              disabled={
                !canGoNext ||
                completing ||
                isBannerModalVisible ||
                (isLastStep && isTaskAlreadyCompleted)
              }
              style={[
                styles.nextButton,
                (!canGoNext ||
                  completing ||
                  isBannerModalVisible ||
                  (isLastStep && isTaskAlreadyCompleted)) &&
                  styles.disabledButton,
              ]}
              onPress={goNext}
            >
              <Text style={styles.nextButtonText}>
                {isLastStep
                  ? isTaskAlreadyCompleted
                    ? "این مرحله تکمیل شده"
                    : completing
                      ? "در حال ثبت..."
                      : isBannerModalVisible
                        ? "در انتظار تأیید..."
                        : finalSubmitLabel
                  : canGoNext
                    ? "بعدی"
                    : "این مرحله رو کامل کن"}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </KeyboardAvoidingView>

      <AppBannerModal
        visible={!!bannerModal?.visible}
        kind={bannerModal?.kind ?? "info"}
        title={bannerModal?.title ?? ""}
        message={bannerModal?.message ?? ""}
        closeText="متوجه شدم"
        onClose={handleCloseBannerModal}
      />
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
    flexDirection: "row-reverse",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 20,
  },

  pill: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.cardStrong,
  },

  activePill: {
    backgroundColor: "#7ED957",
  },

  donePill: {
    backgroundColor: "#2FBF71",
  },

  scrollContent: {
    padding: 16,
    gap: 16,
  },

  hero: {
    gap: 8,
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: "transparent",
  },

  description: {
    textAlign: "right",
    fontSize: 14,
    lineHeight: 22,
    color: palette.sub,
  },

  footer: {
    position: "absolute",
    left: 20,
    right: 20,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
  },

  backButton: {
    flex: 1,
    height: 58,
    borderRadius: 18,
    backgroundColor: palette.cardStrong,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: palette.border,
  },

  backButtonText: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "700",
  },

  nextButton: {
    flex: 2,
    height: 58,
    borderRadius: 18,
    backgroundColor: palette.gold,
    alignItems: "center",
    justifyContent: "center",
  },

  disabledButton: {
    opacity: 0.35,
  },

  nextButtonText: {
    color: palette.bg,
    fontSize: 17,
    fontWeight: "900",
  },
});
