import { ScreenLayout } from "@/components/ScreenLayout";
import { palette } from "@/constants/theme/palette";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ResolvedTask } from "../types";
import { useLocalTaskDraft } from "../useLocalTaskDraft";

type ReminderTemplateProps = {
  dayCode: string;
  task: ResolvedTask<"reminder">;
  onComplete: (data?: unknown) => void | Promise<void>;
};

type ReminderAction =
  | "go_to_safe_place"
  | "random_safe_place_technique"
  | null;

export default function ReminderTemplate({
  dayCode,
  task,
  onComplete,
}: ReminderTemplateProps) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const { loading, draft, setValue, saveDraft } = useLocalTaskDraft(
    dayCode,
    task.config.code
  );

  const [selectedAction, setSelectedAction] =
    useState<ReminderAction>(null);

  const [draftLoaded, setDraftLoaded] = useState(false);

  const isTaskAlreadyCompleted = task.backendTask?.isDone === true;

  const submitLabel = task.config.meta?.submitLabel || "متوجه شدم";

  const description = useMemo(() => {
    return (
      task.effectiveDescription ||
      task.config.descriptionFa ||
      "اگه امروز دچار فشار، وسوسه، اضطراب یا میل شدید به برگشتن شدی، به تب پناهگاه برو و تکنیکی که به حالت نزدیک‌تر هست رو انجام بده."
    );
  }, [task.effectiveDescription, task.config.descriptionFa]);

  useEffect(() => {
    if (loading || draftLoaded) return;

    const values = draft.values || {};

    if (
      values.selectedAction === "go_to_safe_place" ||
      values.selectedAction === "random_safe_place_technique"
    ) {
      setSelectedAction(values.selectedAction);
    }

    setDraftLoaded(true);
  }, [draft.values, draftLoaded, loading]);

  const canSubmit = selectedAction !== null && !isTaskAlreadyCompleted;

  const handleSelect = (action: Exclude<ReminderAction, null>) => {
    setSelectedAction(action);
    void setValue("selectedAction", action);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    await saveDraft({
      values: {
        selectedAction,
        completed: true,
      },
    });

    await onComplete({
      taskCode: task.config.code,
      template: task.config.template,
      selectedAction,
    });
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
      <View style={styles.container}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 120 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <View style={styles.headerSection}>
              <Text style={styles.kicker}>یادآوری حمایتی</Text>

              <Text style={styles.description}>{description}</Text>
            </View>

            <View style={styles.contentSection}>
              <View style={styles.warningBox}>
                <Text style={styles.warningTitle}>قانون ساده امروز</Text>

                <Text style={styles.warningText}>
                  اگه الان فشار احساسی، اضطراب، وسوسه پیام دادن یا میل شدید به
                  برگشتن داری، مستقیم برو تب پناهگاه و تکنیک مناسب همون لحظه رو
                  انجام بده.
                </Text>
              </View>

              <View style={styles.randomBox}>
                <Text style={styles.randomText}>
                  اگه هیچ‌کدوم از موقعیت‌های پناهگاه دقیقاً به حالت نمی‌خوره،
                  وسواس به خرج نده؛ یکی از تکنیک‌ها رو انتخاب کن و انجام
                  بده. ققنوس جای فکر اضافه نیست، جای عمله.
                </Text>
              </View>

              <View style={styles.actions}>
                <Pressable
                  style={[
                    styles.optionButton,
                    selectedAction === "go_to_safe_place" &&
                      styles.optionButtonActive,
                  ]}
                  onPress={() => handleSelect("go_to_safe_place")}
                >
                  <View
                    style={[
                      styles.radio,
                      selectedAction === "go_to_safe_place" &&
                        styles.radioActive,
                    ]}
                  />

                  <Text
                    style={[
                      styles.optionText,
                      selectedAction === "go_to_safe_place" &&
                        styles.optionTextActive,
                    ]}
                  >
                    الان میرم پناهگاه و تکنیک مناسب حالم رو انجام می‌دم
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.optionButton,
                    selectedAction === "random_safe_place_technique" &&
                      styles.optionButtonActive,
                  ]}
                  onPress={() =>
                    handleSelect("random_safe_place_technique")
                  }
                >
                  <View
                    style={[
                      styles.radio,
                      selectedAction === "random_safe_place_technique" &&
                        styles.radioActive,
                    ]}
                  />

                  <Text
                    style={[
                      styles.optionText,
                      selectedAction === "random_safe_place_technique" &&
                        styles.optionTextActive,
                    ]}
                  >
                    الان نیاز فوری ندارم؛ اگه لازم شد یک تکنیک رو به شکل انتخابی انجام
                    می‌دم
                  </Text>
                </Pressable>
              </View>

              {isTaskAlreadyCompleted ? (
                <Text style={styles.completedText}>
                  این یادآوری قبلاً ثبت شده.
                </Text>
              ) : null}
            </View>
          </View>
        </ScrollView>

        <View style={[styles.footer, { bottom: insets.bottom + 20 }]}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              !canSubmit && styles.submitButtonDisabled,
            ]}
            disabled={!canSubmit}
            onPress={handleSubmit}
          >
            <Text style={styles.submitText}>
              {isTaskAlreadyCompleted ? "قبلاً ثبت شده" : submitLabel}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
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

  scrollContent: {
    padding: 24,
    alignItems: "center",
  },

  card: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
    marginTop: -15,
  },

  headerSection: {
    paddingVertical: 22,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
  },

  kicker: {
    color: palette.gold,
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 10,
    textAlign: "center",
  },

  title: {
    color: palette.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 12,
    textAlign: "center",
  },

  description: {
    color: palette.sub,
    fontSize: 15,
    lineHeight: 26,
    textAlign: "center",
  },

  contentSection: {
    padding: 20,
  },

  warningBox: {
    backgroundColor: "rgba(212,175,55,0.1)",
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.28)",
    marginBottom: 12,
  },

  warningTitle: {
    color: palette.gold,
    fontSize: 15,
    fontWeight: "900",
    textAlign: "right",
    marginBottom: 8,
  },

  warningText: {
    color: "#F4E3A1",
    fontSize: 14,
    lineHeight: 24,
    textAlign: "right",
  },

  randomBox: {
    backgroundColor: "rgba(124,184,255,0.08)",
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: "rgba(124,184,255,0.22)",
    marginBottom: 18,
  },

  randomText: {
    color: "#BFD9FF",
    fontSize: 14,
    lineHeight: 24,
    textAlign: "right",
  },

  actions: {
    gap: 10,
  },

  optionButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 18,
    paddingVertical: 15,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  optionButtonActive: {
    borderColor: palette.gold,
    backgroundColor: "rgba(212,175,55,0.14)",
  },

  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  radioActive: {
    borderColor: palette.gold,
    backgroundColor: palette.gold,
  },

  optionText: {
    flex: 1,
    color: palette.text,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 24,
    textAlign: "right",
  },

  optionTextActive: {
    color: palette.gold,
  },

  completedText: {
    marginTop: 16,
    color: "#7ED957",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },

  footer: {
    position: "absolute",
    left: 20,
    right: 20,
  },

  submitButton: {
    height: 60,
    borderRadius: 20,
    backgroundColor: palette.gold,
    alignItems: "center",
    justifyContent: "center",
  },

  submitButtonDisabled: {
    opacity: 0.45,
  },

  submitText: {
    color: palette.bg,
    fontSize: 17,
    fontWeight: "900",
  },
});
