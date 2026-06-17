import { ScreenLayout } from "@/components/ScreenLayout";
import { palette } from "@/constants/theme/palette";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
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
import { isTaskOfTemplate, type ResolvedTask } from "../types";
import AudioPracticePlayer from "../ui/AudioPracticePlayer";
import PracticeTimer from "../ui/PracticeTimer";
import { useLocalTaskDraft } from "../useLocalTaskDraft";

type Props = {
  dayCode: string;
  task: ResolvedTask;
  onComplete: (data?: unknown) => void;
};

const STEPS = [
  {
    key: "audio",
    label: "مراقبه روز",
    hint: "ابتدا ویس مراقبه را با آرامش گوش بده.",
  },
  {
    key: "reflection",
    label: "آموخته‌های من",
    hint: "هر چیزی از این مراقبه یاد گرفتی یا حس کردی رو اینجا بنویس تا یادت بمونه و بعدا بتونی مرورش کنی.",
  },
  {
    key: "breathing",
    label: "تنفس عمیق",
    hint: "حالا چند دقیقه با تنفس عمیق بدنت رو آروم‌تر کن.",
  },
  {
    key: "summary",
    label: "مرور نهایی",
    hint: "مرور کن و اگه آماده‌ای ثبت نهایی رو بزن.",
  },
] as const;

export default function AudioReflectionTemplate({
  dayCode,
  task,
  onComplete,
}: Props) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const isValidTask = isTaskOfTemplate(task, "audio_reflection");

  const taskCode = isValidTask ? task.config.code : "";
  const meta = isValidTask ? (task.config.meta ?? {}) : {};
  const audioKey = (meta as { audioKey?: string }).audioKey ?? "";
  const submitLabel =
    (meta as { submitLabel?: string }).submitLabel || "ثبت تمرین";

  const { loading, draft, setValue, markStepCompleted, saveDraft } =
    useLocalTaskDraft(dayCode, taskCode);

  const [idx, setIdx] = useState(0);
  const [reflectionText, setReflectionText] = useState("");
  const [audioCompleted, setAudioCompleted] = useState(false);
  const [timerCompleted, setTimerCompleted] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  useEffect(() => {
    if (!isValidTask) return;
    if (loading || draftLoaded) return;

    const values = draft.values || {};

    setReflectionText(
      typeof values.reflectionText === "string" ? values.reflectionText : "",
    );

    setAudioCompleted(values.audioCompleted === true);
    setTimerCompleted(values.timerCompleted === true);

    if (typeof values.currentStepIndex === "number") {
      const safeIndex = Math.min(
        Math.max(values.currentStepIndex, 0),
        STEPS.length - 1,
      );
      setIdx(safeIndex);
    }

    setDraftLoaded(true);
  }, [draft, draftLoaded, loading, isValidTask]);

  const currentStep = STEPS[idx];
  const isAudioStep = currentStep.key === "audio";
  const isReflectionStep = currentStep.key === "reflection";
  const isBreathingStep = currentStep.key === "breathing";
  const isSummaryStep = currentStep.key === "summary";
  const isLastStep = idx === STEPS.length - 1;
  const isTaskAlreadyCompleted = task.backendTask?.isDone === true;

  const nextButtonLabel = useMemo(() => {
    if (isSummaryStep) return submitLabel;
    return "بعدی";
  }, [isSummaryStep, submitLabel]);

  const reflectionMinLength = 160;
  const reflectionLength = reflectionText.trim().length;
  const reflectionValid = reflectionLength >= reflectionMinLength;

  const saveCurrentStepIndex = (nextIndex: number) => {
    void setValue("currentStepIndex", nextIndex);
  };

  const handleReflectionChange = (txt: string) => {
    setReflectionText(txt);
    void setValue("reflectionText", txt);
  };

  const handleAudioComplete = async () => {
    setAudioCompleted(true);
    await setValue("audioCompleted", true);
    await markStepCompleted("audio");
  };

  const handleTimerComplete = async () => {
    setTimerCompleted(true);
    await setValue("timerCompleted", true);
    await markStepCompleted("breathing");
  };

  const canGoNext =
    isAudioStep ||
    (isReflectionStep && reflectionValid) ||
    isBreathingStep ||
    isSummaryStep;

  const goNext = async () => {
    Keyboard.dismiss();

    if (!canGoNext) return;
    if (isLastStep && isTaskAlreadyCompleted) return;

    if (!isSummaryStep) {
      await markStepCompleted(currentStep.key);
    }

    if (idx < STEPS.length - 1) {
      const nextIndex = idx + 1;
      setIdx(nextIndex);
      saveCurrentStepIndex(nextIndex);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    await saveDraft({
      values: {
        reflectionText,
        audioCompleted,
        timerCompleted,
        currentStepIndex: idx,
        completed: true,
      },
    });

    onComplete({
      reflectionText,
      audioCompleted,
      timerCompleted,
    });
  };

  const goBack = () => {
    if (idx <= 0) return;

    const prevIndex = idx - 1;
    setIdx(prevIndex);
    saveCurrentStepIndex(prevIndex);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
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
              <View style={styles.instructionSection}>
                <Text style={styles.instructionText}>{currentStep.hint}</Text>
              </View>

              <View style={styles.contentSection}>
                <AudioPracticePlayer
                  audioKey={audioKey}
                  onCompleted={handleAudioComplete}
                />

                {audioCompleted && (
                  <View style={styles.doneBadge}>
                    <Text style={styles.doneBadgeText}>
                      پخش مراقبه انجام شد
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {isReflectionStep && (
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
                <TextInput
                  style={styles.bigInput}
                  placeholder="اینجا بنویس..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  multiline
                  value={reflectionText}
                  onChangeText={handleReflectionChange}
                  textAlign="right"
                />

                {!reflectionValid && (
                  <Text style={styles.reflectionHint}>
                    {`${reflectionMinLength - reflectionLength} کاراکتر دیگه باید بنویسی`}
                  </Text>
                )}

                {reflectionValid && (
                  <Text style={styles.reflectionSuccess}>
                    حداقل تعداد کاراکتر کامل شده
                  </Text>
                )}
              </View>
            </View>
          )}

          {isBreathingStep && (
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
                <PracticeTimer
                  durationSeconds={180}
                  onComplete={handleTimerComplete}
                />

                {timerCompleted && (
                  <View style={styles.doneBadge}>
                    <Text style={styles.doneBadgeText}>
                      تایمر تنفس با موفقیت ثبت شد
                    </Text>
                  </View>
                )}
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

              <View style={styles.contentSection}>
                <View style={styles.summaryBox}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryKey}>گوش دادن به مراقبه</Text>
                    <Text style={styles.summaryVal}>
                      {audioCompleted ? "انجام شده" : "انجام نشده"}
                    </Text>
                  </View>

                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryKey}> آموخته‌ها</Text>
                    <Text style={styles.summaryVal}>
                      {reflectionText.trim()
                        ? reflectionText
                        : "چیزی نوشته نشده"}
                    </Text>
                  </View>

                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryKey}>تمرین تنفس</Text>
                    <Text style={styles.summaryVal}>
                      {timerCompleted ? "انجام شده" : "انجام نشده"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={[styles.footer, { bottom: insets.bottom + 20 }]}>
          {idx > 0 && (
            <TouchableOpacity style={styles.backBtn} onPress={goBack}>
              <Text style={styles.backBtnText}>قبلی</Text>
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
                : nextButtonLabel}
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

  bigInput: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 15,
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: palette.text,
    textAlign: "right",
    minHeight: 180,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    textAlignVertical: "top",
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
  reflectionHint: {
    color: "#FF6B6B",
    fontSize: 13,
    textAlign: "right",
    width: "100%",
    marginTop: -6,
  },

  reflectionSuccess: {
    color: "#2FBF71",
    fontSize: 13,
    textAlign: "right",
    width: "100%",
    marginTop: -6,
  },
});
