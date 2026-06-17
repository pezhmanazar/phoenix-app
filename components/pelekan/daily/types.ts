export type TaskTemplate =
  | "mood_checkin"
  | "routine_flow"
  | "commitment"
  | "reminder"
  | "audio_reflection"
  | "mood_boost"
  | "quiz_audio"
  | "no_contact_check";

export type CompletionRule =
  | {
      type: "required_fields";
      fields: string[];
    }
  | {
      type: "all_steps_completed";
      requiredSteps?: string[];
      optionalSteps?: string[];
    }
  | {
      type: "commitment";
      requiredChecked: "all" | string[];
      requiredTypedConfirmations?: {
        key: string;
        exactText: string;
      }[];
    }
  | {
      type: "manual";
    }
  | {
      type: "required_fields_and_steps";
      requiredFields: string[];
      requiredSteps: string[];
    }
  | {
      type: "selection_and_manual_or_timer";
      requireActivity: boolean;
      requireTimerCompletion?: boolean;
    }
  | {
      type: "quiz_pass";
      passingScorePercent: number;
      requireAudioCompleted?: boolean;
    }
  | {
      type: "text_or_timer";
      requireAtLeastOne: string[];
    };

type BaseTaskStep = {
  key: string;
  title?: string;
  description?: string;
  instruction?: string;
  required?: boolean;
};

export type ChecklistItem = {
  id: string;
  label: string;
};
export type QuizQuestionOption = {
  id: string;
  text: string;
};

export type QuizQuestion = {
  id: string;
  type: "true_false" | "multiple_choice";
  prompt: string;
  options: QuizQuestionOption[];
  correctOptionId: string;
  explanation?: string;
};

export type ConditionalAudioStep = BaseTaskStep & {
  stepType: "conditional_audio";
  sourceScoreKey: string;
  sourceTaskCode?: string;
  variants: {
    min: number;
    max: number;
    audioKey: string;
    title?: string;
  }[];
};

export type TimerAudioStep = BaseTaskStep & {
  stepType: "timer_audio";
  audioKey: string;
  durationSeconds?: number;
};

export type TextInputStep = BaseTaskStep & {
  stepType: "text_input";
  placeholder?: string;
  multiline?: boolean;
};

export type ManualActionStep = BaseTaskStep & {
  stepType: "manual_action";
};

export type NavigationCtaStep = BaseTaskStep & {
  stepType: "navigation_cta";
  route: string;
  buttonLabel?: string;
};

export type MoodScaleStep = BaseTaskStep & {
  stepType: "mood_scale";
  min?: number;
  max?: number;
  minLabel?: string;
  maxLabel?: string;
};

export type MultiTextInputStep = BaseTaskStep & {
  stepType: "multi_text_input";
  fields: {
    key: string;
    label: string;
    placeholder?: string;
    required?: boolean;
  }[];
};

export type MultiTextWithScoreStep = BaseTaskStep & {
  stepType: "multi_text_with_score";
  fields: {
    key: string;
    label: string;
    placeholder?: string;
    required?: boolean;
    multiline?: boolean;
  }[];
  scoreField: {
    key: string;
    label: string;
    min: number;
    max: number;
  };
};

export type RepeatableTextListStep = BaseTaskStep & {
  stepType: "repeatable_text_list";
  itemLabel?: string;
  minItems?: number;
  maxItems?: number;
};

export type AudioThenTextListStep = BaseTaskStep & {
  stepType: "audio_then_text_list";
  audioKey: string;
  minItems?: number;
  maxItems?: number;
};

export type AudioStep = BaseTaskStep & {
  stepType: "audio";
  audioKey: string;
};

export type SleepAudioStep = BaseTaskStep & {
  stepType: "sleep_audio";
  audioKey: string;
  ctaLabel?: string;
  fallbackStepKey?: string;
  manualCompleteLabel?: string;
};

export type SleepHelpStep = BaseTaskStep & {
  stepType: "sleep_help";
  sections: {
    title?: string;
    body: string;
  }[];
  backStepKey?: string;
  backButtonLabel?: string;
};

export type AudioWithTextInputStep = BaseTaskStep & {
  stepType: "audio_with_text";
  audioKey: string;
  textField: {
    key: string;
    label?: string;
    placeholder?: string;
    multiline?: boolean;
  };
};

export type SleepResetStep = BaseTaskStep & {
  stepType: "sleep_reset";
  introTitle?: string;
  introBody?: string;
  activities: {
    id: string;
    label: string;
    durationSeconds: number;
    hint?: string;
  }[];
  backStepKey?: string;
  backButtonLabel?: string;
};

export type ChecklistTextStep = BaseTaskStep & {
  stepType: "checklist_text";
  checklist: ChecklistItem[];
  placeholder?: string;
  multiline?: boolean;
};

export type InfoChecklistActionStep = BaseTaskStep & {
  stepType: "info_checklist_action";
  checklist: ChecklistItem[];
  doneButtonLabel?: string;
  undoButtonLabel?: string;
};

export type InfoNavigationActionStep = BaseTaskStep & {
  stepType: "info_navigation_action";
  route: string;
  ctaLabel?: string;
  doneButtonLabel?: string;
  undoButtonLabel?: string;
  requireNavigationBeforeComplete?: boolean;
  checklist?: {
    id: string;
    label: string;
  }[];
};

export type NoContactEventType = "none" | "role_based" | "emotional";
export type NoContactOption = {
  key: NoContactEventType;
  label: string;
  helpText?: string;
};

export type NoContactNoteField = {
  key: string;
  label?: string;
  placeholder?: string;
  multiline?: boolean;
  required?: boolean;
};

export type NoContactEncouragements = {
  safe?: string;
  roleBased?: string;
  relapse?: string;
};

export type NoContactFlowStatus = "no_contact" | "necessary_contact" | "emotional_contact";

export type NoContactFlowStep = {
  key: "status" | "questions" | "guidance" | "final";
  label: string;
  hint?: string;
};

export type NoContactQuestionOption = {
  value: string;
  label: string;
};

export type NoContactQuestionShowIf = {
  questionId: string;
  equals: string;
};

export type NoContactQuestion = {
  id: string;
  type: "single_select" | "multi_select" | "text";
  title: string;
  required?: boolean;
  placeholder?: string;
  options?: NoContactQuestionOption[];
  showIf?: NoContactQuestionShowIf;
};


export type NoContactQuestionsByStatus = Partial<
  Record<NoContactFlowStatus, NoContactQuestion[]>
>;

export type NoContactGuidanceContent = {
  message: string;
  streakText?: string;
  commitments: string[];
  closingNote?: string;
};

export type NoContactEmotionalGuidance = {
  useBackendResult?: boolean;
  fallback: NoContactGuidanceContent;
  promise_required?: NoContactGuidanceContent;
  serious_warning?: NoContactGuidanceContent;
  reset?: NoContactGuidanceContent;
};

export type NoContactGuidanceByStatus = {
  no_contact?: NoContactGuidanceContent;
  necessary_contact?: NoContactGuidanceContent;
  emotional_contact?: NoContactEmotionalGuidance;
};

export type NoContactFinalStep = {
  message: string;
  commitments: string[];
  submitLabel?: string;
};


export type NoContactCheckStep = BaseTaskStep & {
  stepType: "no_contact_check";
  options: NoContactOption[];
  noteField?: NoContactNoteField;
  encouragements?: NoContactEncouragements;
};


export type TaskStep =
  | ConditionalAudioStep
  | TimerAudioStep
  | TextInputStep
  | ManualActionStep
  | NavigationCtaStep
  | MoodScaleStep
  | MultiTextInputStep
  | MultiTextWithScoreStep
  | RepeatableTextListStep
  | AudioThenTextListStep
  | AudioStep
  | SleepAudioStep
  | SleepHelpStep
  | SleepResetStep
  | AudioWithTextInputStep
  | ChecklistTextStep
  | InfoChecklistActionStep
  | InfoNavigationActionStep
  | NoContactCheckStep;

export type TaskMetaMap = {
  mood_checkin: {
    submitLabel?: string;
  };
  routine_flow: {
    submitLabel?: string;
  };
  commitment: {
    commitments?: {
      id: string;
      text: string;
    }[];
    confirmText?: string;
    submitLabel?: string;
  };
  reminder: {
    submitLabel?: string;
  };
  audio_reflection: {
    audioKey?: string;
    submitLabel?: string;
  };
  mood_boost: {
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
};
    quiz_audio: {
    audioKey?: string;
    audioProgressStorageKey?: string;
    submitLabel?: string;
    lessonTitle?: string;
    questions: QuizQuestion[];
    passingScorePercent?: number;
    requireAudioCompleted?: boolean;
  };
  no_contact_check: {
  submitLabel?: string;
  steps?: NoContactFlowStep[];
  options: NoContactOption[];
  questionsByStatus?: NoContactQuestionsByStatus;
  guidanceByStatus?: NoContactGuidanceByStatus;
  finalStep?: NoContactFinalStep;
  noteField?: NoContactNoteField;
  encouragements?: NoContactEncouragements;
};

};

export type TaskConfig<TTemplate extends TaskTemplate = TaskTemplate> = {
  code: string;
  titleFa: string;
  descriptionFa?: string;
  template: TTemplate;
  required: boolean;
  variant?: "morning" | "night";
  completionRule: CompletionRule;
  steps?: TaskStep[];
  meta?: TaskMetaMap[TTemplate];
};

export type DayConfig = {
  dayCode: string;
  stageCode: string;
  dayNumber: number;
  titleFa: string;
  requiredTaskCodes: string[];
  tasks: TaskConfig[];
};

export type TaskDraftValueMap = Record<string, unknown> & {
  checkedCommitmentIds?: string[];
  typedConfirmations?: Record<string, string>;
  selectedActivity?: string;
  customActivity?: string;
  timerCompleted?: boolean;
  manualCompleted?: boolean;
  audioCompleted?: boolean;
  latestPassed?: boolean;
  latestScorePercent?: number | string;
};


export type LocalTaskDraft = {
  dayCode: string;
  taskCode: string;
  version: number;
  updatedAt: string;
  values: TaskDraftValueMap;
  completedSteps?: string[];
};

export type BackendNoContactStreak = {
  currentDays: number;
  bestDays: number;
  warningState: string;
  violationCount: number;
  resetCount: number;
};


export type BackendDayTask = {
  id: string;
  code: string;
  titleFa: string;
  description?: string | null;
  suggestedTimeFa?: string | null;
  sortOrder?: number;
  isRequired: boolean;
  weightPercent?: number | null;
  xpReward?: number | null;
  isDone: boolean;
  doneAt?: string | null;
  noContactStreak?: BackendNoContactStreak | null;
};

export type ResolvedTask<TTemplate extends TaskTemplate = TaskTemplate> = {
  config: TaskConfig<TTemplate>;
  backendTask?: BackendDayTask | null;
  effectiveTitleFa: string;
  effectiveDescription?: string | null;
  effectiveRequired: boolean;
  isCompleted: boolean;
};

export function isTaskOfTemplate<T extends TaskTemplate>(
  task: ResolvedTask,
  template: T
): task is ResolvedTask<T> {
  return task.config.template === template;
}

export type TaskStepValue = {
  completed?: boolean;
  text?: string;
  score?: number;
  fields?: Record<string, string>;
  items?: string[];
  audioCompleted?: boolean;
  timerCompleted?: boolean;
  selectedAudioKey?: string;
  checkedItems?: string[];
  navigated?: boolean;
  scoreFieldKey?: string;
  textFieldKey?: string;
  manualCompleted?: boolean;
  openedFallback?: boolean;
  deviceDate?: string;
  selectedActivityId?: string;
  selectedActivityLabel?: string;
  selectedDurationSeconds?: number;
  sleepResetPhase?: "intro" | "select" | "timer";
  noContactEventType?: NoContactEventType;
  noContactNote?: string;
};

export type RoutineFlowDraftValues = {
  currentStepIndex?: number;
  completed?: boolean;
  steps?: Record<string, TaskStepValue>;
};
