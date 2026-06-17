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
import PracticeTimer from "../ui/PracticeTimer";
import { useLocalTaskDraft } from "../useLocalTaskDraft";

type Props = {
  dayCode: string;
  task: ResolvedTask;
  onComplete: (data?: unknown) => void;
};

const STEPS = [
  { key: "intro", label: "شروع" },
  { key: "activity", label: "انتخاب کار" },
  { key: "timer", label: "زمان انجام" },
  { key: "reminders", label: "یادآوری‌ها" },
  { key: "summary", label: "مرور نهایی" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

function formatDuration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  return `${minutes} دقیقه`;
}

function toPersianNumber(value: number | string) {
  return String(value).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

function buildDurationOptions(
  minSeconds: number,
  maxSeconds: number,
  defaultSeconds: number,
) {
  const minuteValues = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

  const options = minuteValues
    .map((minute) => {
      const value = minute * 60;
      return {
        label: toPersianNumber(minute),
        value,
      };
    })
    .filter((item) => item.value >= minSeconds && item.value <= maxSeconds);

  const hasDefault = options.some((item) => item.value === defaultSeconds);

  if (
    !hasDefault &&
    defaultSeconds >= minSeconds &&
    defaultSeconds <= maxSeconds
  ) {
    options.push({
      label: toPersianNumber(Math.round(defaultSeconds / 60)),
      value: defaultSeconds,
    });
  }

  return options.sort((a, b) => a.value - b.value);
}

export default function MoodBoostTemplate({
  dayCode,
  task,
  onComplete,
}: Props) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const isValidTask = isTaskOfTemplate(task, "mood_boost");
  const taskCode = isValidTask ? task.config.code : "";
  const rawMeta = isValidTask ? task.config.meta : null;

const meta =
  rawMeta && typeof rawMeta === "object"
    ? (rawMeta as {
        submitLabel?: string;
        introTitle?: string;
        introText?: string;
        activityPlaceholder?: string;
        timerTitle?: string;
        timerHint?: string;
        reminderTitle?: string;
        activities?: string[];
        reminders?: string[];
        minTimerSeconds?: number;
        maxTimerSeconds?: number;
        defaultTimerSeconds?: number;
      })
    : {};

  const submitLabel = meta.submitLabel || "ثبت کار حال خوب‌کن";
  const introText = meta.introText || "";
  const activityPlaceholder =
    meta.activityPlaceholder || "اگر کار تو داخل لیست نیست، اینجا بنویس...";
  const timerTitle = meta.timerTitle || "زمان انجام";
  const timerHint = meta.timerHint || "";
  const reminderTitle = meta.reminderTitle || "یادآوری‌های ادامه روز";

  const activities = Array.isArray(meta.activities) ? meta.activities : [];
  const reminders = Array.isArray(meta.reminders) ? meta.reminders : [];

  const minTimerSeconds = meta.minTimerSeconds ?? 300;
  const maxTimerSeconds = meta.maxTimerSeconds ?? 3600;
  const defaultTimerSeconds = meta.defaultTimerSeconds ?? 900;

  const { loading, draft, setValue, markStepCompleted, saveDraft } =
    useLocalTaskDraft(dayCode, taskCode);

  const [idx, setIdx] = useState(0);
  const [selectedActivity, setSelectedActivity] = useState("");
  const [customActivity, setCustomActivity] = useState("");
  const [selectedDuration, setSelectedDuration] = useState(defaultTimerSeconds);
  const [timerCompleted, setTimerCompleted] = useState(false);
  const [checkedReminders, setCheckedReminders] = useState<string[]>([]);
  const [draftLoaded, setDraftLoaded] = useState(false);

  useEffect(() => {
    if (!isValidTask) return;
    if (loading || draftLoaded) return;

    const values = draft.values || {};

    setSelectedActivity(
      typeof values.selectedActivity === "string" ? values.selectedActivity : "",
    );

    setCustomActivity(
      typeof values.customActivity === "string" ? values.customActivity : "",
    );

    setSelectedDuration(
      typeof values.selectedDuration === "number"
        ? values.selectedDuration
        : defaultTimerSeconds,
    );

    setTimerCompleted(values.timerCompleted === true);

    setCheckedReminders(
      Array.isArray(values.checkedReminders)
        ? values.checkedReminders.filter((item): item is string => typeof item === "string")
        : [],
    );

    if (typeof values.currentStepIndex === "number") {
      const safeIndex = Math.min(
        Math.max(values.currentStepIndex, 0),
        STEPS.length - 1,
      );
      setIdx(safeIndex);
    }

    setDraftLoaded(true);
  }, [draft, draftLoaded, loading, isValidTask, defaultTimerSeconds]);

  const currentStep = STEPS[idx];
  const isIntroStep = currentStep.key === "intro";
  const isActivityStep = currentStep.key === "activity";
  const isTimerStep = currentStep.key === "timer";
  const isRemindersStep = currentStep.key === "reminders";
  const isSummaryStep = currentStep.key === "summary";
  const isLastStep = idx === STEPS.length - 1;
  const isTaskAlreadyCompleted = task.backendTask?.isDone === true;

  const normalizedCustomActivity = customActivity.trim();
  const finalActivity = normalizedCustomActivity || selectedActivity;

  const activitySelected = finalActivity.length > 0;

  const timerSelected =
    typeof selectedDuration === "number" &&
    selectedDuration >= minTimerSeconds &&
    selectedDuration <= maxTimerSeconds;

  const remindersCompleted =
    reminders.length === 0 ||
    reminders.every((item) => checkedReminders.includes(item));

  const durationOptions = useMemo(() => {
    return buildDurationOptions(
      minTimerSeconds,
      maxTimerSeconds,
      defaultTimerSeconds,
    );
  }, [minTimerSeconds, maxTimerSeconds, defaultTimerSeconds]);

  const nextButtonLabel = useMemo(() => {
    if (isSummaryStep) return submitLabel;
    return "بعدی";
  }, [isSummaryStep, submitLabel]);

  const saveCurrentStepIndex = (nextIndex: number) => {
    void setValue("currentStepIndex", nextIndex);
  };

  const handleSelectActivity = async (activity: string) => {
    setSelectedActivity(activity);
    await setValue("selectedActivity", activity);
  };

  const handleCustomActivityChange = async (txt: string) => {
    setCustomActivity(txt);
    await setValue("customActivity", txt);
  };

  const handleSelectDuration = async (seconds: number) => {
    setSelectedDuration(seconds);
    await setValue("selectedDuration", seconds);
  };

  const handleTimerComplete = async () => {
    setTimerCompleted(true);
    await setValue("timerCompleted", true);
    await markStepCompleted("timer");
  };

  const handleToggleReminder = async (reminder: string) => {
    const nextValue = checkedReminders.includes(reminder)
      ? checkedReminders.filter((item) => item !== reminder)
      : [...checkedReminders, reminder];

    setCheckedReminders(nextValue);
    await setValue("checkedReminders", nextValue);
  };

  const canGoNext =
    isIntroStep ||
    (isActivityStep && activitySelected) ||
    (isTimerStep && timerSelected) ||
    (isRemindersStep && remindersCompleted) ||
    isSummaryStep;

  const goNext = async () => {
    Keyboard.dismiss();

    if (!canGoNext) return;
    if (isLastStep && isTaskAlreadyCompleted) return;

    if (!isSummaryStep) {
      await markStepCompleted(currentStep.key as StepKey);
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
        selectedActivity,
        customActivity,
        finalActivity,
        selectedDuration,
        timerCompleted,
        checkedReminders,
        currentStepIndex: idx,
        completed: true,
      },
    });

    onComplete({
      selectedActivity,
      customActivity,
      finalActivity,
      selectedDuration,
      timerCompleted,
      checkedReminders,
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
          {isIntroStep && (
  <View style={styles.mainCard}>
    <View style={styles.headerSection}>
      <Text style={styles.cardTitle}>شروع</Text>
    </View>

    <View style={styles.contentSection}>
      <Text style={styles.bodyText}>{introText}</Text>
    </View>
  </View>
)}

          {isActivityStep && (
            <View style={styles.mainCard}>
              <View style={styles.headerSection}>
                <Text style={styles.cardTitle}>{currentStep.label}</Text>
              </View>

              <View style={styles.contentSection}>
                <View style={styles.verticalList}>
                  {activities.map((activity) => {
                    const isSelected =
                      !normalizedCustomActivity && selectedActivity === activity;

                    return (
                      <TouchableOpacity
                        key={activity}
                        style={[
                          styles.checkRow,
                          isSelected && styles.checkRowActive,
                        ]}
                        onPress={() => handleSelectActivity(activity)}
                        activeOpacity={0.85}
                      >
                        <View
                          style={[
                            styles.checkBox,
                            isSelected && styles.checkBoxActive,
                          ]}
                        >
                          {isSelected && <Text style={styles.checkMark}>✓</Text>}
                        </View>

                        <Text
                          style={[
                            styles.checkRowText,
                            isSelected && styles.checkRowTextActive,
                          ]}
                        >
                          {activity}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TextInput
                  style={styles.customInput}
                  placeholder={activityPlaceholder}
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  multiline
                  value={customActivity}
                  onChangeText={handleCustomActivityChange}
                  textAlign="right"
                />

                {!activitySelected && (
                  <Text style={styles.validationError}>
                    باید یک کار را انتخاب کنی یا خودت یکی بنویسی
                  </Text>
                )}

                {activitySelected && (
                  <Text style={styles.validationSuccess}>
                    کار حال خوب‌کن انتخاب شد
                  </Text>
                )}
              </View>
            </View>
          )}

          {isTimerStep && (
            <View style={styles.mainCard}>
              <View style={styles.headerSection}>
                <Text style={styles.cardTitle}>{timerTitle}</Text>
              </View>

              {!!timerHint && (
                <View style={styles.instructionSection}>
                  <Text style={styles.instructionText}>{timerHint}</Text>
                </View>
              )}

              <View style={styles.contentSection}>
                <View style={styles.timerOptionsRow}>
                  {durationOptions.map((item) => {
                    const isSelected = selectedDuration === item.value;

                    return (
                      <TouchableOpacity
                        key={item.value}
                        style={[
                          styles.timerOption,
                          isSelected && styles.timerOptionActive,
                        ]}
                        onPress={() => handleSelectDuration(item.value)}
                        activeOpacity={0.85}
                      >
                        <Text
                          style={[
                            styles.timerOptionText,
                            isSelected && styles.timerOptionTextActive,
                          ]}
                        >
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.timerBox}>
                  <PracticeTimer
                    durationSeconds={selectedDuration}
                    onComplete={handleTimerComplete}
                  />
                </View>

                <Text style={styles.timerSelectedText}>
                  زمان انتخاب‌شده: {formatDuration(selectedDuration)}
                </Text>

                {timerCompleted && (
                  <View style={styles.doneBadge}>
                    <Text style={styles.doneBadgeText}>
                      تایمر این فعالیت کامل شد
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {isRemindersStep && (
            <View style={styles.mainCard}>
              <View style={styles.headerSection}>
                <Text style={styles.cardTitle}>{reminderTitle}</Text>
              </View>

              <View style={styles.contentSection}>
                <View style={styles.verticalList}>
                  {reminders.map((item) => {
                    const isChecked = checkedReminders.includes(item);

                    return (
                      <TouchableOpacity
                        key={item}
                        style={[
                          styles.checkRow,
                          isChecked && styles.checkRowActive,
                        ]}
                        onPress={() => handleToggleReminder(item)}
                        activeOpacity={0.85}
                      >
                        <View
                          style={[
                            styles.checkBox,
                            isChecked && styles.checkBoxActive,
                          ]}
                        >
                          {isChecked && <Text style={styles.checkMark}>✓</Text>}
                        </View>

                        <Text
                          style={[
                            styles.checkRowText,
                            isChecked && styles.checkRowTextActive,
                          ]}
                        >
                          {item}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {!remindersCompleted && reminders.length > 0 && (
                  <Text style={styles.validationError}>
                    همه یادآوری‌ها را تیک بزن و بعد برو مرحله بعد
                  </Text>
                )}

                {remindersCompleted && reminders.length > 0 && (
                  <Text style={styles.validationSuccess}>
                    همه یادآوری‌ها بررسی شدند
                  </Text>
                )}
              </View>
            </View>
          )}

          {isSummaryStep && (
            <View style={styles.mainCard}>
              <View style={styles.headerSection}>
                <Text style={styles.cardTitle}>{currentStep.label}</Text>
              </View>

              <View style={styles.contentSection}>
                <View style={styles.summaryBox}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryKey}>کار انتخاب‌شده</Text>
                    <Text style={styles.summaryVal}>
                      {finalActivity || "انتخاب نشده"}
                    </Text>
                  </View>

                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryKey}>زمان انتخاب‌شده</Text>
                    <Text style={styles.summaryVal}>
                      {timerSelected
                        ? formatDuration(selectedDuration)
                        : "انتخاب نشده"}
                    </Text>
                  </View>

                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryKey}>وضعیت تایمر</Text>
                    <Text style={styles.summaryVal}>
                      {timerCompleted ? "کامل شده" : "هنوز کامل نشده"}
                    </Text>
                  </View>

                  <View style={styles.summaryItemNoBorder}>
                    <Text style={styles.summaryKey}>یادآوری‌های تیک‌خورده</Text>
                    <Text style={styles.summaryVal}>
                      {toPersianNumber(checkedReminders.length)} از{" "}
                      {toPersianNumber(reminders.length)}
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
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
  },

  cardTitle: {
    fontSize: 19,
    fontWeight: "900",
    textAlign: "center",
    color: palette.gold,
  },

  instructionSection: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.02)",
  },

  instructionText: {
    fontSize: 14,
    lineHeight: 23,
    color: "#7CB8FF",
    textAlign: "center",
  },

  contentSection: {
    padding: 20,
    gap: 16,
  },

  bodyText: {
    color: palette.text,
    fontSize: 16,
    lineHeight: 30,
    textAlign: "right",
  },

  verticalList: {
    width: "100%",
    gap: 10,
  },

  checkRow: {
    width: "100%",
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
  },

  checkRowActive: {
    backgroundColor: "rgba(126,217,87,0.16)",
    borderColor: "#7ED957",
  },

  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },

  checkBoxActive: {
    backgroundColor: "#7ED957",
    borderColor: "#7ED957",
  },

  checkMark: {
    color: "#0B1B12",
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 18,
  },

  checkRowText: {
    flex: 1,
    color: palette.text,
    fontSize: 15,
    lineHeight: 24,
    textAlign: "right",
  },

  checkRowTextActive: {
    color: "#DDF8CF",
    fontWeight: "700",
  },

  customInput: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 15,
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: palette.text,
    textAlign: "right",
    minHeight: 120,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    textAlignVertical: "top",
  },

  validationError: {
    color: "#FF6B6B",
    fontSize: 13,
    textAlign: "right",
    width: "100%",
    marginTop: -4,
  },

  validationSuccess: {
    color: "#2FBF71",
    fontSize: 13,
    textAlign: "right",
    width: "100%",
    marginTop: -4,
  },

  timerOptionsRow: {
    width: "100%",
    flexDirection: "row-reverse",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 8,
  },

  timerOption: {
    minWidth: 48,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },

  timerOptionActive: {
    backgroundColor: "rgba(126,217,87,0.18)",
    borderColor: "#7ED957",
  },

  timerOptionText: {
    color: palette.text,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },

  timerOptionTextActive: {
    color: "#B8F594",
  },

  timerBox: {
    width: "100%",
  },

  timerSelectedText: {
    color: palette.sub,
    fontSize: 14,
    textAlign: "right",
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
