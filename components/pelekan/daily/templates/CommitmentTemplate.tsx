import { ScreenLayout } from "@/components/ScreenLayout";
import { palette } from "@/constants/theme/palette";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ResolvedTask } from "../types";
import { useLocalTaskDraft } from "../useLocalTaskDraft";

type CommitmentTemplateProps = {
  dayCode: string;
  task: ResolvedTask<"commitment">;
  onComplete: (data?: unknown) => void | Promise<void>;
};

type TypedConfirmationState = Record<string, string>;

const BASE_STEPS = [
  { key: "commitments", label: "تعهدها" },
  { key: "typed_confirmations", label: "تأیید نوشتاری" },
  { key: "summary", label: "مرور نهایی" },
] as const;

function normalizePersianText(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[ي]/g, "ی")
    .replace(/[ك]/g, "ک")
    .replace(/[أإآ]/g, "ا")
    .replace(/[ۀة]/g, "ه")
    .replace(/[ؤ]/g, "و")
    .replace(/[ئ]/g, "ی")
    .replace(/[ًٌٍَُِّْ]/g, "")
    .replace(/[‌\u200c]/g, " ")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[.,،؛:!؟?()"']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string) {
  const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i]);

  for (let j = 1; j <= b.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

function softTextMatch(value: string, target: string) {
  const normalizedValue = normalizePersianText(value);
  const normalizedTarget = normalizePersianText(target);

  if (!normalizedValue || !normalizedTarget) return false;
  if (normalizedValue === normalizedTarget) return true;

  const distance = levenshtein(normalizedValue, normalizedTarget);
  const maxLength = Math.max(normalizedValue.length, normalizedTarget.length);
  const similarity = 1 - distance / maxLength;

  return similarity >= 0.82;
}

export default function CommitmentTemplate({
  dayCode,
  task,
  onComplete,
}: CommitmentTemplateProps) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const { loading, draft, setValue, markStepCompleted, saveDraft } =
    useLocalTaskDraft(dayCode, task.config.code);

  const commitments = useMemo(() => {
  return task.config.meta?.commitments ?? [];
}, [task.config.meta?.commitments]);

const commitmentRule = useMemo(() => {
  return task.config.completionRule.type === "commitment"
    ? task.config.completionRule
    : null;
}, [task.config.completionRule]);

const requiredTypedConfirmations = useMemo(() => {
  return commitmentRule?.requiredTypedConfirmations ?? [];
}, [commitmentRule]);


  const steps = useMemo(() => {
    if (requiredTypedConfirmations.length === 0) {
      return BASE_STEPS.filter((step) => step.key !== "typed_confirmations");
    }

    return BASE_STEPS;
  }, [requiredTypedConfirmations.length]);

  const [idx, setIdx] = useState(0);
  const [checkedCommitmentIds, setCheckedCommitmentIds] = useState<string[]>([]);
  const [typedConfirmations, setTypedConfirmations] =
    useState<TypedConfirmationState>({});
  const [draftLoaded, setDraftLoaded] = useState(false);

  const currentStep = steps[idx];
  const isCommitmentsStep = currentStep.key === "commitments";
  const isTypedStep = currentStep.key === "typed_confirmations";
  const isSummaryStep = currentStep.key === "summary";
  const isLastStep = idx === steps.length - 1;
  const isTaskAlreadyCompleted = task.backendTask?.isDone === true;

  useEffect(() => {
    if (loading || draftLoaded) return;

    const values = draft.values || {};

    setCheckedCommitmentIds(
      Array.isArray(values.checkedCommitmentIds)
        ? values.checkedCommitmentIds
        : []
    );

    setTypedConfirmations(
      values.typedConfirmations &&
        typeof values.typedConfirmations === "object"
        ? (values.typedConfirmations as TypedConfirmationState)
        : {}
    );

    if (typeof values.currentStepIndex === "number") {
      const safeIndex = Math.min(
        Math.max(values.currentStepIndex, 0),
        steps.length - 1
      );

      setIdx(safeIndex);
    }

    setDraftLoaded(true);
  }, [draft, draftLoaded, loading, steps.length]);

  const allCommitmentsChecked = useMemo(() => {
    if (!commitmentRule) return false;

    if (commitmentRule.requiredChecked === "all") {
      return commitments.every((item) => checkedCommitmentIds.includes(item.id));
    }

    return commitmentRule.requiredChecked.every((id) =>
      checkedCommitmentIds.includes(id)
    );
  }, [commitmentRule, commitments, checkedCommitmentIds]);

  const typedConfirmationsValid = useMemo(() => {
    return requiredTypedConfirmations.every((item) => {
      const value = typedConfirmations[item.key] ?? "";
      return softTextMatch(value, item.exactText);
    });
  }, [requiredTypedConfirmations, typedConfirmations]);

  const canSubmit = allCommitmentsChecked && typedConfirmationsValid;

  const canGoNext =
    isCommitmentsStep
      ? allCommitmentsChecked
      : isTypedStep
        ? typedConfirmationsValid
        : canSubmit;

  const saveCurrentStepIndex = (nextIndex: number) => {
    void setValue("currentStepIndex", nextIndex);
  };

  const toggleCommitment = (id: string) => {
    setCheckedCommitmentIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id];

      void setValue("checkedCommitmentIds", next);

      return next;
    });
  };

  const handleTypedConfirmationChange = (key: string, text: string) => {
    setTypedConfirmations((prev) => {
      const next = {
        ...prev,
        [key]: text,
      };

      void setValue("typedConfirmations", next);

      return next;
    });
  };

  const goNext = async () => {
    Keyboard.dismiss();

    if (!canGoNext) return;

    if (isLastStep && isTaskAlreadyCompleted) {
      return;
    }

    await markStepCompleted(currentStep.key);

    if (idx < steps.length - 1) {
      const nextIndex = idx + 1;
      setIdx(nextIndex);
      saveCurrentStepIndex(nextIndex);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    await saveDraft({
      values: {
        checkedCommitmentIds,
        typedConfirmations,
        currentStepIndex: idx,
        completed: true,
      },
    });

    await onComplete({
      taskCode: task.config.code,
      template: task.config.template,
      checkedCommitmentIds,
      typedConfirmations,
    });
  };

  const goBack = () => {
    if (idx <= 0) return;

    const prevIndex = idx - 1;
    setIdx(prevIndex);
    saveCurrentStepIndex(prevIndex);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
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
          {[...steps].reverse().map((step, reverseIndex) => {
            const realIndex = steps.length - 1 - reverseIndex;

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
          <View style={styles.mainCard}>
            <View style={styles.headerSection}>
              <Text style={styles.cardTitle}>
                {currentStep.label}
              </Text>

              <Text style={styles.cardDescription}>
                {task.effectiveDescription ||
                  "این تعهد فقط برای امروزه پس فقط امروز رو حفظ کن."}
              </Text>
            </View>

            {isCommitmentsStep ? (
              <View style={styles.contentSection}>
                <Text style={styles.instructionText}>
                  همه تعهدهای امروز رو با آگاهی تیک بزن.
                </Text>

                <View style={styles.commitmentList}>
                  {commitments.map((item) => {
                    const checked = checkedCommitmentIds.includes(item.id);

                    return (
                      <Pressable
                        key={item.id}
                        style={[
                          styles.commitmentRow,
                          checked && styles.checkedRow,
                        ]}
                        onPress={() => toggleCommitment(item.id)}
                      >
                        <View
                          style={[
                            styles.checkbox,
                            checked && styles.checkedBox,
                          ]}
                        >
                          {checked ? (
                            <Text style={styles.checkmark}>✓</Text>
                          ) : null}
                        </View>

                        <Text style={styles.commitmentText}>{item.text}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                {!allCommitmentsChecked ? (
                  <Text style={styles.helperText}>
                    برای ادامه، همه تعهدهای لازم رو تیک بزن.
                  </Text>
                ) : null}
              </View>
            ) : null}

            {isTypedStep ? (
              <View style={styles.contentSection}>
                <Text style={styles.instructionText}>
                  بعضی تعهدها مهم‌ترند؛ برای تثبیت ذهنی، جمله رو با دست خودت
                  بنویس.
                </Text>

                {requiredTypedConfirmations.map((item) => {
                  const value = typedConfirmations[item.key] ?? "";
                  const valid = softTextMatch(value, item.exactText);

                  return (
                    <View key={item.key} style={styles.confirmationBox}>
                      <Text style={styles.confirmationLabel}>
                        این جمله رو بنویس:
                      </Text>

                      <Text style={styles.exactText}>{item.exactText}</Text>

                      <TextInput
                        value={value}
                        textAlign="right"
                        placeholder="اینجا بنویس..."
                        placeholderTextColor="rgba(255,255,255,0.32)"
                        style={[
                          styles.textInput,
                          value.length > 0 && valid && styles.validInput,
                          value.length > 0 && !valid && styles.invalidInput,
                        ]}
                        onChangeText={(text) =>
                          handleTypedConfirmationChange(item.key, text)
                        }
                      />

                      {value.length > 0 && !valid ? (
                        <Text style={styles.errorText}>
                          جمله هنوز به متن تعهد نزدیک نیست. یک‌بار آروم‌تر
                          اصلاحش کن.
                        </Text>
                      ) : null}

                      {value.length > 0 && valid ? (
                        <Text style={styles.successText}>تأیید شد.</Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : null}

            {isSummaryStep ? (
              <View style={styles.contentSection}>
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryTitle}>
                    مرور تعهد امروز
                  </Text>

                  <Text style={styles.summaryText}>
                    امروز متعهد شدی که از رفتارهای آسیب‌زننده فاصله بگیری و
                    تمرکزت رو به خودت، برنامت و ادامه مسیر برگردونی.
                  </Text>

                  <View style={styles.summaryDivider} />

                  <Text style={styles.summaryCount}>
                    تعهدهای تیک‌خورده:{" "}
                    <Text style={styles.summaryGold}>
                      {checkedCommitmentIds.length} از {commitments.length}
                    </Text>
                  </Text>

                  {requiredTypedConfirmations.length > 0 ? (
                    <Text style={styles.summaryCount}>
                      تأییدهای نوشتاری:{" "}
                      <Text style={styles.summaryGold}>
                        {requiredTypedConfirmations.length}
                      </Text>
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>
        </ScrollView>

        <View style={[styles.footer, { bottom: insets.bottom + 20 }]}>
          {idx > 0 ? (
            <TouchableOpacity style={styles.backBtn} onPress={goBack}>
              <Text style={styles.backBtnText}>قبلی</Text>
            </TouchableOpacity>
          ) : null}

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
                ? "این تعهد قبلاً ثبت شده"
                : isLastStep
                  ? task.config.meta?.submitLabel ?? "ثبت تعهد"
                  : "بعدی"}
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
    color: "#7ED957",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },

  cardDescription: {
    marginTop: 10,
    color: palette.sub,
    fontSize: 14,
    lineHeight: 23,
    textAlign: "center",
  },

  contentSection: {
    padding: 20,
  },

  instructionText: {
    fontSize: 15,
    lineHeight: 24,
    color: "#7CB8FF",
    textAlign: "center",
    marginBottom: 16,
  },

  commitmentList: {
    gap: 10,
  },

  commitmentRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },

  checkedRow: {
    backgroundColor: "rgba(126,217,87,0.12)",
    borderColor: "rgba(126,217,87,0.7)",
  },

  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  checkedBox: {
    borderColor: "#7ED957",
    backgroundColor: "#7ED957",
  },

  checkmark: {
    color: "#102015",
    fontWeight: "900",
    fontSize: 16,
  },

  commitmentText: {
    flex: 1,
    color: palette.text,
    textAlign: "right",
    fontSize: 15,
    lineHeight: 24,
    fontWeight: "700",
  },

  helperText: {
    marginTop: 14,
    color: palette.sub,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 21,
  },

  confirmationBox: {
    gap: 10,
    padding: 15,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    marginBottom: 12,
  },

  confirmationLabel: {
    textAlign: "right",
    color: palette.sub,
    fontSize: 13,
  },

  exactText: {
    textAlign: "right",
    color: palette.gold,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 24,
  },

  textInput: {
    minHeight: 54,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    color: palette.text,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    fontSize: 15,
  },

  validInput: {
    borderColor: "#7ED957",
    backgroundColor: "rgba(126,217,87,0.08)",
  },

  invalidInput: {
    borderColor: "#ff6b6b",
    backgroundColor: "rgba(255,107,107,0.07)",
  },

  errorText: {
    textAlign: "right",
    color: "#ff8a8a",
    fontSize: 12,
    lineHeight: 20,
  },

  successText: {
    textAlign: "right",
    color: "#7ED957",
    fontSize: 12,
    fontWeight: "800",
  },

  summaryBox: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  summaryTitle: {
    color: palette.gold,
    fontSize: 17,
    fontWeight: "900",
    textAlign: "right",
    marginBottom: 10,
  },

  summaryText: {
    color: palette.text,
    fontSize: 15,
    lineHeight: 25,
    textAlign: "right",
  },

  summaryDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginVertical: 14,
  },

  summaryCount: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "right",
    marginTop: 6,
  },

  summaryGold: {
    color: palette.gold,
    fontWeight: "900",
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
});
