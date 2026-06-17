import { ScreenLayout } from "@/components/ScreenLayout";
import { palette } from "@/constants/theme/palette";
import React, { useEffect, useRef, useState } from "react";
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
import { ResolvedTask } from "../types";
import { useLocalTaskDraft } from "../useLocalTaskDraft";

type Props = {
  dayCode: string;
  task: ResolvedTask<"mood_checkin">;
  onComplete: (data: any) => void;
};

const STEPS = [
  { key: "score", label: "حال کلی", hint: "از یک تا ده بگو حالت چطوره" },
  { key: "fear", label: "ترس", hint: "ترس‌های امروزت رو بنویس", color: "#ff4d4d" },
  { key: "anger", label: "خشم", hint: "الان از چی عصبانی هستی؟", color: "#ff944d" },
  { key: "sadness", label: "غم", hint: "الان چه غمی روی دلته؟", color: "#4d94ff" },
  { key: "hope", label: "امید", hint: "امروز به چی امیدواری؟", color: palette.gold },
  { key: "summary", label: "مرور نهایی", hint: "اطلاعات وارد شده را چک کن" },
] as const;

type EmotionKey = "fear" | "anger" | "sadness" | "hope";


export default function MoodCheckinTemplate({ dayCode, task, onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const { loading, draft, setValue, markStepCompleted, saveDraft } =
  useLocalTaskDraft(dayCode, task.config.code);


  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState<number | null>(null);
  const [emotions, setEmotions] = useState<Record<EmotionKey, string>>({
    fear: "",
    anger: "",
    sadness: "",
    hope: "",
  });

  const [draftLoaded, setDraftLoaded] = useState(false);

  useEffect(() => {
    if (loading || draftLoaded) return;

    const values = draft.values || {};

    setScore(typeof values.score === "number" ? values.score : null);

    setEmotions({
      fear: typeof values.fear === "string" ? values.fear : "",
      anger: typeof values.anger === "string" ? values.anger : "",
      sadness: typeof values.sadness === "string" ? values.sadness : "",
      hope: typeof values.hope === "string" ? values.hope : "",
    });

    if (typeof values.currentStepIndex === "number") {
      const safeIndex = Math.min(Math.max(values.currentStepIndex, 0), STEPS.length - 1);
      setIdx(safeIndex);
    }

    setDraftLoaded(true);
  }, [draft, draftLoaded, loading]);

  const currentStep = STEPS[idx];

  const isSummaryStep = idx === STEPS.length - 1;
  const isScoreStep = idx === 0;
  const isEmotionStep = !isScoreStep && !isSummaryStep;
  const isLastStep = idx === STEPS.length - 1;
  const isTaskAlreadyCompleted = task.backendTask?.isDone === true;


  const currentEmotionValue =
    isEmotionStep && currentStep.key in emotions
      ? emotions[currentStep.key as EmotionKey]
      : "";

  const nextButtonLabel = isSummaryStep
    ? "ثبت نهایی"
    : isEmotionStep && !currentEmotionValue.trim()
      ? "رد شدن"
      : "بعدی";

  const saveCurrentStepIndex = (nextIndex: number) => {
    void setValue("currentStepIndex", nextIndex);
  };

  const handleScoreSelect = (num: number) => {
    setScore(num);
    void setValue("score", num);
  };

  const handleEmotionChange = (txt: string) => {
    const emotionKey = currentStep.key as EmotionKey;

    setEmotions((prev) => ({
      ...prev,
      [emotionKey]: txt,
    }));

    void setValue(emotionKey, txt);
  };

    const goNext = async () => {
    Keyboard.dismiss();

    if (isLastStep && isTaskAlreadyCompleted) {
      return;
    }

    await markStepCompleted(currentStep.key);

    if (idx < STEPS.length - 1) {
      const nextIndex = idx + 1;
      setIdx(nextIndex);
      saveCurrentStepIndex(nextIndex);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    await saveDraft({
      values: {
        score,
        emotions,
        fear: emotions.fear,
        anger: emotions.anger,
        sadness: emotions.sadness,
        hope: emotions.hope,
        currentStepIndex: idx,
        completed: true,
      },
    });

    onComplete({ score, emotions });
  };

  const goBack = () => {
    if (idx > 0) {
      const prevIndex = idx - 1;
      setIdx(prevIndex);
      saveCurrentStepIndex(prevIndex);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

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

          {isScoreStep && (
            <View style={styles.mainCard}>
              <View style={styles.headerSection}>
                <Text style={[styles.cardTitle, { color: "#7ED957" }]}>
                  {currentStep.label}
                </Text>
              </View>

              <View style={styles.instructionSection}>
                <Text style={styles.instructionText}>{currentStep.hint}</Text>
              </View>

              <View style={styles.contentSection}>
                <View style={styles.scoreGrid}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={[
                        styles.scoreCircle,
                        score === num && styles.activeScore,
                      ]}
                      onPress={() => handleScoreSelect(num)}
                    >
                      <Text
                        style={[
                          styles.scoreText,
                          score === num && styles.activeScoreText,
                        ]}
                      >
                        {num}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.scoreGuideTable}>
                  <View style={styles.scoreGuideHeader}>
                    <Text style={styles.scoreGuideHeaderText}>
                      راهنمای انتخاب اعداد
                    </Text>
                  </View>

                  <View style={[styles.scoreGuideRow, styles.scoreGuideRowRed]}>
                    <Text style={styles.scoreGuideRowText}>۱ تا ۳ = خیلی بد</Text>
                  </View>

                  <View style={[styles.scoreGuideRow, styles.scoreGuideRowOrange]}>
                    <Text style={styles.scoreGuideRowText}>۴ تا ۵ = بد</Text>
                  </View>

                  <View
                    style={[styles.scoreGuideRow, styles.scoreGuideRowLightGreen]}
                  >
                    <Text style={styles.scoreGuideRowText}>
                      ۶ تا ۷ = معمولی تا خوب
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.scoreGuideRow,
                      styles.scoreGuideRowGreen,
                      styles.lastScoreGuideRow,
                    ]}
                  >
                    <Text style={styles.scoreGuideRowText}>
                      ۸ تا ۱۰ = خوب تا عالی
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}


          {isSummaryStep && (
            <View style={styles.mainCard}>
              <View style={styles.headerSection}>
                <Text style={[styles.cardTitle, { color: "#7ED957" }]}>
                  {currentStep.label}
                </Text>
              </View>

              <View style={styles.contentSection}>
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryRow}>
                    وضعیت کلی:
                    <Text style={styles.summaryScore}> {score} از ۱۰</Text>
                  </Text>

                  {Object.entries(emotions).map(([key, value]) => {
                    if (!value.trim()) return null;

                    const label = STEPS.find((step) => step.key === key)?.label;

                    return (
                      <View key={key} style={styles.summaryItem}>
                        <Text style={styles.summaryKey}>{label}</Text>
                        <Text style={styles.summaryVal}>{value}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          )}

            {isEmotionStep && (
            <View style={styles.mainCard}>
              <View style={styles.headerSection}>
                <Text
                  style={[
                    styles.cardTitle,
                    { color: "color" in currentStep ? currentStep.color : "#7ED957" },
                  ]}
                >
                  {currentStep.label}
                </Text>
              </View>

              <View style={styles.instructionSection}>
                <Text style={styles.instructionText}>{currentStep.hint}</Text>
              </View>

              <View style={styles.contentSection}>
                <TextInput
                  style={styles.bigInput}
                  placeholder="بنویس..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  multiline
                  value={currentEmotionValue}
                  onChangeText={handleEmotionChange}
                  textAlign="right"
                />
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
              ((isScoreStep && !score) || (isLastStep && isTaskAlreadyCompleted)) &&
                styles.disabledBtn,
            ]}
            onPress={goNext}
            disabled={(isScoreStep && !score) || (isLastStep && isTaskAlreadyCompleted)}
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
  },


  stepLabel: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 8,
  },

  hintText: {
    color: palette.sub,
    fontSize: 15,
    marginBottom: 30,
    textAlign: "center",
  },

  scoreGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
    width: "100%",
  },


  scoreCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  activeScore: {
    backgroundColor: "#7ED957",
    borderColor: "#7ED957",
  },


  scoreText: {
    color: palette.text,
    fontSize: 20,
    fontWeight: "bold",
  },

  activeScoreText: {
    color: "#102015",
  },

  scoreGuideTable: {
    width: "100%",
    marginTop: 20,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.cardSoft,
  },

  scoreGuideHeader: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: palette.cardStrong,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    alignItems: "center",
    justifyContent: "center",
  },

  scoreGuideHeaderText: {
    color: "#7ED957",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },

  scoreGuideRow: {
    minHeight: 52,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },

  lastScoreGuideRow: {
    borderBottomWidth: 0,
  },

  scoreGuideRowRed: {
    backgroundColor: "rgba(255, 77, 77, 0.18)",
  },

  scoreGuideRowOrange: {
    backgroundColor: "rgba(255, 148, 77, 0.18)",
  },

  scoreGuideRowLightGreen: {
    backgroundColor: "rgba(144, 238, 144, 0.18)",
  },

  scoreGuideRowGreen: {
    backgroundColor: "rgba(46, 204, 113, 0.22)",
  },

  scoreGuideRowText: {
    color: palette.text,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
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

  summaryRow: {
    color: palette.text,
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "right",
  },

  summaryScore: {
    color: palette.gold,
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
});
