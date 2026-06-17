import type { LocalTaskDraft, TaskConfig, TaskDraftValueMap } from "./types";

function hasValue(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function normalizeFaText(input: string) {
  return String(input || "")
    .replace(/\u200c/g, " ")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\s+/g, " ")
    .trim();
}

function getCommitments(config: TaskConfig<"commitment">) {
  return Array.isArray(config.meta?.commitments) ? config.meta.commitments : [];
}

export function validateTaskCompletion(
  config: TaskConfig,
  draft: LocalTaskDraft
) {
  const values: TaskDraftValueMap = draft?.values ?? {};
  const completedSteps = draft?.completedSteps ?? [];
  const rule = config.completionRule;

  switch (rule.type) {
    case "required_fields": {
      const missingFields = rule.fields.filter((field) => !hasValue(values[field]));

      return {
        valid: missingFields.length === 0,
        missingFields,
      };
    }

    case "all_steps_completed": {
      const requiredSteps =
        rule.requiredSteps ||
        (config.steps || []).filter((step) => step.required).map((step) => step.key);

      const missingSteps = requiredSteps.filter(
        (stepKey) => !completedSteps.includes(stepKey)
      );

      return {
        valid: missingSteps.length === 0,
        missingSteps,
      };
    }

    case "commitment": {
      const commitmentConfig = config as TaskConfig<"commitment">;
      const commitments = getCommitments(commitmentConfig);
      const checkedCommitmentIds = values.checkedCommitmentIds ?? [];

      let missingChecked: string[] = [];

      if (rule.requiredChecked === "all") {
        const allIds = commitments.map((commitment) => commitment.id);
        missingChecked = allIds.filter(
          (id) => !checkedCommitmentIds.includes(id)
        );
      } else {
        missingChecked = rule.requiredChecked.filter(
          (id) => !checkedCommitmentIds.includes(id)
        );
      }

      const typedConfirmations = values.typedConfirmations ?? {};

      const missingTypedConfirmations = (
        rule.requiredTypedConfirmations || []
      ).filter((item) => {
        const current = normalizeFaText(typedConfirmations[item.key] || "");
        const expected = normalizeFaText(item.exactText);
        return current !== expected;
      });

      return {
        valid:
          missingChecked.length === 0 &&
          missingTypedConfirmations.length === 0,
        missingChecked,
        missingTypedConfirmations,
      };
    }

    case "manual": {
      return { valid: true };
    }

    case "required_fields_and_steps": {
      const missingFields = rule.requiredFields.filter(
        (field) => !hasValue(values[field])
      );
      const missingSteps = rule.requiredSteps.filter(
        (stepKey) => !completedSteps.includes(stepKey)
      );

      return {
        valid: missingFields.length === 0 && missingSteps.length === 0,
        missingFields,
        missingSteps,
      };
    }

    case "selection_and_manual_or_timer": {
      const activityOk = rule.requireActivity
        ? hasValue(values.selectedActivity) || hasValue(values.customActivity)
        : true;

      const timerOk = rule.requireTimerCompletion ? !!values.timerCompleted : true;
      const manualDone = !!values.manualCompleted;

      return {
        valid: activityOk && (manualDone || timerOk),
        activityOk,
        timerOk,
        manualDone,
      };
    }

    case "quiz_pass": {
      const audioOk = rule.requireAudioCompleted ? !!values.audioCompleted : true;
      const passed = !!values.latestPassed;
      const latestScore = Number(values.latestScorePercent || 0);

      return {
        valid: audioOk && passed && latestScore >= rule.passingScorePercent,
        audioOk,
        passed,
        latestScore,
      };
    }

    case "text_or_timer": {
      const ok = rule.requireAtLeastOne.some((field) => hasValue(values[field]));

      return {
        valid: ok,
      };
    }

    default: {
      return { valid: false };
    }
  }
}
