//phoenix-app\components\pelekan\gosastan\ui\TaskStepRenderer.tsx
import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import type { TaskStep, TaskStepValue } from "../types";
import AudioPracticePlayer from "./AudioPracticePlayer";
import PracticeTimer from "./PracticeTimer";

type TaskStepRendererProps = {
  step: TaskStep;
  value?: TaskStepValue;
  stepValues?: Record<string, TaskStepValue>;
  onChange: (stepKey: string, value: TaskStepValue) => void;
  onNavigate?: (route: string, stepKey: string) => void;
  onGoToStep?: (stepKey: string) => void;
  onInputFocus?: (input: TextInput | null) => void;
};

export default function TaskStepRenderer({
  step,
  value,
  stepValues = {},
  onChange,
  onNavigate,
  onGoToStep,
  onInputFocus,
}: TaskStepRendererProps) {
  useEffect(() => {
    const isAudioOnlyStep =
      step.stepType === "audio" ||
      step.stepType === "sleep_audio" ||
      step.stepType === "conditional_audio" ||
      step.stepType === "timer_audio";

    if (!isAudioOnlyStep || value?.completed) return;

    if (step.stepType === "conditional_audio") {
      const sourceScore = stepValues[step.sourceScoreKey]?.score;

      const selectedVariant = step.variants.find((variant) => {
        if (typeof sourceScore !== "number") return false;
        return sourceScore >= variant.min && sourceScore <= variant.max;
      });

      if (!selectedVariant) return;

      onChange(step.key, {
        ...(value ?? {}),
        selectedAudioKey: selectedVariant.audioKey,
        completed: true,
      });

      return;
    }

    onChange(step.key, {
      ...(value ?? {}),
      completed: true,
    });
  }, [step, stepValues, value, onChange]);

  const markCompleted = () => {
    onChange(step.key, { completed: true });
  };

  const markNotCompleted = () => {
    onChange(step.key, { completed: false });
  };

  const sleepResetPhase = value?.sleepResetPhase ?? "intro";

  const shouldHideInstruction =
    step.stepType === "sleep_reset" &&
    (sleepResetPhase === "intro" || sleepResetPhase === "timer");

  return (
    <View style={styles.mainCard}>
      <View style={styles.headerSection}>
        <Text style={styles.title}>{step.title}</Text>
      </View>

      {step.instruction && !shouldHideInstruction ? (
        <View style={styles.instructionSection}>
          <Text style={styles.instruction}>{step.instruction}</Text>
        </View>
      ) : null}

      <View style={styles.contentSection}>
        {renderStepBody({
          step,
          value,
          stepValues,
          onChange,
          onNavigate,
          onGoToStep,
          onInputFocus,
          markCompleted,
          markNotCompleted,
        })}
      </View>
    </View>
  );
}

type RenderStepBodyParams = {
  step: TaskStep;
  value?: TaskStepValue;
  stepValues: Record<string, TaskStepValue>;
  onChange: (stepKey: string, value: TaskStepValue) => void;
  onNavigate?: (route: string, stepKey: string) => void;
  onGoToStep?: (stepKey: string) => void;
  onInputFocus?: (input: TextInput | null) => void;
  markCompleted: () => void;
  markNotCompleted: () => void;
};

type FocusAwareTextInputProps = React.ComponentProps<typeof TextInput> & {
  onInputFocus?: (input: TextInput | null) => void;
};

function FocusAwareTextInput({
  onInputFocus,
  onFocus,
  ...props
}: FocusAwareTextInputProps) {
  const inputRef = React.useRef<TextInput | null>(null);

  return (
    <TextInput
      ref={inputRef}
      {...props}
      onFocus={(event) => {
        onInputFocus?.(inputRef.current);
        onFocus?.(event);
      }}
    />
  );
}

function renderStepBody({
  step,
  value,
  stepValues,
  onChange,
  onNavigate,
  onGoToStep,
  onInputFocus,
  markCompleted,
  markNotCompleted,
}: RenderStepBodyParams) {
  switch (step.stepType) {
    case "text_input":
      return (
        <FocusAwareTextInput
          value={value?.text ?? ""}
          placeholder={step.placeholder}
          onInputFocus={onInputFocus}
          multiline={step.multiline}
          placeholderTextColor="rgba(255,255,255,0.3)"
          textAlign="right"
          style={[
            styles.textInput,
            step.multiline ? styles.multilineInput : null,
          ]}
          onChangeText={(text) => {
            onChange(step.key, {
              text,
              completed: text.trim().length > 0,
            });
          }}
        />
      );

    case "manual_action":
      return (
        <Pressable
          style={[
            styles.actionButton,
            value?.completed ? styles.doneButton : null,
          ]}
          onPress={value?.completed ? markNotCompleted : markCompleted}
        >
          <Text style={styles.actionButtonText}>
            {value?.completed ? "انجام شد" : "انجام دادم"}
          </Text>
        </Pressable>
      );

    case "navigation_cta":
      return (
        <Pressable
          style={[
            styles.actionButton,
            value?.completed ? styles.doneButton : null,
          ]}
          onPress={() => {
            onChange(step.key, {
              navigated: true,
              completed: true,
            });

            onNavigate?.(step.route, step.key);
          }}
        >
          <Text style={styles.actionButtonText}>
            {step.buttonLabel ?? "ادامه"}
          </Text>
        </Pressable>
      );

    case "mood_scale": {
      const min = step.min ?? 1;
      const max = step.max ?? 10;
      const numbers = Array.from(
        { length: max - min + 1 },
        (_, index) => min + index,
      );

      return (
        <View>
          {step.minLabel || step.maxLabel ? (
            <View style={styles.scaleLabelsRow}>
              <Text style={styles.scaleLabel}>{step.maxLabel}</Text>
              <Text style={styles.scaleLabel}>{step.minLabel}</Text>
            </View>
          ) : null}

          <View style={styles.scoreGrid}>
            {numbers.map((num) => {
              const isActive = value?.score === num;

              return (
                <Pressable
                  key={num}
                  style={[
                    styles.scoreCircle,
                    isActive ? styles.activeScoreCircle : null,
                  ]}
                  onPress={() =>
                    onChange(step.key, {
                      score: num,
                      completed: true,
                      deviceDate: new Date().toISOString(),
                    })
                  }
                >
                  <Text
                    style={[
                      styles.scoreCircleText,
                      isActive ? styles.activeScoreCircleText : null,
                    ]}
                  >
                    {num}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      );
    }

    case "multi_text_input":
      return (
        <View style={styles.fieldList}>
          {step.fields.map((field) => {
            const currentFields = value?.fields ?? {};
            const fieldValue = currentFields[field.key] ?? "";

            return (
              <View key={field.key} style={styles.fieldBox}>
                <Text style={styles.fieldLabel}>{field.label}</Text>

                <FocusAwareTextInput
                  value={fieldValue}
                  placeholder={field.placeholder}
                  onInputFocus={onInputFocus}
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  textAlign="right"
                  style={styles.textInput}
                  onChangeText={(text) => {
                    const nextFields = {
                      ...currentFields,
                      [field.key]: text,
                    };

                    const requiredFields = step.fields.filter(
                      (item) => item.required,
                    );

                    const completed = requiredFields.every((item) => {
                      return nextFields[item.key]?.trim().length > 0;
                    });

                    onChange(step.key, {
                      fields: nextFields,
                      completed,
                    });
                  }}
                />
              </View>
            );
          })}
        </View>
      );

    case "repeatable_text_list": {
      const items = value?.items ?? [""];
      const minItems = step.minItems ?? 1;
      const maxItems = step.maxItems ?? 10;

      const updateItem = (index: number, text: string) => {
        const nextItems = [...items];
        nextItems[index] = text;

        const filledItems = nextItems.filter((item) => item.trim().length > 0);

        onChange(step.key, {
          items: nextItems,
          completed: filledItems.length >= minItems,
        });
      };

      const addItem = () => {
        if (items.length >= maxItems) return;

        onChange(step.key, {
          items: [...items, ""],
          completed: false,
        });
      };

      return (
        <View style={styles.fieldList}>
          {items.map((item, index) => (
            <FocusAwareTextInput
              key={`${step.key}-${index}`}
              value={item}
              placeholder={`${step.itemLabel ?? "مورد"} ${index + 1}`}
              onInputFocus={onInputFocus}
              placeholderTextColor="rgba(255,255,255,0.3)"
              textAlign="right"
              style={styles.textInput}
              onChangeText={(text) => updateItem(index, text)}
            />
          ))}

          {items.length < maxItems ? (
            <Pressable style={styles.secondaryButton} onPress={addItem}>
              <Text style={styles.secondaryButtonText}>افزودن مورد جدید</Text>
            </Pressable>
          ) : null}
        </View>
      );
    }

    case "multi_text_with_score": {
      const currentFields = value?.fields ?? {};
      const currentScore = value?.score;

      const requiredFields = step.fields.filter((field) => field.required);

      const areRequiredFieldsFilled = (fields: Record<string, string>) => {
        return requiredFields.every((field) => {
          return fields[field.key]?.trim().length > 0;
        });
      };

      const isCompleted = (fields: Record<string, string>, score?: number) => {
        return (
          areRequiredFieldsFilled(fields) &&
          typeof score === "number" &&
          score >= step.scoreField.min &&
          score <= step.scoreField.max
        );
      };

      const scoreNumbers = Array.from(
        { length: step.scoreField.max - step.scoreField.min + 1 },
        (_, index) => step.scoreField.min + index,
      );

      return (
        <View style={styles.fieldList}>
          {step.fields.map((field) => {
            const fieldValue = currentFields[field.key] ?? "";

            return (
              <View key={field.key} style={styles.fieldBox}>
                <Text style={styles.fieldLabel}>{field.label}</Text>

                <FocusAwareTextInput
                  value={fieldValue}
                  placeholder={field.placeholder}
                  onInputFocus={onInputFocus}
                  multiline={field.multiline}
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  textAlign="right"
                  style={[
                    styles.textInput,
                    field.multiline ? styles.multilineInput : null,
                  ]}
                  onChangeText={(text) => {
                    const nextFields = {
                      ...currentFields,
                      [field.key]: text,
                    };

                    onChange(step.key, {
                      fields: nextFields,
                      score: currentScore,
                      scoreFieldKey: step.scoreField.key,
                      completed: isCompleted(nextFields, currentScore),
                    });
                  }}
                />
              </View>
            );
          })}

          <View style={styles.fieldBox}>
            <Text style={styles.fieldLabel}>{step.scoreField.label}</Text>

            <View style={styles.scoreGrid}>
              {scoreNumbers.map((num) => {
                const isActive = currentScore === num;

                return (
                  <Pressable
                    key={num}
                    style={[
                      styles.scoreCircle,
                      isActive ? styles.activeScoreCircle : null,
                    ]}
                    onPress={() => {
                      onChange(step.key, {
                        fields: currentFields,
                        score: num,
                        scoreFieldKey: step.scoreField.key,
                        completed: isCompleted(currentFields, num),
                        deviceDate: new Date().toISOString(),
                      });
                    }}
                  >
                    <Text
                      style={[
                        styles.scoreCircleText,
                        isActive ? styles.activeScoreCircleText : null,
                      ]}
                    >
                      {num}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      );
    }

    case "audio_with_text": {
      const text = value?.text ?? "";

      return (
        <View style={styles.fieldList}>
          <AudioPracticePlayer
            audioKey={step.audioKey}
            onCompleted={() =>
              onChange(step.key, {
                audioCompleted: true,
                text,
                textFieldKey: step.textField.key,
                completed: text.trim().length > 0,
              })
            }
          />

          <View style={styles.fieldBox}>
            <Text style={styles.fieldLabel}>{step.textField.label}</Text>

            <FocusAwareTextInput
              value={text}
              placeholder={step.textField.placeholder}
              onInputFocus={onInputFocus}
              multiline={step.textField.multiline}
              placeholderTextColor="rgba(255,255,255,0.3)"
              textAlign="right"
              style={[
                styles.textInput,
                step.textField.multiline ? styles.multilineInput : null,
              ]}
              onChangeText={(nextText) => {
                onChange(step.key, {
                  text: nextText,
                  textFieldKey: step.textField.key,
                  audioCompleted: Boolean(value?.audioCompleted),
                  completed: nextText.trim().length > 0,
                });
              }}
            />
          </View>
        </View>
      );
    }

    case "audio_then_text_list": {
      const items = value?.items ?? [""];
      const minItems = step.minItems ?? 1;
      const maxItems = step.maxItems ?? 10;

      const updateItem = (index: number, text: string) => {
        const nextItems = [...items];
        nextItems[index] = text;

        const filledItems = nextItems.filter((item) => item.trim().length > 0);

        onChange(step.key, {
          items: nextItems,
          completed:
            Boolean(value?.audioCompleted) && filledItems.length >= minItems,
        });
      };

      const addItem = () => {
        if (items.length >= maxItems) return;

        onChange(step.key, {
          items: [...items, ""],
          completed: false,
        });
      };

      return (
        <View style={styles.fieldList}>
          <AudioPracticePlayer
            audioKey={step.audioKey}
            onCompleted={() => {
              const filledItems = items.filter(
                (item) => item.trim().length > 0,
              );

              onChange(step.key, {
                audioCompleted: true,
                completed: filledItems.length >= minItems,
              });
            }}
          />

          {items.map((item, index) => (
            <FocusAwareTextInput
              key={`${step.key}-${index}`}
              value={item}
              placeholder={`نکته ${index + 1}`}
              onInputFocus={onInputFocus}
              placeholderTextColor="rgba(255,255,255,0.3)"
              textAlign="right"
              style={styles.textInput}
              onChangeText={(text) => updateItem(index, text)}
            />
          ))}

          {items.length < maxItems ? (
            <Pressable style={styles.secondaryButton} onPress={addItem}>
              <Text style={styles.secondaryButtonText}>افزودن مورد جدید</Text>
            </Pressable>
          ) : null}
        </View>
      );
    }

    case "audio":
      return (
        <AudioPracticePlayer
          audioKey={step.audioKey}
          onCompleted={() =>
            onChange(step.key, {
              ...(value ?? {}),
              audioCompleted: true,
              completed: true,
            })
          }
        />
      );

    case "sleep_audio":
      return (
        <View style={styles.fieldList}>
          <AudioPracticePlayer
            audioKey={step.audioKey}
            onCompleted={() =>
              onChange(step.key, {
                ...(value ?? {}),
                audioCompleted: true,
                completed: true,
              })
            }
          />

          {step.ctaLabel && step.fallbackStepKey ? (
            <View style={styles.sleepActivatorBox}>
              <Pressable
                style={[styles.secondaryButton, styles.dangerGlassButton]}
                onPress={() => {
                  onChange(step.key, {
                    ...(value ?? {}),
                    openedFallback: true,
                  });
                  if (!step.fallbackStepKey) return;
                  onGoToStep?.(step.fallbackStepKey);
                }}
              >
                <Text style={styles.secondaryButtonText}>{step.ctaLabel}</Text>
              </Pressable>

              <Text style={styles.sleepActivatorHint}>
                بعد از ۲۰ دقیقه از مراقبه، اگه خوابت نبرده بود، وارد فعالساز
                خواب شو.
              </Text>
            </View>
          ) : null}
        </View>
      );

    case "sleep_help":
      return (
        <View style={styles.sleepHelpContainer}>
          {step.sections.map((section, index) => (
            <View key={`${step.key}-${index}`} style={styles.sleepHelpSection}>
              {section.title ? (
                <Text style={styles.sleepHelpSectionTitle}>
                  {section.title}
                </Text>
              ) : null}

              <Text style={styles.sleepHelpSectionBody}>{section.body}</Text>
            </View>
          ))}

          {step.backStepKey ? (
            <Pressable
              style={styles.actionButton}
              onPress={() => {
                onChange(step.key, {
                  ...(value ?? {}),
                  completed: true,
                });
                if (!step.backStepKey) return;
                onGoToStep?.(step.backStepKey);
              }}
            >
              <Text style={styles.actionButtonText}>
                {step.backButtonLabel ?? "برگشت"}
              </Text>
            </Pressable>
          ) : null}
        </View>
      );

    case "sleep_reset": {
      const phase = value?.sleepResetPhase ?? "intro";
      const selectedActivityId = value?.selectedActivityId;

      const selectedActivity = step.activities.find(
        (activity) => activity.id === selectedActivityId,
      );

      if (phase === "intro") {
        return (
          <View style={styles.fieldList}>
            {step.introTitle ? (
              <Text style={styles.sleepResetIntroTitle}>{step.introTitle}</Text>
            ) : null}

            {step.introBody ? (
              <Text style={styles.sleepResetIntroBody}>{step.introBody}</Text>
            ) : null}

            <Pressable
              style={styles.actionButton}
              onPress={() => {
                onChange(step.key, {
                  ...(value ?? {}),
                  sleepResetPhase: "select",
                  completed: false,
                  timerCompleted: false,
                });
              }}
            >
              <Text style={styles.actionButtonText}>انتخاب یک کار آروم</Text>
            </Pressable>
          </View>
        );
      }

      if (phase === "select") {
        return (
          <View style={styles.fieldList}>
            <Text style={styles.sleepResetIntroTitle}>یکی رو انتخاب کن</Text>

            <Text style={styles.sleepResetIntroBody}>
              لازم نیست بهترین گزینه رو پیدا کنی؛{"\n"}
              یک کار ساده انتخاب کن و انجامش بده.
            </Text>

            <View style={styles.sleepResetActivities}>
              {step.activities.map((activity) => {
                const isSelected = selectedActivityId === activity.id;

                return (
                  <Pressable
                    key={activity.id}
                    style={[
                      styles.sleepResetActivityCard,
                      isSelected ? styles.sleepResetActivityCardSelected : null,
                    ]}
                    onPress={() => {
                      onChange(step.key, {
                        ...(value ?? {}),
                        sleepResetPhase: "select",
                        selectedActivityId: activity.id,
                        selectedActivityLabel: activity.label,
                        selectedDurationSeconds: activity.durationSeconds,
                        timerCompleted: false,
                        completed: false,
                      });
                    }}
                  >
                    <View style={styles.sleepResetActivityRow}>
                      <View
                        style={[
                          styles.sleepResetCheckBox,
                          isSelected ? styles.sleepResetCheckBoxSelected : null,
                        ]}
                      >
                        {isSelected ? (
                          <Text style={styles.sleepResetCheckText}>✓</Text>
                        ) : null}
                      </View>

                      <Text
                        style={[
                          styles.sleepResetActivityLabel,
                          isSelected
                            ? styles.sleepResetActivityLabelSelected
                            : null,
                        ]}
                      >
                        {activity.label}
                      </Text>
                    </View>

                    {activity.hint ? (
                      <Text style={styles.sleepResetActivityHint}>
                        {activity.hint}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              style={[
                styles.actionButton,
                !selectedActivity ? styles.disabledButton : null,
              ]}
              disabled={!selectedActivity}
              onPress={() => {
                if (!selectedActivity) return;

                onChange(step.key, {
                  ...(value ?? {}),
                  sleepResetPhase: "timer",
                  selectedActivityId: selectedActivity.id,
                  selectedActivityLabel: selectedActivity.label,
                  selectedDurationSeconds: selectedActivity.durationSeconds,
                  timerCompleted: false,
                  completed: false,
                });
              }}
            >
              <Text style={styles.actionButtonText}>شروع تایمر</Text>
            </Pressable>

            <Pressable
              style={styles.secondaryButton}
              onPress={() => {
                onChange(step.key, {
                  ...(value ?? {}),
                  sleepResetPhase: "intro",
                  completed: false,
                });
              }}
            >
              <Text style={styles.secondaryButtonText}>قبلی</Text>
            </Pressable>
          </View>
        );
      }

      if (phase === "timer" && selectedActivity) {
        return (
          <View style={styles.fieldList}>
            <View style={styles.sleepResetTimerBox}>
              <Text style={styles.sleepResetSelectedTitle}>
                الان فقط همین کار رو انجام بده
              </Text>

              <Text style={styles.sleepResetSelectedHint}>
                {selectedActivity.label}
              </Text>

              {selectedActivity.hint ? (
                <Text style={styles.sleepResetTimerHint}>
                  {selectedActivity.hint}
                </Text>
              ) : null}

              <PracticeTimer
                durationSeconds={selectedActivity.durationSeconds}
                onComplete={() => {
                  onChange(step.key, {
                    ...(value ?? {}),
                    sleepResetPhase: "timer",
                    selectedActivityId: selectedActivity.id,
                    selectedActivityLabel: selectedActivity.label,
                    selectedDurationSeconds: selectedActivity.durationSeconds,
                    timerCompleted: true,
                    completed: true,
                  });
                }}
              />

              <Pressable
                style={styles.secondaryButton}
                onPress={() => {
                  onChange(step.key, {
                    ...(value ?? {}),
                    sleepResetPhase: "select",
                    timerCompleted: false,
                    completed: false,
                  });
                }}
              >
                <Text style={styles.secondaryButtonText}>
                  انتخاب یک کار دیگه
                </Text>
              </Pressable>

              {step.backStepKey ? (
                <Pressable
                  style={styles.actionButton}
                  onPress={() => {
                    onChange(step.key, {
                      ...(value ?? {}),
                      sleepResetPhase: "timer",
                      selectedActivityId: selectedActivity.id,
                      selectedActivityLabel: selectedActivity.label,
                      selectedDurationSeconds: selectedActivity.durationSeconds,
                      timerCompleted: Boolean(value?.timerCompleted),
                      completed: true,
                    });

                    onGoToStep?.(step.backStepKey!);
                  }}
                >
                  <Text style={styles.actionButtonText}>
                    {step.backButtonLabel ?? "برگشت به مراقبه خواب"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        );
      }

      return (
        <View style={styles.fieldList}>
          <Text style={styles.warningText}>
            برای شروع، یک فعالیت آروم انتخاب کن.
          </Text>

          <Pressable
            style={styles.actionButton}
            onPress={() => {
              onChange(step.key, {
                ...(value ?? {}),
                sleepResetPhase: "select",
                completed: false,
              });
            }}
          >
            <Text style={styles.actionButtonText}>انتخاب فعالیت</Text>
          </Pressable>
        </View>
      );
    }

    case "timer_audio":
      return (
        <View style={styles.fieldList}>
          <AudioPracticePlayer
            audioKey={step.audioKey}
            onCompleted={() =>
              onChange(step.key, {
                audioCompleted: true,
                completed:
                  step.durationSeconds && step.durationSeconds > 0
                    ? Boolean(value?.timerCompleted)
                    : true,
              })
            }
          />

          {step.durationSeconds ? (
            <PracticeTimer
              durationSeconds={step.durationSeconds}
              onComplete={() =>
                onChange(step.key, {
                  timerCompleted: true,
                  completed: true,
                })
              }
            />
          ) : null}
        </View>
      );

    case "conditional_audio": {
      const sourceScore = stepValues[step.sourceScoreKey]?.score;

      const selectedVariant = step.variants.find((variant) => {
        if (typeof sourceScore !== "number") return false;
        return sourceScore >= variant.min && sourceScore <= variant.max;
      });

      if (!selectedVariant) {
        return (
          <Text style={styles.warningText}>
            برای انتخاب فایل صوتی، اول مرحله ثبت حال و هیجانات ابتدای روز رو کامل کن.
          </Text>
        );
      }

      return (
        <View style={styles.fieldList}>
          {selectedVariant.title ? (
            <Text style={styles.selectedAudioTitle}>
              {selectedVariant.title}
            </Text>
          ) : null}

          <AudioPracticePlayer
            audioKey={selectedVariant.audioKey}
            onCompleted={() =>
              onChange(step.key, {
                ...(value ?? {}),
                selectedAudioKey: selectedVariant.audioKey,
                audioCompleted: true,
                completed: true,
              })
            }
          />
        </View>
      );
    }

    case "checklist_text": {
      const checkedItems = value?.checkedItems ?? [];
      const allChecked =
        step.checklist.length > 0 &&
        step.checklist.every((item) => checkedItems.includes(item.id));

      const textCompleted = (value?.text ?? "").trim().length > 0;

      const toggleChecklistItem = (itemId: string) => {
        const isChecked = checkedItems.includes(itemId);

        const nextCheckedItems = isChecked
          ? checkedItems.filter((id) => id !== itemId)
          : [...checkedItems, itemId];

        const nextAllChecked =
          step.checklist.length > 0 &&
          step.checklist.every((item) => nextCheckedItems.includes(item.id));

        onChange(step.key, {
          checkedItems: nextCheckedItems,
          completed: nextAllChecked && textCompleted,
        });
      };

      return (
        <View style={styles.fieldList}>
          <ChecklistView
            checklist={step.checklist}
            checkedItems={checkedItems}
            onToggle={toggleChecklistItem}
          />

          <FocusAwareTextInput
            value={value?.text ?? ""}
            placeholder={step.placeholder}
            onInputFocus={onInputFocus}
            multiline={step.multiline}
            placeholderTextColor="rgba(255,255,255,0.3)"
            textAlign="right"
            style={[
              styles.textInput,
              step.multiline ? styles.multilineInput : null,
            ]}
            onChangeText={(text) => {
              onChange(step.key, {
                text,
                completed: allChecked && text.trim().length > 0,
              });
            }}
          />
        </View>
      );
    }

    case "info_checklist_action": {
      const checkedItems = value?.checkedItems ?? [];

      const toggleChecklistItem = (itemId: string) => {
        const isChecked = checkedItems.includes(itemId);

        const nextCheckedItems = isChecked
          ? checkedItems.filter((id) => id !== itemId)
          : [...checkedItems, itemId];

        const allChecked =
          step.checklist.length > 0 &&
          step.checklist.every((item) => nextCheckedItems.includes(item.id));

        onChange(step.key, {
          checkedItems: nextCheckedItems,
          completed: allChecked,
        });
      };

      return (
        <View style={styles.fieldList}>
          <ChecklistView
            checklist={step.checklist}
            checkedItems={checkedItems}
            onToggle={toggleChecklistItem}
          />
        </View>
      );
    }

    case "info_navigation_action": {
      const checkedItems = value?.checkedItems ?? [];
      const hasChecklist = Boolean(step.checklist?.length);
      const isDayPlannerStep = step.key === "day_planner_check";

      const toggleChecklistItem = (itemId: string) => {
        const isChecked = checkedItems.includes(itemId);

        const nextCheckedItems = isChecked
          ? checkedItems.filter((id) => id !== itemId)
          : [...checkedItems, itemId];

        const allChecked = step.checklist?.length
          ? step.checklist.every((item) => nextCheckedItems.includes(item.id))
          : false;

        const navigationRequirementPassed =
          !step.requireNavigationBeforeComplete || Boolean(value?.navigated);

        onChange(step.key, {
          checkedItems: nextCheckedItems,
          completed: isDayPlannerStep
            ? allChecked
            : allChecked && navigationRequirementPassed,
        });
      };

      const canComplete = isDayPlannerStep
        ? true
        : !step.requireNavigationBeforeComplete || Boolean(value?.navigated);

      return (
        <View style={styles.fieldList}>
          {!isDayPlannerStep ? (
            <Pressable
              style={styles.actionButton}
              onPress={() => {
                onChange(step.key, {
                  navigated: true,
                });

                onNavigate?.(step.route, step.key);
              }}
            >
              <Text style={styles.actionButtonText}>
                {step.ctaLabel ?? "رفتن به بخش مربوطه"}
              </Text>
            </Pressable>
          ) : null}

          {hasChecklist ? (
            <ChecklistView
              checklist={step.checklist!}
              checkedItems={checkedItems}
              onToggle={toggleChecklistItem}
            />
          ) : (
            <Pressable
              style={[
                styles.secondaryButton,
                value?.completed ? styles.doneOutlineButton : null,
                !canComplete ? styles.disabledButton : null,
              ]}
              disabled={!canComplete}
              onPress={() => {
                onChange(step.key, {
                  completed: !value?.completed,
                });
              }}
            >
              <Text
                style={[
                  styles.secondaryButtonText,
                  value?.completed ? styles.doneOutlineButtonText : null,
                  !canComplete ? styles.disabledButtonText : null,
                ]}
              >
                {value?.completed
                  ? (step.undoButtonLabel ?? "برگشت از انجام‌شده")
                  : (step.doneButtonLabel ?? "انجام دادم")}
              </Text>
            </Pressable>
          )}
        </View>
      );
    }
    default:
      return (
        <Text style={styles.instruction}>محتوایی برای این بخش تعریف نشده</Text>
      );
  }
}

//----

type ChecklistViewProps = {
  checklist: {
    id: string;
    label: string;
  }[];
  checkedItems: string[];
  onToggle: (itemId: string) => void;
};

function ChecklistView({
  checklist,
  checkedItems,
  onToggle,
}: ChecklistViewProps) {
  return (
    <View style={styles.checklistBox}>
      {checklist.map((item) => {
        const isChecked = checkedItems.includes(item.id);

        return (
          <Pressable
            key={item.id}
            style={[
              styles.checklistItem,
              isChecked ? styles.checkedChecklistItem : null,
            ]}
            onPress={() => onToggle(item.id)}
          >
            <View
              style={[
                styles.checkbox,
                isChecked ? styles.checkedCheckbox : null,
              ]}
            >
              {isChecked ? <Text style={styles.checkmark}>✓</Text> : null}
            </View>

            <Text
              style={[
                styles.checklistLabel,
                isChecked ? styles.checkedChecklistLabel : null,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  mainCard: {
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
  title: {
    fontSize: 20,
    fontWeight: "900",
    color: "#7ED957",
    textAlign: "center",
  },
  instructionSection: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  instruction: {
    fontSize: 15,
    lineHeight: 24,
    color: "#7CB8FF",
    textAlign: "center",
  },
  contentSection: {
    padding: 20,
  },
  textInput: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.05)",
    color: "#FFFFFF",
    fontSize: 16,
    textAlign: "right",
  },
  multilineInput: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  actionButton: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 15,
    backgroundColor: "#7ED957",
    alignItems: "center",
  },
  doneButton: {
    backgroundColor: "#2FBF71",
  },
  actionButtonText: {
    color: "#0B1218",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  secondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  dangerGlassButton: {
    backgroundColor: "rgba(255, 77, 79, 0.14)",
    borderColor: "rgba(255, 77, 79, 0.45)",
  },
  sleepActivatorBox: {
    gap: 7,
  },

  sleepActivatorHint: {
    color: "rgba(255,255,255,0.48)",
    fontSize: 11,
    lineHeight: 18,
    textAlign: "center",
  },
  doneOutlineButton: {
    borderColor: "#2FBF71",
    backgroundColor: "rgba(47,191,113,0.12)",
  },
  doneOutlineButtonText: {
    color: "#7ED957",
  },
  disabledButton: {
    opacity: 0.45,
  },
  disabledButtonText: {
    color: "rgba(255,255,255,0.5)",
  },
  scoreGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    justifyContent: "center",
    alignSelf: "center",
    width: 280,
    gap: 10,
  },
  scoreCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  activeScoreCircle: {
    backgroundColor: "#7ED957",
    borderColor: "#7ED957",
  },
  scoreCircleText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  activeScoreCircleText: {
    color: "#0B1218",
  },
  scaleLabelsRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  scaleLabel: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
    fontWeight: "600",
  },
  fieldList: {
    gap: 15,
  },
  fieldBox: {
    gap: 8,
  },
  fieldLabel: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
  },
  warningText: {
    color: "#FFD166",
    fontSize: 15,
    lineHeight: 24,
    textAlign: "center",
  },
  selectedAudioTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  checklistBox: {
    gap: 10,
  },
  checklistItem: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  checkedChecklistItem: {
    backgroundColor: "rgba(126,217,87,0.12)",
    borderColor: "rgba(126,217,87,0.55)",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkedCheckbox: {
    backgroundColor: "#7ED957",
    borderColor: "#7ED957",
  },
  checkmark: {
    color: "#0B1218",
    fontSize: 16,
    fontWeight: "900",
  },
  checklistLabel: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: 23,
    textAlign: "right",
  },
  checkedChecklistLabel: {
    color: "#DFFFD6",
  },
  sleepHelpContainer: {
    gap: 14,
  },
  sleepHelpSection: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  sleepHelpSectionTitle: {
    color: "#7ED957",
    fontSize: 15,
    fontWeight: "900",
    textAlign: "right",
    marginBottom: 8,
    lineHeight: 23,
  },
  sleepHelpSectionBody: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 15,
    lineHeight: 25,
    textAlign: "right",
  },
  sleepResetIntroTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
    lineHeight: 28,
  },
  sleepResetIntroBody: {
    color: "#B8C7D9",
    fontSize: 14,
    lineHeight: 24,
    textAlign: "center",
  },
  sleepResetActivities: {
    gap: 10,
  },
  sleepResetActivityCard: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 6,
  },
  sleepResetActivityCardSelected: {
    backgroundColor: "rgba(126,217,87,0.12)",
    borderColor: "rgba(126,217,87,0.55)",
  },
  sleepResetActivityLabel: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "right",
    lineHeight: 22,
  },

  sleepResetActivityLabelSelected: {
    color: "#7ED957",
  },
  sleepResetActivityHint: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 12,
    lineHeight: 20,
    textAlign: "right",
  },

  sleepResetTimerBox: {
    gap: 12,
    marginTop: 8,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  sleepResetSelectedTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 24,
  },
  sleepResetSelectedHint: {
    color: "#B8C7D9",
    fontSize: 13,
    lineHeight: 22,
    textAlign: "center",
  },
  sleepResetActivityRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 10,
  },
  sleepResetCheckBox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  sleepResetCheckBoxSelected: {
    backgroundColor: "#7ED957",
    borderColor: "#7ED957",
  },
  sleepResetCheckText: {
    color: "#07130A",
    fontSize: 16,
    fontWeight: "900",
  },
  sleepResetTimerHint: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 12,
    lineHeight: 20,
    textAlign: "center",
  },
  noContactOptionsList: {
    gap: 10,
  },
  noContactOptionCard: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 8,
  },
  noContactOptionCardSelected: {
    backgroundColor: "rgba(126,217,87,0.10)",
    borderColor: "rgba(126,217,87,0.50)",
  },
  noContactOptionCardDanger: {
    backgroundColor: "rgba(255,77,79,0.10)",
    borderColor: "rgba(255,77,79,0.45)",
  },
  noContactOptionHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  noContactRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  noContactRadioSelected: {
    borderColor: "#7ED957",
    backgroundColor: "rgba(126,217,87,0.15)",
  },
  noContactRadioDanger: {
    borderColor: "#FF4D4F",
    backgroundColor: "rgba(255,77,79,0.15)",
  },
  noContactRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FFFFFF",
  },
  noContactOptionLabel: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
    lineHeight: 23,
  },
  noContactOptionLabelSelected: {
    color: "#DFFFD6",
  },
  noContactOptionLabelDanger: {
    color: "#FFD6D6",
  },
  noContactOptionHelpText: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
    lineHeight: 21,
    textAlign: "right",
  },
  noContactEncouragementBox: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  noContactEncouragementSafeBox: {
    backgroundColor: "rgba(126,217,87,0.10)",
    borderColor: "rgba(126,217,87,0.35)",
  },
  noContactEncouragementDangerBox: {
    backgroundColor: "rgba(255,77,79,0.10)",
    borderColor: "rgba(255,77,79,0.35)",
  },
  noContactEncouragementText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 24,
    textAlign: "right",
  },
});
